# Cron jobs (portable infrastructure)

Scheduled work is defined in `src/lib/cron/jobs.ts` (registry). Each entry has
`name`, `schedule` (5-field cron, UTC), `description`, and optionally a
`handler`. Vercel currently triggers jobs via `vercel.json` → `/api/cron/<name>`.

## Design goals

- **Resumable, not fast.** Process oldest unprocessed items first, mark each
  item immediately after its side effect, stop when the **time budget** is
  spent (`RUN_BUDGET_MS`), catch per item. Finish with `status: OK` and
  `hasMore: true` when work remains — that is expected on Hobby, not a failure.
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
  `CRON_SECRET`). Swap this file for the VPS variant later.
- **Admin.** `/admin/system/jobs` (ADMIN / SUPER_ADMIN) lists registry jobs,
  last run, stale flag (no OK within 2× interval), backlog hint, and **Run now**.

## Time budget & Hobby throughput

| Constant | Value | Role |
|----------|-------|------|
| `RUN_BUDGET_MS` | `8_000` on Vercel; `5 * 60_000` otherwise | Primary stop |
| `CRON_BATCH_LIMIT` | `200` | Secondary fetch bound |

Hobby allows **one run per day** per cron expression and kills functions at
~10 seconds. At ~300ms per SMTP email, an 8-second budget clears roughly
**~25 items per day** per job. That is ample while production volume is low;
it is a known ceiling before Phase 5. When backlog grows past ~25/day, either
raise the schedule frequency (requires Pro) or move to the VPS.

## Migrated in Sprint C0

| Job | Marker | Notes |
|-----|--------|-------|
| `balance-reminders` | `BespokeOrder.balanceReminderSentAt` | Re-sends after 7-day cooldown |
| `stage-approval-reminders` | `StageApproval.reminderSentAt` | Once per pending approval |
| `unsent-quote-alerts` | `ConsultationBooking.quoteAlertSentAt` | Once; COMPLETED + no quotation + 48h |

## Pending migration (legacy route handlers)

Leave these on their current structure until a later sprint / Phase 5:

- `abandoned-cart`
- `expired-coupons`
- `rotate-qr`
- `late-alert`
- `event-reminders`
- `daily-report`
- `weekly-report`
- `update-performance`
- `review-requests`
- `update-bestsellers`

They appear in the registry (`migrated: false`) so the drift test still covers
them. **Run now** for legacy jobs POSTs their existing HTTP route with
`CRON_SECRET`.

## Drift test

`pnpm test:cron` asserts every registry entry has a matching `vercel.json`
cron (path + schedule), and vice versa. At Phase 5, point this test at the VPS
scheduler config instead of `vercel.json`.

## Phase 5 (VPS) checklist

1. Run a node process (or system crontab) that reads `CRON_JOBS` and calls
   `executeCronJob` / the HTTP routes on schedule.
2. Delete the `crons` block from `vercel.json`.
3. Repoint `scripts/test-cron-registry.ts`.
4. Raise `RUN_BUDGET_MS` (single edit in `src/lib/cron/types.ts`) — e.g. collapse
   both branches to `5 * 60_000`. Optionally raise or remove `CRON_BATCH_LIMIT`.

No handler changes required. Throughput then stops being a daily ~25-item ceiling.
