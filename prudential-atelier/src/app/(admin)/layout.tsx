import { headers } from "next/headers";
import { authOrNull } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BespokeStage, ConsultationEnquiryStatus, ConsultationStatus, OrderStatus, PaymentStatus } from "@prisma/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { WorkroomTypeScale } from "@/components/common/WorkroomTypeScale";
import { prisma } from "@/lib/prisma";
import { deniedAdminRedirect } from "@/lib/admin-route-access";
import { resolveSessionAccess } from "@/lib/admin-auth";
import { hasAnyAdminPermission } from "@/lib/roles";
import { NOINDEX } from "@/lib/seo";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: NOINDEX,
  title: "Admin",
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await authOrNull();

  if (!session?.user) {
    redirect("/login?tab=admin");
  }

  const { role, actor, user, previewRole, impersonation } = await resolveSessionAccess(session);
  if (!hasAnyAdminPermission(role, actor) && !previewRole) {
    redirect("/login?tab=admin");
  }

  const pathname = (await headers()).get("x-pathname") ?? "/admin";
  // actor.email is the viewed-as person's (or null when previewing a role). Never fall back to
  // the real email: SUPER_ADMIN_EMAIL alone counts as Super Admin and would open every page.
  const denied = deniedAdminRedirect(role, pathname, actor.email ?? null, actor);
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
    const [bespoke, consultations, orders, messages, enquiries, chat] = await Promise.all([
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
      prisma.consultationEnquiry.count({ where: { status: ConsultationEnquiryStatus.PENDING } }),
      // BF6: conversations waiting on the house, not every open one.
      prisma.chatConversation.count({ where: { status: "OPEN", awaitingSince: { not: null } } }),
    ]);
    badges = { bespoke, consultations, orders, messages, enquiries, chat };
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
      accessEmail={actor.email ?? null}
      viewer={impersonation ? { name: user.name, role } : null}
      permissionGrants={actor.grants ?? []}
      permissionRevokes={actor.revokes ?? []}
      rolePermissions={actor.rolePermissions}
    >
      <WorkroomTypeScale />
      {children}
    </AdminShell>
  );
}
