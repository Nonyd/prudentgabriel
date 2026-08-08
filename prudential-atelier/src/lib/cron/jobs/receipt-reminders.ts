import type { CronJobContext, JobResult } from "@/lib/cron/types";
import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendReceiptReminderEmail } from "@/lib/email";
import { getPublicAppUrl } from "@/lib/app-url";
import { createClientNotification, resolveUserIdByEmail } from "@/lib/customer-notifications";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function run(ctx: CronJobContext): Promise<JobResult> {
  const cutoff = new Date(ctx.now.getTime() - SEVEN_DAYS_MS);
  const orders = await prisma.bespokeOrder.findMany({
    where: {
      status: { in: [OrderStatus.DELIVERED] },
      deliveredAt: { lte: cutoff },
      receiptConfirmedAt: null,
      receiptReminderSentAt: null,
    },
    orderBy: { deliveredAt: "asc" },
    take: ctx.batchLimit,
  });

  let processed = 0;
  let failed = 0;
  let stoppedForBudget = false;
  const base = getPublicAppUrl().replace(/\/+$/, "");

  for (const order of orders) {
    if (ctx.isBudgetExhausted()) {
      stoppedForBudget = true;
      break;
    }
    try {
      const confirmUrl = `${base}/receipt/${order.receiptConfirmToken}`;
      const firstName = order.clientName.split(/\s+/)[0] ?? order.clientName;
      await sendReceiptReminderEmail({
        to: order.clientEmail,
        firstName,
        orderRef: order.orderRef,
        confirmUrl,
      });
      await prisma.bespokeOrder.update({
        where: { id: order.id },
        data: { receiptReminderSentAt: ctx.now },
      });
      const userId =
        (await resolveUserIdByEmail(order.clientEmail)) ??
        (order.clientProfileId
          ? (
              await prisma.clientProfile.findUnique({
                where: { id: order.clientProfileId },
                select: { userId: true },
              })
            )?.userId
          : null);
      if (userId) {
        void createClientNotification({
          userId,
          type: "RECEIPT_CONFIRMATION_REQUESTED",
          title: "Confirm your garment receipt",
          message: `Please confirm you received commission ${order.orderRef}.`,
          link: `/account/orders/bespoke/${order.id}`,
          entityId: order.id,
        }).catch(() => undefined);
      }
      processed += 1;
    } catch (e) {
      console.warn("[receipt-reminders]", order.id, e);
      failed += 1;
    }
  }

  return {
    processed,
    failed,
    hasMore: stoppedForBudget || orders.length >= ctx.batchLimit,
    detail: { candidates: orders.length },
  };
}
