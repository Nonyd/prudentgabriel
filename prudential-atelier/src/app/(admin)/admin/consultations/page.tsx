import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ConsultationStatus } from "@prisma/client";
import {
  getOfferingTypeIcon,
  getOfferingTypeLabel,
  getVirtualPlatformLabel,
  isOfferingTypeVirtual,
  type OfferingTypeKey,
} from "@/lib/consultation-types";
import { isVirtualDelivery } from "@/lib/consultation";
import { formatConsultationQuotationStatus } from "@/lib/consultation-quotation-status";

function formatStatus(status: ConsultationStatus) {
  return status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function isWithinTwoHours(confirmedDate: Date | null, confirmedTime: string | null): boolean {
  if (!confirmedDate || !confirmedTime) return false;
  const [h, m] = confirmedTime.split(":").map(Number);
  const session = new Date(confirmedDate);
  session.setUTCHours(h - 1, m, 0, 0);
  const now = Date.now();
  const diff = session.getTime() - now;
  return diff > 0 && diff <= 2 * 60 * 60 * 1000;
}

export default async function AdminConsultationsPage() {
  const bookings = await prisma.consultationBooking.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      consultant: { select: { name: true } },
      offering: { select: { deliveryMode: true } },
      quotations: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          bespokeOrders: { select: { orderRef: true }, take: 1 },
        },
      },
    },
  });

  const pendingConfirm = await prisma.consultationBooking.count({
    where: { status: ConsultationStatus.PENDING_CONFIRMATION },
  });

  const unsentVirtual = bookings.filter((b) => {
    const isVirtual =
      (b.offeringType && isOfferingTypeVirtual(b.offeringType as OfferingTypeKey)) ||
      isVirtualDelivery(b.offering.deliveryMode);
    return (
      isVirtual &&
      !b.meetingLinkSentAt &&
      isWithinTwoHours(b.confirmedDate, b.confirmedTime) &&
      b.status !== ConsultationStatus.CANCELLED_BY_ADMIN &&
      b.status !== ConsultationStatus.CANCELLED_BY_CLIENT
    );
  });

  const alertBooking = unsentVirtual[0];

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Consultations</h1>
      <p className="mt-1 font-body text-[13px] text-[#6B6B68]">Prudential Atelier</p>

      {unsentVirtual.length > 0 && alertBooking ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>
            ⚠ {unsentVirtual.length} virtual consultation{unsentVirtual.length > 1 ? "s" : ""} within 2 hours —
            meeting link not sent
          </span>
          <Link href={`/admin/consultations/${alertBooking.id}`} className="font-medium text-olive underline">
            Send link →
          </Link>
        </div>
      ) : null}

      {pendingConfirm > 0 ? (
        <p className="mt-4 font-body text-sm text-amber-800">
          {pendingConfirm} booking(s) awaiting manual confirmation
        </p>
      ) : null}

      <div className="mt-8 overflow-x-auto border border-sand">
        <table className="w-full min-w-[860px] border-collapse font-body text-xs">
          <thead>
            <tr className="bg-[#37392d] text-left text-[10px] font-medium uppercase tracking-[0.1em] text-white">
              <th className="px-3 py-2">Booking</th>
              <th className="px-3 py-2">Client</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Platform</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Quotation</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => {
              const isVirtual =
                (b.offeringType && isOfferingTypeVirtual(b.offeringType as OfferingTypeKey)) ||
                isVirtualDelivery(b.offering.deliveryMode);
              return (
                <tr key={b.id} className="border-t border-sand">
                  <td className="px-3 py-2 font-mono text-[11px] text-olive">{b.bookingNumber}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-ink">{b.clientName}</div>
                    <div className="text-[#6B6B68]">{b.clientEmail}</div>
                  </td>
                  <td className="px-3 py-2 text-ink">
                    {getOfferingTypeIcon(b.offeringType)} {getOfferingTypeLabel(b.offeringType)}
                  </td>
                  <td className="px-3 py-2 text-[#6B6B68]">
                    {isVirtual ? getVirtualPlatformLabel(b.virtualPlatform) || "—" : "—"}
                  </td>
                  <td className="px-3 py-2 text-ink">{formatStatus(b.status)}</td>
                  <td className="px-3 py-2">
                    {(() => {
                      const q = formatConsultationQuotationStatus(b.quotations[0]);
                      return <span className={q.className}>{q.label}</span>;
                    })()}
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/admin/consultations/${b.id}`} className="text-olive underline">
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
