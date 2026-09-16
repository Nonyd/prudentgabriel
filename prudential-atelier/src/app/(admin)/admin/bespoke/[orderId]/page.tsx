import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { BespokeOrderDetailClient } from "@/components/admin/BespokeOrderDetailClient";
import { stageGateInclude } from "@/lib/atelier/can-complete-stage";
import { maybeArchiveBespokeOrder } from "@/lib/bespoke-archive";

export default async function AdminBespokeOrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  await maybeArchiveBespokeOrder(orderId);

  const order = await prisma.bespokeOrder.findUnique({
    where: { id: orderId },
    include: {
      stageHistory: { orderBy: { completedAt: "desc" } },
      assignments: {
        include: { staffProfile: { include: { user: { select: { name: true, email: true } } } } },
      },
      materials: { orderBy: { createdAt: "asc" } },
      clientProfile: { include: { measurements: true } },
      quotation: true,
      consultation: { select: { id: true, bookingNumber: true, occasion: true } },
      payments: {
        orderBy: { createdAt: "desc" },
        include: { confirmedBy: { select: { id: true, name: true, email: true } } },
      },
      ...stageGateInclude(),
    },
  });

  if (!order) notFound();

  const staffList = await prisma.staffProfile.findMany({
    where: { isActive: true },
    include: {
      user: { select: { name: true, email: true } },
      assignments: { where: { completedAt: null } },
    },
  });

  const session = await auth();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://prudentgabriel.com";

  return (
    <BespokeOrderDetailClient
      order={order}
      actorRole={session?.user?.role ?? null}
      actorUserId={session?.user?.id ?? null}
      staffList={staffList.map((s) => ({
        id: s.id,
        userId: s.userId,
        name: s.user.name ?? s.user.email ?? "Staff",
        department: s.department,
        activeOrders: s.assignments.length,
      }))}
      trackingUrl={`${baseUrl}/track/${order.trackingToken}`}
    />
  );
}
