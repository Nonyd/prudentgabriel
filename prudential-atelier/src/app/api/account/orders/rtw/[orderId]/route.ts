import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";

type Params = { params: Promise<{ orderId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  const { orderId } = await params;

  try {
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId: gate.session.user.id! },
      include: {
        items: {
          include: {
            product: {
              include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
            },
            variant: true,
          },
        },
      },
    });

    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ order });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "ACCOUNT_RTW_ORDER_DETAIL",
      message: e instanceof Error ? e.message : "Failed to get order",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
