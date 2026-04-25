import { NextRequest, NextResponse } from "next/server";
import { PaymentGateway, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature } from "@/lib/payments/paystack";
import { fulfillPaidOrder } from "@/lib/order-payment";
import { notifyPaymentFailed } from "@/lib/notifications";
import { fulfillPaidConsultationBooking } from "@/lib/consultation-payment";
import { fulfillPaidBespokeBalance } from "@/lib/bespoke-payment";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return new Response(null, { status: 401 });
  }

  let event: {
    event?: string;
    data?: {
      status?: string;
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
    if (isBespokeBalance && bespokeRequestId) {
      await fulfillPaidBespokeBalance({
        bespokeRequestId,
        paymentRef: ref,
        gateway: PaymentGateway.PAYSTACK,
      });
    } else if (isConsultation && bookingId) {
      await fulfillPaidConsultationBooking({
        bookingId,
        paymentRef: ref,
        gateway: PaymentGateway.PAYSTACK,
      });
    } else if (orderId) {
      await fulfillPaidOrder({ orderId, paymentRef: ref, gateway: PaymentGateway.PAYSTACK });
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
