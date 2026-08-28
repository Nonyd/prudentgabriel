import { OrderStatus } from "@prisma/client";
import type { CronJobContext, JobResult } from "@/lib/cron/types";
import { prisma } from "@/lib/prisma";
import { sendUncollectedPickupEmail } from "@/lib/email";
import { getShippingCopy } from "@/lib/shipping/copy";

export async function run(ctx: CronJobContext): Promise<JobResult> {
  const { uncollectedDays } = await getShippingCopy();
  const cutoff = new Date(ctx.now.getTime() - uncollectedDays * 24 * 60 * 60 * 1000);

  const orders = await prisma.order.findMany({
    where: {
      status: OrderStatus.READY_FOR_COLLECTION,
      collectionRemindedAt: null,
      collectionReadyAt: { lte: cutoff },
      shippingMethodKind: "PICKUP",
    },
    include: { user: { select: { email: true, name: true } } },
    orderBy: { collectionReadyAt: "asc" },
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
    const to = order.guestEmail ?? order.user?.email;
    if (!to || !order.collectionCode) continue;
    const firstName = (order.guestName ?? order.user?.name ?? "there").split(/\s+/)[0] ?? "there";
    try {
      await sendUncollectedPickupEmail({
        to,
        firstName,
        orderNumber: order.orderNumber,
        collectionCode: order.collectionCode,
        days: uncollectedDays,
      });
      await prisma.order.update({
        where: { id: order.id },
        data: { collectionRemindedAt: ctx.now },
      });
      processed += 1;
    } catch (e) {
      failed += 1;
      console.warn("[uncollected-pickup]", order.orderNumber, e);
    }
  }

  return {
    processed,
    failed,
    hasMore: orders.length === ctx.batchLimit || stoppedForBudget,
    detail: { uncollectedDays, scanned: orders.length },
  };
}
