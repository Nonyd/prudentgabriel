import type { CronJobDefinition } from "@/lib/cron/types";
import { run as runBalanceReminders } from "@/lib/cron/jobs/balance-reminders";
import { run as runStageApprovalReminders } from "@/lib/cron/jobs/stage-approval-reminders";
import { run as runUnsentQuoteAlerts } from "@/lib/cron/jobs/unsent-quote-alerts";
import { run as runReviewRequests } from "@/lib/cron/jobs/review-requests";
import { run as runReceiptReminders } from "@/lib/cron/jobs/receipt-reminders";
import { run as runUpdatePerformance } from "@/lib/cron/jobs/update-performance";
import { run as runEmailOutbox } from "@/lib/cron/jobs/email-outbox";

/**
 * Single source of truth for scheduled jobs.
 * Path in vercel.json must be `/api/cron/${name}` with matching `schedule`.
 * Phase 5: point the VPS scheduler at this registry; delete vercel.json crons.
 */
export const CRON_JOBS: CronJobDefinition[] = [
  {
    name: "abandoned-cart",
    schedule: "0 0 * * *",
    description: "Abandoned cart recovery emails",
    handler: null,
    migrated: false,
  },
  {
    name: "expired-coupons",
    schedule: "0 0 * * *",
    description: "Expire coupons past their end date",
    handler: null,
    migrated: false,
  },
  {
    name: "rotate-qr",
    schedule: "0 0 * * *",
    description: "Rotate staff attendance QR secrets",
    handler: null,
    migrated: false,
  },
  {
    name: "late-alert",
    schedule: "0 9 * * 1-6",
    description: "Staff late-clock-in alerts (Mon–Sat)",
    handler: null,
    migrated: false,
  },
  {
    name: "event-reminders",
    schedule: "0 9 * * *",
    description: "Client event date reminders",
    handler: null,
    migrated: false,
  },
  {
    name: "daily-report",
    schedule: "0 23 * * *",
    description: "Daily atelier operations report",
    handler: null,
    migrated: false,
  },
  {
    name: "weekly-report",
    schedule: "0 7 * * 1",
    description: "Weekly operations report (Mondays)",
    handler: null,
    migrated: false,
  },
  {
    name: "update-performance",
    schedule: "0 2 * * *",
    description: "Staff performance score refresh",
    handler: runUpdatePerformance,
    migrated: true,
  },
  {
    name: "review-requests",
    schedule: "0 9 * * *",
    description: "Product + consultation + bespoke review request emails",
    handler: runReviewRequests,
    migrated: true,
  },
  {
    name: "balance-reminders",
    schedule: "0 9 * * *",
    description: "Bespoke outstanding-balance reminders (14-day delivery window)",
    handler: runBalanceReminders,
    migrated: true,
  },
  {
    name: "stage-approval-reminders",
    schedule: "0 10 * * *",
    description: "Client stage-approval reminders after 72h pending",
    handler: runStageApprovalReminders,
    migrated: true,
  },
  {
    name: "update-bestsellers",
    schedule: "0 2 * * *",
    description: "Refresh bestseller product flags",
    handler: null,
    migrated: false,
  },
  {
    name: "unsent-quote-alerts",
    schedule: "0 11 * * *",
    description: "Alert when COMPLETED consultations have no quotation after 48h",
    handler: runUnsentQuoteAlerts,
    migrated: true,
  },
  {
    name: "receipt-reminders",
    schedule: "0 10 * * *",
    description: "Remind clients to confirm bespoke garment receipt after 7 days",
    handler: runReceiptReminders,
    migrated: true,
  },
  {
    name: "email-outbox",
    schedule: "* * * * *",
    description: "Drain queued and failed outbound emails",
    handler: runEmailOutbox,
    migrated: true,
    budgetMs: 4 * 60_000,
  },
];

export function getCronJob(name: string): CronJobDefinition | undefined {
  return CRON_JOBS.find((j) => j.name === name);
}

export function cronPath(name: string): string {
  return `/api/cron/${name}`;
}
