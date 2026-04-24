import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PaymentStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPublicAppUrl } from "@/lib/app-url";
import { getExchangeRates, convertFromNGN } from "@/lib/currency";
import { initializeTransaction } from "@/lib/payments/flutterwave";

const bodySchema = z.object({
  bookingId: z.string().min(1),
  currency: z.enum(["NGN", "USD", "GBP"]),
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
  let amount = booking.feeNGN;
  if (currency === "USD") {
    amount = Math.round(convertFromNGN(booking.feeNGN, "USD", rates) * 100) / 100;
  } else if (currency === "GBP") {
    amount = Math.round(convertFromNGN(booking.feeNGN, "GBP", rates) * 100) / 100;
  }

  const email = session?.user?.email ?? booking.clientEmail;
  const name = session?.user?.name ?? booking.clientName;

  const appUrl = getPublicAppUrl();
  const redirectUrl = `${appUrl}/api/consultations/payment/flutterwave/verify?bookingId=${encodeURIComponent(bookingId)}`;

  const init = await initializeTransaction({
    txRef: booking.bookingNumber,
    amount,
    currency,
    email,
    name,
    phone: booking.clientPhone,
    redirectUrl,
    meta: { bookingId: booking.id },
  });

  return NextResponse.json({ paymentLink: init.paymentLink });
}
