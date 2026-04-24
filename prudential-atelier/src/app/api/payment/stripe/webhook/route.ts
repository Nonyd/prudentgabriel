import { NextRequest, NextResponse } from "next/server";
import { PaymentGateway, PaymentStatus } from "@prisma/client";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { verifyWebhookEvent } from "@/lib/payments/stripe";
import { fulfillPaidOrder } from "@/lib/order-payment";
import { notifyPaymentFailed } from "@/lib/notifications";
import { fulfillPaidConsultationBooking } from "@/lib/consultation-payment";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const buf = Buffer.from(await req.arrayBuffer());
  const sig = req.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = verifyWebhookEvent(buf, sig);
  } catch {
    return new Response("Bad signature", { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;
    const orderId = pi.metadata?.orderId;
    const bookingId = pi.metadata?.consultationBookingId;
    const isConsultation = pi.metadata?.type === "consultation";
    if (isConsultation && bookingId) {
      await fulfillPaidConsultationBooking({
        bookingId,
        paymentRef: pi.id,
        gateway: PaymentGateway.STRIPE,
      });
    } else if (orderId) {
      await fulfillPaidOrder({
        orderId,
        paymentRef: pi.id,
        gateway: PaymentGateway.STRIPE,
      });
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
  }

  return NextResponse.json({ received: true });
}
