import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BespokeOrderDetailClient } from "@/components/admin/BespokeOrderDetailClient";

export default async function AdminBespokeOrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

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

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://prudentgabriel.com";

  return (
    <BespokeOrderDetailClient
      order={order}
      staffList={staffList.map((s) => ({
        id: s.id,
        name: s.user.name ?? s.user.email ?? "Staff",
        department: s.department,
        activeOrders: s.assignments.length,
      }))}
      trackingUrl={`${baseUrl}/track/${order.trackingToken}`}
    />
  );
}
