import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PaymentStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPublicAppUrl } from "@/lib/app-url";
import { initializeTransaction } from "@/lib/payments/monnify";

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

  const appUrl = getPublicAppUrl();
  const redirectUrl = `${appUrl}/api/consultations/payment/monnify/verify?bookingId=${encodeURIComponent(bookingId)}`;

  const customerEmail = session?.user?.email ?? booking.clientEmail;
  const customerName = session?.user?.name ?? booking.clientName;

  const init = await initializeTransaction({
    amountNGN: Math.round(booking.feeNGN),
    reference: booking.bookingNumber,
    customerEmail,
    customerName,
    description: `Prudential Atelier Consultation #${booking.bookingNumber}`,
    redirectUrl,
  });

  return NextResponse.json({ checkoutUrl: init.checkoutUrl });
}
