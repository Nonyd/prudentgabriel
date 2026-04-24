import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ConsultationStatus } from "@prisma/client";
import { getDeliveryModeLabel, getSessionTypeLabel } from "@/lib/consultation";

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
    <div className="p-6 text-[#eaeaea]">
      <h1 className="font-display text-2xl text-gold">Consultations</h1>
      {pendingConfirm > 0 && (
        <p className="mt-2 text-sm text-amber-300">
          {pendingConfirm} booking(s) awaiting manual confirmation
        </p>
      )}
      <div className="mt-6 overflow-x-auto rounded-sm border border-[rgba(201,168,76,0.2)]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-[#252525] font-label text-[10px] uppercase tracking-wider text-gold/70">
            <tr>
              <th className="px-3 py-2">Booking</th>
              <th className="px-3 py-2">Client</th>
              <th className="px-3 py-2">Consultant</th>
              <th className="px-3 py-2">Session</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id} className="border-t border-[rgba(201,168,76,0.1)]">
                <td className="px-3 py-2 font-mono text-gold">{b.bookingNumber}</td>
                <td className="px-3 py-2">
                  <div>{b.clientName}</div>
                  <div className="text-xs text-[#888]">{b.clientEmail}</div>
                </td>
                <td className="px-3 py-2">{b.consultant.name}</td>
                <td className="px-3 py-2 text-xs text-[#aaa]">
                  {getSessionTypeLabel(b.offering.sessionType)}
                  <br />
                  {getDeliveryModeLabel(b.offering.deliveryMode)}
                </td>
                <td className="px-3 py-2 text-xs">{b.status}</td>
                <td className="px-3 py-2">
                  <Link href={`/admin/consultations/${b.id}`} className="text-gold underline">
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
