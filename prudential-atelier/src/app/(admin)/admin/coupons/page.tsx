import { prisma } from "@/lib/prisma";
import { CouponsAdminClient } from "@/components/admin/CouponsAdminClient";

export default async function AdminCouponsPage() {
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <div>
      <h1 className="font-display text-2xl text-ivory">Coupons</h1>
      <CouponsAdminClient coupons={coupons} />
    </div>
  );
}
