import { prisma } from "@/lib/prisma";
import { ShippingZonesClient } from "@/components/admin/ShippingZonesClient";

export default async function AdminShippingPage() {
  const zones = await prisma.shippingZone.findMany({ orderBy: [{ name: "asc" }] });
  return <ShippingZonesClient initialZones={zones} />;
}
