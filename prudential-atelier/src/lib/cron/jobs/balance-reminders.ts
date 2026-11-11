import type { CronJobContext, JobResult } from "@/lib/cron/types";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { renderBrandedBodyHtml } from "@/lib/admin-email-render";
import { getPublicAppUrl } from "@/lib/app-url";
import { notifyBalanceReminder } from "@/lib/customer-notifications";
import { logServerError } from "@/lib/logger";
import { formatBespokeBook } from "@/lib/atelier-fx";
import { ensureInvoicePublicRaw } from "@/lib/capability-token-lookup";
import { OrderStatus, Prisma, ShippingQuoteStatus } from "@prisma/client";
import { findPendingShippingReceipt, shippingAmountDueNGN } from "@/lib/shipping/due";
import { sendShippingPaymentRequest } from "@/lib/shipping/notify";

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
const REMINDER_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

function balanceReminderHtml(params: {
  firstName: string;
  outfitName: string;
  orderRef: string;
  balanceLabel: string;
  deliveryDate: string;
  payUrl: string;
}): string {
  return `
    <div style="font-family:Georgia,serif;color:#442913">
      <h1 style="color:#442913;margin:0 0 8px">A reminder about your outstanding balance</h1>
      <p>Hi ${params.firstName},</p>
      <p>You have an outstanding balance of <strong>${params.balanceLabel}</strong> on your commission.</p>
      <p><strong>Commission:</strong> ${params.outfitName}<br/>
      <strong>Order:</strong> ${params.orderRef}<br/>
      <strong>Outstanding:</strong> ${params.balanceLabel}<br/>
      <strong>Delivery:</strong> ${params.deliveryDate}</p>
      <p><a href="${params.payUrl}" style="display:inline-block;background:#442913;color:#E2D1C2;padding:12px 24px;text-decoration:none">Pay outstanding balance</a></p>
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
      const invoice = order.quotationId
        ? await prisma.invoice.findFirst({
            where: { quotationId: order.quotationId },
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              publicToken: true,
              publicTokenEnc: true,
              publicTokenExpiresAt: true,
              expiresAt: true,
              paidAt: true,
            },
          })
        : null;
      let payPath = `/account/orders/bespoke/${order.id}/pay`;
      if (invoice) {
        const raw = await ensureInvoicePublicRaw(invoice);
        payPath = `/invoice/${raw}`;
      }
      const payUrl = `${appUrl}${payPath}`;
      const outfitName = order.outfitDescription?.slice(0, 80) ?? "Your commission";
      const balanceLabel = formatBespokeBook(order.balance, order);

      await sendEmail({
        to: order.clientEmail,
        subject: `Outstanding balance reminder — ${order.orderRef}`,
        html: await renderBrandedBodyHtml(
          balanceReminderHtml({
            firstName,
            outfitName,
            orderRef: order.orderRef,
            balanceLabel,
            deliveryDate,
            payUrl,
          }),
          { brand: "atelier", previewText: `Outstanding balance on ${order.orderRef}` },
        ),
        template: "balance-reminder",
        idempotencyKey: `balance-reminder:${order.id}:${ctx.now.toISOString().slice(0, 10)}`,
        relatedType: "BespokeOrder",
        relatedId: order.id,
      });

      notifyBalanceReminder({
        clientProfileId: order.clientProfileId,
        clientEmail: order.clientEmail,
        orderId: order.id,
        orderRef: order.orderRef,
        payPath,
        balanceLabel,
      });

      await prisma.bespokeOrder.update({
        where: { id: order.id },
        data: { balanceReminderSentAt: ctx.now },
      });

      processed += 1;
    } catch (e) {
      failed += 1;
      await logServerError({ errorType: "CRON_BALANCE_REMINDER", error: e, orderId: order.id });
    }
  }

  const shipping = stoppedForBudget
    ? { processed: 0, failed: 0, scanned: 0, stoppedForBudget: true }
    : await remindUnpaidShipping(ctx);
  processed += shipping.processed;
  failed += shipping.failed;

  const hasMore = stoppedForBudget || shipping.stoppedForBudget || orders.length >= ctx.batchLimit;

  return {
    processed,
    failed,
    hasMore,
    detail: { scanned: orders.length, shippingScanned: shipping.scanned, shippingReminded: shipping.processed },
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** First reminder this long after the quote, then this long between reminders. */
export const SHIPPING_FIRST_REMINDER_MS = 2 * DAY_MS;
export const SHIPPING_REMINDER_GAP_MS = 3 * DAY_MS;
export const SHIPPING_MAX_REMINDERS = 5;

type QuoteLocked = { quotedAt?: string | null; remindedAt?: string | null; reminderCount?: number | null };

/** Whether a quoted, unpaid shipping fee is due a reminder now. */
export function shippingReminderDue(locked: unknown, nowMs: number): { due: boolean; count: number } {
  const l = (locked ?? {}) as QuoteLocked;
  const count = typeof l.reminderCount === "number" ? l.reminderCount : 0;
  if (count >= SHIPPING_MAX_REMINDERS) return { due: false, count };
  const quotedAt = l.quotedAt ? Date.parse(l.quotedAt) : NaN;
  if (!Number.isFinite(quotedAt) || nowMs - quotedAt < SHIPPING_FIRST_REMINDER_MS) return { due: false, count };
  const remindedAt = l.remindedAt ? Date.parse(l.remindedAt) : NaN;
  if (Number.isFinite(remindedAt) && nowMs - remindedAt < SHIPPING_REMINDER_GAP_MS) return { due: false, count };
  return { due: true, count };
}

/** RTW orders whose shipping was quoted and is still unpaid: email + bell, with the lasting pay link. */
async function remindUnpaidShipping(ctx: CronJobContext) {
  const nowMs = ctx.now.getTime();
  const orders = await prisma.order.findMany({
    where: {
      shippingQuoteStatus: ShippingQuoteStatus.QUOTED,
      status: { notIn: [OrderStatus.CANCELLED, OrderStatus.REFUNDED, OrderStatus.ABANDONED] },
    },
    orderBy: { updatedAt: "asc" },
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
    if (shippingAmountDueNGN(order) <= 0) continue;
    const { due, count } = shippingReminderDue(order.shippingQuoteLocked, nowMs);
    if (!due) continue;
    // She sent a transfer receipt: no reminder while the house is checking it.
    if (await findPendingShippingReceipt(order.id)) continue;
    try {
      const sent = await sendShippingPaymentRequest(order.id, { reminder: { count: count + 1 } });
      if (!sent) continue;
      const prev = (order.shippingQuoteLocked as Record<string, unknown> | null) ?? {};
      await prisma.order.update({
        where: { id: order.id },
        data: {
          shippingQuoteLocked: {
            ...prev,
            reminderCount: count + 1,
            remindedAt: ctx.now.toISOString(),
          } as Prisma.InputJsonValue,
        },
      });
      processed += 1;
    } catch (e) {
      failed += 1;
      await logServerError({ errorType: "CRON_SHIPPING_REMINDER", error: e, orderId: order.id });
    }
  }
  return { processed, failed, scanned: orders.length, stoppedForBudget };
}
