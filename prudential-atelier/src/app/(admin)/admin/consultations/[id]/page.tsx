import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminConsultationDetail } from "@/components/admin/AdminConsultationDetail";
import { measurementFromRecord } from "@/components/admin/ClientMeasurementsPanel";

function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  return typeof value === "string" ? value : value.toISOString();
}

export default async function AdminConsultationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const booking = await prisma.consultationBooking.findUnique({
    where: { id },
    include: {
      consultant: true,
      offering: true,
    },
  });
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
    status: booking.status,
    clientName: booking.clientName,
    clientEmail: booking.clientEmail,
    clientPhone: booking.clientPhone,
    clientCountry: booking.clientCountry,
    clientInstagram: booking.clientInstagram,
    occasion: booking.occasion,
    description: booking.description,
    preferredDate1: toIso(booking.preferredDate1),
    preferredDate2: toIso(booking.preferredDate2),
    preferredDate3: toIso(booking.preferredDate3),
    confirmedDate: toIso(booking.confirmedDate),
    confirmedTime: booking.confirmedTime,
    meetingLink: booking.meetingLink,
    meetingPlatform: booking.meetingPlatform,
    feeNGN: booking.feeNGN,
    paymentStatus: booking.paymentStatus,
    paymentGateway: booking.paymentGateway,
    paymentRef: booking.paymentRef,
    paidAt: toIso(booking.paidAt),
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
    completedAt: toIso(booking.completedAt),
    consultant: {
      id: booking.consultant.id,
      name: booking.consultant.name,
      title: booking.consultant.title,
      image: booking.consultant.image,
    },
    offering: {
      sessionType: booking.offering.sessionType,
      deliveryMode: booking.offering.deliveryMode,
      durationMinutes: booking.offering.durationMinutes,
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
      />
    </div>
  );
}
