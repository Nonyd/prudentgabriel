import { NextRequest, NextResponse } from "next/server";
import { PaymentGateway, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPublicAppUrl } from "@/lib/app-url";
import { verifyTransaction } from "@/lib/payments/flutterwave";
import { fulfillPaidConsultationBooking } from "@/lib/consultation-payment";

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
      if (result.meta?.bookingId && result.meta.bookingId !== bookingId) {
        return NextResponse.redirect(`${appUrl}/consultation?error=payment-failed`);
      }
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
  } catch {
    return NextResponse.redirect(`${appUrl}/consultation?error=payment-failed`);
  }

  return NextResponse.redirect(`${appUrl}/consultation?error=payment-failed`);
}
