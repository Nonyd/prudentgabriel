import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createPaymentIntent } from "@/lib/payments/stripe";
import { canAcceptRtwPayment, rtwChargeAmountForeign } from "@/lib/payments/rtw-totals";
import { lockedFxFromOrder } from "@/lib/fx";
import { getStripePublicKey } from "@/lib/payments/config";
import { catchPaymentInit } from "@/lib/payments/catch-init";

const bodySchema = z.object({
  orderId: z.string().min(1),
  currency: z.enum(["USD", "GBP"]),
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

    const fx = lockedFxFromOrder(order);
    const converted = rtwChargeAmountForeign(order, currency, fx);
    if (converted < 0.5) {
      return NextResponse.json({ error: "This order is already paid" }, { status: 400 });
    }
    const amountCents = Math.max(50, Math.round(converted * 100));

    const email = session?.user?.email ?? order.guestEmail ?? guestEmail ?? "";

    const { clientSecret, paymentIntentId } = await createPaymentIntent({
      amountCents,
      currency: currency.toLowerCase() as "usd" | "gbp",
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerEmail: email,
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { paymentRef: paymentIntentId },
    });

    const publishableKey = (await getStripePublicKey()) ?? "";
    return NextResponse.json({ clientSecret, publishableKey });
  });
}
