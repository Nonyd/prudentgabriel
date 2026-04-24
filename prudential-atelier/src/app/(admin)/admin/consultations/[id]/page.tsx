import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminConsultationDetail } from "@/components/admin/AdminConsultationDetail";

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

  const payload = {
    ...booking,
    preferredDate1: booking.preferredDate1?.toISOString() ?? null,
    preferredDate2: booking.preferredDate2?.toISOString() ?? null,
    preferredDate3: booking.preferredDate3?.toISOString() ?? null,
    confirmedDate: booking.confirmedDate?.toISOString() ?? null,
  };

  return (
    <div className="p-6">
      <Link href="/admin/consultations" className="text-sm text-gold underline">
        ← Consultations
      </Link>
      <h1 className="mt-4 font-display text-2xl text-gold">{booking.bookingNumber}</h1>
      <AdminConsultationDetail key={booking.updatedAt.toISOString()} booking={payload} />
    </div>
  );
}
