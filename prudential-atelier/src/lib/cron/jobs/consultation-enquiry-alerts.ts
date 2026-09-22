import { ConsultationEnquiryStatus } from "@prisma/client";
import type { CronJobContext, JobResult } from "@/lib/cron/types";
import { prisma } from "@/lib/prisma";
import { ENQUIRY_WAITING_ALERT_MS } from "@/lib/consultation-enquiry";
import { notifyConsultationEnquiry } from "@/lib/notifications";
import { sendAdminNotificationEmail } from "@/lib/email";
import { getPublicAppUrl } from "@/lib/app-url";
import { logServerError } from "@/lib/logger";

/**
 * BA2: a bride who waits two days has gone elsewhere. An enquiry still PENDING
 * after a day is raised once — a NEW_CONSULTATION notification titled "waiting
 * over a day" to the consultations desk, plus the admin mailbox. The queue also
 * sorts oldest first and marks anything past a day in amber.
 */
export async function run(ctx: CronJobContext): Promise<JobResult> {
  const cutoff = new Date(ctx.now.getTime() - ENQUIRY_WAITING_ALERT_MS);
  const waiting = await prisma.consultationEnquiry.findMany({
    where: { status: ConsultationEnquiryStatus.PENDING, createdAt: { lte: cutoff }, overdueAlertSentAt: null },
    orderBy: { createdAt: "asc" },
    take: ctx.batchLimit,
  });

  let processed = 0;
  let failed = 0;
  let stoppedForBudget = false;
  for (const enquiry of waiting) {
    if (ctx.isBudgetExhausted()) {
      stoppedForBudget = true;
      break;
    }
    try {
      // Claim first so two runners never alert twice.
      const claimed = await prisma.consultationEnquiry.updateMany({
        where: { id: enquiry.id, overdueAlertSentAt: null, status: ConsultationEnquiryStatus.PENDING },
        data: { overdueAlertSentAt: ctx.now },
      });
      if (claimed.count !== 1) continue;
      await notifyConsultationEnquiry(enquiry, "waiting");
      await sendAdminNotificationEmail(
        `Enquiry waiting over a day — ${enquiry.enquiryNumber}`,
        `<p>${enquiry.enquiryNumber} from <strong>${enquiry.clientName.replace(/[<>&]/g, "")}</strong> has waited over a day for a decision${enquiry.shortNotice ? " and her event is close" : ""}.</p>
         <p><a href="${getPublicAppUrl()}/admin/consultations/enquiries?open=${enquiry.id}">Open the enquiry queue</a></p>`,
        `consultation-enquiry-waiting:${enquiry.id}`,
      );
      processed += 1;
    } catch (e) {
      failed += 1;
      await logServerError({ errorType: "CRON_ENQUIRY_ALERT", error: e });
    }
  }

  return {
    processed,
    failed,
    hasMore: stoppedForBudget || waiting.length >= ctx.batchLimit,
    detail: { scanned: waiting.length },
  };
}
