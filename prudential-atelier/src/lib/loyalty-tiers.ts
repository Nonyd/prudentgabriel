import type { LoyaltyTier } from "@prisma/client";
import { OrderStatus, PaymentMethod, PaymentPurpose, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { TIER_LABELS, TIER_ORDER } from "@/lib/loyalty";
import { resolveClientIdentifiers } from "@/lib/payments/ledger";

/**
 * Prudent Points tiers follow naira paid, per Lagos calendar year.
 *
 * A client's tier is the higher of what they qualify for with this year's
 * payments and with last year's. So a tier reached in 2026 holds until
 * 31 December 2027, and a client who stops buying drops on 1 January after
 * that. Points held or spent never move a tier.
 *
 * Counted: every confirmed payment (shop orders, atelier commissions,
 * invoices, consultations) except points, less refunds recorded on shop orders.
 */

export type TierConfig = { tier: LoyaltyTier; minSpendNGN: number; pointsPer100: number };
export type TierPerk = { id: string; label: string; tiers: LoyaltyTier[]; sortOrder: number };

export const DEFAULT_TIER_CONFIGS: TierConfig[] = [
  { tier: "BRONZE", minSpendNGN: 0, pointsPer100: 3 },
  { tier: "SILVER", minSpendNGN: 10_000_000, pointsPer100: 3 },
  { tier: "GOLD", minSpendNGN: 20_000_000, pointsPer100: 3 },
  { tier: "PLATINUM", minSpendNGN: 30_000_000, pointsPer100: 3 },
];

const LAGOS_UTC_OFFSET_HOURS = 1; // West Africa Time, no daylight saving.

export function lagosYear(at: Date): number {
  return new Date(at.getTime() + LAGOS_UTC_OFFSET_HOURS * 3_600_000).getUTCFullYear();
}

/** Midnight on 1 January in Lagos, as a UTC instant. */
export function lagosYearStart(year: number): Date {
  return new Date(Date.UTC(year, 0, 1, -LAGOS_UTC_OFFSET_HOURS));
}

export async function getTierConfigs(): Promise<TierConfig[]> {
  const rows = await prisma.loyaltyTierConfig.findMany();
  const byTier = new Map(rows.map((r) => [r.tier, r]));
  return TIER_ORDER.map((tier) => {
    const row = byTier.get(tier);
    const fallback = DEFAULT_TIER_CONFIGS.find((c) => c.tier === tier)!;
    return {
      tier,
      minSpendNGN: tier === "BRONZE" ? 0 : (row?.minSpendNGN ?? fallback.minSpendNGN),
      pointsPer100: row?.pointsPer100 ?? fallback.pointsPer100,
    };
  });
}

export async function getTierPerks(): Promise<TierPerk[]> {
  const rows = await prisma.loyaltyPerk.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  return rows.map((r) => ({ id: r.id, label: r.label, tiers: r.tiers, sortOrder: r.sortOrder }));
}

/** Perks for one tier, led by the points rate the website applies itself. */
export function perksForTier(tier: LoyaltyTier, configs: TierConfig[], perks: TierPerk[]): string[] {
  const rate = configs.find((c) => c.tier === tier)?.pointsPer100 ?? 0;
  const lines = rate > 0 ? [`${rate}% back in points on ready-to-wear`] : [];
  return [...lines, ...perks.filter((p) => p.tiers.includes(tier)).map((p) => p.label)];
}

export function tierForSpend(spendNGN: number, configs: TierConfig[]): LoyaltyTier {
  let best: LoyaltyTier = "BRONZE";
  for (const c of configs) {
    if (c.tier !== "BRONZE" && spendNGN >= c.minSpendNGN) best = c.tier;
  }
  return best;
}

function higherTier(a: LoyaltyTier, b: LoyaltyTier): LoyaltyTier {
  return TIER_ORDER.indexOf(a) >= TIER_ORDER.indexOf(b) ? a : b;
}

export async function clientSpendByYear(userId: string, now = new Date()): Promise<{ thisYear: number; lastYear: number }> {
  const year = lagosYear(now);
  const from = lagosYearStart(year - 1);
  const clientIds = await resolveClientIdentifiers({ userId });
  if (clientIds.length === 0) return { thisYear: 0, lastYear: 0 };

  const [payments, refunds] = await Promise.all([
    prisma.payment.findMany({
      where: {
        clientId: { in: clientIds },
        status: PaymentStatus.CONFIRMED,
        method: { not: PaymentMethod.POINTS },
        purpose: { not: PaymentPurpose.POINTS_REDEMPTION },
        amount: { gt: 0 },
        OR: [{ confirmedAt: { gte: from } }, { confirmedAt: null, createdAt: { gte: from } }],
      },
      select: { amount: true, confirmedAt: true, createdAt: true, order: { select: { status: true } } },
    }),
    prisma.order.findMany({
      where: { userId, refundRecordedAt: { gte: from }, refundRecordedAmountNGN: { gt: 0 } },
      select: { refundRecordedAt: true, refundRecordedAmountNGN: true, status: true },
    }),
  ]);

  const totals = { thisYear: 0, lastYear: 0 };
  const add = (at: Date, naira: number) => {
    if (lagosYear(at) === year) totals.thisYear += naira;
    else if (lagosYear(at) === year - 1) totals.lastYear += naira;
  };
  for (const p of payments) {
    // A cancelled or fully refunded shop order does not count at all.
    if (p.order && (p.order.status === OrderStatus.REFUNDED || p.order.status === OrderStatus.CANCELLED)) continue;
    add(p.confirmedAt ?? p.createdAt, Number(p.amount));
  }
  for (const r of refunds) {
    if (r.status === OrderStatus.REFUNDED || r.status === OrderStatus.CANCELLED) continue;
    if (r.refundRecordedAt) add(r.refundRecordedAt, -(r.refundRecordedAmountNGN ?? 0));
  }
  totals.thisYear = Math.max(0, Math.round(totals.thisYear));
  totals.lastYear = Math.max(0, Math.round(totals.lastYear));
  return totals;
}

export type ClientTierStatus = {
  tier: LoyaltyTier;
  tierLabel: string;
  spendThisYear: number;
  spendLastYear: number;
  nextTier: LoyaltyTier | null;
  nextTierLabel: string | null;
  /** Naira still to pay this year to reach the next tier. */
  spendToNext: number;
  progressPercent: number;
  /** Last day the current tier is guaranteed, e.g. "31 December 2027". Null for Bronze. */
  heldUntil: string | null;
  pointsPer100: number;
  perks: string[];
};

export async function getClientTierStatus(
  userId: string,
  opts: { configs?: TierConfig[]; perks?: TierPerk[]; now?: Date } = {},
): Promise<ClientTierStatus> {
  const now = opts.now ?? new Date();
  const [configs, perks, spend] = await Promise.all([
    opts.configs ?? getTierConfigs(),
    opts.perks ?? getTierPerks(),
    clientSpendByYear(userId, now),
  ]);
  const fromThisYear = tierForSpend(spend.thisYear, configs);
  const fromLastYear = tierForSpend(spend.lastYear, configs);
  const tier = higherTier(fromThisYear, fromLastYear);

  const idx = TIER_ORDER.indexOf(tier);
  const next = idx < TIER_ORDER.length - 1 ? TIER_ORDER[idx + 1]! : null;
  const nextMin = next ? configs.find((c) => c.tier === next)!.minSpendNGN : 0;
  const year = lagosYear(now);
  const heldYear = tier === "BRONZE" ? null : fromThisYear === tier ? year + 1 : year;

  return {
    tier,
    tierLabel: TIER_LABELS[tier],
    spendThisYear: spend.thisYear,
    spendLastYear: spend.lastYear,
    nextTier: next,
    nextTierLabel: next ? TIER_LABELS[next] : null,
    spendToNext: next ? Math.max(0, nextMin - spend.thisYear) : 0,
    progressPercent: next && nextMin > 0 ? Math.min(100, Math.round((spend.thisYear / nextMin) * 100)) : 100,
    heldUntil: heldYear ? `31 December ${heldYear}` : null,
    pointsPer100: configs.find((c) => c.tier === tier)!.pointsPer100,
    perks: perksForTier(tier, configs, perks),
  };
}

/** Points per ₦100 a client earns on a shop order right now. */
export async function shopPointsPer100(userId: string): Promise<number> {
  const status = await getClientTierStatus(userId);
  return status.pointsPer100;
}

/**
 * Store the tier the client qualifies for. Announces only a move up, and only
 * when asked: bulk recalculations and the yearly drop are silent.
 */
export async function syncClientTier(
  userId: string,
  opts: { announce?: boolean; configs?: TierConfig[]; perks?: TierPerk[] } = {},
): Promise<{ from: LoyaltyTier; to: LoyaltyTier } | null> {
  const profile = await prisma.clientProfile.findUnique({ where: { userId }, select: { id: true, loyaltyTier: true } });
  if (!profile) return null;
  const status = await getClientTierStatus(userId, opts);
  if (status.tier === profile.loyaltyTier) return null;

  await prisma.clientProfile.update({ where: { id: profile.id }, data: { loyaltyTier: status.tier } });
  const up = TIER_ORDER.indexOf(status.tier) > TIER_ORDER.indexOf(profile.loyaltyTier);
  if (up && opts.announce) await announceTierUpgrade(userId, status.tier, status.perks);
  return { from: profile.loyaltyTier, to: status.tier };
}

export async function recomputeAllClientTiers(): Promise<{ checked: number; changed: { userId: string; from: LoyaltyTier; to: LoyaltyTier }[] }> {
  const [configs, perks, profiles] = await Promise.all([
    getTierConfigs(),
    getTierPerks(),
    prisma.clientProfile.findMany({ select: { userId: true } }),
  ]);
  const changed: { userId: string; from: LoyaltyTier; to: LoyaltyTier }[] = [];
  for (const p of profiles) {
    const move = await syncClientTier(p.userId, { configs, perks });
    if (move) changed.push({ userId: p.userId, ...move });
  }
  return { checked: profiles.length, changed };
}

async function announceTierUpgrade(userId: string, tier: LoyaltyTier, perks: string[]): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
  if (!user?.email) return;
  const firstName = user.name?.split(" ")[0] ?? "there";
  const [{ sendLoyaltyTierUpgradeEmail }, { createClientNotification }] = await Promise.all([
    import("@/lib/email"),
    import("@/lib/customer-notifications"),
  ]);
  void sendLoyaltyTierUpgradeEmail({ to: user.email, firstName, newTier: tier, perks }).catch((e) =>
    console.warn("[loyalty] tier email", e),
  );
  void createClientNotification({
    userId,
    type: "LOYALTY_TIER_UPGRADE",
    title: `You've reached ${TIER_LABELS[tier]} status!`,
    message: `Congratulations — you are now a ${TIER_LABELS[tier]} member.`,
    link: "/account/loyalty",
  }).catch((e) => console.warn("[loyalty] tier notification", e));
}

