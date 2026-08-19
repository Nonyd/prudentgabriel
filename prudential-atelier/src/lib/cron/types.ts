export type JobResult = {
  processed: number;
  failed: number;
  /**
   * True when the run stopped early (budget or batch) with work still pending.
   * Admin UI shows "completed, backlog remains" — not a failure.
   */
  hasMore?: boolean;
  /** Optional detail for logs / admin UI (e.g. scanned count). */
  detail?: Record<string, unknown>;
};

export type CronJobContext = {
  /** Wall clock at job start — use for cutoff math so all items share one "now". */
  now: Date;
  /** Secondary fetch bound. Time budget usually stops the loop first on Hobby. */
  batchLimit: number;
  /** Check at the top of each item iteration; stop cleanly when true. */
  isBudgetExhausted: () => boolean;
};

export type CronJobHandler = (ctx: CronJobContext) => Promise<JobResult>;

export type CronJobDefinition = {
  name: string;
  /** Standard 5-field cron expression (UTC). */
  schedule: string;
  description: string;
  /**
   * Migrated jobs export a handler. Legacy jobs keep logic in their route until
   * Phase 5 / a later sprint; Run now hits the HTTP route for those.
   */
  handler: CronJobHandler | null;
  migrated: boolean;
  /** Override RUN_BUDGET_MS for this job (email drain is not Hobby-bound). */
  budgetMs?: number;
};

/**
 * Primary per-run control: stop before the host kills the function.
 * Hobby Vercel ~10s ceiling → 8s budget. Non-Vercel (local / Phase 5 VPS) gets
 * five minutes. Phase 5: raise the Vercel branch or collapse both to one number.
 */
export const RUN_BUDGET_MS = process.env.VERCEL ? 8_000 : 5 * 60_000;

/** Secondary sanity bound on items fetched per run. */
export const CRON_BATCH_LIMIT = 200;

/** RUNNING older than this is reaped as TIMED_OUT when a new run starts. */
export const CRON_STUCK_RUNNING_MS = 15 * 60 * 1000;

/** Drop CronRun rows older than this on every migrated job start. */
export const CRON_RUN_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
