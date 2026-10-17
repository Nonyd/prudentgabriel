import type { LoyaltyTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { renderBrandedEmail, sendEmail } from "@/lib/email";
import { TIER_LABELS, TIER_ORDER } from "@/lib/loyalty";
import { getClientTierStatus, getTierConfigs, getTierPerks } from "@/lib/loyalty-tiers";
import LoyaltyTierCorrectionEmail from "@/emails/LoyaltyTierCorrectionEmail";

/**
 * The one-time correction for clients told they had reached a tier under the
 * old points-balance rules. Only clients whose real tier is lower than what
 * they were told get it, and each client at most once (LoyaltyCorrectionNotice).
 */

export const CORRECTION_SUBJECT = "A correction about your Prudent Points tier";
export const DEFAULT_CORRECTION_NOTE =
  "As a thank-you for your patience, we would like to offer you one complimentary consultation with our team. Simply reply to this email and we will arrange it.";

export type CorrectionRecipient = {
  userId: string;
  name: string;
  firstName: string;
  email: string;
  announcedTier: LoyaltyTier;
  announcedOn: string;
  correctTier: LoyaltyTier;
  sentAt: string | null;
};

function tierFromTitle(title: string): LoyaltyTier | null {
  for (const t of [...TIER_ORDER].reverse()) {
    if (title.includes(TIER_LABELS[t])) return t;
  }
  return null;
}

function dateLabel(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });
}

export async function listCorrectionRecipients(): Promise<CorrectionRecipient[]> {
  const [notices, sent, configs, perks] = await Promise.all([
    prisma.customerNotification.findMany({
      where: { type: "LOYALTY_TIER_UPGRADE", user: { role: "CUSTOMER" } },
      orderBy: { createdAt: "asc" },
      select: { userId: true, title: true, createdAt: true, user: { select: { name: true, email: true } } },
    }),
    prisma.loyaltyCorrectionNotice.findMany(),
    getTierConfigs(),
    getTierPerks(),
  ]);
  const sentBy = new Map(sent.map((s) => [s.userId, s]));

  // Highest tier each client was told about, and when they were first told it.
  const told = new Map<string, { tier: LoyaltyTier; at: Date; name: string; email: string }>();
  for (const n of notices) {
    const tier = tierFromTitle(n.title);
    if (!tier || !n.user.email) continue;
    const cur = told.get(n.userId);
    if (!cur || TIER_ORDER.indexOf(tier) > TIER_ORDER.indexOf(cur.tier)) {
      told.set(n.userId, { tier, at: n.createdAt, name: n.user.name ?? "", email: n.user.email });
    }
  }

  const out: CorrectionRecipient[] = [];
  for (const [userId, t] of Array.from(told.entries())) {
    const done = sentBy.get(userId);
    const correctTier = done?.correctTier ?? (await getClientTierStatus(userId, { configs, perks })).tier;
    if (!done && TIER_ORDER.indexOf(correctTier) >= TIER_ORDER.indexOf(t.tier)) continue;
    out.push({
      userId,
      name: t.name,
      firstName: t.name.trim().split(/\s+/)[0] || "there",
      email: t.email,
      announcedTier: done?.previousTier ?? t.tier,
      announcedOn: dateLabel(t.at),
      correctTier,
      sentAt: done?.sentAt.toISOString() ?? null,
    });
  }
  return out;
}

export async function renderCorrectionEmail(r: CorrectionRecipient, note: string | null): Promise<string> {
  return renderBrandedEmail(
    <LoyaltyTierCorrectionEmail
      firstName={r.firstName}
      announcedTier={r.announcedTier}
      announcedOn={r.announcedOn}
      correctTier={r.correctTier}
      note={note}
    />,
  );
}

/** Sends to every listed client not yet sent to. Returns how many went out. */
export async function sendCorrections(params: { note: string | null; sentById: string }): Promise<{ sent: number; skipped: number }> {
  const recipients = (await listCorrectionRecipients()).filter((r) => !r.sentAt);
  let sent = 0;
  let skipped = 0;
  for (const r of recipients) {
    // Claim the row first: the unique userId makes a double click or a second tab a no-op.
    try {
      await prisma.loyaltyCorrectionNotice.create({
        data: {
          userId: r.userId,
          email: r.email,
          previousTier: r.announcedTier,
          correctTier: r.correctTier,
          note: params.note?.trim() || null,
          sentById: params.sentById,
        },
      });
    } catch {
      skipped += 1;
      continue;
    }
    const html = await renderCorrectionEmail(r, params.note);
    await sendEmail({
      to: r.email,
      subject: CORRECTION_SUBJECT,
      html,
      template: "loyalty-tier-correction",
      idempotencyKey: `loyalty-tier-correction:${r.userId}`,
      relatedType: "User",
      relatedId: r.userId,
    });
    await prisma.clientProfile.updateMany({ where: { userId: r.userId }, data: { loyaltyTier: r.correctTier } });
    sent += 1;
  }
  return { sent, skipped };
}
