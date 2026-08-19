import { NextRequest, NextResponse } from "next/server";
import { PaymentGateway, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPublicAppUrl } from "@/lib/app-url";
import { verifyTransaction } from "@/lib/payments/flutterwave";
import { fulfillPaidOrder } from "@/lib/order-payment";
import { convertFromNGN, getExchangeRates, type ShopCurrency } from "@/lib/currency";
import {
  assertPspChargeBinds,
  expectedAmountInPspUnits,
  PaymentBindError,
} from "@/lib/payment-bind";

async function expectedFlutterwaveCharge(totalNGN: number, pspCurrency: string) {
  const cur = pspCurrency.trim().toUpperCase();
  if (cur === "USD" || cur === "GBP") {
    const rates = await getExchangeRates();
    const major = convertFromNGN(totalNGN, cur as ShopCurrency, rates);
    return { amount: expectedAmountInPspUnits(PaymentGateway.FLUTTERWAVE, major), currency: cur };
  }
  return { amount: expectedAmountInPspUnits(PaymentGateway.FLUTTERWAVE, totalNGN), currency: "NGN" };
}

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
      const expected = await expectedFlutterwaveCharge(order.total, result.currency);
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

    await prisma.order.updateMany({
      where: { id: orderId, paymentStatus: PaymentStatus.PENDING },
      data: { paymentStatus: PaymentStatus.FAILED },
    });
  } catch (e) {
    if (e instanceof PaymentBindError) {
      return NextResponse.redirect(`${appUrl}/checkout?error=payment-failed`);
    }
    return NextResponse.redirect(`${appUrl}/checkout?error=payment-failed`);
  }

  return NextResponse.redirect(`${appUrl}/checkout?error=payment-failed`);
}
