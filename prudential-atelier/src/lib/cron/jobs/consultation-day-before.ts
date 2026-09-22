import { ConsultationStatus } from "@prisma/client";
import type { CronJobContext, JobResult } from "@/lib/cron/types";
import { prisma } from "@/lib/prisma";
import { addDaysToWatYmd, getWatYmd } from "@/lib/consultation";
import { getOfferingTypeConfig, isOfferingTypeVirtual, type OfferingTypeKey } from "@/lib/consultation-types";
import { sendUsingCatalog } from "@/lib/catalog-email";
import { EMAIL_TEMPLATE_KEYS } from "@/lib/admin-email-catalog";
import { getPublicAppUrl } from "@/lib/app-url";
import { logServerError } from "@/lib/logger";

/**
 * BA2 "confirmation → reminders": the day before a confirmed consultation, in
 * person or virtual. The hour-before meeting link (meeting-link-reminders) is
 * unchanged. One email per booking (idempotency key), however often this runs.
 */
export async function run(ctx: CronJobContext): Promise<JobResult> {
  const tomorrow = addDaysToWatYmd(getWatYmd(ctx.now), 1);
  const day = new Date(`${tomorrow}T00:00:00.000Z`);
  const bookings = await prisma.consultationBooking.findMany({
    where: {
      status: { in: [ConsultationStatus.CONFIRMED, ConsultationStatus.SCHEDULED] },
      confirmedDate: { gte: day, lt: new Date(day.getTime() + 24 * 60 * 60 * 1000) },
    },
    take: ctx.batchLimit,
  });

  let processed = 0;
  let failed = 0;
  for (const b of bookings) {
    if (ctx.isBudgetExhausted()) break;
    try {
      const typeKey = b.offeringType as OfferingTypeKey | null;
      const virtual = typeKey ? isOfferingTypeVirtual(typeKey) : Boolean(b.virtualPlatform);
      const where = virtual
        ? "It is a virtual consultation: we email the meeting link about an hour before."
        : b.atelierAddress?.trim()
          ? `We will see you at the atelier: ${b.atelierAddress.trim()}.`
          : "We will see you at the atelier.";
      await sendUsingCatalog({
        key: EMAIL_TEMPLATE_KEYS.CONSULTATION_DAY_BEFORE,
        to: b.clientEmail,
        vars: {
          firstName: b.clientName.split(/\s+/)[0] ?? b.clientName,
          orderRef: b.bookingNumber,
          date: b.confirmedDate!.toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            timeZone: "UTC",
          }),
          time: b.confirmedTime ?? "the time we agreed",
          where,
          link: `${getPublicAppUrl()}/account/consultations`,
          sessionTitle: typeKey ? getOfferingTypeConfig(typeKey).title : "Consultation",
        },
        outboxTemplate: "consultation-day-before",
        idempotencyKey: `consultation-day-before:${b.id}:${tomorrow}`,
        relatedType: "ConsultationBooking",
        relatedId: b.id,
      });
      processed += 1;
    } catch (e) {
      failed += 1;
      await logServerError({ errorType: "CRON_CONSULTATION_DAY_BEFORE", error: e });
    }
  }
  return { processed, failed, hasMore: bookings.length >= ctx.batchLimit, detail: { scanned: bookings.length } };
}
