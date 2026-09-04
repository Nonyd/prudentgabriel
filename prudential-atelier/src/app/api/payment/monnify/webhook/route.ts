import { NextRequest, NextResponse } from "next/server";
import { PaymentGateway } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature, verifyTransaction } from "@/lib/payments/monnify";
import { fulfillPaidOrder } from "@/lib/order-payment";
import { markRtwOrderPaymentFailed } from "@/lib/checkout-reservations";
import { fulfillPaidConsultationBooking } from "@/lib/consultation-payment";
import { rtwChargeAmountNGN } from "@/lib/payments/rtw-totals";
import {
  assertPspChargeBinds,
  expectedAmountInPspUnits,
  PaymentBindError,
} from "@/lib/payment-bind";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("monnify-signature");

  if (!(await verifyWebhookSignature(rawBody, signature))) {
    return new Response(null, { status: 401 });
  }

  try {
    const j = JSON.parse(rawBody) as {
      eventType?: string;
      paymentReference?: string;
      product?: { reference?: string };
    };

    if (j.eventType === "SUCCESSFUL_TRANSACTION" && j.paymentReference) {
      const v = await verifyTransaction(j.paymentReference);
      if (v.status === "PAID") {
        const booking = await prisma.consultationBooking.findUnique({
          where: { bookingNumber: v.paymentReference },
        });
        if (booking) {
          assertPspChargeBinds(
            {
              id: booking.id,
              storedReference: booking.paymentRef,
              expectedAmount: expectedAmountInPspUnits(PaymentGateway.MONNIFY, booking.feeNGN),
              expectedCurrency: "NGN",
            },
            {
              gateway: PaymentGateway.MONNIFY,
              reference: v.paymentReference,
              amount: v.amountPaid,
              currency: v.currency,
              metadataEntityId: v.paymentReference === booking.bookingNumber ? booking.id : null,
            },
          );
          await fulfillPaidConsultationBooking({
            bookingId: booking.id,
            paymentRef: v.paymentReference,
            gateway: PaymentGateway.MONNIFY,
          });
        } else {
          const order =
            (await prisma.order.findUnique({ where: { orderNumber: v.paymentReference } })) ??
            (await prisma.order.findFirst({ where: { paymentRef: v.paymentReference } }));
          if (order) {
            assertPspChargeBinds(
              {
                id: order.id,
                storedReference: order.paymentRef,
                expectedAmount: expectedAmountInPspUnits(PaymentGateway.MONNIFY, rtwChargeAmountNGN(order)),
                expectedCurrency: String(order.currency),
              },
              {
                gateway: PaymentGateway.MONNIFY,
                reference: v.paymentReference,
                amount: v.amountPaid,
                currency: v.currency,
                metadataEntityId: v.paymentReference === order.orderNumber ? order.id : null,
              },
            );
            await fulfillPaidOrder({
              orderId: order.id,
              paymentRef: v.paymentReference,
              gateway: PaymentGateway.MONNIFY,
            });
          }
        }
      }
    }

    if (
      (j.eventType === "FAILED_TRANSACTION" || j.eventType === "TRANSACTION_FAILED") &&
      j.paymentReference
    ) {
      const order =
        (await prisma.order.findUnique({ where: { orderNumber: j.paymentReference } })) ??
        (await prisma.order.findFirst({ where: { paymentRef: j.paymentReference } }));
      if (order) await markRtwOrderPaymentFailed(order.id);
    }
  } catch (e) {
    if (!(e instanceof PaymentBindError)) {
      /* ignore parse / verify errors */
    }
  }

  return NextResponse.json({ received: true });
}
