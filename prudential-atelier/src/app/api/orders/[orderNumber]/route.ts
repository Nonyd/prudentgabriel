import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ orderNumber: string }> },
) {
  const { orderNumber: raw } = await context.params;
  const orderNumber = decodeURIComponent(raw ?? "");
  if (!orderNumber) {
    return NextResponse.json({ error: "Missing order number" }, { status: 400 });
  }

  const session = await auth();
  const emailParam = req.nextUrl.searchParams.get("email")?.trim().toLowerCase();

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      items: {
        include: {
          product: { select: { name: true } },
        },
      },
      shippingZone: { select: { name: true, estimatedDays: true } },
    },
  });

  if (!order) {
    return NextResponse.json({ order: null });
  }

  const uid = session?.user?.id;
  const sessionEmail = session?.user?.email?.toLowerCase();

  const isUserOrder = order.userId && uid === order.userId;
  const isGuestEmailMatch =
    order.guestEmail &&
    (sessionEmail === order.guestEmail.toLowerCase() || emailParam === order.guestEmail.toLowerCase());

  if (!isUserOrder && !isGuestEmailMatch) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    order: {
      orderNumber: order.orderNumber,
      guestEmail: order.guestEmail,
      subtotal: order.subtotal,
      shippingAmount: order.shippingAmount,
      discount: order.discount,
      pointsDiscountNGN: order.pointsDiscountNGN,
      total: order.total,
      paymentStatus: order.paymentStatus,
      status: order.status,
      addressSnapshot: order.addressSnapshot,
      shippingZone: order.shippingZone,
      items: order.items.map((i) => ({
        name: i.product.name,
        size: i.size,
        quantity: i.quantity,
        lineTotal: i.lineTotal,
      })),
    },
  });
}
