import type { CronJobDefinition, CronJobHandler } from "@/lib/cron/types";
import { CRON_CATALOG, cronPath } from "@/lib/cron/catalog";
import { run as runBalanceReminders } from "@/lib/cron/jobs/balance-reminders";
import { run as runStageApprovalReminders } from "@/lib/cron/jobs/stage-approval-reminders";
import { run as runUnsentQuoteAlerts } from "@/lib/cron/jobs/unsent-quote-alerts";
import { run as runReviewRequests } from "@/lib/cron/jobs/review-requests";
import { run as runReceiptReminders } from "@/lib/cron/jobs/receipt-reminders";
import { run as runUpdatePerformance } from "@/lib/cron/jobs/update-performance";
import { run as runEmailOutbox } from "@/lib/cron/jobs/email-outbox";
import { run as runAbandonedCart } from "@/lib/cron/jobs/abandoned-cart";
import { run as runAbandonedCheckout } from "@/lib/cron/jobs/abandoned-checkout";

const HANDLERS: Record<string, CronJobHandler> = {
  "abandoned-cart": runAbandonedCart,
  "abandoned-checkout": runAbandonedCheckout,
  "update-performance": runUpdatePerformance,
  "review-requests": runReviewRequests,
  "balance-reminders": runBalanceReminders,
  "stage-approval-reminders": runStageApprovalReminders,
  "unsent-quote-alerts": runUnsentQuoteAlerts,
  "receipt-reminders": runReceiptReminders,
  "email-outbox": runEmailOutbox,
};

/**
 * Catalog + handlers. Schedules are in catalog.ts; production host cron is
 * generated from that list (deploy/cron.d/prudentgabriel). Staging fires the
 * same routes in-process when CRON_SCHEDULER=1.
 */
export const CRON_JOBS: CronJobDefinition[] = CRON_CATALOG.map((entry) => ({
  ...entry,
  handler: HANDLERS[entry.name] ?? null,
}));

export { cronPath };

export function getCronJob(name: string): CronJobDefinition | undefined {
  return CRON_JOBS.find((j) => j.name === name);
}
