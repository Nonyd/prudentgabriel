import { NextRequest, NextResponse } from "next/server";
import { PaymentGateway } from "@prisma/client";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getPublicAppUrl } from "@/lib/app-url";
import { verifyTransaction as verifyPaystack } from "@/lib/payments/paystack";
import { verifyTransaction as verifyFlutterwave } from "@/lib/payments/flutterwave";
import { verifyTransaction as verifyMonnify } from "@/lib/payments/monnify";
import { fulfillBespokeOrderBalance } from "@/lib/bespoke-order-payment";
import { parseBespokePaymentRef } from "@/lib/bespoke-order-access";
import { sendPaymentConfirmedEmail } from "@/lib/email";
import { logActivity } from "@/lib/logger";
import { getStripeSecret } from "@/lib/payments/config";

function redirectSuccess(appUrl: string, orderId: string, reference: string) {
  return NextResponse.redirect(
    `${appUrl}/payment/success?type=bespoke&orderId=${encodeURIComponent(orderId)}&reference=${encodeURIComponent(reference)}`,
  );
}

function redirectFailed(appUrl: string, orderId: string, reference: string) {
  return NextResponse.redirect(
    `${appUrl}/payment/failed?type=bespoke&orderId=${encodeURIComponent(orderId)}&reference=${encodeURIComponent(reference)}`,
  );
}

async function completeBespokePayment(params: {
  orderId: string;
  paymentRef: string;
  amountNGN: number;
  gateway: PaymentGateway;
}) {
  const order = await prisma.bespokeOrder.findUnique({ where: { id: params.orderId } });
  if (!order) return false;

  const ok = await fulfillBespokeOrderBalance({
    orderId: params.orderId,
    amount: params.amountNGN,
    paymentRef: params.paymentRef,
    gateway: params.gateway,
  });
  if (!ok) return false;

  void sendPaymentConfirmedEmail({
    to: order.clientEmail,
    ref: order.orderRef,
    amountNGN: params.amountNGN,
    kind: "bespoke",
    trackUrl: `${getPublicAppUrl()}/track/${encodeURIComponent(order.trackingToken)}`,
  });
  void logActivity({
    action: "PAYMENT_CONFIRM",
    module: "payments",
    description: `Bespoke payment ${params.paymentRef} via ${params.gateway}`,
    recordId: order.id,
    recordType: "BespokeOrder",
  });
  return true;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const gateway = searchParams.get("gateway")?.toUpperCase();
  const appUrl = getPublicAppUrl();

  const order = await prisma.bespokeOrder.findUnique({ where: { id: orderId } });
  if (!order) {
    return NextResponse.redirect(`${appUrl}/account/orders?error=not-found`);
  }

  const stored = parseBespokePaymentRef(order.paymentRef);
  const amountNGN = stored.amountNGN ?? order.balance;

  try {
    if (gateway === "PAYSTACK") {
      const reference = searchParams.get("reference") ?? stored.reference;
      if (!reference) return redirectFailed(appUrl, orderId, reference ?? "");

      const result = await verifyPaystack(reference);
      if (result.status === "success") {
        const metaId = result.metadata.orderId ?? result.metadata.bespokeOrderId ?? result.metadata.bespokeRequestId;
        if (metaId && metaId !== orderId) {
          return redirectFailed(appUrl, orderId, reference);
        }
        if (stored.reference && stored.reference !== result.reference) {
          return redirectFailed(appUrl, orderId, reference);
        }
        const paidNGN = result.amount / 100;
        if (paidNGN + 0.01 < amountNGN) {
          return redirectFailed(appUrl, orderId, reference);
        }
        await completeBespokePayment({
          orderId,
          paymentRef: reference,
          amountNGN: Math.min(paidNGN, amountNGN),
          gateway: PaymentGateway.PAYSTACK,
        });
        return redirectSuccess(appUrl, orderId, reference);
      }
      return redirectFailed(appUrl, orderId, reference);
    }

    if (gateway === "FLUTTERWAVE") {
      const transactionId = searchParams.get("transaction_id");
      if (!transactionId) return redirectFailed(appUrl, orderId, stored.reference);

      const result = await verifyFlutterwave(transactionId);
      if (result.status === "successful") {
        if (result.meta?.orderId && result.meta.orderId !== orderId) {
          return redirectFailed(appUrl, orderId, result.txRef);
        }
        const paid = result.amount;
        if (result.currency.toUpperCase() === "NGN" && paid + 0.01 < amountNGN) {
          return redirectFailed(appUrl, orderId, result.txRef);
        }
        await completeBespokePayment({
          orderId,
          paymentRef: result.txRef,
          amountNGN: result.currency.toUpperCase() === "NGN" ? Math.min(paid, amountNGN) : amountNGN,
          gateway: PaymentGateway.FLUTTERWAVE,
        });
        return redirectSuccess(appUrl, orderId, result.txRef);
      }
      return redirectFailed(appUrl, orderId, result.txRef);
    }

    if (gateway === "MONNIFY") {
      const reference = searchParams.get("paymentReference") ?? searchParams.get("reference") ?? stored.reference;
      if (!reference) return redirectFailed(appUrl, orderId, "");

      const result = await verifyMonnify(reference);
      if (result.status === "PAID" || result.status === "OVERPAID" || result.status === "PAID_FULL") {
        if (stored.reference && stored.reference !== result.paymentReference && stored.reference !== reference) {
          return redirectFailed(appUrl, orderId, reference);
        }
        if (result.amountPaid + 0.01 < amountNGN) {
          return redirectFailed(appUrl, orderId, reference);
        }
        await completeBespokePayment({
          orderId,
          paymentRef: reference,
          amountNGN: Math.min(result.amountPaid, amountNGN),
          gateway: PaymentGateway.MONNIFY,
        });
        return redirectSuccess(appUrl, orderId, reference);
      }
      return redirectFailed(appUrl, orderId, reference);
    }

    if (gateway === "STRIPE") {
      const paymentIntentId = searchParams.get("payment_intent") ?? stored.reference;
      const key = await getStripeSecret();
      if (!key || !paymentIntentId) return redirectFailed(appUrl, orderId, paymentIntentId ?? "");

      const stripe = new Stripe(key);
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (intent.status === "succeeded") {
        await completeBespokePayment({
          orderId,
          paymentRef: paymentIntentId,
          amountNGN,
          gateway: PaymentGateway.STRIPE,
        });
        return redirectSuccess(appUrl, orderId, paymentIntentId);
      }
      return redirectFailed(appUrl, orderId, paymentIntentId);
    }
  } catch {
    return redirectFailed(appUrl, orderId, stored.reference || order.orderRef);
  }

  return NextResponse.json({ error: "Missing gateway" }, { status: 400 });
}
