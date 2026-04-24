"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ConsultationStatus } from "@prisma/client";

type BookingPayload = {
  bookingNumber: string;
  status: ConsultationStatus;
  clientEmail: string;
  clientPhone: string;
  confirmedDate: string | null;
  confirmedTime: string | null;
  meetingLink: string | null;
  preferredDate1: string | null;
  preferredDate2: string | null;
  preferredDate3: string | null;
  consultant: { name: string; image: string | null };
  offering: { durationMinutes: number; deliveryMode: string };
};

function Inner() {
  const router = useRouter();
  const sp = useSearchParams();
  const { data: session } = useSession();
  const bookingParam = sp.get("booking");
  const [booking, setBooking] = useState<BookingPayload | null | undefined>(undefined);

  useEffect(() => {
    if (!bookingParam) {
      router.replace("/consultation");
      return;
    }
    void (async () => {
      const res = await fetch(`/api/account/consultations/${encodeURIComponent(bookingParam)}`);
      if (!res.ok) {
        setBooking(null);
        return;
      }
      const j = (await res.json()) as { booking: BookingPayload };
      setBooking(j.booking);
    })();
  }, [bookingParam, router]);

  if (booking === undefined) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-ivory">
        <p className="text-charcoal-mid">Loading…</p>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 bg-ivory px-4">
        <p className="text-charcoal">We could not find this booking.</p>
        <Link href="/consultation" className="text-wine underline">
          Back to consultation
        </Link>
      </div>
    );
  }

  const confirmed = booking.status === ConsultationStatus.CONFIRMED;
  const pending = booking.status === ConsultationStatus.PENDING_CONFIRMATION;

  return (
    <div className="min-h-screen bg-ivory px-4 py-16">
      <div className="mx-auto max-w-lg text-center">
        <p className="font-label text-gold">#{booking.bookingNumber}</p>
        {confirmed ? (
          <>
            <h1 className="mt-2 font-display text-3xl text-wine">Consultation confirmed</h1>
            <p className="mt-2 text-sm text-charcoal-mid">Your session is booked.</p>
          </>
        ) : pending ? (
          <>
            <h1 className="mt-2 font-display text-3xl text-wine">Request submitted</h1>
            <p className="mt-2 text-sm text-charcoal-mid">We will confirm your slot within 24–48 hours.</p>
          </>
        ) : (
          <>
            <h1 className="mt-2 font-display text-3xl text-wine">Thank you</h1>
            <p className="mt-2 text-sm text-charcoal-mid">Status: {booking.status}</p>
          </>
        )}

        <div className="mt-8 rounded-sm border border-border bg-cream p-6 text-left text-sm text-charcoal">
          <p className="font-medium">{booking.consultant.name}</p>
          {confirmed && booking.confirmedDate && (
            <p className="mt-2 text-charcoal-mid">
              {new Date(booking.confirmedDate).toLocaleDateString("en-GB", { timeZone: "Africa/Lagos" })} at{" "}
              {booking.confirmedTime} WAT · {booking.offering.durationMinutes} min
            </p>
          )}
          {confirmed && booking.meetingLink && (
            <a
              href={booking.meetingLink}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block rounded-sm bg-gold px-4 py-2 text-charcoal"
            >
              Join meeting
            </a>
          )}
          {pending && (
            <div className="mt-4 space-y-1 text-charcoal-mid">
              {booking.preferredDate1 && (
                <p>Preference 1: {new Date(booking.preferredDate1).toLocaleDateString("en-GB")}</p>
              )}
              {booking.preferredDate2 && (
                <p>Preference 2: {new Date(booking.preferredDate2).toLocaleDateString("en-GB")}</p>
              )}
              {booking.preferredDate3 && (
                <p>Preference 3: {new Date(booking.preferredDate3).toLocaleDateString("en-GB")}</p>
              )}
            </div>
          )}
          <p className="mt-4 text-xs text-charcoal-mid">Confirmation sent to {booking.clientEmail}</p>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/account/consultations"
            className="rounded-sm bg-wine px-6 py-3 text-center text-sm font-medium text-ivory"
          >
            View my bookings
          </Link>
          <Link href="/shop" className="rounded-sm border border-border px-6 py-3 text-center text-sm text-charcoal">
            Back to shop
          </Link>
        </div>

        {!session && (
          <p className="mt-8 text-sm text-charcoal-mid">
            <Link href="/register" className="text-wine underline">
              Create an account
            </Link>{" "}
            to track your consultations.
          </p>
        )}
      </div>
    </div>
  );
}

export default function ConsultationSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center bg-ivory">
          <p className="text-charcoal-mid">Loading…</p>
        </div>
      }
    >
      <Inner />
    </Suspense>
  );
}
