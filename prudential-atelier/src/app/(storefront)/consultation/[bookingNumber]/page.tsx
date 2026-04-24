"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ConsultationStatus } from "@prisma/client";

type Booking = {
  id: string;
  bookingNumber: string;
  status: ConsultationStatus;
  clientEmail: string;
  confirmedDate: string | null;
  confirmedTime: string | null;
  meetingLink: string | null;
  consultant: { name: string; image: string | null };
  offering: { sessionType: string; deliveryMode: string; durationMinutes: number };
};

export default function ConsultationDetailPublicPage() {
  const params = useParams();
  const bookingNumber = params.bookingNumber as string;
  const { data: session } = useSession();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [showCancel, setShowCancel] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/account/consultations/${encodeURIComponent(bookingNumber)}`);
      if (!res.ok) return;
      const j = (await res.json()) as { booking: Booking };
      setBooking(j.booking);
    })();
  }, [bookingNumber]);

  async function cancelBooking() {
    if (!booking) return;
    const res = await fetch(`/api/account/consultations/${booking.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: ConsultationStatus.CANCELLED_BY_CLIENT,
        guestEmail: session?.user ? undefined : booking.clientEmail,
      }),
    });
    if (res.ok) {
      setBooking({ ...booking, status: ConsultationStatus.CANCELLED_BY_CLIENT });
    }
  }

  if (!booking) {
    return (
      <div className="mx-auto max-w-site px-4 py-20 text-center">
        <p className="text-charcoal-mid">Loading…</p>
      </div>
    );
  }

  const canCancel =
    booking.status === ConsultationStatus.CONFIRMED &&
    booking.confirmedDate &&
    new Date(booking.confirmedDate).getTime() - Date.now() > 48 * 60 * 60 * 1000;

  return (
    <div className="mx-auto max-w-site px-4 py-12">
      <Link href="/consultation" className="text-sm text-wine underline">
        ← Book again
      </Link>
      <h1 className="mt-4 font-display text-3xl text-wine">Booking #{booking.bookingNumber}</h1>
      <p className="mt-2 text-sm text-charcoal-mid">Status: {booking.status}</p>
      <div className="mt-8 rounded-sm border border-border bg-cream p-6">
        <p className="font-medium text-charcoal">{booking.consultant.name}</p>
        <p className="text-sm text-charcoal-mid">
          {booking.offering.sessionType} · {booking.offering.durationMinutes} min
        </p>
        {booking.confirmedDate && (
          <p className="mt-4 text-sm text-charcoal">
            {new Date(booking.confirmedDate).toLocaleString("en-GB", { timeZone: "Africa/Lagos" })} at{" "}
            {booking.confirmedTime} WAT
          </p>
        )}
        {booking.meetingLink && (
          <a href={booking.meetingLink} target="_blank" rel="noreferrer" className="mt-4 inline-block text-wine underline">
            Join meeting
          </a>
        )}
      </div>

      {canCancel && (
        <div className="mt-6">
          {!showCancel ? (
            <button
              type="button"
              onClick={() => setShowCancel(true)}
              className="rounded-sm border border-red-800 px-4 py-2 text-sm text-red-800"
            >
              Cancel booking
            </button>
          ) : (
            <div className="rounded-sm border border-border bg-ivory p-4">
              <p className="text-sm text-charcoal">Are you sure? Cancellation policy applies.</p>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => setShowCancel(false)} className="rounded-sm border border-border px-3 py-2 text-sm">
                  Keep
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void cancelBooking();
                    setShowCancel(false);
                  }}
                  className="rounded-sm bg-red-800 px-3 py-2 text-sm text-ivory"
                >
                  Confirm cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
