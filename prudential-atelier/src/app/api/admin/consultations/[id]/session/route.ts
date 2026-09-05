import { NextRequest, NextResponse } from "next/server";
import { ConsultationStatus } from "@prisma/client";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { sendConsultationSessionSummaryEmail } from "@/lib/email";
import { notifyMoodboardReady } from "@/lib/customer-notifications";
import { getPublicAppUrl } from "@/lib/app-url";
import { storedPrivateMediaUrlSchema } from "@/lib/media/stored-url";

const bodySchema = z.object({
  sessionNotes: z.string().max(20000).optional(),
  moodboardImages: z.array(storedPrivateMediaUrlSchema).max(20).optional(),
  moodboardNotes: z.string().max(5000).optional(),
  status: z.nativeEnum(ConsultationStatus).optional(),
});

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

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const booking = await prisma.consultationBooking.findUnique({ where: { id } });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const d = parsed.data;
  const completing = d.status === ConsultationStatus.COMPLETED && booking.status !== ConsultationStatus.COMPLETED;

  if (completing) {
    const notes = (d.sessionNotes ?? booking.sessionNotes ?? "").trim();
    if (!notes) {
      return NextResponse.json(
        { error: "Session notes are required before marking a consultation completed." },
        { status: 400 },
      );
    }
  }

  const updated = await prisma.consultationBooking.update({
    where: { id },
    data: {
      ...(d.sessionNotes !== undefined ? { sessionNotes: d.sessionNotes } : {}),
      ...(d.moodboardImages !== undefined ? { moodboardImages: d.moodboardImages } : {}),
      ...(d.moodboardNotes !== undefined ? { moodboardNotes: d.moodboardNotes } : {}),
      ...(d.status ? { status: d.status } : {}),
      ...(completing ? { completedAt: new Date() } : {}),
    },
  });

  if (completing) {
    const firstName = updated.clientName.split(/\s+/)[0] ?? updated.clientName;
    const moodboardImages = updated.moodboardImages ?? [];
    const appUrl = getPublicAppUrl();

    await sendConsultationSessionSummaryEmail({
      to: updated.clientEmail,
      firstName,
      sessionNotes: updated.sessionNotes ?? undefined,
      moodboardImages: moodboardImages.length > 0 ? moodboardImages : undefined,
      moodboardUrl: `${appUrl}/account/consultations`,
      commissionUrl: `${appUrl}/atelier`,
    });

    if (moodboardImages.length > 0) {
      notifyMoodboardReady({
        userId: updated.userId,
        clientEmail: updated.clientEmail,
        bookingId: updated.id,
        bookingNumber: updated.bookingNumber,
      });
    }

    await createNotification({
      type: "CONSULTATION_COMPLETED",
      title: "Consultation completed",
      message: `${updated.bookingNumber} — session notes saved`,
      link: `/admin/consultations/${updated.id}`,
      entityId: updated.id,
    });
  }

  return NextResponse.json({ booking: updated });
}
