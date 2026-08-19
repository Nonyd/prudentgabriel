import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toPublicRtwOrderDto } from "@/lib/public-pii-dtos";
import { rateLimitOr429 } from "@/lib/rate-limit";

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
  if (!session?.user?.id) {
    const limited = rateLimitOr429(req, "rtw-order-lookup", 20, 15 * 60 * 1000);
    if (limited) return limited;
  }

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
    order: toPublicRtwOrderDto(order),
  });
}
