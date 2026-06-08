import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { getVirtualPlatformLabel, isOfferingTypeVirtual } from "@/lib/consultation-types";
import { isVirtualDelivery } from "@/lib/consultation";
import { sendConsultationMeetingLinkEmail } from "@/lib/email";
import { notifyMeetingLinkSent } from "@/lib/customer-notifications";

const bodySchema = z.object({
  meetingLink: z.string().url(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await params;

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

  const booking = await prisma.consultationBooking.findUnique({
    where: { id },
    include: { offering: true },
  });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isVirtual =
    (booking.offeringType && isOfferingTypeVirtual(booking.offeringType as never)) ||
    isVirtualDelivery(booking.offering.deliveryMode);
  if (!isVirtual) {
    return NextResponse.json({ error: "Not a virtual consultation" }, { status: 400 });
  }

  if (!booking.confirmedDate || !booking.confirmedTime) {
    return NextResponse.json({ error: "Consultation must have a confirmed date and time" }, { status: 400 });
  }

  const platformLabel =
    getVirtualPlatformLabel(booking.virtualPlatform) ||
    booking.meetingPlatform ||
    "Video call";

  await prisma.consultationBooking.update({
    where: { id },
    data: {
      meetingLink: parsed.data.meetingLink,
      meetingLinkSentAt: new Date(),
      meetingPlatform: platformLabel,
    },
  });

  await sendConsultationMeetingLinkEmail({
    to: booking.clientEmail,
    clientName: booking.clientName,
    platformLabel,
    confirmedDate: booking.confirmedDate.toISOString(),
    confirmedTime: booking.confirmedTime,
    meetingLink: parsed.data.meetingLink,
    isWhatsApp: booking.virtualPlatform === "whatsapp_video",
  });

  notifyMeetingLinkSent({
    userId: booking.userId,
    clientEmail: booking.clientEmail,
    bookingId: booking.id,
    bookingNumber: booking.bookingNumber,
  });

  return NextResponse.json({ ok: true });
}
