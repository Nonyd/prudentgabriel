# Cron jobs (portable infrastructure)

Scheduled work is defined in `src/lib/cron/jobs.ts` (registry). Each entry has
`name`, `schedule` (5-field cron, UTC), `description`, and optionally a
`handler`.

**Vercel `vercel.json` crons do not fire on the Coolify VPS** and are no longer
listed there. Scheduling:

- **Staging:** the app process with `CRON_SCHEDULER=1` (set in
  `deploy/compose.staging.yaml`) reads `CRON_JOBS` and POSTs
  `/api/cron/:name` on localhost with `CRON_SECRET`.
- **Production:** `/etc/cron.d/prudentgabriel` curls
  `https://prudentgabriel.com/api/cron/...`. That file does not yet include
  `email-outbox`. Do not also set `CRON_SCHEDULER=1` on production or jobs
  will double-fire.

## Design goals

- **Resumable, not fast.** Process oldest unprocessed items first, mark each
  item immediately after its side effect, stop when the **time budget** is
  spent, catch per item. Finish with `status: OK` and `hasMore: true` when
  work remains — that is expected, not a failure.
- **Handlers decoupled from HTTP.** Migrated jobs live in
  `src/lib/cron/jobs/<name>.ts` as `export async function run(ctx)`. Routes are
  thin auth wrappers. **Run now** also goes through `executeCronJob` (same
  budget).
- **Visibility.** Every migrated invocation writes a `CronRun` row
  (`RUNNING` → `OK` | `FAILED`). A row stuck in `RUNNING` past 15 minutes is
  **reaped** as `TIMED_OUT` on the next start. With the time budget, `TIMED_OUT`
  should be unusual; `OK` + `hasMore` is the normal partial drain.
- **Retention.** The runner deletes `CronRun` rows older than 90 days on each
  migrated job start.
- **Auth.** `verifyCronRequest(req)` in `src/lib/cron/verify.ts` (Bearer
  `CRON_SECRET`).
- **Admin.** `/admin/system/jobs` (ADMIN / SUPER_ADMIN) lists registry jobs,
  last run, stale flag (no OK within 2× max(schedule interval, job budget)),
  backlog hint, and **Run now**.

## Time budget

| Constant | Value | Role |
|----------|-------|------|
| `RUN_BUDGET_MS` | `8_000` on Vercel; `5 * 60_000` otherwise | Default stop |
| `email-outbox.budgetMs` | `50_000` | Drain on a minutely schedule without overlapping runs |
| `CRON_BATCH_LIMIT` | `200` | Secondary fetch bound |

Stale detection uses `2 × max(cronIntervalMs(schedule), budgetMs)` so a job
cannot look healthy on a 1-minute cadence while its budget is longer than that
window, or look stale while still inside a legitimate budget.

## Migrated

| Job | Marker | Notes |
|-----|--------|-------|
| `balance-reminders` | `BespokeOrder.balanceReminderSentAt` | Re-sends after 7-day cooldown |
| `stage-approval-reminders` | `StageApproval.reminderSentAt` | Once per pending approval |
| `unsent-quote-alerts` | `ConsultationBooking.quoteAlertSentAt` | Once; COMPLETED + no quotation + 48h |
| `update-performance` | `PerformanceRecord` upsert | Staff scores; fail-closed cron auth |
| `review-requests` | review request emails | Product + consultation + bespoke |
| `receipt-reminders` | receipt confirmation | 7 days after delivery |
| `email-outbox` | `EmailMessage` | Drain queue; 50s budget |

## Pending migration (legacy route handlers)

- `abandoned-cart`
- `expired-coupons`
- `rotate-qr`
- `late-alert`
- `event-reminders`
- `daily-report`
- `weekly-report`
- `update-bestsellers`

They appear in the registry (`migrated: false`). **Run now** and the in-process
scheduler POST their existing HTTP routes with `CRON_SECRET`.

## Drift test

`pnpm test:cron` asserts every registry entry has `src/app/api/cron/<name>/route.ts`
and a 5-field schedule, plus matcher / stale-window checks.
