import type { CronJobDefinition, CronJobHandler } from "@/lib/cron/types";
import { CRON_CATALOG, cronPath } from "@/lib/cron/catalog";
import { run as runBalanceReminders } from "@/lib/cron/jobs/balance-reminders";
import { run as runStageApprovalReminders } from "@/lib/cron/jobs/stage-approval-reminders";
import { run as runUnsentQuoteAlerts } from "@/lib/cron/jobs/unsent-quote-alerts";
import { run as runReviewRequests } from "@/lib/cron/jobs/review-requests";
import { run as runReceiptReminders } from "@/lib/cron/jobs/receipt-reminders";
import { run as runUpdatePerformance } from "@/lib/cron/jobs/update-performance";
import { run as runEmailOutbox } from "@/lib/cron/jobs/email-outbox";

const HANDLERS: Record<string, CronJobHandler> = {
  "update-performance": runUpdatePerformance,
  "review-requests": runReviewRequests,
  "balance-reminders": runBalanceReminders,
  "stage-approval-reminders": runStageApprovalReminders,
  "unsent-quote-alerts": runUnsentQuoteAlerts,
  "receipt-reminders": runReceiptReminders,
  "email-outbox": runEmailOutbox,
};

/**
 * Single source of truth for scheduled jobs (catalog + handlers).
 * The VPS process with CRON_SCHEDULER=1 reads the catalog and POSTs each
 * `/api/cron/${name}` on `schedule` (UTC). vercel.json no longer lists crons.
 */
export const CRON_JOBS: CronJobDefinition[] = CRON_CATALOG.map((entry) => ({
  ...entry,
  handler: HANDLERS[entry.name] ?? null,
}));

export { cronPath };

export function getCronJob(name: string): CronJobDefinition | undefined {
  return CRON_JOBS.find((j) => j.name === name);
}
