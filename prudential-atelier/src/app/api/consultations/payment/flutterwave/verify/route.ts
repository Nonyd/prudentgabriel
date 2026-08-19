import { NextRequest, NextResponse } from "next/server";
import { PaymentGateway, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPublicAppUrl } from "@/lib/app-url";
import { verifyTransaction } from "@/lib/payments/flutterwave";
import { fulfillPaidConsultationBooking } from "@/lib/consultation-payment";
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
  const bookingId = searchParams.get("bookingId");
  const appUrl = getPublicAppUrl();

  if (!transactionId || !bookingId) {
    return NextResponse.redirect(`${appUrl}/consultation?error=payment-failed`);
  }

  try {
    const result = await verifyTransaction(transactionId);
    const booking = await prisma.consultationBooking.findUnique({ where: { id: bookingId } });
    if (!booking) {
      return NextResponse.redirect(`${appUrl}/consultation?error=payment-failed`);
    }

    if (result.status === "successful") {
      const expected = await expectedFlutterwaveCharge(booking.feeNGN, result.currency);
      assertPspChargeBinds(
        {
          id: booking.id,
          storedReference: booking.paymentRef,
          expectedAmount: expected.amount,
          expectedCurrency: expected.currency,
        },
        {
          gateway: PaymentGateway.FLUTTERWAVE,
          reference: result.txRef,
          amount: result.amount,
          currency: result.currency,
          metadataEntityId: result.meta.bookingId,
        },
      );
      await fulfillPaidConsultationBooking({
        bookingId: booking.id,
        paymentRef: result.txRef,
        gateway: PaymentGateway.FLUTTERWAVE,
      });
      return NextResponse.redirect(
        `${appUrl}/consultation/success?booking=${encodeURIComponent(booking.bookingNumber)}`,
      );
    }

    await prisma.consultationBooking.updateMany({
      where: { id: bookingId, paymentStatus: PaymentStatus.PENDING },
      data: { paymentStatus: PaymentStatus.FAILED },
    });
  } catch (e) {
    if (e instanceof PaymentBindError) {
      return NextResponse.redirect(`${appUrl}/consultation?error=payment-failed`);
    }
    return NextResponse.redirect(`${appUrl}/consultation?error=payment-failed`);
  }

  return NextResponse.redirect(`${appUrl}/consultation?error=payment-failed`);
}
