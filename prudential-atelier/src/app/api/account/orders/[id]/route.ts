import { NextRequest, NextResponse } from "next/server";
import { PaymentStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { deleteOrdersByIds } from "@/lib/order-delete";
import { returnRedeemedPoints } from "@/lib/points";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const order = await prisma.order.findFirst({
    where: { id, userId: session.user.id },
    include: {
      items: {
        include: {
          product: { include: { images: { orderBy: { sortOrder: "asc" } } } },
          variant: true,
        },
      },
      shippingZone: true,
      coupon: true,
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ order });
}

/** Remove abandoned / failed checkouts only (never paid orders). */
export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const order = await prisma.order.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, paymentStatus: true },
  });

  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (order.paymentStatus !== PaymentStatus.PENDING && order.paymentStatus !== PaymentStatus.FAILED) {
    return NextResponse.json(
      { error: "Only unpaid or failed-payment orders can be removed from your account." },
      { status: 400 },
    );
  }

  try {
    const deleted = await deleteOrdersByIds([order.id]);
    if (deleted === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    if (msg.includes("payment records")) {
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: { status: "CANCELLED" },
        });
        await returnRedeemedPoints(order.id, tx);
      });
      return NextResponse.json({ ok: true, cancelled: true });
    }
    console.error("[account/orders DELETE]", e);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
