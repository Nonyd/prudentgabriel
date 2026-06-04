import type { LoyaltyTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type TierThresholds = {
  bronze: number;
  silver: number;
  gold: number;
  platinum: number;
};

const DEFAULT_THRESHOLDS: TierThresholds = {
  bronze: 0,
  silver: 2000,
  gold: 5000,
  platinum: 10000,
};

export async function getTierThresholds(): Promise<TierThresholds> {
  const keys = [
    "loyalty_threshold_bronze",
    "loyalty_threshold_silver",
    "loyalty_threshold_gold",
    "loyalty_threshold_platinum",
  ] as const;

  const settings = await prisma.siteSetting.findMany({
    where: { key: { in: [...keys] } },
  });

  const map = Object.fromEntries(settings.map((s) => [s.key, Number(s.value)]));
  return {
    bronze: map.loyalty_threshold_bronze ?? DEFAULT_THRESHOLDS.bronze,
    silver: map.loyalty_threshold_silver ?? DEFAULT_THRESHOLDS.silver,
    gold: map.loyalty_threshold_gold ?? DEFAULT_THRESHOLDS.gold,
    platinum: map.loyalty_threshold_platinum ?? DEFAULT_THRESHOLDS.platinum,
  };
}

export function tierFromPoints(points: number, thresholds: TierThresholds): LoyaltyTier {
  if (points >= thresholds.platinum) return "PLATINUM";
  if (points >= thresholds.gold) return "GOLD";
  if (points >= thresholds.silver) return "SILVER";
  return "BRONZE";
}

export function nextTier(current: LoyaltyTier): LoyaltyTier | null {
  const order: LoyaltyTier[] = ["BRONZE", "SILVER", "GOLD", "PLATINUM"];
  const idx = order.indexOf(current);
  return idx < order.length - 1 ? order[idx + 1]! : null;
}

export function pointsToNextTier(
  points: number,
  tier: LoyaltyTier,
  thresholds: TierThresholds,
): number {
  const next = nextTier(tier);
  if (!next) return 0;
  const target =
    next === "SILVER"
      ? thresholds.silver
      : next === "GOLD"
        ? thresholds.gold
        : thresholds.platinum;
  return Math.max(0, target - points);
}

export function tierProgressPercent(
  points: number,
  tier: LoyaltyTier,
  thresholds: TierThresholds,
): number {
  const next = nextTier(tier);
  if (!next) return 100;
  const currentMin =
    tier === "BRONZE"
      ? thresholds.bronze
      : tier === "SILVER"
        ? thresholds.silver
        : tier === "GOLD"
          ? thresholds.gold
          : thresholds.platinum;
  const nextMin =
    next === "SILVER"
      ? thresholds.silver
      : next === "GOLD"
        ? thresholds.gold
        : thresholds.platinum;
  const range = nextMin - currentMin;
  if (range <= 0) return 100;
  return Math.min(100, Math.round(((points - currentMin) / range) * 100));
}

export const TIER_LABELS: Record<LoyaltyTier, string> = {
  BRONZE: "Bronze",
  SILVER: "Silver",
  GOLD: "Gold",
  PLATINUM: "Platinum",
};

export const TIER_BENEFITS = [
  { label: "Priority booking", tiers: ["BRONZE", "SILVER", "GOLD", "PLATINUM"] as LoyaltyTier[] },
  { label: "Early collection access", tiers: ["SILVER", "GOLD", "PLATINUM"] as LoyaltyTier[] },
  { label: "Free consultation/year", tiers: ["GOLD", "PLATINUM"] as LoyaltyTier[] },
  { label: "Complimentary alterations", tiers: ["PLATINUM"] as LoyaltyTier[] },
];

export async function getLoyaltyRulePoints(action: string): Promise<number> {
  const rule = await prisma.loyaltyRule.findUnique({ where: { action } });
  if (!rule?.isActive) return 0;
  return rule.points;
}
