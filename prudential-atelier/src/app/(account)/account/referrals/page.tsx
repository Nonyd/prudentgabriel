import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPublicAppUrl } from "@/lib/app-url";
import { ReferralsClient } from "@/components/account/ReferralsClient";
import { PointsType } from "@prisma/client";

export default async function ReferralsPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const [user, referrals, referralPoints] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true },
    }),
    prisma.user.findMany({
      where: { referredById: userId },
      select: {
        name: true,
        createdAt: true,
        orders: { select: { id: true }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.pointsTransaction.aggregate({
      where: { userId, type: PointsType.EARNED_REFERRAL },
      _sum: { amount: true },
    }),
  ]);

  const base = getPublicAppUrl();
  const link = `${base}/register?ref=${user?.referralCode ?? ""}`;

  return (
    <ReferralsClient
      link={link}
      stats={{
        totalReferred: referrals.length,
        converted: referrals.filter((r) => r.orders.length > 0).length,
        pointsEarned: referralPoints._sum.amount ?? 0,
      }}
      referrals={referrals.map((r) => ({
        firstName: (r.name ?? "Friend").split(/\s+/)[0] ?? "Friend",
        joinedAt: r.createdAt.toISOString(),
        status: r.orders.length > 0 ? ("Ordered" as const) : ("Joined" as const),
      }))}
    />
  );
}
