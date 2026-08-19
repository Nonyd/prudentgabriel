import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasAnyAdminPermission } from "@/lib/roles";

export async function isMaintenanceEnabled(): Promise<boolean> {
  try {
    const row = await prisma.siteSetting.findUnique({
      where: { key: "maintenance_mode_enabled" },
      select: { value: true },
    });
    return row?.value === "true";
  } catch {
    return false;
  }
}

/** Send non-admin visitors to the maintenance page. Admins keep full access. */
export async function enforcePublicMaintenance(role?: string | null) {
  const enabled = await isMaintenanceEnabled();
  if (!enabled) return;
  if (hasAnyAdminPermission(role)) return;
  redirect("/maintenance");
}
