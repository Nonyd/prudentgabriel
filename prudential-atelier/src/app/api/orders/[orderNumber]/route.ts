import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toPublicRtwOrderDto } from "@/lib/public-pii-dtos";
import { canViewRtwTracker } from "@/lib/rtw-tracker";
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
    select: {
      userId: true,
      guestEmail: true,
      orderNumber: true,
      status: true,
      paymentStatus: true,
      total: true,
      currency: true,
      fxUsdAmountLocked: true,
      fxGbpAmountLocked: true,
      fxRateLocked: true,
      fxGbpRateLocked: true,
      user: { select: { email: true } },
      items: {
        select: {
          size: true,
          sizeMode: true,
          quantity: true,
          product: { select: { name: true } },
        },
      },
    },
  });

  if (!order) {
    return NextResponse.json({ order: null });
  }

  const allowed = canViewRtwTracker(
    {
      userId: order.userId,
      guestEmail: order.guestEmail,
      userEmail: order.user?.email ?? null,
    },
    {
      userId: session?.user?.id,
      email: emailParam || session?.user?.email,
    },
  );

  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    order: toPublicRtwOrderDto(order),
  });
}
