import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PaymentStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPublicAppUrl } from "@/lib/app-url";
import { initializeTransaction } from "@/lib/payments/monnify";
import { canAcceptRtwPayment, rtwChargeAmountNGN } from "@/lib/payments/rtw-totals";
import { generatePaymentReference } from "@/lib/payments/index";
import { catchPaymentInit } from "@/lib/payments/catch-init";

const bodySchema = z.object({
  orderId: z.string().min(1),
  guestEmail: z.string().email().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { orderId, guestEmail } = parsed.data;
  return catchPaymentInit(orderId, async () => {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || !canAcceptRtwPayment(order)) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.userId) {
      if (session?.user?.id !== order.userId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else {
      const ge = guestEmail?.trim().toLowerCase();
      if (!ge || ge !== (order.guestEmail ?? "").toLowerCase()) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const appUrl = getPublicAppUrl();
    const redirectUrl = `${appUrl}/api/payment/monnify/verify?orderId=${encodeURIComponent(orderId)}`;

    const customerEmail = session?.user?.email ?? order.guestEmail ?? guestEmail ?? "";
    const customerName =
      session?.user?.name ?? order.guestName ?? customerEmail.split("@")[0] ?? "Customer";

    const chargeNGN = rtwChargeAmountNGN(order);
    if (chargeNGN < 1) {
      return NextResponse.json({ error: "This order is already paid" }, { status: 400 });
    }
    const reference =
      order.paymentStatus === PaymentStatus.PAID ? generatePaymentReference("BAL") : order.orderNumber;

    const init = await initializeTransaction({
      amountNGN: Math.round(chargeNGN),
      reference,
      customerEmail,
      customerName,
      description: `Prudential Atelier Order #${order.orderNumber}`,
      redirectUrl,
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { paymentRef: reference },
    });

    return NextResponse.json({ checkoutUrl: init.checkoutUrl });
  });
}
