import { NextRequest, NextResponse } from "next/server";
import { PaymentGateway } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPublicAppUrl } from "@/lib/app-url";
import { verifyTransaction } from "@/lib/payments/flutterwave";
import { fulfillPaidOrder } from "@/lib/order-payment";
import { rtwChargeAmountForeign, rtwChargeAmountNGN } from "@/lib/payments/rtw-totals";
import { markRtwOrderPaymentFailed } from "@/lib/checkout-reservations";
import type { ShopCurrency } from "@/lib/currency";
import { lockedFxFromOrder } from "@/lib/fx";
import {
  assertPspChargeBinds,
  expectedAmountInPspUnits,
  PaymentBindError,
} from "@/lib/payment-bind";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const transactionId = searchParams.get("transaction_id");
  const orderId = searchParams.get("orderId");
  const appUrl = getPublicAppUrl();

  if (!transactionId || !orderId) {
    return NextResponse.redirect(`${appUrl}/checkout?error=payment-failed`);
  }

  try {
    const result = await verifyTransaction(transactionId);
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return NextResponse.redirect(`${appUrl}/checkout?error=payment-failed`);
    }

    if (result.status === "successful") {
      const cur = result.currency.trim().toUpperCase() as ShopCurrency | string;
      const fx = lockedFxFromOrder(order);
      const major =
        cur === "USD" || cur === "GBP"
          ? rtwChargeAmountForeign(order, cur, fx)
          : rtwChargeAmountNGN(order);
      const expected = {
        amount: expectedAmountInPspUnits(PaymentGateway.FLUTTERWAVE, major),
        currency: cur === "USD" || cur === "GBP" ? cur : "NGN",
      };
      assertPspChargeBinds(
        {
          id: order.id,
          storedReference: order.paymentRef,
          expectedAmount: expected.amount,
          expectedCurrency: expected.currency,
        },
        {
          gateway: PaymentGateway.FLUTTERWAVE,
          reference: result.txRef,
          amount: result.amount,
          currency: result.currency,
          metadataEntityId: result.meta.orderId,
        },
      );
      await fulfillPaidOrder({
        orderId: order.id,
        paymentRef: result.txRef,
        gateway: PaymentGateway.FLUTTERWAVE,
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
