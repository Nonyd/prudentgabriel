import { NextRequest, NextResponse } from "next/server";
import { PaymentGateway, PaymentStatus } from "@prisma/client";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { verifyWebhookEvent } from "@/lib/payments/stripe";
import { fulfillPaidOrder } from "@/lib/order-payment";
import { notifyPaymentFailed } from "@/lib/notifications";
import { fulfillPaidConsultationBooking } from "@/lib/consultation-payment";
import { rtwChargeAmountForeign, rtwChargeAmountNGN } from "@/lib/payments/rtw-totals";
import { markRtwOrderPaymentFailed } from "@/lib/checkout-reservations";
import { convertFromNGN, getExchangeRates, type ShopCurrency } from "@/lib/currency";
import { lockedFxFromOrder } from "@/lib/fx";
import {
  assertPspChargeBinds,
  expectedAmountInPspUnits,
  PaymentBindError,
} from "@/lib/payment-bind";

export const runtime = "nodejs";

async function expectedStripeMinor(totalNGN: number, pspCurrency: string): Promise<{
  amount: number;
  currency: string;
}> {
  const cur = pspCurrency.trim().toUpperCase();
  if (cur === "USD" || cur === "GBP") {
    const rates = await getExchangeRates();
    const major = convertFromNGN(totalNGN, cur as ShopCurrency, rates);
    return { amount: expectedAmountInPspUnits(PaymentGateway.STRIPE, major), currency: cur };
  }
  return { amount: expectedAmountInPspUnits(PaymentGateway.STRIPE, totalNGN), currency: cur || "USD" };
}

export async function POST(req: NextRequest) {
  const buf = Buffer.from(await req.arrayBuffer());
  const sig = req.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = await verifyWebhookEvent(buf, sig);
  } catch {
    return new Response("Bad signature", { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;
    const orderId = pi.metadata?.orderId;
    const bookingId = pi.metadata?.consultationBookingId;
    const isConsultation = pi.metadata?.type === "consultation";
    try {
      if (isConsultation && bookingId) {
        const booking = await prisma.consultationBooking.findUnique({ where: { id: bookingId } });
        if (booking) {
          const expected = await expectedStripeMinor(booking.feeNGN, pi.currency);
          assertPspChargeBinds(
            {
              id: booking.id,
              storedReference: booking.paymentRef,
              expectedAmount: expected.amount,
              expectedCurrency: expected.currency,
            },
            {
              gateway: PaymentGateway.STRIPE,
              reference: pi.id,
              amount: pi.amount,
              currency: pi.currency,
              metadataEntityId: bookingId,
            },
          );
          await fulfillPaidConsultationBooking({
            bookingId,
            paymentRef: pi.id,
            gateway: PaymentGateway.STRIPE,
          });
        }
      } else if (orderId) {
        const order = await prisma.order.findUnique({ where: { id: orderId } });
        if (order) {
          const cur = pi.currency.trim().toUpperCase() as ShopCurrency | string;
          const fx = lockedFxFromOrder(order);
          const major =
            cur === "USD" || cur === "GBP"
              ? rtwChargeAmountForeign(order, cur, fx)
              : rtwChargeAmountNGN(order);
          const expected = {
            amount: expectedAmountInPspUnits(PaymentGateway.STRIPE, major),
            currency: cur,
          };
          assertPspChargeBinds(
            {
              id: order.id,
              storedReference: order.paymentRef,
              expectedAmount: expected.amount,
              expectedCurrency: expected.currency,
            },
            {
              gateway: PaymentGateway.STRIPE,
              reference: pi.id,
              amount: pi.amount,
              currency: pi.currency,
              metadataEntityId: orderId,
            },
          );
          await fulfillPaidOrder({
            orderId,
            paymentRef: pi.id,
            gateway: PaymentGateway.STRIPE,
          });
        }
      }
    } catch (e) {
      if (!(e instanceof PaymentBindError)) throw e;
    }
  }

  if (event.type === "payment_intent.payment_failed") {
    const pi = event.data.object as Stripe.PaymentIntent;
    const orderId = pi.metadata?.orderId;
    const bookingId = pi.metadata?.consultationBookingId;
    const isConsultation = pi.metadata?.type === "consultation";
    if (isConsultation && bookingId) {
      await prisma.consultationBooking.updateMany({
        where: { id: bookingId, paymentStatus: PaymentStatus.PENDING },
        data: { paymentStatus: PaymentStatus.FAILED },
      });
    } else if (orderId) {
      await markRtwOrderPaymentFailed(orderId);
      const failedOrder = await prisma.order.findUnique({
        where: { id: orderId },
        select: { id: true, orderNumber: true },
      });
      if (failedOrder) void notifyPaymentFailed(failedOrder);
    }
  }

  return NextResponse.json({ received: true });
}
