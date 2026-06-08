import Link from "next/link";
import Image from "next/image";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ConsultationStatus } from "@prisma/client";
import { getDeliveryModeLabel, getSessionTypeLabel } from "@/lib/consultation";

function statusLabel(status: ConsultationStatus) {
  switch (status) {
    case ConsultationStatus.CONFIRMED:
      return "Confirmed";
    case ConsultationStatus.PENDING_CONFIRMATION:
      return "Pending";
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
    default:
      return String(status);
  }
}

export default async function AccountConsultationsPage() {
  const session = await auth();
  const email = session!.user!.email!.toLowerCase();
  const bookings = await prisma.consultationBooking.findMany({
    where: {
      OR: [{ userId: session!.user!.id! }, { clientEmail: email }],
    },
    orderBy: { createdAt: "desc" },
    include: {
      consultant: { select: { name: true, image: true } },
      offering: { select: { sessionType: true, deliveryMode: true, durationMinutes: true } },
    },
  });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-choc">Consultations</h1>
          <p className="mt-2 font-sans text-sm text-text-mid">{bookings.length} bookings</p>
        </div>
        <Link href="/consultation" className="btn-primary">
          Book new consultation
        </Link>
      </div>

      <div className="mt-10 space-y-4">
        {bookings.length === 0 ? (
          <div className="card-surface p-12 text-center">
            <p className="font-sans text-sm text-text-mid">No consultations booked yet.</p>
            <Link href="/consultation" className="btn-primary mt-6 inline-flex">
              Book a consultation
            </Link>
          </div>
        ) : (
          bookings.map((b) => (
            <article
              key={b.id}
              className="card-surface flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex gap-4">
                {b.consultant.image ? (
                  <Image
                    src={b.consultant.image}
                    alt=""
                    width={56}
                    height={56}
                    className="h-14 w-14 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sand/40 font-serif text-lg text-choc">
                    {b.consultant.name.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-lightbr">
                    {b.bookingNumber}
                  </p>
                  <p className="font-serif text-lg text-choc">{b.consultant.name}</p>
                  <p className="font-sans text-xs text-text-mid">
                    {getSessionTypeLabel(b.offering.sessionType)} ·{" "}
                    {getDeliveryModeLabel(b.offering.deliveryMode)}
                  </p>
                  <p className="mt-1 font-sans text-sm text-text-mid">
                    {b.status === ConsultationStatus.CONFIRMED && b.confirmedDate
                      ? `${b.confirmedDate.toLocaleDateString("en-GB", { timeZone: "Africa/Lagos" })}${b.confirmedTime ? ` at ${b.confirmedTime} WAT` : ""}`
                      : statusLabel(b.status)}
                  </p>
                  {b.description ? (
                    <p className="mt-2 line-clamp-2 font-sans text-xs text-text-light">{b.description}</p>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-sand px-3 py-1 font-sans text-[10px] uppercase tracking-wider text-text-mid">
                  {statusLabel(b.status)}
                </span>
                <Link
                  href={`/account/consultations/${b.id}`}
                  className="btn-ghost-light text-[10px]"
                >
                  View details
                </Link>
                {b.status === ConsultationStatus.CONFIRMED && b.meetingLink ? (
                  <a
                    href={b.meetingLink}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-primary text-[10px]"
                  >
                    Join meeting
                  </a>
                ) : null}
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
