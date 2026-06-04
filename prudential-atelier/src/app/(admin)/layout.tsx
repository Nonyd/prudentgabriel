import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { BespokeStage, ConsultationStatus, OrderStatus, PaymentStatus } from "@prisma/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { isAdminRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || !isAdminRole(session.user.role)) {
    redirect("/admin-login");
  }

  let badges: Record<string, number> = {};
  try {
    const [bespoke, consultations, orders] = await Promise.all([
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
    ]);
    badges = { bespoke, consultations, orders };
  } catch {
    /* DB unavailable */
  }

  return (
    <AdminShell session={session} badges={badges}>
      {children}
    </AdminShell>
  );
}
