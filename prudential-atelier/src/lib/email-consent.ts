import { EmailStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPublicAppUrl } from "@/lib/app-url";
import { UNSUBSCRIBE_URL_PLACEHOLDER } from "@/lib/email-priority";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function ensureEmailPreference(email: string) {
  const e = normalizeEmail(email);
  const existing = await prisma.emailPreference.findUnique({ where: { email: e } });
  if (existing) return existing;
  try {
    return await prisma.emailPreference.create({ data: { email: e } });
  } catch {
    const again = await prisma.emailPreference.findUnique({ where: { email: e } });
    if (!again) throw new Error("Could not create email preference");
    return again;
  }
}

export function unsubscribeUrlForToken(token: string): string {
  return `${getPublicAppUrl()}/unsubscribe/${encodeURIComponent(token)}`;
}

export function listUnsubscribeApiUrl(token: string): string {
  return `${getPublicAppUrl()}/api/unsubscribe/${encodeURIComponent(token)}`;
}

export function listUnsubscribeHeaders(url: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${url}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

export async function applyMarketingUnsubscribe(
  html: string,
  token: string,
): Promise<{ html: string; headers: Record<string, string>; url: string }> {
  const pageUrl = unsubscribeUrlForToken(token);
  const apiUrl = listUnsubscribeApiUrl(token);
  return {
    html: html.split(UNSUBSCRIBE_URL_PLACEHOLDER).join(pageUrl),
    headers: listUnsubscribeHeaders(apiUrl),
    url: pageUrl,
  };
}

export async function unsubscribeByToken(token: string): Promise<{ email: string; already: boolean } | null> {
  const pref = await prisma.emailPreference.findUnique({ where: { unsubscribeToken: token } });
  if (!pref) return null;
  const now = new Date();
  const already = Boolean(pref.unsubscribedAt);
  if (!already) {
    await prisma.emailPreference.update({
      where: { id: pref.id },
      data: { unsubscribedAt: now },
    });
  }
  await prisma.newsletterSubscriber.updateMany({
    where: { email: pref.email },
    data: { unsubscribedAt: pref.unsubscribedAt ?? now },
  });
  return { email: pref.email, already };
}

export function lastErrorLooksLikeBounce(err: string | null | undefined): boolean {
  if (!err) return false;
  const m = err.toLowerCase();
  if (m.includes("no provider")) return false;
  if (m.includes("circuit open")) return false;
  if (m.includes("not configured")) return false;
  return /bounce|invalid recipient|user unknown|mailbox|suppressed|550 |5\.1\.1|does not exist|undeliverable/.test(
    m,
  );
}

export async function recordEmailBounce(to: string, reason: string): Promise<void> {
  const pref = await ensureEmailPreference(to);
  if (pref.bounceAt) return;
  await prisma.emailPreference.update({
    where: { id: pref.id },
    data: { bounceAt: new Date(), bounceReason: reason.slice(0, 500) },
  });
}

export async function suppressedEmailSet(emails: string[]): Promise<Set<string>> {
  const list = Array.from(new Set(emails.map(normalizeEmail).filter((e) => e.includes("@"))));
  if (list.length === 0) return new Set();

  const [prefs, news, dead] = await Promise.all([
    prisma.emailPreference.findMany({
      where: {
        email: { in: list },
        OR: [{ unsubscribedAt: { not: null } }, { bounceAt: { not: null } }],
      },
      select: { email: true },
    }),
    prisma.newsletterSubscriber.findMany({
      where: { email: { in: list }, unsubscribedAt: { not: null } },
      select: { email: true },
    }),
    prisma.emailMessage.findMany({
      where: { to: { in: list }, status: EmailStatus.DEAD },
      select: { to: true, lastError: true },
    }),
  ]);

  const out = new Set<string>();
  for (const p of prefs) out.add(p.email);
  for (const n of news) out.add(n.email);
  for (const d of dead) {
    if (lastErrorLooksLikeBounce(d.lastError)) out.add(normalizeEmail(d.to));
  }
  return out;
}
