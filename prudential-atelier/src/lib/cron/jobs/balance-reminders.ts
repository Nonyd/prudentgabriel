import type { CronJobContext, JobResult } from "@/lib/cron/types";
import { prisma } from "@/lib/prisma";
import { sendSmtpMail } from "@/lib/email-transport";
import { getPublicAppUrl } from "@/lib/app-url";
import { notifyBalanceReminder } from "@/lib/customer-notifications";

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
const REMINDER_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

function balanceReminderHtml(params: {
  firstName: string;
  outfitName: string;
  orderRef: string;
  balanceNGN: number;
  deliveryDate: string;
  payUrl: string;
}): string {
  return `
    <div style="font-family:Georgia,serif;background:#F7F2EC;padding:24px;color:#442913">
      <h1 style="color:#442913;margin:0 0 8px">A reminder about your outstanding balance</h1>
      <p>Hi ${params.firstName},</p>
      <p>You have an outstanding balance of <strong>₦${params.balanceNGN.toLocaleString("en-NG")}</strong> on your commission.</p>
      <p><strong>Commission:</strong> ${params.outfitName}<br/>
      <strong>Order:</strong> ${params.orderRef}<br/>
      <strong>Outstanding:</strong> ₦${params.balanceNGN.toLocaleString("en-NG")}<br/>
      <strong>Delivery:</strong> ${params.deliveryDate}</p>
      <p><a href="${params.payUrl}" style="display:inline-block;background:#442913;color:#E2D1C2;padding:12px 24px;text-decoration:none">Pay outstanding balance</a></p>
      <p style="margin-top:32px;font-size:12px;color:#98755B">Prudential Atelier · prudentgabriel.com</p>
    </div>
  `;
}

export async function run(ctx: CronJobContext): Promise<JobResult> {
  const nowMs = ctx.now.getTime();
  const horizon = new Date(nowMs + FOURTEEN_DAYS_MS);
  const cooldownBefore = new Date(nowMs - REMINDER_COOLDOWN_MS);
  const appUrl = getPublicAppUrl();

  const orders = await prisma.bespokeOrder.findMany({
    where: {
      balance: { gt: 0 },
      deliveryDate: { lte: horizon, gte: ctx.now },
      status: { not: "CANCELLED" },
      OR: [{ balanceReminderSentAt: null }, { balanceReminderSentAt: { lt: cooldownBefore } }],
    },
    orderBy: [{ deliveryDate: "asc" }, { createdAt: "asc" }],
    take: ctx.batchLimit,
  });

  let processed = 0;
  let failed = 0;
  let stoppedForBudget = false;

  for (const order of orders) {
    if (ctx.isBudgetExhausted()) {
      stoppedForBudget = true;
      break;
    }
    if (!order.deliveryDate) continue;
    try {
      const firstName = order.clientName.split(/\s+/)[0] ?? order.clientName;
      const deliveryDate = order.deliveryDate.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      const payUrl = `${appUrl}/track/${encodeURIComponent(order.trackingToken)}`;
      const outfitName = order.outfitDescription?.slice(0, 80) ?? "Your commission";

      await sendSmtpMail({
        to: order.clientEmail,
        subject: `Outstanding balance reminder — ${order.orderRef}`,
        html: balanceReminderHtml({
          firstName,
          outfitName,
          orderRef: order.orderRef,
          balanceNGN: order.balance,
          deliveryDate,
          payUrl,
        }),
      });

      notifyBalanceReminder({
        clientProfileId: order.clientProfileId,
        clientEmail: order.clientEmail,
        orderId: order.id,
        orderRef: order.orderRef,
        trackingToken: order.trackingToken,
        balanceNGN: order.balance,
      });

      await prisma.bespokeOrder.update({
        where: { id: order.id },
        data: { balanceReminderSentAt: ctx.now },
      });

      processed += 1;
    } catch (e) {
      failed += 1;
      console.error("[balance-reminders]", order.id, e);
    }
  }

  const hasMore = stoppedForBudget || orders.length >= ctx.batchLimit;

  return {
    processed,
    failed,
    hasMore,
    detail: { scanned: orders.length },
  };
}
