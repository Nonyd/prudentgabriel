import { NextRequest, NextResponse } from "next/server";
import { PaymentGateway, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPublicAppUrl } from "@/lib/app-url";
import { verifyTransaction } from "@/lib/payments/monnify";
import { fulfillPaidOrder } from "@/lib/order-payment";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const paymentReference = searchParams.get("paymentReference");
  const orderId = searchParams.get("orderId");
  const appUrl = getPublicAppUrl();

  if (!paymentReference || !orderId) {
    return NextResponse.redirect(`${appUrl}/checkout?error=payment-failed`);
  }

  try {
    const result = await verifyTransaction(paymentReference);
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return NextResponse.redirect(`${appUrl}/checkout?error=payment-failed`);
    }

    if (result.status === "PAID") {
      await fulfillPaidOrder({
        orderId: order.id,
        paymentRef: result.paymentReference,
        gateway: PaymentGateway.MONNIFY,
      });
      const emailQ = order.guestEmail ? `&email=${encodeURIComponent(order.guestEmail)}` : "";
      return NextResponse.redirect(
        `${appUrl}/checkout/success?order=${encodeURIComponent(order.orderNumber)}${emailQ}`,
      );
    }

    await prisma.order.updateMany({
      where: { id: orderId, paymentStatus: PaymentStatus.PENDING },
      data: { paymentStatus: PaymentStatus.FAILED },
    });
  } catch {
    return NextResponse.redirect(`${appUrl}/checkout?error=payment-failed`);
  }

  return NextResponse.redirect(`${appUrl}/checkout?error=payment-failed`);
}
