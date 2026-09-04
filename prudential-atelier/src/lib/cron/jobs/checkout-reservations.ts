import type { CronJobContext, JobResult } from "@/lib/cron/types";
import { expireStaleCheckoutReservations } from "@/lib/checkout-reservations";

export async function run(ctx: CronJobContext): Promise<JobResult> {
  let processed = 0;
  let pass = 0;
  do {
    if (ctx.isBudgetExhausted()) {
      return { processed, failed: 0, hasMore: true };
    }
    pass = await expireStaleCheckoutReservations(undefined, ctx.now, 40);
    processed += pass;
  } while (pass > 0);
  return { processed, failed: 0, hasMore: false };
}
