import { NextRequest, NextResponse } from "next/server";
import { ConsultationStatus, PaymentStatus } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toPublicConsultationDto } from "@/lib/public-pii-dtos";
import { rateLimitOr429 } from "@/lib/rate-limit";
import { sendConsultationCancelledEmail } from "@/lib/email";
import { notifyConsultationCancelledByClient } from "@/lib/notifications";
import { provenEmail } from "@/lib/email-verification";

function isBookingNumber(id: string): boolean {
  return id.startsWith("CB-");
}

async function findBooking(id: string) {
  if (isBookingNumber(id)) {
    return prisma.consultationBooking.findUnique({
      where: { bookingNumber: id },
      include: {
        consultant: true,
        offering: true,
      },
    });
  }
  return prisma.consultationBooking.findUnique({
    where: { id },
    include: {
      consultant: true,
      offering: true,
    },
  });
}

function canAccessPublicSuccess(booking: { paymentStatus: PaymentStatus; status: ConsultationStatus }): boolean {
  if (booking.status === ConsultationStatus.PENDING_PAYMENT && booking.paymentStatus === PaymentStatus.PENDING) {
    return false;
  }
  return true;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const booking = await findBooking(id);
  if (!booking) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (isBookingNumber(id)) {
    const limited = await rateLimitOr429(req, "consultation-ref", 20, 15 * 60 * 1000);
    if (limited) return limited;
    if (!canAccessPublicSuccess(booking)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ booking: toPublicConsultationDto(booking) });
  }

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // A booking made under her email before she signed up is hers once she has proven it.
  const email = await provenEmail(session.user.id);
  const ok =
    booking.userId === session.user.id || (email !== null && booking.clientEmail.toLowerCase() === email);
  if (!ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ booking });
}

const patchBodySchema = z.object({
  status: z.literal(ConsultationStatus.CANCELLED_BY_CLIENT).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;
  if (isBookingNumber(id)) {
    return NextResponse.json({ error: "Use booking id from account" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const booking = await prisma.consultationBooking.findUnique({
    where: { id },
    include: { consultant: { select: { name: true } } },
  });
  if (!booking) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Signed in only: knowing a booking id and the client email is not enough to cancel.
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const email = await provenEmail(session.user.id);
  const userOk = booking.userId === session.user.id || (email !== null && email === booking.clientEmail.toLowerCase());
  if (!userOk) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (parsed.data.status === ConsultationStatus.CANCELLED_BY_CLIENT) {
    if (booking.status !== ConsultationStatus.CONFIRMED || !booking.confirmedDate) {
      return NextResponse.json({ error: "Cannot cancel this booking" }, { status: 400 });
    }
    const now = Date.now();
    const sessionStart = booking.confirmedDate.getTime();
    const ms48 = 48 * 60 * 60 * 1000;
    if (sessionStart - now < ms48) {
      return NextResponse.json({ error: "Cancellation must be at least 48 hours before the session" }, { status: 400 });
    }
    await prisma.consultationBooking.update({
      where: { id },
      data: { status: ConsultationStatus.CANCELLED_BY_CLIENT },
    });
    void sendConsultationCancelledEmail({
      to: booking.clientEmail,
      clientName: booking.clientName,
      bookingNumber: booking.bookingNumber,
      consultantName: booking.consultant.name,
      reason: "You cancelled this booking.",
    });
    notifyConsultationCancelledByClient(booking);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}
