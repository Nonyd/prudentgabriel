import type { CronJobContext, JobResult } from "@/lib/cron/types";
import { dueAbandonedCheckoutSessions, sendAbandonedCheckoutReminder } from "@/lib/checkout-session";

export async function run(ctx: CronJobContext): Promise<JobResult> {
  const due = await dueAbandonedCheckoutSessions(ctx.now, ctx.batchLimit);
  let processed = 0;
  let failed = 0;
  let skipped = 0;
  let stoppedForBudget = false;

  for (const item of due) {
    if (ctx.isBudgetExhausted()) {
      stoppedForBudget = true;
      break;
    }
    try {
      const result = await sendAbandonedCheckoutReminder({
        sessionId: item.session.id,
        kind: item.kind,
        now: ctx.now,
      });
      if (result.created) processed += 1;
      else skipped += 1;
    } catch (e) {
      console.warn("[abandoned-checkout]", item.session.id, e);
      failed += 1;
    }
  }

  return {
    processed,
    failed,
    hasMore: stoppedForBudget || due.length >= ctx.batchLimit,
    detail: { candidates: due.length, skipped },
  };
}
