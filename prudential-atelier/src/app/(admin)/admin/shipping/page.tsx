import { prisma } from "@/lib/prisma";
import { ShippingAdminClient } from "@/components/admin/ShippingAdminClient";

export default async function AdminShippingPage() {
  const zones = await prisma.shippingZone.findMany({ orderBy: { sortOrder: "asc" } });
  return (
    <div>
      <h1 className="font-display text-2xl text-ivory">Shipping zones</h1>
      <ShippingAdminClient zones={zones} />
    </div>
  );
}
