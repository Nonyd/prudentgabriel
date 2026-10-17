import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { LoyaltyClient } from "@/components/account/LoyaltyClient";
import { getPointRateNGN, getPrudentPointsCopy, pointsToNaira } from "@/lib/points";
import { getClientTierStatus, getTierConfigs, getTierPerks, perksForTier } from "@/lib/loyalty-tiers";
import { TIER_LABELS, TIER_ORDER } from "@/lib/loyalty";

type Props = { searchParams: Promise<{ page?: string }> };

export default async function LoyaltyPage({ searchParams }: Props) {
  const session = await auth();
  const userId = session!.user!.id!;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const perPage = 10;

  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [user, configs, perks, history, total, rateNGN, expiring, copy] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { pointsBalance: true } }),
    getTierConfigs(),
    getTierPerks(),
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
    getPrudentPointsCopy(),
  ]);
  const status = await getClientTierStatus(userId, { configs, perks, now });

  const points = user?.pointsBalance ?? 0;

  return (
    <LoyaltyClient
      pointsBalance={points}
      pointsValueNGN={pointsToNaira(points, rateNGN)}
      rateNGN={rateNGN}
      status={status}
      tiers={TIER_ORDER.map((t) => ({
        tier: t,
        label: TIER_LABELS[t],
        minSpendNGN: configs.find((c) => c.tier === t)!.minSpendNGN,
        perks: perksForTier(t, configs, perks),
      }))}
      copy={copy}
      expiringPoints={expiring._sum.remaining ?? 0}
      expiringOn={expiring._min.expiresAt?.toISOString() ?? null}
      history={history}
      page={page}
      totalPages={Math.ceil(total / perPage)}
    />
  );
}
