import { headers } from "next/headers";
import { authOrNull } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BespokeStage, ConsultationStatus, OrderStatus, PaymentStatus } from "@prisma/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { prisma } from "@/lib/prisma";
import { deniedAdminRedirect } from "@/lib/admin-route-access";
import { resolveSessionAccess } from "@/lib/admin-auth";
import { hasAnyAdminPermission } from "@/lib/roles";

export const dynamic = "force-dynamic";

const adminRoles = [
  "SUPER_ADMIN",
  "ADMIN",
  "STAFF_ADMIN",
  "BESPOKE_MANAGER",
  "RTW_MANAGER",
  "CONTENT_MANAGER",
  "FINANCE_MANAGER",
  "HR_MANAGER",
  "CONSULTATION_MANAGER",
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await authOrNull();

  if (!session?.user) {
    redirect("/login?tab=admin");
  }

  if (!adminRoles.includes(session.user.role)) {
    redirect("/login?tab=admin");
  }

  const { role, actor, previewRole, impersonation } = await resolveSessionAccess(session);
  if (!hasAnyAdminPermission(role, actor) && !previewRole) {
    redirect("/login?tab=admin");
  }

  const pathname = (await headers()).get("x-pathname") ?? "/admin";
  const denied = deniedAdminRedirect(role, pathname, actor.email ?? session.user.email, actor);
  if (denied) redirect(denied);

  let badges: Record<string, number> = {};
  let isMaintenanceOn = false;
  try {
    const maintenanceEnabled = await prisma.siteSetting.findUnique({
      where: { key: "maintenance_mode_enabled" },
      select: { value: true },
    });
    isMaintenanceOn = maintenanceEnabled?.value === "true";
  } catch {
    /* DB unavailable */
  }

  try {
    const [bespoke, consultations, orders, messages] = await Promise.all([
      prisma.bespokeOrder.count({
        where: { currentStage: { not: BespokeStage.DELIVERY } },
      }),
      prisma.consultationBooking.count({
        where: { status: ConsultationStatus.PENDING_CONFIRMATION },
      }),
      prisma.order.count({
        where: {
          isBespoke: false,
          OR: [
            { status: OrderStatus.PENDING },
            { paymentStatus: PaymentStatus.PENDING },
          ],
        },
      }),
      prisma.contactMessage.count({ where: { isRead: false } }),
    ]);
    badges = { bespoke, consultations, orders, messages };
  } catch {
    /* DB unavailable */
  }

  return (
    <AdminShell
      session={session}
      badges={badges}
      isMaintenanceOn={isMaintenanceOn}
      previewRole={previewRole}
      impersonation={impersonation}
      accessRole={role}
      permissionGrants={actor.grants ?? []}
      permissionRevokes={actor.revokes ?? []}
      rolePermissions={actor.rolePermissions}
    >
      {children}
    </AdminShell>
  );
}
