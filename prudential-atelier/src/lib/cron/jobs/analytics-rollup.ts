import type { CronJobContext, JobResult } from "@/lib/cron/types";
import { rollupAnalyticsDaily } from "@/lib/analytics/retention";

export async function run(ctx: CronJobContext): Promise<JobResult> {
  const result = await rollupAnalyticsDaily(ctx.now);
  return {
    processed: result.rolledDays,
    failed: 0,
    detail: { deleted: result.deleted },
  };
}
