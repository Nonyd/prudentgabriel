import { NextRequest, NextResponse } from "next/server";
import { ConsultationStatus, PaymentStatus } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const booking = await findBooking(id);
  if (!booking) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (isBookingNumber(id)) {
    if (!canAccessPublicSuccess(booking)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ booking });
  }

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const email = session.user.email?.toLowerCase();
  const ok =
    booking.userId === session.user.id || (email && booking.clientEmail.toLowerCase() === email);
  if (!ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ booking });
}

const patchBodySchema = z.object({
  status: z.literal(ConsultationStatus.CANCELLED_BY_CLIENT).optional(),
  guestEmail: z.string().email().optional(),
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

  const booking = await prisma.consultationBooking.findUnique({ where: { id } });
  if (!booking) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const email = session?.user?.email?.toLowerCase();
  const guestOk =
    parsed.data.guestEmail && parsed.data.guestEmail.toLowerCase() === booking.clientEmail.toLowerCase();
  const userOk = session?.user?.id && (booking.userId === session.user.id || email === booking.clientEmail.toLowerCase());
  if (!userOk && !guestOk) {
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
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}
