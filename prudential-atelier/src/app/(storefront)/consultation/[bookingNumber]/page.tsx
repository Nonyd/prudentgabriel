"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ConsultationStatus } from "@prisma/client";
import type { PublicConsultationDto } from "@/lib/public-pii-dtos";

export default function ConsultationDetailPublicPage() {
  const params = useParams();
  const bookingNumber = params.bookingNumber as string;
  const [booking, setBooking] = useState<PublicConsultationDto | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/account/consultations/${encodeURIComponent(bookingNumber)}`);
      if (!res.ok) {
        setMissing(true);
        return;
      }
      const j = (await res.json()) as { booking: PublicConsultationDto };
      setBooking(j.booking);
    })();
  }, [bookingNumber]);

  if (missing) {
    return (
      <div className="mx-auto max-w-site px-4 py-20 text-center">
        <p className="text-charcoal-mid">We could not find this booking.</p>
        <Link href="/consultation" className="mt-4 inline-block text-wine underline">
          Book again
        </Link>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="mx-auto max-w-site px-4 py-20 text-center">
        <p className="text-charcoal-mid">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-site px-4 py-12">
      <Link href="/consultation" className="text-sm text-wine underline">
        ← Book again
      </Link>
      <h1 className="mt-4 font-display text-3xl text-wine">Booking #{booking.bookingNumber}</h1>
      <p className="mt-2 text-sm text-charcoal-mid">Status: {booking.status}</p>
      <div className="mt-8 rounded-sm border border-border bg-cream p-6">
        <p className="font-medium text-charcoal">{booking.consultantName ?? "Our team"}</p>
        {booking.offeringName ? (
          <p className="text-sm text-charcoal-mid">{booking.offeringName.replace(/_/g, " ")}</p>
        ) : null}
        {booking.confirmedDate && booking.status === ConsultationStatus.CONFIRMED ? (
          <p className="mt-4 text-sm text-charcoal">
            {new Date(booking.confirmedDate).toLocaleDateString("en-GB", { timeZone: "Africa/Lagos" })}
            {booking.confirmedTime ? ` at ${booking.confirmedTime} WAT` : ""}
          </p>
        ) : null}
      </div>
    </div>
  );
}
