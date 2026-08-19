import { NextRequest, NextResponse } from "next/server";
import { PaymentGateway, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPublicAppUrl } from "@/lib/app-url";
import { verifyTransaction } from "@/lib/payments/paystack";
import { fulfillPaidConsultationBooking } from "@/lib/consultation-payment";
import {
  assertPspChargeBinds,
  expectedAmountInPspUnits,
  PaymentBindError,
} from "@/lib/payment-bind";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get("reference");
  const bookingId = searchParams.get("bookingId");
  const appUrl = getPublicAppUrl();

  if (!reference || !bookingId) {
    return NextResponse.redirect(`${appUrl}/consultation?error=payment-failed`);
  }

  try {
    const result = await verifyTransaction(reference);
    const booking = await prisma.consultationBooking.findUnique({ where: { id: bookingId } });
    if (!booking) {
      return NextResponse.redirect(`${appUrl}/consultation?error=payment-failed`);
    }

    if (result.status === "success") {
      assertPspChargeBinds(
        {
          id: booking.id,
          storedReference: booking.paymentRef,
          expectedAmount: expectedAmountInPspUnits(PaymentGateway.PAYSTACK, booking.feeNGN),
          expectedCurrency: "NGN",
        },
        {
          gateway: PaymentGateway.PAYSTACK,
          reference: result.reference,
          amount: result.amount,
          currency: result.currency,
          metadataEntityId: result.metadata.bookingId,
        },
      );
      await fulfillPaidConsultationBooking({
        bookingId: booking.id,
        paymentRef: result.reference,
        gateway: PaymentGateway.PAYSTACK,
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
