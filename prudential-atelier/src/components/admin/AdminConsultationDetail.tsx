"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ConsultationDeliveryMode,
  ConsultationSessionType,
  ConsultationStatus,
} from "@prisma/client";
import toast from "react-hot-toast";
import { getDeliveryModeLabel, getSessionTypeLabel } from "@/lib/consultation";

type Booking = {
  id: string;
  userId: string | null;
  bookingNumber: string;
  status: ConsultationStatus;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientCountry: string;
  clientInstagram: string | null;
  occasion: string;
  description: string;
  preferredDate1: string | null;
  preferredDate2: string | null;
  preferredDate3: string | null;
  confirmedDate: string | null;
  confirmedTime: string | null;
  meetingLink: string | null;
  meetingPlatform: string | null;
  feeNGN: number;
  paymentStatus: string;
  paymentGateway: string | null;
  paymentRef: string | null;
  consultant: { id: string; name: string; title: string; image: string | null };
  offering: {
    sessionType: ConsultationSessionType;
    deliveryMode: ConsultationDeliveryMode;
    durationMinutes: number;
  };
};

export function AdminConsultationDetail({ booking }: { booking: Booking }) {
  const router = useRouter();
  const [confirmDate, setConfirmDate] = useState(
    booking.confirmedDate ? booking.confirmedDate.slice(0, 10) : "",
  );
  const [confirmTime, setConfirmTime] = useState(booking.confirmedTime ?? "10:00");
  const [meetingLink, setMeetingLink] = useState(booking.meetingLink ?? "");
  const [meetingPlatform, setMeetingPlatform] = useState(booking.meetingPlatform ?? "Google Meet");
  const [proposalMsg, setProposalMsg] = useState("");
  const [alt1, setAlt1] = useState("");
  const [alt2, setAlt2] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/consultations/${booking.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json();
    if (!res.ok) {
      toast.error((j as { error?: string }).error ?? "Update failed");
      return;
    }
    toast.success("Updated");
    router.refresh();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-4 text-sm text-[#eaeaea]">
        <div className="rounded-sm border border-[#EBEBEA] bg-[#FAFAFA] p-4">
          <h2 className="font-label text-gold">Client</h2>
          <p className="mt-2">{booking.clientName}</p>
          <a href={`mailto:${booking.clientEmail}`} className="text-gold underline">
            {booking.clientEmail}
          </a>
          <p className="mt-1">{booking.clientPhone}</p>
          <p className="text-[#aaa]">{booking.clientCountry}</p>
        </div>
        <div className="rounded-sm border border-[#EBEBEA] bg-[#FAFAFA] p-4">
          <h2 className="font-label text-gold">Session</h2>
          <p className="mt-2">{booking.consultant.name}</p>
          <p className="text-xs text-[#aaa]">{getSessionTypeLabel(booking.offering.sessionType)}</p>
          <p className="text-xs text-[#aaa]">{getDeliveryModeLabel(booking.offering.deliveryMode)}</p>
          <p className="mt-2 text-xs">Fee ₦{booking.feeNGN.toLocaleString("en-NG")}</p>
        </div>
        <div className="rounded-sm border border-[#EBEBEA] bg-[#FAFAFA] p-4">
          <h2 className="font-label text-gold">Scheduling</h2>
          {booking.preferredDate1 && (
            <p className="mt-2 text-xs">
              Prefs: {booking.preferredDate1?.slice(0, 10)} {booking.preferredDate2 ? `, ${booking.preferredDate2.slice(0, 10)}` : ""}
            </p>
          )}
          {booking.confirmedDate && (
            <p className="mt-2 text-xs">
              Confirmed: {booking.confirmedDate.slice(0, 10)} {booking.confirmedTime} WAT
            </p>
          )}
        </div>
        <p className="text-xs text-[#888]">{booking.description}</p>
      </div>

      <div className="space-y-4 rounded-sm border border-[#EBEBEA] bg-[#1e1e1e] p-4">
        <p className="font-display text-lg text-gold">Status: {booking.status}</p>

        {booking.status === ConsultationStatus.PENDING_CONFIRMATION && (
          <div className="space-y-3">
            <label className="block text-xs text-[#aaa]">
              Confirmed date
              <input
                type="date"
                value={confirmDate}
                onChange={(e) => setConfirmDate(e.target.value)}
                className="mt-1 w-full rounded-sm border border-[#444] bg-[#2a2a2a] px-2 py-2 text-[#eaeaea]"
              />
            </label>
            <label className="block text-xs text-[#aaa]">
              Time (WAT)
              <input
                value={confirmTime}
                onChange={(e) => setConfirmTime(e.target.value)}
                className="mt-1 w-full rounded-sm border border-[#444] bg-[#2a2a2a] px-2 py-2 text-[#eaeaea]"
              />
            </label>
            <label className="block text-xs text-[#aaa]">
              Meeting link (virtual)
              <input
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
                className="mt-1 w-full rounded-sm border border-[#444] bg-[#2a2a2a] px-2 py-2 text-[#eaeaea]"
              />
            </label>
            <label className="block text-xs text-[#aaa]">
              Platform
              <input
                value={meetingPlatform}
                onChange={(e) => setMeetingPlatform(e.target.value)}
                className="mt-1 w-full rounded-sm border border-[#444] bg-[#2a2a2a] px-2 py-2 text-[#eaeaea]"
              />
            </label>
            <button
              type="button"
              onClick={() =>
                void patch({
                  status: ConsultationStatus.CONFIRMED,
                  confirmedDate: confirmDate ? new Date(confirmDate).toISOString() : undefined,
                  confirmedTime: confirmTime,
                  meetingLink: meetingLink || undefined,
                  meetingPlatform: meetingPlatform || undefined,
                })
              }
              className="w-full rounded-sm bg-wine py-2 text-sm text-charcoal"
            >
              Confirm & send email
            </button>

            <textarea
              value={proposalMsg}
              onChange={(e) => setProposalMsg(e.target.value)}
              placeholder="Message for reschedule proposal"
              className="mt-4 w-full rounded-sm border border-[#444] bg-[#2a2a2a] p-2 text-sm text-[#eaeaea]"
              rows={3}
            />
            <input
              placeholder="Alt date 1 (YYYY-MM-DD)"
              value={alt1}
              onChange={(e) => setAlt1(e.target.value)}
              className="w-full rounded-sm border border-[#444] bg-[#2a2a2a] px-2 py-2 text-sm"
            />
            <input
              placeholder="Alt date 2"
              value={alt2}
              onChange={(e) => setAlt2(e.target.value)}
              className="w-full rounded-sm border border-[#444] bg-[#2a2a2a] px-2 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() =>
                void patch({
                  status: ConsultationStatus.RESCHEDULED,
                  proposedDates: [alt1, alt2].filter(Boolean),
                  adminMessage: proposalMsg || undefined,
                })
              }
              className="w-full rounded-sm border border-gold py-2 text-sm text-gold"
            >
              Send reschedule proposal
            </button>

            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Cancellation reason"
              className="w-full rounded-sm border border-[#444] bg-[#2a2a2a] p-2 text-sm"
              rows={2}
            />
            <button
              type="button"
              onClick={() =>
                void patch({
                  status: ConsultationStatus.CANCELLED_BY_ADMIN,
                  cancellationReason: cancelReason || undefined,
                })
              }
              className="w-full rounded-sm border border-red-700 py-2 text-sm text-red-300"
            >
              Cancel & notify client
            </button>
          </div>
        )}

        {booking.status === ConsultationStatus.CONFIRMED && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => void patch({ status: ConsultationStatus.COMPLETED })}
              className="w-full rounded-sm bg-emerald-900 py-2 text-sm text-charcoal"
            >
              Mark completed
            </button>
            <button
              type="button"
              onClick={() => void patch({ status: ConsultationStatus.NO_SHOW })}
              className="w-full rounded-sm border border-amber-700 py-2 text-sm text-amber-200"
            >
              Mark no-show
            </button>
            <button
              type="button"
              onClick={() =>
                void patch({
                  status: ConsultationStatus.CANCELLED_BY_ADMIN,
                  cancellationReason: cancelReason || "Cancelled by admin",
                })
              }
              className="w-full rounded-sm border border-red-700 py-2 text-sm text-red-300"
            >
              Cancel booking
            </button>
          </div>
        )}

        {booking.userId && (
          <Link href={`/admin/customers/${booking.userId}`} className="mt-4 inline-block text-xs text-gold underline">
            Open customer wallet
          </Link>
        )}
      </div>
    </div>
  );
}
