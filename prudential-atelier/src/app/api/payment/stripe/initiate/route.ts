import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PaymentStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getExchangeRates, convertFromNGN } from "@/lib/currency";
import { createPaymentIntent } from "@/lib/payments/stripe";

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
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.paymentStatus !== PaymentStatus.PENDING) {
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

  const rates = await getExchangeRates();
  const converted = convertFromNGN(order.total, currency, rates);
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

  return NextResponse.json({ clientSecret, publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "" });
}
