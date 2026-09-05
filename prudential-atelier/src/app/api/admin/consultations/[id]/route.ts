import { NextRequest, NextResponse } from "next/server";
import { ConsultationStatus } from "@prisma/client";
import { z } from "zod";
import { requireAdminApi, requireSuperAdminApi } from "@/lib/admin-auth";
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
import { notifyConsultationConfirmed } from "@/lib/customer-notifications";
import { destroyStoredMedia } from "@/lib/media/destroy";
import { executeConsultationCascade, previewConsultationCascade } from "@/lib/consultation-cascade-delete";
import { ProductCascadeError } from "@/lib/product-cascade-delete";

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
  const gate = await requireAdminApi("consultations");
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
  const gate = await requireAdminApi("consultations");
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
  if (cur === ConsultationStatus.CONFIRMED && nextStatus === ConsultationStatus.SCHEDULED) allowed = true;
  if (cur === ConsultationStatus.CONFIRMED && nextStatus === ConsultationStatus.IN_SESSION) allowed = true;
  if (cur === ConsultationStatus.CONFIRMED && nextStatus === ConsultationStatus.COMPLETED) allowed = true;
  if (cur === ConsultationStatus.CONFIRMED && nextStatus === ConsultationStatus.CANCELLED_BY_ADMIN) allowed = true;
  if (cur === ConsultationStatus.CONFIRMED && nextStatus === ConsultationStatus.NO_SHOW) allowed = true;
  if (cur === ConsultationStatus.SCHEDULED && nextStatus === ConsultationStatus.IN_SESSION) allowed = true;
  if (cur === ConsultationStatus.SCHEDULED && nextStatus === ConsultationStatus.COMPLETED) allowed = true;
  if (cur === ConsultationStatus.SCHEDULED && nextStatus === ConsultationStatus.CANCELLED_BY_ADMIN) allowed = true;
  if (cur === ConsultationStatus.IN_SESSION && nextStatus === ConsultationStatus.COMPLETED) allowed = true;
  if (cur === ConsultationStatus.IN_SESSION && nextStatus === ConsultationStatus.CANCELLED_BY_ADMIN) allowed = true;

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

  if (nextStatus === ConsultationStatus.COMPLETED) {
    const notes = (booking.sessionNotes ?? "").trim();
    if (!notes) {
      return NextResponse.json(
        { error: "Session notes are required before marking a consultation completed." },
        { status: 400 },
      );
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
    notifyConsultationConfirmed({
      userId: refreshed.userId,
      clientEmail: refreshed.clientEmail,
      bookingId: refreshed.id,
      bookingNumber: refreshed.bookingNumber,
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

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi("consultations");
  if (!gate.ok) return gate.response;
  const { id } = await params;

  let confirmation: string | undefined;
  try {
    const json = (await req.json()) as { confirmation?: unknown };
    if (typeof json.confirmation === "string") confirmation = json.confirmation;
  } catch {
    confirmation = undefined;
  }

  try {
    const preview = await previewConsultationCascade([id]);
    if (preview.loud) {
      const superGate = await requireSuperAdminApi();
      if (!superGate.ok) return superGate.response;
    }
    if (preview.blocked) {
      return NextResponse.json(
        { error: preview.blockReason ?? "This consultation cannot be deleted from here" },
        { status: 409 },
      );
    }

    const result = await executeConsultationCascade({
      ids: [id],
      confirmation,
      actor: {
        userId: gate.session.user.id!,
        email: gate.session.user.email ?? null,
        role: gate.session.user.role ?? "",
        ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null,
      },
    });
    await Promise.all(
      result.mediaUrls.map((url) => destroyStoredMedia(url).catch((err) => console.error("[consultation-cascade media]", url, err))),
    );
    return NextResponse.json({ ok: true, logId: result.logId, deleted: result.deletedIds.length });
  } catch (e) {
    if (e instanceof ProductCascadeError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[admin/consultations DELETE]", e);
    return NextResponse.json({ error: "Delete failed; nothing was removed" }, { status: 500 });
  }
}
