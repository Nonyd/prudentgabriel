import Link from "next/link";
import { notFound } from "next/navigation";
import type { ConsultationStatus, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AdminConsultationDetail } from "@/components/admin/AdminConsultationDetail";
import { measurementFromRecord } from "@/lib/measurements";

function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export default async function AdminConsultationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let booking;
  try {
    booking = await prisma.consultationBooking.findUnique({
      where: { id },
      include: {
        consultant: true,
        offering: true,
        quotations: {
          where: { status: { not: "SUPERSEDED" } },
          orderBy: { version: "desc" },
          take: 1,
          select: { id: true, quoteRef: true, status: true },
        },
      },
    });
  } catch (error) {
    console.error("CONSULTATION DETAIL ERROR:", error);
    throw error;
  }

  if (!booking) notFound();

  const clientProfile = booking.userId
    ? await prisma.clientProfile.findUnique({
        where: { userId: booking.userId },
        include: { measurements: true },
      })
    : null;

  const payload = {
    id: booking.id,
    userId: booking.userId,
    bookingNumber: booking.bookingNumber,
    status: booking.status as ConsultationStatus,
    clientName: booking.clientName ?? "Unknown",
    clientEmail: booking.clientEmail ?? "",
    clientPhone: booking.clientPhone ?? "",
    clientCountry: booking.clientCountry ?? "",
    clientInstagram: booking.clientInstagram,
    occasion: booking.occasion,
    description: booking.description,
    preferredDate1: toIso(booking.preferredDate1),
    preferredDate2: toIso(booking.preferredDate2),
    preferredDate3: toIso(booking.preferredDate3),
    confirmedDate: toIso(booking.confirmedDate),
    confirmedTime: booking.confirmedTime,
    offeringType: booking.offeringType,
    virtualPlatform: booking.virtualPlatform,
    meetingLink: booking.meetingLink,
    meetingPlatform: booking.meetingPlatform,
    meetingLinkSentAt: toIso(booking.meetingLinkSentAt),
    adminNotes: booking.adminNotes,
    sessionNotes: booking.sessionNotes,
    moodboardImages: booking.moodboardImages ?? [],
    moodboardNotes: booking.moodboardNotes,
    feeNGN: Number(booking.feeNGN) || 0,
    paymentStatus: booking.paymentStatus as PaymentStatus,
    paymentGateway: booking.paymentGateway,
    paymentRef: booking.paymentRef,
    paidAt: toIso(booking.paidAt),
    createdAt: toIso(booking.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(booking.updatedAt) ?? new Date().toISOString(),
    completedAt: toIso(booking.completedAt),
    consultant: booking.consultant
      ? {
          id: booking.consultant.id,
          name: booking.consultant.name,
          title: booking.consultant.title,
          image: booking.consultant.image,
        }
      : {
          id: booking.consultantId,
          name: "Unknown consultant",
          title: "",
          image: null,
        },
    offering: booking.offering
      ? {
          sessionType: booking.offering.sessionType,
          deliveryMode: booking.offering.deliveryMode,
          durationMinutes: booking.offering.durationMinutes,
        }
      : {
          sessionType: "DISCOVERY_CALL" as const,
          deliveryMode: "VIRTUAL_STANDARD" as const,
          durationMinutes: 45,
        },
  };

  return (
    <div className="p-6">
      <Link href="/admin/consultations" className="text-sm text-gold underline">
        ← Consultations
      </Link>
      <h1 className="mt-4 font-display text-2xl text-gold">{booking.bookingNumber}</h1>
      <AdminConsultationDetail
        key={payload.updatedAt}
        booking={payload}
        clientId={clientProfile?.id ?? null}
        measurements={measurementFromRecord(clientProfile?.measurements ?? null)}
        quotation={booking.quotations[0] ?? null}
      />
    </div>
  );
}
