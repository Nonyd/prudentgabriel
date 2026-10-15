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
import { createNotification } from "@/lib/notifications";
import { sendAdminNotificationEmail } from "@/lib/email";
import { getPublicAppUrl } from "@/lib/app-url";

const ADMIN_LINK_REMINDER_TITLE = "Send the meeting link";

/**
 * A virtual consultation about an hour away with no link yet: remind the
 * consultations desk to paste the Google Meet or Zoom link on the booking.
 */
async function remindAdminsWithoutLink(ctx: CronJobContext, horizon: Date, floor: Date): Promise<number> {
  const bookings = await prisma.consultationBooking.findMany({
    where: {
      status: { in: [ConsultationStatus.CONFIRMED, ConsultationStatus.SCHEDULED] },
      meetingLink: null,
      confirmedDate: { gte: floor, lte: horizon },
      confirmedTime: { not: null },
    },
    include: { offering: true },
    take: ctx.batchLimit,
  });
  let reminded = 0;
  for (const booking of bookings) {
    if (ctx.isBudgetExhausted()) break;
    if (!booking.confirmedDate || !booking.confirmedTime || !bookingIsVirtual(booking)) continue;
    const startsAt = consultationSessionStart(booking.confirmedDate, booking.confirmedTime);
    if (!isMeetingReminderWindow(startsAt, ctx.now)) continue;
    // The window spans two runs; remind once.
    const already = await prisma.adminNotification.findFirst({
      where: { entityId: booking.id, title: ADMIN_LINK_REMINDER_TITLE },
      select: { id: true },
    });
    if (already) continue;
    const path = `/admin/consultations/${booking.id}#meeting-link`;
    await createNotification({
      type: "NEW_CONSULTATION",
      title: ADMIN_LINK_REMINDER_TITLE,
      message: `${booking.bookingNumber} — ${booking.clientName} starts at ${booking.confirmedTime} WAT. No meeting link has been sent yet.`,
      link: path,
      entityId: booking.id,
    });
    await sendAdminNotificationEmail(
      `Send the meeting link — ${booking.bookingNumber} starts at ${booking.confirmedTime} WAT`,
      `<p>The virtual consultation <strong>${booking.bookingNumber}</strong> starts in about an hour, at ${booking.confirmedTime} WAT, and the client has no meeting link yet.</p>
<p>Paste the Google Meet or Zoom link under the date and time on the booking and press <strong>Send link to client</strong>.</p>
<p><a href="${getPublicAppUrl()}${path}">Open the booking</a></p>`,
      `meeting-link-admin-reminder:${booking.bookingNumber}`,
    );
    reminded += 1;
  }
  return reminded;
}

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

  let adminReminders = 0;
  try {
    adminReminders = await remindAdminsWithoutLink(ctx, horizon, floor);
  } catch (e) {
    console.warn("[meeting-link-reminders] admin reminder", e);
    failed += 1;
  }

  return {
    processed: processed + adminReminders,
    failed,
    hasMore: bookings.length >= ctx.batchLimit,
    detail: { candidates: bookings.length, skipped, adminReminders },
  };
}
