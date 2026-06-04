import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  getTierThresholds,
  tierFromPoints,
  pointsToNextTier,
  nextTier,
  TIER_LABELS,
  tierProgressPercent,
} from "@/lib/loyalty";
import { LoyaltyClient } from "@/components/account/LoyaltyClient";

type Props = { searchParams: Promise<{ page?: string }> };

export default async function LoyaltyPage({ searchParams }: Props) {
  const session = await auth();
  const userId = session!.user!.id!;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const perPage = 10;

  const [user, thresholds, rules, history, total] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { pointsBalance: true } }),
    getTierThresholds(),
    prisma.loyaltyRule.findMany({ where: { isActive: true } }),
    prisma.pointsTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.pointsTransaction.count({ where: { userId } }),
  ]);

  const points = user?.pointsBalance ?? 0;
  const tier = tierFromPoints(points, thresholds);
  const nt = nextTier(tier);

  return (
    <LoyaltyClient
      pointsBalance={points}
      tier={tier}
      tierLabel={TIER_LABELS[tier]}
      nextTier={nt}
      pointsToNext={pointsToNextTier(points, tier, thresholds)}
      progressPercent={tierProgressPercent(points, tier, thresholds)}
      rules={rules}
      history={history}
      page={page}
      totalPages={Math.ceil(total / perPage)}
    />
  );
}
