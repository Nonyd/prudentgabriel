import { NextRequest, NextResponse } from "next/server";
import { PaymentGateway } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPublicAppUrl } from "@/lib/app-url";
import { verifyTransaction } from "@/lib/payments/monnify";
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
      assertPspChargeBinds(
        {
          id: order.id,
          storedReference: order.paymentRef,
          expectedAmount: expectedAmountInPspUnits(PaymentGateway.MONNIFY, rtwChargeAmountNGN(order)),
          expectedCurrency: String(order.currency),
        },
        {
          gateway: PaymentGateway.MONNIFY,
          reference: result.paymentReference,
          amount: result.amountPaid,
          currency: result.currency,
          metadataEntityId: result.paymentReference === order.orderNumber ? order.id : null,
        },
      );
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

    await markRtwOrderPaymentFailed(orderId);
  } catch (e) {
    if (e instanceof PaymentBindError) {
      return NextResponse.redirect(`${appUrl}/checkout?error=payment-failed`);
    }
    return NextResponse.redirect(`${appUrl}/checkout?error=payment-failed`);
  }

  return NextResponse.redirect(`${appUrl}/checkout?error=payment-failed`);
}
