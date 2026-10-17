import type { LoyaltyTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PROGRAMME_DEFAULTS } from "@/lib/points-value";

/** Tier levels, rates and perks live in src/lib/loyalty-tiers.ts. */

export const TIER_ORDER: LoyaltyTier[] = ["BRONZE", "SILVER", "GOLD", "PLATINUM"];

export function nextTier(current: LoyaltyTier): LoyaltyTier | null {
  const idx = TIER_ORDER.indexOf(current);
  return idx < TIER_ORDER.length - 1 ? TIER_ORDER[idx + 1]! : null;
}

export const TIER_LABELS: Record<LoyaltyTier, string> = {
  BRONZE: "Bronze",
  SILVER: "Silver",
  GOLD: "Gold",
  PLATINUM: "Platinum",
};

export async function getLoyaltyRulePoints(action: string): Promise<number> {
  const rule = await prisma.loyaltyRule.findUnique({ where: { action } });
  if (rule && !rule.isActive) return 0;
  if (rule) return rule.points;
  return PROGRAMME_DEFAULTS[action] ?? 0;
}
