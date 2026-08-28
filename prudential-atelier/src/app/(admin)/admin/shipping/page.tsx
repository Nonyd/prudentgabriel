import { prisma } from "@/lib/prisma";
import { ShippingAdminClient } from "@/components/admin/ShippingAdminClient";

export default async function AdminShippingPage() {
  const methods = await prisma.shippingMethod.findMany({
    include: {
      pickupLocations: { orderBy: { sortOrder: "asc" } },
      lagosLocations: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: { sortOrder: "asc" },
  });
  return <ShippingAdminClient initialMethods={methods} />;
}
