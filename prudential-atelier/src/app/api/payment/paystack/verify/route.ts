import { NextRequest, NextResponse } from "next/server";
import { PaymentGateway } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPublicAppUrl } from "@/lib/app-url";
import { verifyTransaction } from "@/lib/payments/paystack";
import { fulfillPaidOrder } from "@/lib/order-payment";
import { rtwChargeAmountNGN } from "@/lib/payments/rtw-totals";
import { markRtwOrderPaymentFailed } from "@/lib/checkout-reservations";
import {
  assertPspChargeBinds,
  expectedAmountInPspUnits,
  PaymentBindError,
} from "@/lib/payment-bind";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get("reference");
  const orderId = searchParams.get("orderId");
  const appUrl = getPublicAppUrl();

  if (!reference || !orderId) {
    return NextResponse.redirect(`${appUrl}/checkout?error=payment-failed`);
  }

  try {
    const result = await verifyTransaction(reference);
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return NextResponse.redirect(`${appUrl}/checkout?error=payment-failed`);
    }

    if (result.status === "success") {
      assertPspChargeBinds(
        {
          id: order.id,
          storedReference: order.paymentRef,
          expectedAmount: expectedAmountInPspUnits(PaymentGateway.PAYSTACK, rtwChargeAmountNGN(order)),
          expectedCurrency: String(order.currency),
        },
        {
          gateway: PaymentGateway.PAYSTACK,
          reference: result.reference,
          amount: result.amount,
          currency: result.currency,
          metadataEntityId: result.metadata.orderId,
        },
      );
      await fulfillPaidOrder({
        orderId: order.id,
        paymentRef: result.reference,
        gateway: PaymentGateway.PAYSTACK,
      });
      const emailQ = order.guestEmail ? `&email=${encodeURIComponent(order.guestEmail)}` : "";
      return NextResponse.redirect(
        `${appUrl}/checkout/success?order=${encodeURIComponent(order.orderNumber)}${emailQ}`,
      );
    }

    await markRtwOrderPaymentFailed(orderId);
  } catch (e) {
    if (e instanceof PaymentBindError) {
      return NextResponse.redirect(`${appUrl}/checkout?error=payment-failed`);
    }
    return NextResponse.redirect(`${appUrl}/checkout?error=payment-failed`);
  }

  return NextResponse.redirect(`${appUrl}/checkout?error=payment-failed`);
}
