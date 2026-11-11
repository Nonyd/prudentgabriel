import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimitOr429 } from "@/lib/rate-limit";
import { getPublicAppUrl } from "@/lib/app-url";
import { initializeTransaction } from "@/lib/payments/paystack";
import { rtwGatewayEmail } from "@/lib/payments/payer-email";
import { generatePaymentReference } from "@/lib/payments/index";
import { asPaystackCurrency, paystackRtwMajor, paystackSubunits } from "@/lib/payments/paystack-amount";
import { catchPaymentInit } from "@/lib/payments/catch-init";
import { paystackChargeCurrency } from "@/lib/payments/config";
import { prepareRtwPaymentAttempt } from "@/lib/checkout-reservations";
import { shippingAmountDueNGN } from "@/lib/shipping/due";
import { verifyShippingPayCode } from "@/lib/shipping/pay-link";

const bodySchema = z.object({ c: z.string().min(1).max(64) });

/**
 * Pay a quoted shipping fee with Paystack, from the link in the quote email.
 * The link's code never expires; each click makes a new Paystack checkout.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ orderId: string }> }) {
  const limited = await rateLimitOr429(req, "shipping-pay", 10, 15 * 60 * 1000);
  if (limited) return limited;

  const { orderId } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success || !verifyShippingPayCode(orderId, parsed.data.c)) {
    return NextResponse.json({ error: "This link is not valid" }, { status: 404 });
  }

  return catchPaymentInit(orderId, async () => {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { user: { select: { email: true } } },
    });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (shippingAmountDueNGN(order) <= 0) {
      return NextResponse.json({ error: "Shipping for this order is already paid" }, { status: 400 });
    }

    const prep = await prepareRtwPaymentAttempt(order.id);
    if (prep.error) return NextResponse.json({ error: prep.error }, { status: 400 });

    const email = rtwGatewayEmail(order);
    if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 });

    const currency = await paystackChargeCurrency(asPaystackCurrency(order.currency));
    const chargeMajor = paystackRtwMajor(order, currency);
    const minCharge = currency === "NGN" ? 1 : 0.5;
    if (chargeMajor < minCharge) {
      return NextResponse.json({ error: "Shipping for this order is already paid" }, { status: 400 });
    }

    const reference = generatePaymentReference("SHIP");
    const callbackUrl =
      `${getPublicAppUrl()}/api/payment/paystack/verify?orderId=${encodeURIComponent(order.id)}` +
      `&return=shipping&c=${encodeURIComponent(parsed.data.c)}`;

    const init = await initializeTransaction({
      email,
      amountKobo: paystackSubunits(chargeMajor),
      currency,
      reference,
      callbackUrl,
      metadata: { orderId: order.id, orderNumber: order.orderNumber, type: "shipping" },
    });

    await prisma.order.update({ where: { id: order.id }, data: { paymentRef: init.reference } });

    return NextResponse.json({ authorizationUrl: init.authorizationUrl, reference: init.reference });
  });
}
