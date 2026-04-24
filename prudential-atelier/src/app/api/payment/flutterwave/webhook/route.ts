import { NextRequest, NextResponse } from "next/server";
import { PaymentGateway } from "@prisma/client";
import { verifyWebhookSignature } from "@/lib/payments/flutterwave";
import { fulfillPaidOrder } from "@/lib/order-payment";
import { fulfillPaidConsultationBooking } from "@/lib/consultation-payment";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("verif-hash") ?? req.headers.get("flutterwave-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return new Response(null, { status: 401 });
  }

  let payload: {
    event?: string;
    data?: { status?: string; tx_ref?: string; meta?: { orderId?: string; bookingId?: string } };
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
    if (bookingId && txRef) {
      await fulfillPaidConsultationBooking({
        bookingId,
        paymentRef: txRef,
        gateway: PaymentGateway.FLUTTERWAVE,
      });
    } else if (orderId && txRef) {
      await fulfillPaidOrder({
        orderId,
        paymentRef: txRef,
        gateway: PaymentGateway.FLUTTERWAVE,
      });
    }
  }

  return NextResponse.json({ received: true });
}
