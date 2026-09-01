import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PaymentStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPublicAppUrl } from "@/lib/app-url";
import { initializeTransaction } from "@/lib/payments/flutterwave";
import { generatePaymentReference } from "@/lib/payments/index";
import { canAcceptRtwPayment, rtwChargeAmountNGN, rtwChargeAmountForeign } from "@/lib/payments/rtw-totals";
import { lockedFxFromOrder } from "@/lib/fx";
import { catchPaymentInit } from "@/lib/payments/catch-init";

const bodySchema = z.object({
  orderId: z.string().min(1),
  currency: z.enum(["NGN", "USD", "GBP"]),
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

  const { orderId, currency, guestEmail } = parsed.data;
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

    const chargeNGN = rtwChargeAmountNGN(order);
    if (chargeNGN < 1) {
      return NextResponse.json({ error: "This order is already paid" }, { status: 400 });
    }
    const fx = lockedFxFromOrder(order);
    let amount = chargeNGN;
    if (currency === "USD" || currency === "GBP") {
      amount = rtwChargeAmountForeign(order, currency, fx);
    }

    const email = session?.user?.email ?? order.guestEmail ?? guestEmail ?? "";
    const name =
      session?.user?.name ??
      order.guestName ??
      (email ? email.split("@")[0] : "Customer");

    const appUrl = getPublicAppUrl();
    const redirectUrl = `${appUrl}/api/payment/flutterwave/verify?orderId=${encodeURIComponent(orderId)}`;
    const txRef =
      order.paymentStatus === PaymentStatus.PAID ? generatePaymentReference("BAL") : order.orderNumber;

    const init = await initializeTransaction({
      txRef,
      amount,
      currency,
      email,
      name,
      phone: order.guestPhone ?? undefined,
      redirectUrl,
      meta: { orderId: order.id },
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { paymentRef: init.txRef },
    });

    return NextResponse.json({ paymentLink: init.paymentLink });
  });
}
