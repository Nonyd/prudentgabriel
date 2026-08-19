import type { CronJobContext, JobResult } from "@/lib/cron/types";
import { drainQueuedEmails } from "@/lib/email-outbox";

export async function run(ctx: CronJobContext): Promise<JobResult> {
  return drainQueuedEmails({
    now: ctx.now,
    batchLimit: ctx.batchLimit,
    isBudgetExhausted: ctx.isBudgetExhausted,
  });
}