async function userIdForClientId(clientId: string): Promise<string | null> {
  if (clientId.startsWith("email:")) {
    const user = await prisma.user.findUnique({ where: { email: clientId.slice(6) }, select: { id: true } });
    return user?.id ?? null;
  }
  const user = await prisma.user.findUnique({ where: { id: clientId }, select: { id: true } });
  return user?.id ?? null;
}

/**
 * Called after a ledger row is confirmed or rejected. Atelier payments
 * (commissions and their invoices) earn the flat atelier rate; then the
 * client's tier is brought up to date.
 */
export async function onLedgerPaymentChanged(paymentId: string): Promise<void> {
  const p = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      amount: true,
      status: true,
      method: true,
      clientId: true,
      orderId: true,
      bespokeOrderId: true,
      invoiceId: true,
      consultationId: true,
    },
  });
  if (!p) return;
  const userId = await userIdForClientId(p.clientId);
  if (!userId) return;

  const atelier = Boolean(p.bespokeOrderId || p.invoiceId) && !p.orderId && !p.consultationId;
  if (atelier && p.method !== PaymentMethod.POINTS) {
    const { awardAtelierPaymentPoints, reverseAtelierPaymentPoints } = await import("@/lib/points");
    if (p.status === PaymentStatus.CONFIRMED) await awardAtelierPaymentPoints(userId, Number(p.amount), p.id);
    if (p.status === PaymentStatus.REJECTED) await reverseAtelierPaymentPoints(userId, p.id);
  }
  await syncClientTier(userId, { announce: true });
}
