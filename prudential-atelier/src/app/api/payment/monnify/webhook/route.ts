import { NextRequest, NextResponse } from "next/server";
import { PaymentGateway } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature, verifyTransaction } from "@/lib/payments/monnify";
import { fulfillPaidOrder } from "@/lib/order-payment";
import { fulfillPaidConsultationBooking } from "@/lib/consultation-payment";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("monnify-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
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
          await fulfillPaidConsultationBooking({
            bookingId: booking.id,
            paymentRef: v.paymentReference,
            gateway: PaymentGateway.MONNIFY,
          });
        } else {
          const order = await prisma.order.findUnique({
            where: { orderNumber: v.paymentReference },
          });
          if (order) {
            await fulfillPaidOrder({
              orderId: order.id,
              paymentRef: v.paymentReference,
              gateway: PaymentGateway.MONNIFY,
            });
          }
        }
      }
    }
  } catch {
    /* ignore parse / verify errors */
  }

  return NextResponse.json({ received: true });
}
