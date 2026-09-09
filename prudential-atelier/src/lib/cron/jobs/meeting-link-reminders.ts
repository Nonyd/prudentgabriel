import { ConsultationStatus } from "@prisma/client";
import type { CronJobContext, JobResult } from "@/lib/cron/types";
import { prisma } from "@/lib/prisma";
import {
  bookingIsVirtual,
  consultationSessionStart,
  isMeetingReminderWindow,
  queueConsultationMeetingLink,
} from "@/lib/consultation-meeting-link";
import { getVirtualPlatformLabel } from "@/lib/consultation-types";

export async function run(ctx: CronJobContext): Promise<JobResult> {
  const horizon = new Date(ctx.now.getTime() + 2 * 60 * 60 * 1000);
  const floor = new Date(ctx.now.getTime() - 15 * 60 * 1000);
  const bookings = await prisma.consultationBooking.findMany({
    where: {
      status: { in: [ConsultationStatus.CONFIRMED, ConsultationStatus.SCHEDULED] },
      meetingLink: { not: null },
      confirmedDate: { gte: floor, lte: horizon },
      confirmedTime: { not: null },
    },
    include: { offering: true },
    take: ctx.batchLimit,
  });

  let processed = 0;
  let failed = 0;
  let skipped = 0;

  for (const booking of bookings) {
    if (ctx.isBudgetExhausted()) break;
    if (!booking.meetingLink || !booking.confirmedDate || !booking.confirmedTime) {
      skipped += 1;
      continue;
    }
    if (!bookingIsVirtual(booking)) {
      skipped += 1;
      continue;
    }
    const startsAt = consultationSessionStart(booking.confirmedDate, booking.confirmedTime);
    if (!isMeetingReminderWindow(startsAt, ctx.now)) {
      skipped += 1;
      continue;
    }
    try {
      const platformLabel =
        getVirtualPlatformLabel(booking.virtualPlatform) || booking.meetingPlatform || "Video call";
      await queueConsultationMeetingLink({
        to: booking.clientEmail,
        clientName: booking.clientName,
        bookingNumber: booking.bookingNumber,
        platformLabel,
        confirmedDate: booking.confirmedDate,
        confirmedTime: booking.confirmedTime,
        meetingLink: booking.meetingLink,
        isWhatsApp: booking.virtualPlatform === "whatsapp_video",
        kind: "reminder",
      });
      processed += 1;
    } catch (e) {
      console.warn("[meeting-link-reminders]", booking.id, e);
      failed += 1;
    }
  }

  return {
    processed,
    failed,
    hasMore: bookings.length >= ctx.batchLimit,
    detail: { candidates: bookings.length, skipped },
  };
}
