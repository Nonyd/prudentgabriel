import { ConsultationStatus, Role } from "@prisma/client";
import type { CronJobContext, JobResult } from "@/lib/cron/types";
import { prisma } from "@/lib/prisma";
import { createAdminNotification } from "@/lib/notify";
import { createStaffNotification } from "@/lib/staff-notifications";
import { sendAdminNotificationEmail } from "@/lib/email";
import { sendSmtpMail } from "@/lib/email-transport";
import { getPublicAppUrl } from "@/lib/app-url";

const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

async function resolveConsultantStaffUser(consultantName: string) {
  return prisma.user.findFirst({
    where: {
      name: { equals: consultantName, mode: "insensitive" },
      role: { not: Role.CUSTOMER },
    },
    select: { id: true, email: true, name: true },
  });
}

function consultantAlertHtml(params: {
  consultantName: string;
  clientName: string;
  bookingNumber: string;
  completedAt: string;
  adminUrl: string;
}): string {
  return `
    <div style="font-family:Georgia,serif;background:#F7F2EC;padding:24px;color:#442913">
      <h1 style="color:#442913;margin:0 0 8px">Quotation still outstanding</h1>
      <p>Hi ${params.consultantName.split(/\s+/)[0] ?? "there"},</p>
      <p>Consultation <strong>${params.bookingNumber}</strong> for <strong>${params.clientName}</strong>
      was completed on ${params.completedAt} and still has no quotation.</p>
      <p><a href="${params.adminUrl}" style="display:inline-block;background:#442913;color:#E2D1C2;padding:12px 24px;text-decoration:none">Open consultation</a></p>
      <p style="margin-top:32px;font-size:12px;color:#98755B">Prudential Atelier · internal alert</p>
    </div>
  `;
}

export async function run(ctx: CronJobContext): Promise<JobResult> {
  const cutoff = new Date(ctx.now.getTime() - FORTY_EIGHT_HOURS_MS);
  const appUrl = getPublicAppUrl();

  const bookings = await prisma.consultationBooking.findMany({
    where: {
      status: ConsultationStatus.COMPLETED,
      quoteAlertSentAt: null,
      completedAt: { lte: cutoff, not: null },
      quotations: { none: {} },
    },
    orderBy: { completedAt: "asc" },
    take: ctx.batchLimit,
    include: {
      consultant: { select: { id: true, name: true } },
    },
  });

  let processed = 0;
  let failed = 0;
  let stoppedForBudget = false;

  for (const booking of bookings) {
    if (ctx.isBudgetExhausted()) {
      stoppedForBudget = true;
      break;
    }
    try {
      const completedAt = (booking.completedAt ?? booking.updatedAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      const adminUrl = `${appUrl}/admin/consultations/${booking.id}`;
      const link = `/admin/consultations/${booking.id}`;

      await createAdminNotification({
        type: "QUOTE_AWAITING",
        title: "Quotation overdue",
        message: `${booking.bookingNumber} — ${booking.clientName} completed ${completedAt}, no quote yet.`,
        link,
        entityId: booking.id,
      });

      await sendAdminNotificationEmail(
        `Quotation overdue — ${booking.bookingNumber}`,
        `<p>Consultation <strong>${booking.bookingNumber}</strong> for <strong>${booking.clientName}</strong>
        was completed on ${completedAt} and still has no quotation.</p>
        <p><a href="${adminUrl}">Open consultation</a></p>`,
      );

      const staffUser = await resolveConsultantStaffUser(booking.consultant.name);
      if (staffUser) {
        await createStaffNotification({
          userId: staffUser.id,
          type: "QUOTE_AWAITING",
          title: "Quotation overdue",
          message: `${booking.bookingNumber} — ${booking.clientName} needs a quote.`,
          link,
          entityId: booking.id,
        });

        await sendSmtpMail({
          to: staffUser.email,
          subject: `Quotation overdue — ${booking.bookingNumber}`,
          html: consultantAlertHtml({
            consultantName: booking.consultant.name,
            clientName: booking.clientName,
            bookingNumber: booking.bookingNumber,
            completedAt,
            adminUrl,
          }),
        });
      }

      await prisma.consultationBooking.update({
        where: { id: booking.id },
        data: { quoteAlertSentAt: ctx.now },
      });

      processed += 1;
    } catch (e) {
      failed += 1;
      console.error("[unsent-quote-alerts]", booking.id, e);
    }
  }

  const hasMore = stoppedForBudget || bookings.length >= ctx.batchLimit;

  return {
    processed,
    failed,
    hasMore,
    detail: { scanned: bookings.length },
  };
}
