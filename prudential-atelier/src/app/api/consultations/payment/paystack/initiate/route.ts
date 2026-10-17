import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PaymentStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPublicAppUrl } from "@/lib/app-url";
import { initializeTransaction } from "@/lib/payments/paystack";
import { consultationGatewayEmail } from "@/lib/payments/payer-email";
import { asPaystackCurrency, paystackConsultationCharge, paystackSubunits } from "@/lib/payments/paystack-amount";
import { paystackChargeCurrency } from "@/lib/payments/config";

const bodySchema = z.object({
  bookingId: z.string().min(1),
  guestEmail: z.string().email().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { bookingId, guestEmail } = parsed.data;
  const booking = await prisma.consultationBooking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.paymentStatus !== PaymentStatus.PENDING) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (booking.userId) {
    if (session?.user?.id !== booking.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    const ge = guestEmail?.trim().toLowerCase();
    if (!ge || ge !== booking.clientEmail.toLowerCase()) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const email = consultationGatewayEmail(booking);
  const appUrl = getPublicAppUrl();
  const callbackUrl = `${appUrl}/api/consultations/payment/paystack/verify?bookingId=${encodeURIComponent(bookingId)}`;
  // BA3: the booking's own currency and its locked amount (the figure she was shown),
  // or its naira fee while Paystack cannot charge that currency.
  const chargeIn = await paystackChargeCurrency(asPaystackCurrency(booking.currency));
  const { major, currency } = await paystackConsultationCharge(booking, chargeIn);

  const init = await initializeTransaction({
    email,
    amountKobo: paystackSubunits(major),
    currency,
    reference: booking.bookingNumber,
    callbackUrl,
    metadata: {
      bookingId: booking.id,
      bookingNumber: booking.bookingNumber,
      type: "consultation",
    },
  });

  await prisma.consultationBooking.update({
    where: { id: booking.id },
    data: { paymentRef: init.reference },
  });

  return NextResponse.json({ authorizationUrl: init.authorizationUrl, reference: init.reference });
}
