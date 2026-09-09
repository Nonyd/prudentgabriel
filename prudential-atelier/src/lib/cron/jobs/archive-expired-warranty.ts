import type { CronJobContext, JobResult } from "@/lib/cron/types";
import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { maybeArchiveBespokeOrder } from "@/lib/bespoke-archive";

/**
 * Archive commissions whose alteration window has elapsed, receipt is
 * confirmed, and nothing is open. Does not run on receipt confirm.
 */
export async function run(ctx: CronJobContext): Promise<JobResult> {
  const candidates = await prisma.bespokeOrder.findMany({
    where: {
      status: OrderStatus.DELIVERED,
      receiptConfirmedAt: { not: null },
    },
    select: { id: true },
    orderBy: { receiptConfirmedAt: "asc" },
    take: ctx.batchLimit,
  });

  let processed = 0;
  let failed = 0;
  let archived = 0;
  let stoppedForBudget = false;

  for (const order of candidates) {
    if (ctx.isBudgetExhausted()) {
      stoppedForBudget = true;
      break;
    }
    try {
      const did = await maybeArchiveBespokeOrder(order.id, ctx.now);
      if (did) archived += 1;
      processed += 1;
    } catch (e) {
      console.warn("[archive-expired-warranty]", order.id, e);
      failed += 1;
    }
  }

  return {
    processed,
    failed,
    hasMore: stoppedForBudget || candidates.length >= ctx.batchLimit,
    detail: { candidates: candidates.length, archived },
  };
}
