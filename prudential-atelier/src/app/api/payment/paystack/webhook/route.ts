import { NextRequest, NextResponse } from "next/server";
import { PaymentGateway, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature, verifyTransaction } from "@/lib/payments/paystack";
import { fulfillPaidOrder } from "@/lib/order-payment";
import { notifyPaymentFailed } from "@/lib/notifications";
import { fulfillPaidConsultationBooking } from "@/lib/consultation-payment";
import { fulfillPaidBespokeBalance } from "@/lib/bespoke-payment";
import {
  assertPspChargeBinds,
  expectedAmountInPspUnits,
  PaymentBindError,
} from "@/lib/payment-bind";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature");

  if (!(await verifyWebhookSignature(rawBody, signature))) {
    return new Response(null, { status: 401 });
  }

  let event: {
    event?: string;
    data?: {
      status?: string;
      amount?: number;
      currency?: string;
      reference?: string;
      metadata?: { orderId?: string; bookingId?: string; bespokeRequestId?: string; type?: string };
    };
  };
  try {
    event = JSON.parse(rawBody) as typeof event;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const orderId = event.data?.metadata?.orderId;
  const bookingId = event.data?.metadata?.bookingId;
  const bespokeRequestId = event.data?.metadata?.bespokeRequestId;
  const isConsultation = event.data?.metadata?.type === "consultation";
  const isBespokeBalance = event.data?.metadata?.type === "bespoke_balance";
  const ref = event.data?.reference;

  if (event.event === "charge.success" && ref && event.data?.status === "success") {
    try {
      if (isBespokeBalance && bespokeRequestId) {
        const verified = await verifyTransaction(ref);
        const metaId = verified.metadata.bespokeRequestId;
        if (metaId && metaId !== bespokeRequestId) {
          throw new PaymentBindError(
            "REFERENCE_MISMATCH",
            "Paystack bespoke metadata does not match the webhook booking",
          );
        }
        await fulfillPaidBespokeBalance({
          bespokeRequestId,
          paymentRef: ref,
          gateway: PaymentGateway.PAYSTACK,
        });
      } else if (isConsultation && bookingId) {
        const booking = await prisma.consultationBooking.findUnique({ where: { id: bookingId } });
        if (booking) {
          assertPspChargeBinds(
            {
              id: booking.id,
              storedReference: booking.paymentRef,
              expectedAmount: expectedAmountInPspUnits(PaymentGateway.PAYSTACK, booking.feeNGN),
              expectedCurrency: "NGN",
            },
            {
              gateway: PaymentGateway.PAYSTACK,
              reference: ref,
              amount: event.data.amount ?? 0,
              currency: event.data.currency ?? "NGN",
              metadataEntityId: bookingId,
            },
          );
          await fulfillPaidConsultationBooking({
            bookingId,
            paymentRef: ref,
            gateway: PaymentGateway.PAYSTACK,
          });
        }
      } else if (orderId) {
        const order = await prisma.order.findUnique({ where: { id: orderId } });
        if (order) {
          assertPspChargeBinds(
            {
              id: order.id,
              storedReference: order.paymentRef,
              expectedAmount: expectedAmountInPspUnits(PaymentGateway.PAYSTACK, order.total),
              expectedCurrency: String(order.currency),
            },
            {
              gateway: PaymentGateway.PAYSTACK,
              reference: ref,
              amount: event.data.amount ?? 0,
              currency: event.data.currency ?? "NGN",
              metadataEntityId: orderId,
            },
          );
          await fulfillPaidOrder({ orderId, paymentRef: ref, gateway: PaymentGateway.PAYSTACK });
        }
      }
    } catch (e) {
      if (!(e instanceof PaymentBindError)) throw e;
    }
  }

  if (event.event === "charge.failed" && orderId) {
    await prisma.order.updateMany({
      where: { id: orderId, paymentStatus: PaymentStatus.PENDING },
      data: { paymentStatus: PaymentStatus.FAILED },
    });
    const failedOrder = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, orderNumber: true },
    });
    if (failedOrder) void notifyPaymentFailed(failedOrder);
  }

  if (event.event === "charge.failed" && isConsultation && bookingId) {
    await prisma.consultationBooking.updateMany({
      where: { id: bookingId, paymentStatus: PaymentStatus.PENDING },
      data: { paymentStatus: PaymentStatus.FAILED },
    });
  }

  if (event.event === "charge.failed" && isBespokeBalance && bespokeRequestId) {
    await prisma.bespokeRequest.updateMany({
      where: { id: bespokeRequestId, balancePaymentStatus: PaymentStatus.PENDING },
      data: { balancePaymentStatus: PaymentStatus.FAILED },
    });
  }

  return NextResponse.json({ received: true });
}
