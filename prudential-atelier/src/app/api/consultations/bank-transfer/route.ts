import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PaymentGateway, PaymentStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  sendBankTransferAdminNotification,
  sendBankTransferReceiptReceivedEmail,
} from "@/lib/email";
import { getPublicAppUrl } from "@/lib/app-url";

const bodySchema = z.object({
  bookingId: z.string().min(1),
  receiptUrl: z.string().url(),
  guestEmail: z.string().email().optional(),
});

export async function POST(req: NextRequest) {
  // Intentionally not gated by atelier_bookings_enabled: this pays an existing booking.
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

  const { bookingId, receiptUrl, guestEmail } = parsed.data;
  const booking = await prisma.consultationBooking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.paymentGateway !== PaymentGateway.BANK_TRANSFER) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if (booking.paymentStatus !== PaymentStatus.PENDING) {
    return NextResponse.json({ error: "Booking is not awaiting payment" }, { status: 400 });
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

  await prisma.consultationBooking.update({
    where: { id: booking.id },
    data: { paymentReceiptUrl: receiptUrl },
  });

  void sendBankTransferReceiptReceivedEmail({
    to: booking.clientEmail,
    clientName: booking.clientName,
    ref: booking.bookingNumber,
    amountNGN: booking.feeNGN,
  });
  void sendBankTransferAdminNotification({
    ref: booking.bookingNumber,
    clientName: booking.clientName,
    amountNGN: booking.feeNGN,
    receiptUrl,
  });

  return NextResponse.json({
    success: true,
    redirectUrl: `${getPublicAppUrl()}/payment/pending?reference=${encodeURIComponent(booking.bookingNumber)}&type=consultation`,
  });
}
