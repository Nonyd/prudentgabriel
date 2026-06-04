import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const staff = await prisma.staffProfile.findUnique({ where: { userId: session.user.id } });
  if (!staff) return NextResponse.json({ error: "Staff profile not found" }, { status: 404 });

  const filter = req.nextUrl.searchParams.get("filter") ?? "active";

  const where =
    filter === "completed"
      ? { staffProfileId: staff.id, completedAt: { not: null } }
      : filter === "all"
        ? { staffProfileId: staff.id }
        : { staffProfileId: staff.id, completedAt: null };

  const items = await prisma.orderAssignment.findMany({
    where,
    include: {
      order: {
        select: {
          id: true,
          orderRef: true,
          outfitDescription: true,
          deliveryDate: true,
        },
      },
    },
    orderBy: [{ completedAt: "desc" }, { assignedAt: "desc" }],
    take: 50,
  });

  return NextResponse.json({
    items: items.map((a) => ({
      id: a.id,
      orderId: a.order.id,
      orderRef: a.order.orderRef,
      outfitDescription: a.order.outfitDescription,
      role: a.role,
      assignedAt: a.assignedAt.toISOString(),
      completedAt: a.completedAt?.toISOString() ?? null,
      deliveryDate: a.order.deliveryDate?.toISOString() ?? null,
      status: a.completedAt ? "Completed" : "Active",
    })),
  });
}
