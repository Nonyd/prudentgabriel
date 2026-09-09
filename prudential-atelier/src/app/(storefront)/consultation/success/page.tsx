"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import type { PublicConsultationDto } from "@/lib/public-pii-dtos";
import { consultationSuccessView } from "@/lib/consultation-success-view";

function Inner() {
  const router = useRouter();
  const sp = useSearchParams();
  const { data: session } = useSession();
  const bookingParam = sp.get("booking");
  const [booking, setBooking] = useState<PublicConsultationDto | null | undefined>(undefined);

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
      const j = (await res.json()) as { booking: PublicConsultationDto };
      setBooking(j.booking);
    })();
  }, [bookingParam, router]);

  if (booking === undefined) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-charcoal-mid">Loading…</p>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4">
        <p className="text-charcoal">We could not find this booking.</p>
        <Link href="/consultation" className="text-choc underline">
          Back to consultation
        </Link>
      </div>
    );
  }

  const view = consultationSuccessView(booking);

  return (
    <div className="min-h-screen px-4 py-16">
      <div className="mx-auto max-w-lg text-center">
        <p className="font-label text-gold">#{view.bookingNumber}</p>
        <h1 className="mt-2 font-display text-3xl text-choc">{view.heading}</h1>
        <p className="mt-2 text-sm text-charcoal-mid">{view.subcopy}</p>

        <div className="mt-8 rounded-sm border border-border bg-cream p-6 text-left text-sm text-charcoal">
          <p className="font-medium">{view.consultantName}</p>
          {view.offeringName ? <p className="mt-1 text-charcoal-mid">{view.offeringName.replace(/_/g, " ")}</p> : null}
          {view.dateLabel && view.timeLabel ? (
            <p className="mt-2 text-charcoal-mid">
              {view.dateLabel} at {view.timeLabel} WAT
            </p>
          ) : null}
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/account/consultations"
            className="rounded-sm bg-choc px-6 py-3 text-center text-sm font-medium text-cream"
          >
            View my bookings
          </Link>
          <Link href="/rtw" className="rounded-sm border border-border px-6 py-3 text-center text-sm text-charcoal">
            Back to shop
          </Link>
        </div>

        {!session && (
          <p className="mt-8 text-sm text-charcoal-mid">
            <Link href="/register" className="text-choc underline">
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
        <div className="flex min-h-[50vh] items-center justify-center">
          <p className="text-charcoal-mid">Loading…</p>
        </div>
      }
    >
      <Inner />
    </Suspense>
  );
}
