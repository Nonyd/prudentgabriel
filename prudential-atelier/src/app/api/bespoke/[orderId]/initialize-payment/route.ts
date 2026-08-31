import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PaymentGateway } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPublicAppUrl } from "@/lib/app-url";
import { getExchangeRates, convertFromNGN } from "@/lib/currency";
import { generatePaymentReference } from "@/lib/payments/index";
import { initializeTransaction as initPaystack } from "@/lib/payments/paystack";
import { initializeTransaction as initFlutterwave } from "@/lib/payments/flutterwave";
import { initializeTransaction as initMonnify } from "@/lib/payments/monnify";
import { createBespokePaymentIntent } from "@/lib/payments/stripe";
import { getStripePublicKey, getSupportedGateways } from "@/lib/payments/config";
import {
  encodeBespokePaymentRef,
  getBespokeOrderForUser,
} from "@/lib/bespoke-order-access";

const MIN_PARTIAL_NGN = 10_000;

const bodySchema = z.object({
  amount: z.number().positive(),
  currency: z.enum(["NGN", "USD", "GBP"]),
  gateway: z.enum(["PAYSTACK", "FLUTTERWAVE", "STRIPE", "MONNIFY", "BANK_TRANSFER"]),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ orderId: string }> }) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderId } = await ctx.params;
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

  const { amount, currency, gateway } = parsed.data;
  const offered = await getSupportedGateways(currency, "ATELIER");
  if (!offered.includes(gateway)) {
    return NextResponse.json({ error: "That payment method is not available for this currency" }, { status: 400 });
  }
  const order = await getBespokeOrderForUser(orderId, session.user.id);
  if (!order || order.balance <= 0) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const payAmountNGN = Math.min(Math.round(amount), Math.round(order.balance));
  if (payAmountNGN < MIN_PARTIAL_NGN && payAmountNGN < order.balance) {
    return NextResponse.json(
      { error: `Minimum partial payment is ₦${MIN_PARTIAL_NGN.toLocaleString("en-NG")}` },
      { status: 400 },
    );
  }

  const reference = generatePaymentReference("BESPOKE");
  const encodedRef = encodeBespokePaymentRef(reference, payAmountNGN);
  const appUrl = getPublicAppUrl();
  const email = session.user.email;
  const name = session.user.name ?? email.split("@")[0] ?? "Client";

  if (gateway === "BANK_TRANSFER") {
    await prisma.bespokeOrder.update({
      where: { id: order.id },
      data: {
        paymentGateway: PaymentGateway.BANK_TRANSFER,
        paymentRef: encodedRef,
        paymentReceiptUrl: null,
      },
    });
    return NextResponse.json({
      reference,
      amountNGN: payAmountNGN,
      redirectUrl: `${appUrl}/payment/pending?reference=${encodeURIComponent(order.orderRef)}&type=bespoke&orderId=${encodeURIComponent(order.id)}`,
    });
  }

  await prisma.bespokeOrder.update({
    where: { id: order.id },
    data: {
      paymentGateway: gateway as PaymentGateway,
      paymentRef: encodedRef,
    },
  });

  const verifyBase = `${appUrl}/api/bespoke/${order.id}/verify-payment`;

  if (gateway === "PAYSTACK") {
    const callbackUrl = `${verifyBase}?gateway=PAYSTACK`;
    const init = await initPaystack({
      email,
      amountKobo: Math.round(payAmountNGN * 100),
      reference,
      callbackUrl,
      metadata: { bespokeOrderId: order.id, amountNGN: String(payAmountNGN) },
    });
    return NextResponse.json({ paymentUrl: init.authorizationUrl, reference: init.reference });
  }

  if (gateway === "FLUTTERWAVE") {
    const rates = await getExchangeRates();
    let fwAmount = payAmountNGN;
    if (currency === "USD") fwAmount = Math.round(convertFromNGN(payAmountNGN, "USD", rates) * 100) / 100;
    if (currency === "GBP") fwAmount = Math.round(convertFromNGN(payAmountNGN, "GBP", rates) * 100) / 100;
    const init = await initFlutterwave({
      txRef: reference,
      amount: fwAmount,
      currency,
      email,
      name,
      phone: order.clientPhone ?? undefined,
      redirectUrl: `${verifyBase}?gateway=FLUTTERWAVE`,
      meta: { orderId: order.id },
    });
    return NextResponse.json({ paymentUrl: init.paymentLink, reference });
  }

  if (gateway === "MONNIFY") {
    const init = await initMonnify({
      amountNGN: payAmountNGN,
      reference,
      customerEmail: email,
      customerName: name,
      description: `Bespoke balance · ${order.orderRef}`,
      redirectUrl: `${verifyBase}?gateway=MONNIFY`,
    });
    return NextResponse.json({ paymentUrl: init.checkoutUrl, reference });
  }

  if (gateway === "STRIPE") {
    if (currency === "NGN") {
      return NextResponse.json({ error: "Use USD or GBP for Stripe" }, { status: 400 });
    }
    const rates = await getExchangeRates();
    const converted = convertFromNGN(payAmountNGN, currency, rates);
    const amountCents = Math.max(50, Math.round(converted * 100));
    const { clientSecret, paymentIntentId } = await createBespokePaymentIntent({
      amountCents,
      currency: currency.toLowerCase() as "usd" | "gbp",
      bespokeOrderId: order.id,
      orderRef: order.orderRef,
      customerEmail: email,
    });
    await prisma.bespokeOrder.update({
      where: { id: order.id },
      data: { paymentRef: encodeBespokePaymentRef(paymentIntentId, payAmountNGN) },
    });
    const publishableKey = (await getStripePublicKey()) ?? "";
    return NextResponse.json({
      clientSecret,
      publishableKey,
      reference: paymentIntentId,
    });
  }

  return NextResponse.json({ error: "Unsupported gateway" }, { status: 400 });
}
