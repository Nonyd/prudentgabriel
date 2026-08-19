import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { getOfferingTypeLabel } from "@/lib/consultation-types";

export async function GET(req: NextRequest) {
  const gate = await requireAdminApi("consultations");
  if (!gate.ok) return gate.response;

  const ref = new URL(req.url).searchParams.get("ref")?.trim();
  if (!ref) {
    return NextResponse.json({ error: "Consultation reference is required" }, { status: 400 });
  }

  const booking = await prisma.consultationBooking.findFirst({
    where: {
      bookingNumber: { equals: ref, mode: "insensitive" },
    },
    include: {
      user: { include: { clientProfile: true } },
      offering: { select: { sessionType: true } },
    },
  });

  if (!booking) {
    return NextResponse.json({ found: false });
  }

  const existingQuote = await prisma.quotation.findFirst({
    where: { consultationId: booking.id },
    select: { id: true, quoteRef: true, status: true },
  });

  return NextResponse.json({
    found: true,
    booking: {
      id: booking.id,
      bookingNumber: booking.bookingNumber,
      status: booking.status,
      clientName: booking.clientName,
      clientEmail: booking.clientEmail,
      clientPhone: booking.clientPhone,
      occasion: booking.occasion,
      sessionNotes: booking.sessionNotes,
      description: booking.description,
      moodboardImages: booking.moodboardImages,
      completedAt: booking.completedAt?.toISOString() ?? null,
      sessionType: getOfferingTypeLabel(booking.offeringType) || booking.offering.sessionType.replace(/_/g, " "),
      userId: booking.userId,
      hasQuotation: Boolean(existingQuote),
      quotation: existingQuote,
    },
  });
}
