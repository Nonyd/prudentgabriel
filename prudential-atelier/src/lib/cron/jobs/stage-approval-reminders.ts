import { StageApprovalStatus } from "@prisma/client";
import type { CronJobContext, JobResult } from "@/lib/cron/types";
import { prisma } from "@/lib/prisma";
import { getPublicAppUrl } from "@/lib/app-url";
import { STAGE_SHORT_LABELS } from "@/lib/bespoke-stages";
import { sendStageApprovalReminderEmail } from "@/lib/email";
import { createClientNotification, resolveUserIdByEmail } from "@/lib/customer-notifications";

const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000;

export async function run(ctx: CronJobContext): Promise<JobResult> {
  const cutoff = new Date(ctx.now.getTime() - SEVENTY_TWO_HOURS_MS);
  const pending = await prisma.stageApproval.findMany({
    where: {
      status: StageApprovalStatus.PENDING,
      reminderSentAt: null,
      requestedAt: { lte: cutoff },
    },
    orderBy: { requestedAt: "asc" },
    take: ctx.batchLimit,
    include: {
      order: {
        select: {
          id: true,
          orderRef: true,
          clientName: true,
          clientEmail: true,
          clientProfileId: true,
        },
      },
    },
  });

  let processed = 0;
  let failed = 0;
  let stoppedForBudget = false;
  const appUrl = getPublicAppUrl();

  for (const row of pending) {
    if (ctx.isBudgetExhausted()) {
      stoppedForBudget = true;
      break;
    }
    try {
      const approveUrl = `${appUrl}/account/orders/bespoke/${row.order.id}`;
      await sendStageApprovalReminderEmail({
        to: row.order.clientEmail,
        clientName: row.order.clientName,
        orderRef: row.order.orderRef,
        stageLabel: STAGE_SHORT_LABELS[row.stage],
        approveUrl,
      });

      const userId =
        (row.order.clientProfileId
          ? (
              await prisma.clientProfile.findUnique({
                where: { id: row.order.clientProfileId },
                select: { userId: true },
              })
            )?.userId
          : null) ?? (await resolveUserIdByEmail(row.order.clientEmail));

      if (userId) {
        await createClientNotification({
          userId,
          type: "STAGE_APPROVAL_REQUESTED",
          title: "Reminder: commission review",
          message: `${row.order.orderRef} — ${STAGE_SHORT_LABELS[row.stage]} is still waiting for your approval.`,
          link: `/account/orders/bespoke/${row.order.id}`,
          entityId: row.id,
        });
      }

      await prisma.stageApproval.update({
        where: { id: row.id },
        data: { reminderSentAt: ctx.now },
      });

      processed += 1;
    } catch (e) {
      failed += 1;
      console.error("[stage-approval-reminders]", row.id, e);
    }
  }

  const hasMore = stoppedForBudget || pending.length >= ctx.batchLimit;

  return {
    processed,
    failed,
    hasMore,
    detail: { scanned: pending.length },
  };
}
