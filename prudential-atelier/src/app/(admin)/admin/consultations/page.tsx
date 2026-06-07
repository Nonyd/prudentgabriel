import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ConsultationStatus } from "@prisma/client";
import { getDeliveryModeLabel, getSessionTypeLabel } from "@/lib/consultation";

function formatStatus(status: ConsultationStatus) {
  return status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function AdminConsultationsPage() {
  const bookings = await prisma.consultationBooking.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      consultant: { select: { name: true, image: true } },
      offering: { select: { sessionType: true, deliveryMode: true, durationMinutes: true } },
    },
  });

  const pendingConfirm = await prisma.consultationBooking.count({
    where: { status: ConsultationStatus.PENDING_CONFIRMATION },
  });

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Consultations</h1>
      <p className="mt-1 font-body text-[13px] text-[#6B6B68]">Prudential Atelier</p>
      {pendingConfirm > 0 ? (
        <p className="mt-4 font-body text-sm text-amber-800">
          {pendingConfirm} booking(s) awaiting manual confirmation
        </p>
      ) : null}
      <div className="mt-8 overflow-x-auto border border-sand">
        <table className="w-full min-w-[720px] border-collapse font-body text-xs">
          <thead>
            <tr className="bg-[#37392d] text-left text-[10px] font-medium uppercase tracking-[0.1em] text-white">
              <th className="px-3 py-2">Booking</th>
              <th className="px-3 py-2">Client</th>
              <th className="px-3 py-2">Consultant</th>
              <th className="px-3 py-2">Session</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id} className="border-t border-sand">
                <td className="px-3 py-2 font-mono text-[11px] text-olive">{b.bookingNumber}</td>
                <td className="px-3 py-2">
                  <div className="font-medium text-ink">{b.clientName}</div>
                  <div className="text-[#6B6B68]">{b.clientEmail}</div>
                </td>
                <td className="px-3 py-2 text-ink">{b.consultant.name}</td>
                <td className="px-3 py-2 text-[#6B6B68]">
                  {getSessionTypeLabel(b.offering.sessionType)}
                  <br />
                  {getDeliveryModeLabel(b.offering.deliveryMode)}
                </td>
                <td className="px-3 py-2 text-ink">{formatStatus(b.status)}</td>
                <td className="px-3 py-2">
                  <Link href={`/admin/consultations/${b.id}`} className="text-olive underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
