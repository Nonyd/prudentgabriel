import { PointsType, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export default async function AdminReferralsPage() {
  const [referrers, issued, redeemed] = await Promise.all([
    prisma.user.findMany({
      where: { role: Role.CUSTOMER },
      include: { _count: { select: { referrals: true } } },
    }),
    prisma.pointsTransaction.aggregate({
      where: {
        type: { in: [PointsType.EARNED_REFERRAL, PointsType.EARNED_SIGNUP] },
      },
      _sum: { amount: true },
    }),
    prisma.pointsTransaction.aggregate({
      where: { type: PointsType.REDEEMED },
      _sum: { amount: true },
    }),
  ]);

  const top = [...referrers].sort((a, b) => b._count.referrals - a._count.referrals).slice(0, 10);

  return (
    <div>
      <h1 className="font-display text-2xl text-charcoal">Referral analytics</h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-sm border border-[#EBEBEA] bg-white p-6">
          <p className="text-xs uppercase text-[#A8A8A4]">Points issued (referrals & signup)</p>
          <p className="mt-2 font-display text-2xl text-gold">{issued._sum.amount ?? 0}</p>
        </div>
        <div className="rounded-sm border border-[#EBEBEA] bg-white p-6">
          <p className="text-xs uppercase text-[#A8A8A4]">Points redeemed</p>
          <p className="mt-2 font-display text-2xl text-wine">
            {Math.abs(redeemed._sum.amount ?? 0)}
          </p>
        </div>
      </div>
      <h2 className="mt-10 font-display text-lg text-charcoal">Top referrers</h2>
      <ul className="mt-4 space-y-2 text-sm text-charcoal">
        {top.map((u, i) => (
          <li key={u.id}>
            {i + 1}. {u.name} — {u._count.referrals} referrals
          </li>
        ))}
      </ul>
    </div>
  );
}
