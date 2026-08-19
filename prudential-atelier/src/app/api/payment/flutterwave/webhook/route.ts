import { NextRequest, NextResponse } from "next/server";
import { PaymentGateway } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature, verifyTransaction } from "@/lib/payments/flutterwave";
import { fulfillPaidOrder } from "@/lib/order-payment";
import { fulfillPaidConsultationBooking } from "@/lib/consultation-payment";
import { convertFromNGN, getExchangeRates, type ShopCurrency } from "@/lib/currency";
import {
  assertPspChargeBinds,
  expectedAmountInPspUnits,
  PaymentBindError,
} from "@/lib/payment-bind";

async function expectedFlutterwaveCharge(totalNGN: number, pspCurrency: string) {
  const cur = pspCurrency.trim().toUpperCase();
  if (cur === "USD" || cur === "GBP") {
    const rates = await getExchangeRates();
    const major = convertFromNGN(totalNGN, cur as ShopCurrency, rates);
    return { amount: expectedAmountInPspUnits(PaymentGateway.FLUTTERWAVE, major), currency: cur };
  }
  return { amount: expectedAmountInPspUnits(PaymentGateway.FLUTTERWAVE, totalNGN), currency: "NGN" };
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("verif-hash") ?? req.headers.get("flutterwave-signature");

  if (!(await verifyWebhookSignature(rawBody, signature))) {
    return new Response(null, { status: 401 });
  }

  let payload: {
    event?: string;
    data?: {
      status?: string;
      amount?: number;
      currency?: string;
      tx_ref?: string;
      id?: number | string;
      meta?: { orderId?: string; bookingId?: string };
    };
  };
  try {
    payload = JSON.parse(rawBody) as typeof payload;
  } catch {
    return NextResponse.json({ received: true });
  }

  if (payload.event === "charge.completed" && payload.data?.status === "successful") {
    const orderId = payload.data.meta?.orderId;
    const bookingId = payload.data.meta?.bookingId;
    const txRef = payload.data.tx_ref;
    try {
      const verified = payload.data.id
        ? await verifyTransaction(String(payload.data.id))
        : null;
      const amount = verified?.amount ?? payload.data.amount ?? 0;
      const currency = verified?.currency ?? payload.data.currency ?? "NGN";
      const reference = verified?.txRef ?? txRef;
      const metaOrderId = verified?.meta.orderId ?? orderId;
      const metaBookingId = verified?.meta.bookingId ?? bookingId;

      if (bookingId && reference) {
        const booking = await prisma.consultationBooking.findUnique({ where: { id: bookingId } });
        if (booking) {
          const expected = await expectedFlutterwaveCharge(booking.feeNGN, currency);
          assertPspChargeBinds(
            {
              id: booking.id,
              storedReference: booking.paymentRef,
              expectedAmount: expected.amount,
              expectedCurrency: expected.currency,
            },
            {
              gateway: PaymentGateway.FLUTTERWAVE,
              reference,
              amount,
              currency,
              metadataEntityId: metaBookingId,
            },
          );
          await fulfillPaidConsultationBooking({
            bookingId,
            paymentRef: reference,
            gateway: PaymentGateway.FLUTTERWAVE,
          });
        }
      } else if (orderId && reference) {
        const order = await prisma.order.findUnique({ where: { id: orderId } });
        if (order) {
          const expected = await expectedFlutterwaveCharge(order.total, currency);
          assertPspChargeBinds(
            {
              id: order.id,
              storedReference: order.paymentRef,
              expectedAmount: expected.amount,
              expectedCurrency: expected.currency,
            },
            {
              gateway: PaymentGateway.FLUTTERWAVE,
              reference,
              amount,
              currency,
              metadataEntityId: metaOrderId,
            },
          );
          await fulfillPaidOrder({
            orderId,
            paymentRef: reference,
            gateway: PaymentGateway.FLUTTERWAVE,
          });
        }
      }
    } catch (e) {
      if (!(e instanceof PaymentBindError)) throw e;
    }
  }

  return NextResponse.json({ received: true });
}
