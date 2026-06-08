"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConsultationStatus } from "@prisma/client";
import toast from "react-hot-toast";

export function ConsultationBookingActions({
  bookingId,
  status,
  confirmedDate,
  meetingLink,
}: {
  bookingId: string;
  status: ConsultationStatus;
  confirmedDate: string | null;
  meetingLink: string | null;
}) {
  const router = useRouter();
  const [showCancel, setShowCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const canCancel =
    status === ConsultationStatus.CONFIRMED &&
    confirmedDate &&
    new Date(confirmedDate).getTime() - Date.now() > 48 * 60 * 60 * 1000;

  async function cancelBooking() {
    setCancelling(true);
    try {
      const res = await fetch(`/api/account/consultations/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: ConsultationStatus.CANCELLED_BY_CLIENT }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Could not cancel booking");
      toast.success("Booking cancelled");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not cancel booking");
    } finally {
      setCancelling(false);
      setShowCancel(false);
    }
  }

  return (
    <div className="mt-8 flex flex-wrap gap-3">
      {meetingLink && status === ConsultationStatus.CONFIRMED ? (
        <a href={meetingLink} target="_blank" rel="noreferrer" className="btn-primary text-[10px]">
          Join meeting
        </a>
      ) : null}
      {canCancel ? (
        !showCancel ? (
          <button
            type="button"
            onClick={() => setShowCancel(true)}
            className="btn-ghost-light text-[10px] text-red-800"
          >
            Cancel booking
          </button>
        ) : (
          <div className="w-full rounded-sm border border-sand bg-ivory p-4">
            <p className="font-sans text-sm text-text-mid">
              Cancel at least 48 hours before your session. Are you sure?
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setShowCancel(false)}
                className="btn-ghost-light text-[10px]"
              >
                Keep booking
              </button>
              <button
                type="button"
                disabled={cancelling}
                onClick={() => void cancelBooking()}
                className="rounded-sm bg-red-800 px-4 py-2 font-sans text-[10px] uppercase tracking-wider text-white disabled:opacity-50"
              >
                {cancelling ? "Cancelling…" : "Confirm cancel"}
              </button>
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}
