import { NextRequest, NextResponse } from "next/server";
import { ConsultationStatus } from "@prisma/client";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import {
  getDeliveryModeLabel,
  getSessionTypeLabel,
  isVirtualDelivery,
} from "@/lib/consultation";
import {
  sendConsultationCancelledEmail,
  sendConsultationConfirmedEmail,
  sendConsultationRescheduleEmail,
} from "@/lib/email";

const patchSchema = z.object({
  status: z.nativeEnum(ConsultationStatus).optional(),
  confirmedDate: z.coerce.date().optional(),
  confirmedTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  meetingLink: z.string().url().optional().nullable(),
  meetingPlatform: z.string().max(80).optional().nullable(),
  adminNotes: z.string().max(5000).optional().nullable(),
  adminFeedback: z.string().max(8000).optional().nullable(),
  cancellationReason: z.string().max(2000).optional().nullable(),
  proposedDates: z.array(z.string()).optional(),
  adminMessage: z.string().max(2000).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await params;

  const booking = await prisma.consultationBooking.findUnique({
    where: { id },
    include: { consultant: true, offering: true },
  });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ booking });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;

  const booking = await prisma.consultationBooking.findUnique({
    where: { id },
    include: { consultant: true, offering: true },
  });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const nextStatus = d.status ?? booking.status;

  if (!d.status || d.status === booking.status) {
    await prisma.consultationBooking.update({
      where: { id },
      data: {
        ...(d.confirmedDate ? { confirmedDate: d.confirmedDate } : {}),
        ...(d.confirmedTime ? { confirmedTime: d.confirmedTime } : {}),
        ...(d.meetingLink !== undefined ? { meetingLink: d.meetingLink } : {}),
        ...(d.meetingPlatform !== undefined ? { meetingPlatform: d.meetingPlatform } : {}),
        ...(d.adminNotes !== undefined ? { adminNotes: d.adminNotes } : {}),
        ...(d.adminFeedback !== undefined ? { adminFeedback: d.adminFeedback } : {}),
      },
    });
    const updated = await prisma.consultationBooking.findUnique({
      where: { id },
      include: { consultant: true, offering: true },
    });
    return NextResponse.json({ booking: updated });
  }

  const cur = booking.status;
  let allowed = false;
  if (cur === ConsultationStatus.PENDING_CONFIRMATION && nextStatus === ConsultationStatus.CONFIRMED) allowed = true;
  if (cur === ConsultationStatus.PENDING_CONFIRMATION && nextStatus === ConsultationStatus.RESCHEDULED) allowed = true;
  if (cur === ConsultationStatus.PENDING_CONFIRMATION && nextStatus === ConsultationStatus.CANCELLED_BY_ADMIN)
    allowed = true;
  if (cur === ConsultationStatus.CONFIRMED && nextStatus === ConsultationStatus.COMPLETED) allowed = true;
  if (cur === ConsultationStatus.CONFIRMED && nextStatus === ConsultationStatus.CANCELLED_BY_ADMIN) allowed = true;
  if (cur === ConsultationStatus.CONFIRMED && nextStatus === ConsultationStatus.NO_SHOW) allowed = true;

  if (!allowed) {
    return NextResponse.json({ error: "Invalid status transition" }, { status: 400 });
  }

  if (nextStatus === ConsultationStatus.CONFIRMED) {
    if (!d.confirmedDate || !d.confirmedTime) {
      return NextResponse.json({ error: "confirmedDate and confirmedTime required" }, { status: 400 });
    }
  }

  if (nextStatus === ConsultationStatus.RESCHEDULED) {
    if (!d.proposedDates?.length) {
      return NextResponse.json({ error: "proposedDates required" }, { status: 400 });
    }
  }

  await prisma.consultationBooking.update({
    where: { id },
    data: {
      status: nextStatus,
      ...(d.confirmedDate ? { confirmedDate: d.confirmedDate } : {}),
      ...(d.confirmedTime ? { confirmedTime: d.confirmedTime } : {}),
      ...(d.meetingLink !== undefined ? { meetingLink: d.meetingLink } : {}),
      ...(d.meetingPlatform !== undefined ? { meetingPlatform: d.meetingPlatform } : {}),
      ...(d.adminNotes !== undefined ? { adminNotes: d.adminNotes } : {}),
      ...(d.adminFeedback !== undefined ? { adminFeedback: d.adminFeedback } : {}),
      ...(d.cancellationReason !== undefined ? { cancellationReason: d.cancellationReason } : {}),
      ...(nextStatus === ConsultationStatus.COMPLETED ? { completedAt: new Date() } : {}),
    },
  });

  const refreshed = await prisma.consultationBooking.findUnique({
    where: { id },
    include: { consultant: true, offering: true },
  });
  if (!refreshed) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sessionTypeLabel = getSessionTypeLabel(refreshed.offering.sessionType);
  const deliveryModeLabel = getDeliveryModeLabel(refreshed.offering.deliveryMode);

  if (nextStatus === ConsultationStatus.CONFIRMED && refreshed.confirmedDate && refreshed.confirmedTime) {
    await sendConsultationConfirmedEmail({
      to: refreshed.clientEmail,
      clientName: refreshed.clientName,
      bookingNumber: refreshed.bookingNumber,
      consultantName: refreshed.consultant.name,
      sessionTypeLabel,
      deliveryModeLabel,
      confirmedDate: refreshed.confirmedDate,
      confirmedTime: refreshed.confirmedTime,
      durationMinutes: refreshed.offering.durationMinutes,
      meetingLink: refreshed.meetingLink ?? undefined,
      meetingPlatform: refreshed.meetingPlatform ?? undefined,
      atelierAddress: refreshed.atelierAddress ?? undefined,
      isVirtual: isVirtualDelivery(refreshed.offering.deliveryMode),
    });
  }

  if (nextStatus === ConsultationStatus.RESCHEDULED) {
    await sendConsultationRescheduleEmail({
      to: refreshed.clientEmail,
      clientName: refreshed.clientName,
      bookingNumber: refreshed.bookingNumber,
      consultantName: refreshed.consultant.name,
      proposedDates: d.proposedDates ?? [],
      adminMessage: d.adminMessage,
    });
  }

  if (nextStatus === ConsultationStatus.CANCELLED_BY_ADMIN) {
    await sendConsultationCancelledEmail({
      to: refreshed.clientEmail,
      clientName: refreshed.clientName,
      bookingNumber: refreshed.bookingNumber,
      consultantName: refreshed.consultant.name,
      reason: d.cancellationReason ?? undefined,
    });
  }

  return NextResponse.json({ booking: refreshed });
}
