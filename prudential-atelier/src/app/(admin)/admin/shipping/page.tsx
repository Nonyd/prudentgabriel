import { prisma } from "@/lib/prisma";
import { ShippingAdminClient } from "@/components/admin/ShippingAdminClient";
import { getShippingAdminStatus } from "@/lib/shipping/mode";
import { getShippingCopy } from "@/lib/shipping/copy";
import { ensureShippingSettingKeys } from "@/lib/shipping-settings-bootstrap";

export default async function AdminShippingPage() {
  await ensureShippingSettingKeys();
  const [methods, status, copy] = await Promise.all([
    prisma.shippingMethod.findMany({
      include: {
        pickupLocations: { orderBy: { sortOrder: "asc" } },
        lagosLocations: { orderBy: { sortOrder: "asc" } },
      },
      orderBy: { sortOrder: "asc" },
    }),
    getShippingAdminStatus(),
    getShippingCopy(),
  ]);
  return (
    <ShippingAdminClient
      initialMethods={methods}
      initialStatus={status}
      initialCopy={{ manualConsent: copy.manualConsent, unavailableConsent: copy.unavailableConsent }}
    />
  );
}
