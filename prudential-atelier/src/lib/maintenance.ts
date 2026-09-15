import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { userHasAdminAccess, type LoginPathUser } from "@/lib/login-paths";

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
export async function enforcePublicMaintenance(user?: LoginPathUser | string | null) {
  const enabled = await isMaintenanceEnabled();
  if (!enabled) return;
  const actor = typeof user === "string" ? { role: user } : user;
  if (userHasAdminAccess(actor)) return;
  redirect("/maintenance");
}
