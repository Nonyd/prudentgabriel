import { prisma } from "@/lib/prisma";
import { CouponsClient } from "@/components/admin/CouponsClient";

export default async function AdminCouponsPage() {
  const coupons = await prisma.coupon.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { usages: true } } },
  });
  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Coupons</h1>
      <CouponsClient coupons={coupons} />
    </div>
  );
}
