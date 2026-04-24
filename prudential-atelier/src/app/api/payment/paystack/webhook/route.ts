import { NextRequest, NextResponse } from "next/server";
import { PaymentGateway } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature } from "@/lib/payments/paystack";
import { fulfillPaidOrder } from "@/lib/order-payment";
import { fulfillPaidConsultationBooking } from "@/lib/consultation-payment";

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
      metadata?: { orderId?: string; bookingId?: string; type?: string };
    };
  };
  try {
    event = JSON.parse(rawBody) as typeof event;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const orderId = event.data?.metadata?.orderId;
  const bookingId = event.data?.metadata?.bookingId;
  const isConsultation = event.data?.metadata?.type === "consultation";
  const ref = event.data?.reference;

  if (event.event === "charge.success" && ref && event.data?.status === "success") {
    if (isConsultation && bookingId) {
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
      where: { id: orderId, paymentStatus: "PENDING" },
      data: { paymentStatus: "FAILED" },
    });
  }

  if (event.event === "charge.failed" && isConsultation && bookingId) {
    await prisma.consultationBooking.updateMany({
      where: { id: bookingId, paymentStatus: "PENDING" },
      data: { paymentStatus: "FAILED" },
    });
  }

  return NextResponse.json({ received: true });
}
