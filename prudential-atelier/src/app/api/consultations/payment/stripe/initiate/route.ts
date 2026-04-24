import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PaymentStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getExchangeRates, convertFromNGN } from "@/lib/currency";
import { createConsultationPaymentIntent } from "@/lib/payments/stripe";

const bodySchema = z.object({
  bookingId: z.string().min(1),
  currency: z.enum(["USD", "GBP"]),
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

  const { bookingId, currency, guestEmail } = parsed.data;
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

  const rates = await getExchangeRates();
  const converted = convertFromNGN(booking.feeNGN, currency, rates);
  const amountCents = Math.max(50, Math.round(converted * 100));

  const email = session?.user?.email ?? booking.clientEmail;

  const { clientSecret, paymentIntentId } = await createConsultationPaymentIntent({
    amountCents,
    currency: currency.toLowerCase() as "usd" | "gbp",
    bookingId: booking.id,
    bookingNumber: booking.bookingNumber,
    customerEmail: email,
  });

  await prisma.consultationBooking.update({
    where: { id: booking.id },
    data: { paymentRef: paymentIntentId },
  });

  return NextResponse.json({ clientSecret, publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "" });
}
