import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { getTierThresholds, tierFromPoints, pointsToNextTier, nextTier, TIER_LABELS } from "@/lib/loyalty";
import { getOrCreateClientProfile } from "@/lib/account-helpers";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") ?? 1));
  const perPage = 10;
  const skip = (page - 1) * perPage;

  try {
    const userId = gate.session.user.id!;
    const [user, profile, thresholds, rules, history, total] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { pointsBalance: true },
      }),
      getOrCreateClientProfile(userId),
      getTierThresholds(),
      prisma.loyaltyRule.findMany({ where: { isActive: true }, orderBy: { action: "asc" } }),
      prisma.pointsTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: perPage,
      }),
      prisma.pointsTransaction.count({ where: { userId } }),
    ]);

    const points = user?.pointsBalance ?? 0;
    const tier = tierFromPoints(points, thresholds);

    return NextResponse.json({
      pointsBalance: points,
      tier,
      tierLabel: TIER_LABELS[tier],
      nextTier: nextTier(tier),
      pointsToNext: pointsToNextTier(points, tier, thresholds),
      thresholds,
      totalSpend: profile.totalSpend,
      rules,
      history,
      pagination: { page, perPage, total, pages: Math.ceil(total / perPage) },
    });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "ACCOUNT_LOYALTY",
      message: e instanceof Error ? e.message : "Failed to get loyalty data",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
