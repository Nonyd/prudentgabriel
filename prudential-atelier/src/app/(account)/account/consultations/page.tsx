import Link from "next/link";
import Image from "next/image";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ConsultationStatus } from "@prisma/client";
import { getDeliveryModeLabel, getSessionTypeLabel } from "@/lib/consultation";

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
    <div>
      <h1 className="font-display text-3xl text-wine">My consultations</h1>
      <p className="mt-1 text-sm text-charcoal-mid">{bookings.length} bookings</p>
      <div className="mt-8 space-y-4">
        {bookings.length === 0 ? (
          <div className="rounded-sm border border-border bg-cream p-10 text-center">
            <p className="text-charcoal-mid">No consultations booked yet.</p>
            <Link href="/consultation" className="mt-4 inline-block rounded-sm bg-wine px-6 py-3 text-sm text-ivory">
              Book a consultation
            </Link>
          </div>
        ) : (
          bookings.map((b) => (
            <div
              key={b.id}
              className="flex flex-col gap-4 rounded-sm border border-border bg-cream p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex gap-3">
                {b.consultant.image ? (
                  <Image
                    src={b.consultant.image}
                    alt=""
                    width={48}
                    height={48}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-charcoal-mid/20" />
                )}
                <div>
                  <p className="font-label text-[11px] text-gold">{b.bookingNumber}</p>
                  <p className="font-medium text-charcoal">{b.consultant.name}</p>
                  <p className="font-label text-[12px] text-gold">
                    {getSessionTypeLabel(b.offering.sessionType)} · {getDeliveryModeLabel(b.offering.deliveryMode)}
                  </p>
                  <p className="text-sm text-charcoal-mid">
                    {b.status === ConsultationStatus.CONFIRMED && b.confirmedDate
                      ? `${b.confirmedDate.toLocaleDateString("en-GB", { timeZone: "Africa/Lagos" })} at ${b.confirmedTime ?? ""} WAT`
                      : b.status === ConsultationStatus.PENDING_CONFIRMATION
                        ? "Awaiting confirmation"
                        : b.status === ConsultationStatus.COMPLETED
                          ? "Completed"
                          : String(b.status)}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/consultation/${encodeURIComponent(b.bookingNumber)}`}
                  className="rounded-sm border border-border px-4 py-2 text-sm text-charcoal hover:border-wine/40"
                >
                  View details
                </Link>
                {b.status === ConsultationStatus.CONFIRMED && b.meetingLink && (
                  <a
                    href={b.meetingLink}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-sm bg-wine px-4 py-2 text-sm text-ivory"
                  >
                    Join meeting
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
