import { NextRequest, NextResponse } from "next/server";
import { ConsultationStatus, PaymentStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  addDaysToWatYmd,
  dateToWatYmd,
  generateBookingNumber,
  getAvailableSlots,
  getWatTomorrowYmd,
  getWatYmd,
  isManualFlow,
  ymdCompare,
} from "@/lib/consultation";
import { consultationBookingSchema } from "@/validations/consultation";

function parseDateParamToUtcDay(ymd: string): Date {
  const [y, mo, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = consultationBookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  const offering = await prisma.consultantOffering.findFirst({
    where: {
      id: data.offeringId,
      consultantId: data.consultantId,
      isActive: true,
      consultant: { isActive: true },
    },
    include: { consultant: true },
  });
  if (!offering) {
    return NextResponse.json({ error: "Invalid offering" }, { status: 400 });
  }

  const manual = isManualFlow(offering.deliveryMode, offering.consultant.isFlagship);

  if (manual) {
    if (!data.preferredDate1) {
      return NextResponse.json({ error: "Preferred date required" }, { status: 400 });
    }
    const minYmd = addDaysToWatYmd(getWatYmd(), 3);
    const d1 = dateToWatYmd(data.preferredDate1);
    if (ymdCompare(d1, minYmd) < 0) {
      return NextResponse.json({ error: "Preferred dates must be at least 3 days from today" }, { status: 400 });
    }
    if (data.preferredDate2) {
      const d2 = dateToWatYmd(data.preferredDate2);
      if (ymdCompare(d2, minYmd) < 0) {
        return NextResponse.json({ error: "Second preference must meet minimum lead time" }, { status: 400 });
      }
    }
    if (data.preferredDate3) {
      const d3 = dateToWatYmd(data.preferredDate3);
      if (ymdCompare(d3, minYmd) < 0) {
        return NextResponse.json({ error: "Third preference must meet minimum lead time" }, { status: 400 });
      }
    }
  } else {
    if (!data.confirmedDate || !data.confirmedTime) {
      return NextResponse.json({ error: "Date and time required" }, { status: 400 });
    }
    const ymd = dateToWatYmd(data.confirmedDate);
    const tomorrow = getWatTomorrowYmd();
    if (ymdCompare(ymd, tomorrow) < 0) {
      return NextResponse.json({ error: "Date must be from tomorrow onward" }, { status: 400 });
    }
    const slots = await getAvailableSlots(data.consultantId, ymd, offering.durationMinutes);
    if (!slots.includes(data.confirmedTime)) {
      return NextResponse.json({ error: "Selected slot is no longer available" }, { status: 409 });
    }
  }

  const bookingNumber = generateBookingNumber();
  const confirmedDate =
    !manual && data.confirmedDate ? parseDateParamToUtcDay(dateToWatYmd(data.confirmedDate)) : null;
  const confirmedTime = !manual ? data.confirmedTime ?? null : null;

  const booking = await prisma.$transaction(async (tx) => {
    return tx.consultationBooking.create({
      data: {
        bookingNumber,
        offeringId: offering.id,
        consultantId: offering.consultantId,
        userId: session?.user?.id ?? null,
        clientName: data.clientName,
        clientEmail: data.clientEmail.trim().toLowerCase(),
        clientPhone: data.clientPhone,
        clientCountry: data.clientCountry,
        clientInstagram: data.clientInstagram?.trim() || null,
        occasion: data.occasion,
        description: data.description,
        referenceImages: data.referenceImages,
        preferredDate1: manual ? data.preferredDate1 : null,
        preferredDate2: manual ? data.preferredDate2 ?? null : null,
        preferredDate3: manual ? data.preferredDate3 ?? null : null,
        confirmedDate,
        confirmedTime,
        feeNGN: offering.feeNGN,
        currency: data.currency,
        paymentStatus: PaymentStatus.PENDING,
        status: ConsultationStatus.PENDING_PAYMENT,
      },
    });
  });

  return NextResponse.json({
    bookingId: booking.id,
    bookingNumber: booking.bookingNumber,
    feeNGN: booking.feeNGN,
    currency: booking.currency,
  });
}
