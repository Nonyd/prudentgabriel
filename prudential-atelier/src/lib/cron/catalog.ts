export type CronCatalogEntry = {
  name: string;
  schedule: string;
  description: string;
  migrated: boolean;
  budgetMs?: number;
};

/**
 * Schedules and names only — safe to import from the Node instrumentation hook.
 * Handlers live in jobs.ts so nodemailer stays off the instrumentation graph.
 */
export const CRON_CATALOG: CronCatalogEntry[] = [
  {
    name: "abandoned-cart",
    schedule: "0 0 * * *",
    description: "Abandoned cart recovery emails",
    migrated: true,
  },
  {
    name: "abandoned-checkout",
    schedule: "*/15 * * * *",
    description: "Abandoned checkout recovery (email captured at step 1)",
    migrated: true,
    budgetMs: 50_000,
  },
  {
    name: "expired-coupons",
    schedule: "0 0 * * *",
    description: "Expire coupons past their end date",
    migrated: false,
  },
  {
    name: "rotate-qr",
    schedule: "0 0 * * *",
    description: "Rotate staff attendance QR secrets",
    migrated: false,
  },
  {
    name: "late-alert",
    schedule: "0 9 * * 1-6",
    description: "Staff late-clock-in alerts (Mon–Sat)",
    migrated: false,
  },
  {
    name: "event-reminders",
    schedule: "0 9 * * *",
    description: "Client event date reminders",
    migrated: false,
  },
  {
    name: "daily-report",
    schedule: "0 23 * * *",
    description: "Daily atelier operations report",
    migrated: false,
  },
  {
    name: "weekly-report",
    schedule: "0 7 * * 1",
    description: "Weekly operations report (Mondays)",
    migrated: false,
  },
  {
    name: "update-performance",
    schedule: "0 2 * * *",
    description: "Staff performance score refresh",
    migrated: true,
  },
  {
    name: "review-requests",
    schedule: "0 9 * * *",
    description: "Product + consultation + bespoke review request emails",
    migrated: true,
  },
  {
    name: "balance-reminders",
    schedule: "0 9 * * *",
    description: "Bespoke outstanding-balance reminders (14-day delivery window)",
    migrated: true,
  },
  {
    name: "stage-approval-reminders",
    schedule: "0 10 * * *",
    description: "Client stage-approval reminders after 72h pending",
    migrated: true,
  },
  {
    name: "update-bestsellers",
    schedule: "0 2 * * *",
    description: "Refresh bestseller product flags",
    migrated: false,
  },
  {
    name: "unsent-quote-alerts",
    schedule: "0 11 * * *",
    description: "Alert when COMPLETED consultations have no quotation after 48h",
    migrated: true,
  },
  {
    name: "receipt-reminders",
    schedule: "0 10 * * *",
    description: "Remind clients to confirm bespoke garment receipt after 7 days",
    migrated: true,
  },
  {
    name: "uncollected-pickup",
    schedule: "0 10 * * *",
    description: "Remind customers of uncollected store pickup after N days",
    migrated: true,
  },
  {
    name: "email-outbox",
    schedule: "* * * * *",
    description:
      "Drain queued emails. Transactional first; marketing capped at 60/min. 90s budget ≈ a 500-recipient campaign in ~9 minutes.",
    migrated: true,
    budgetMs: 90_000,
  },
];

export function cronPath(name: string): string {
  return `/api/cron/${name}`;
}
