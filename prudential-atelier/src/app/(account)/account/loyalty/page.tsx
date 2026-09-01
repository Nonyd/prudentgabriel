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
import { getPointRateNGN, pointsToNaira } from "@/lib/points";
import { PRUDENT_POINTS_COPY } from "@/lib/points-value";

type Props = { searchParams: Promise<{ page?: string }> };

export default async function LoyaltyPage({ searchParams }: Props) {
  const session = await auth();
  const userId = session!.user!.id!;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const perPage = 10;

  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [user, thresholds, history, total, rateNGN, expiring] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { pointsBalance: true } }),
    getTierThresholds(),
    prisma.pointsTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.pointsTransaction.count({ where: { userId } }),
    getPointRateNGN(),
    prisma.pointsTransaction.aggregate({
      where: { userId, remaining: { gt: 0 }, expiresAt: { gt: now, lte: in30 } },
      _sum: { remaining: true },
      _min: { expiresAt: true },
    }),
  ]);

  const points = user?.pointsBalance ?? 0;
  const tier = tierFromPoints(points, thresholds);
  const nt = nextTier(tier);

  return (
    <LoyaltyClient
      pointsBalance={points}
      pointsValueNGN={pointsToNaira(points, rateNGN)}
      rateNGN={rateNGN}
      tier={tier}
      tierLabel={TIER_LABELS[tier]}
      nextTier={nt}
      pointsToNext={pointsToNextTier(points, tier, thresholds)}
      progressPercent={tierProgressPercent(points, tier, thresholds)}
      copy={PRUDENT_POINTS_COPY}
      expiringPoints={expiring._sum.remaining ?? 0}
      expiringOn={expiring._min.expiresAt?.toISOString() ?? null}
      history={history}
      page={page}
      totalPages={Math.ceil(total / perPage)}
    />
  );
}
