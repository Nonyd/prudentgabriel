import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ConsultationStatus, PaymentStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  getDeliveryModeLabel,
  getSessionTypeLabel,
  isVirtualDelivery,
} from "@/lib/consultation";
import { ConsultationBookingActions } from "@/components/account/ConsultationBookingActions";

function statusLabel(status: ConsultationStatus) {
  switch (status) {
    case ConsultationStatus.CONFIRMED:
      return "Confirmed";
    case ConsultationStatus.PENDING_CONFIRMATION:
      return "Pending confirmation";
    case ConsultationStatus.COMPLETED:
      return "Completed";
    case ConsultationStatus.CANCELLED_BY_CLIENT:
    case ConsultationStatus.CANCELLED_BY_ADMIN:
      return "Cancelled";
    case ConsultationStatus.NO_SHOW:
      return "No show";
    case ConsultationStatus.RESCHEDULED:
      return "Rescheduled";
    case ConsultationStatus.PENDING_PAYMENT:
      return "Pending payment";
    case ConsultationStatus.SCHEDULED:
      return "Scheduled";
    case ConsultationStatus.IN_SESSION:
      return "In session";
    default:
      return String(status);
  }
}

function formatWatDate(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Lagos",
  });
}

export default async function AccountConsultationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const userId = session!.user!.id!;
  const email = session!.user!.email!.toLowerCase();

  const booking = await prisma.consultationBooking.findFirst({
    where: {
      id,
      OR: [{ userId }, { clientEmail: email }],
    },
    include: {
      consultant: { select: { name: true, title: true, image: true } },
      offering: { select: { sessionType: true, deliveryMode: true, durationMinutes: true } },
    },
  });

  if (!booking) notFound();

  const isVirtual = isVirtualDelivery(booking.offering.deliveryMode);
  const when =
    booking.status === ConsultationStatus.CONFIRMED && booking.confirmedDate
      ? `${formatWatDate(booking.confirmedDate)}${booking.confirmedTime ? ` at ${booking.confirmedTime} WAT` : ""}`
      : booking.preferredDate1
        ? `Preferred: ${formatWatDate(booking.preferredDate1)}`
        : statusLabel(booking.status);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/account/consultations" className="font-sans text-sm text-lightbr hover:underline">
        ← Consultations
      </Link>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-lightbr">
            {booking.bookingNumber}
          </p>
          <h1 className="mt-2 font-display text-3xl text-choc">{booking.consultant.name}</h1>
          <p className="mt-1 font-sans text-sm text-text-mid">{booking.consultant.title}</p>
        </div>
        <span className="rounded-full border border-sand px-3 py-1 font-sans text-[10px] uppercase tracking-wider text-text-mid">
          {statusLabel(booking.status)}
        </span>
      </div>

      <div className="card-surface mt-8 space-y-6 p-6">
        <div className="flex gap-4">
          {booking.consultant.image ? (
            <Image
              src={booking.consultant.image}
              alt=""
              width={72}
              height={72}
              className="h-[72px] w-[72px] rounded-full object-cover"
            />
          ) : (
            <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-sand/40 font-serif text-2xl text-choc">
              {booking.consultant.name.charAt(0)}
            </div>
          )}
          <div>
            <p className="font-sans text-sm text-text-mid">
              {getSessionTypeLabel(booking.offering.sessionType)} ·{" "}
              {getDeliveryModeLabel(booking.offering.deliveryMode)}
            </p>
            <p className="mt-2 font-sans text-sm text-choc">{when}</p>
            <p className="mt-1 font-sans text-xs text-text-mid">
              Duration: up to {booking.offering.durationMinutes} minutes
            </p>
          </div>
        </div>

        {booking.status === ConsultationStatus.PENDING_CONFIRMATION ? (
          <div className="rounded-sm border border-sand/60 bg-ivory px-4 py-3">
            <p className="font-sans text-sm text-choc">We&apos;re confirming your session time</p>
            <p className="mt-1 font-sans text-xs text-text-mid">
              You&apos;ll receive an email once your date and time are confirmed — usually within 24
              hours.
            </p>
            {booking.preferredDate1 ? (
              <ul className="mt-3 space-y-1 font-sans text-xs text-text-mid">
                <li>Preferred: {formatWatDate(booking.preferredDate1)}</li>
                {booking.preferredDate2 ? <li>Alternative: {formatWatDate(booking.preferredDate2)}</li> : null}
                {booking.preferredDate3 ? <li>Alternative: {formatWatDate(booking.preferredDate3)}</li> : null}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-4 border-t border-sand/50 pt-6 sm:grid-cols-2">
          <div>
            <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-text-light">
              Occasion
            </p>
            <p className="mt-1 font-sans text-sm text-choc">{booking.occasion}</p>
          </div>
          <div>
            <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-text-light">
              Payment
            </p>
            <p className="mt-1 font-sans text-sm text-choc">
              ₦{Math.round(booking.feeNGN).toLocaleString("en-NG")}
            </p>
            <p className="font-sans text-xs text-text-mid">
              {booking.paymentStatus}
              {booking.paymentGateway ? ` · ${booking.paymentGateway}` : ""}
            </p>
            {booking.paidAt && booking.paymentStatus === PaymentStatus.PAID ? (
              <p className="font-sans text-xs text-text-mid">Paid {formatWatDate(booking.paidAt)}</p>
            ) : null}
          </div>
        </div>

        {booking.description ? (
          <div className="border-t border-sand/50 pt-6">
            <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-text-light">
              Your brief
            </p>
            <p className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed text-text-mid">
              {booking.description}
            </p>
          </div>
        ) : null}

        {!isVirtual && booking.atelierAddress ? (
          <div className="border-t border-sand/50 pt-6">
            <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-text-light">
              Location
            </p>
            <p className="mt-2 font-sans text-sm text-choc">{booking.atelierAddress}</p>
          </div>
        ) : null}

        {booking.moodboardImages.length > 0 ? (
          <div className="border-t border-sand/50 pt-6">
            <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-text-light">
              Session moodboard
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {booking.moodboardImages.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative aspect-[4/5] overflow-hidden rounded-sm border border-sand"
                >
                  <Image src={url} alt="" fill className="object-cover" sizes="200px" />
                </a>
              ))}
            </div>
            {booking.moodboardNotes ? (
              <p className="mt-3 font-sans text-sm italic text-text-mid">
                &ldquo;{booking.moodboardNotes}&rdquo;
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <ConsultationBookingActions
        bookingId={booking.id}
        status={booking.status}
        confirmedDate={booking.confirmedDate?.toISOString() ?? null}
        meetingLink={booking.meetingLink}
      />

      <a
        className="mt-8 inline-block font-sans text-sm text-lightbr hover:underline"
        href={`mailto:hello@prudentgabriel.com?subject=Consultation%20${encodeURIComponent(booking.bookingNumber)}`}
      >
        Questions about this booking?
      </a>
    </div>
  );
}
