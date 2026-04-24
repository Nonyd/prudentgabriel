import { NextRequest, NextResponse } from "next/server";
import { PaymentGateway, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPublicAppUrl } from "@/lib/app-url";
import { verifyTransaction } from "@/lib/payments/monnify";
import { fulfillPaidConsultationBooking } from "@/lib/consultation-payment";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const paymentReference = searchParams.get("paymentReference");
  const bookingId = searchParams.get("bookingId");
  const appUrl = getPublicAppUrl();

  if (!paymentReference || !bookingId) {
    return NextResponse.redirect(`${appUrl}/consultation?error=payment-failed`);
  }

  try {
    const result = await verifyTransaction(paymentReference);
    const booking = await prisma.consultationBooking.findUnique({ where: { id: bookingId } });
    if (!booking) {
      return NextResponse.redirect(`${appUrl}/consultation?error=payment-failed`);
    }

    if (result.status === "PAID") {
      await fulfillPaidConsultationBooking({
        bookingId: booking.id,
        paymentRef: result.paymentReference,
        gateway: PaymentGateway.MONNIFY,
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
