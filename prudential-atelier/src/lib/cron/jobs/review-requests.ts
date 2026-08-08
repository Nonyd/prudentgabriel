import type { CronJobContext, JobResult } from "@/lib/cron/types";
import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendConsultationReviewRequestEmail, sendProductReviewRequestEmail } from "@/lib/email";
import { notifyReviewRequest } from "@/lib/customer-notifications";
import { maybeSendBespokeReviewRequest } from "@/lib/bespoke-review";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const BESPOKE_FALLBACK_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

export async function run(ctx: CronJobContext): Promise<JobResult> {
  let processed = 0;
  let failed = 0;
  let stoppedForBudget = false;

  const cutoff = new Date(ctx.now.getTime() - TWENTY_FOUR_HOURS_MS);
  const eligibleOrders = await prisma.order.findMany({
    where: {
      status: "DELIVERED",
      reviewRequestSent: false,
      isBespoke: false,
      userId: { not: null },
      updatedAt: { lte: cutoff },
    },
    include: {
      user: { select: { email: true, name: true } },
      items: {
        take: 1,
        include: { product: { select: { id: true, name: true } } },
      },
    },
    take: ctx.batchLimit,
  });

  for (const order of eligibleOrders) {
    if (ctx.isBudgetExhausted()) {
      stoppedForBudget = true;
      break;
    }
    try {
      if (!order.user?.email) continue;
      const item = order.items[0];
      if (!item?.product) continue;
      const firstName = (order.user.name ?? "there").split(/\s+/)[0] ?? "there";
      await sendProductReviewRequestEmail({
        to: order.user.email,
        firstName,
        productName: item.product.name,
        productId: item.product.id,
        orderId: order.id,
      });
      await prisma.order.update({
        where: { id: order.id },
        data: { reviewRequestSent: true },
      });
      if (order.userId) {
        notifyReviewRequest({
          userId: order.userId,
          orderId: order.id,
          productName: item.product.name,
        });
      }
      processed += 1;
    } catch (e) {
      console.warn("[review-requests] rtw", order.id, e);
      failed += 1;
    }
  }

  if (!stoppedForBudget) {
    const consultationCutoff = new Date(ctx.now.getTime() - ONE_HOUR_MS);
    const eligibleConsultations = await prisma.consultationBooking.findMany({
      where: {
        status: "COMPLETED",
        reviewRequestSent: false,
        completedAt: { lte: consultationCutoff },
      },
      select: { id: true, clientEmail: true, clientName: true },
      take: ctx.batchLimit,
    });

    for (const booking of eligibleConsultations) {
      if (ctx.isBudgetExhausted()) {
        stoppedForBudget = true;
        break;
      }
      try {
        const firstName = (booking.clientName ?? "there").split(/\s+/)[0] ?? "there";
        await sendConsultationReviewRequestEmail({
          to: booking.clientEmail,
          firstName,
          consultationId: booking.id,
        });
        await prisma.consultationBooking.update({
          where: { id: booking.id },
          data: { reviewRequestSent: true },
        });
        processed += 1;
      } catch (e) {
        console.warn("[review-requests] consult", booking.id, e);
        failed += 1;
      }
    }
  }

  if (!stoppedForBudget) {
    const bespokeFallback = new Date(ctx.now.getTime() - BESPOKE_FALLBACK_DAYS_MS);
    const bespokeOrders = await prisma.bespokeOrder.findMany({
      where: {
        reviewRequestSent: false,
        status: { in: [OrderStatus.DELIVERED, OrderStatus.ARCHIVED] },
        OR: [
          { receiptConfirmedAt: { not: null } },
          { deliveredAt: { lte: bespokeFallback } },
        ],
      },
      select: { id: true },
      take: ctx.batchLimit,
    });

    for (const order of bespokeOrders) {
      if (ctx.isBudgetExhausted()) {
        stoppedForBudget = true;
        break;
      }
      try {
        const sent = await maybeSendBespokeReviewRequest(order.id);
        if (sent) processed += 1;
      } catch (e) {
        console.warn("[review-requests] bespoke", order.id, e);
        failed += 1;
      }
    }
  }

  return {
    processed,
    failed,
    hasMore: stoppedForBudget,
  };
}
