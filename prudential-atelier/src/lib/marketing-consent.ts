/**
 * Marketing email is opt-in only (NDPA 2023 / GDPR, decided October 2026).
 *
 * A person has opted in when EITHER her account carries `marketingConsentAt`
 * OR her address is an active (not unsubscribed) newsletter subscriber. Opting
 * out clears the account consent and writes the unsubscribe to the suppression
 * ledger (EmailPreference + NewsletterSubscriber), which every marketing send
 * already honours (email-consent.ts → suppressedEmailSet).
 *
 * Behaviour-triggered reminders (abandoned bag/checkout, points expiry,
 * uncollected pickup) are not campaign audiences: they go through queueEmail,
 * which treats them as marketing templates and so carries one-click unsubscribe
 * and honours suppression. They are not gated on opt-in here.
 */

import { prisma } from "@/lib/prisma";
import { ensureEmailPreference, normalizeEmail } from "@/lib/email-consent";
import type { MarketingConsentSource } from "@/lib/marketing-consent-copy";

export {
  MARKETING_CONSENT_LABEL,
  CONSENT_GATED_SOURCES,
  isConsentGatedSource,
  keepConsented,
  type MarketingConsentSource,
} from "@/lib/marketing-consent-copy";

/** Of these addresses, the ones that opted in (account consent or active newsletter subscriber). */
export async function consentedEmailSet(emails: string[]): Promise<Set<string>> {
  const list = Array.from(new Set(emails.map(normalizeEmail).filter((e) => e.includes("@"))));
  if (list.length === 0) return new Set();
  const out = new Set<string>();
  const CHUNK = 5000;
  for (let i = 0; i < list.length; i += CHUNK) {
    const slice = list.slice(i, i + CHUNK);
    const [users, subs] = await Promise.all([
      prisma.user.findMany({
        where: { email: { in: slice, mode: "insensitive" }, marketingConsentAt: { not: null } },
        select: { email: true },
      }),
      prisma.newsletterSubscriber.findMany({
        where: { email: { in: slice, mode: "insensitive" }, unsubscribedAt: null },
        select: { email: true },
      }),
    ]);
    for (const u of users) out.add(normalizeEmail(u.email));
    for (const s of subs) out.add(normalizeEmail(s.email));
  }
  return out;
}

export type MarketingConsentState = {
  optedIn: boolean;
  consentAt: string | null;
  source: string | null;
};

/** What the account settings toggle shows: what she will actually receive. */
export async function getMarketingConsentState(userId: string): Promise<MarketingConsentState> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, marketingConsentAt: true, marketingConsentSource: true },
  });
  if (!user) return { optedIn: false, consentAt: null, source: null };
  const email = normalizeEmail(user.email);
  const [sub, pref] = await Promise.all([
    prisma.newsletterSubscriber.findUnique({
      where: { email },
      select: { unsubscribedAt: true, consentAt: true, createdAt: true, consentSource: true },
    }),
    prisma.emailPreference.findUnique({ where: { email }, select: { unsubscribedAt: true } }),
  ]);
  if (pref?.unsubscribedAt) return { optedIn: false, consentAt: null, source: null };
  if (user.marketingConsentAt) {
    return {
      optedIn: true,
      consentAt: user.marketingConsentAt.toISOString(),
      source: user.marketingConsentSource,
    };
  }
  if (sub && !sub.unsubscribedAt) {
    return {
      optedIn: true,
      consentAt: (sub.consentAt ?? sub.createdAt).toISOString(),
      source: sub.consentSource ?? "newsletter",
    };
  }
  return { optedIn: false, consentAt: null, source: null };
}

/**
 * She opts in from her account. An unsubscribe already on her address is lifted
 * only when she has proven she owns it, so nobody can re-subscribe a stranger's
 * inbox by registering with it.
 */
export async function grantMarketingConsent(params: {
  userId: string;
  source: MarketingConsentSource;
  emailProven: boolean;
}): Promise<void> {
  const now = new Date();
  const user = await prisma.user.update({
    where: { id: params.userId },
    data: { marketingConsentAt: now, marketingConsentSource: params.source },
    select: { email: true },
  });
  if (!params.emailProven) return;
  const email = normalizeEmail(user.email);
  await prisma.emailPreference.updateMany({
    where: { email, unsubscribedAt: { not: null } },
    data: { unsubscribedAt: null },
  });
  await prisma.newsletterSubscriber.updateMany({
    where: { email, unsubscribedAt: { not: null } },
    data: { unsubscribedAt: null, consentAt: now, consentSource: params.source },
  });
}

/** She opts out: consent cleared, address suppressed for marketing (the existing ledger). */
export async function withdrawMarketingConsent(userId: string): Promise<void> {
  const now = new Date();
  const user = await prisma.user.update({
    where: { id: userId },
    data: { marketingConsentAt: null, marketingConsentSource: null },
    select: { email: true },
  });
  const email = normalizeEmail(user.email);
  const pref = await ensureEmailPreference(email);
  if (!pref.unsubscribedAt) {
    await prisma.emailPreference.update({ where: { id: pref.id }, data: { unsubscribedAt: now } });
  }
  await prisma.newsletterSubscriber.updateMany({
    where: { email, unsubscribedAt: null },
    data: { unsubscribedAt: now },
  });
}
