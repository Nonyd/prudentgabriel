# Cron jobs

Schedules live in `src/lib/cron/catalog.ts`. That list is the only source of
truth. Generate the production crontab from it; do not edit `/etc/cron.d`
by hand.

```text
cd prudential-atelier
pnpm exec tsx --tsconfig tsconfig.scripts.json scripts/render-host-cron.ts
```

`pnpm test:cron` checks every registry name has `src/app/api/cron/<name>/route.ts`,
that `deploy/cron.d/prudentgabriel` matches the renderer, and that `vercel.json`
has no `crons` key. Vercel is not running this app.

## Where jobs actually fire

**Staging** uses the in-process scheduler (`CRON_SCHEDULER=1` in
`deploy/compose.staging.yaml`, also set by `entrypoint.sh` when the public URL
is `staging.prudentgabriel.com`). It POSTs `http://127.0.0.1:3000/api/cron/:name`
with `Authorization: Bearer $CRON_SECRET` on each matching UTC minute.

**Production** uses the host crontab at `/etc/cron.d/prudentgabriel`. Compose
runs a single `app` container (`container_name: prudentgabriel-main`, no
replicas). Keep that scheduler on the host, not in the process:

- A container restart does not wait on Next instrumentation to start ticking.
- The fourteen jobs that are not `email-outbox` were not written for two
  concurrent runners. If production is ever scaled to more than one app
  replica, do not turn on `CRON_SCHEDULER=1` on those replicas either; keep
  one host crontab (or one designated runner).
- `email-outbox` claims rows with `updateMany`, so a duplicate drain is safe.
  The others are not.

Do not set `CRON_SCHEDULER=1` on production. Host cron already POSTs the same
routes. Two schedulers on one container double-fire every job.

Staging must not also install `/etc/cron.d/prudentgabriel` against the staging
URL, or it would double-fire with the in-process scheduler.

## Production crontab (exact shape)

Committed copy: `deploy/cron.d/prudentgabriel`. Installed mode `600`, owner
`root`. The `deploy` user cannot read `/etc/cron.d/prudentgabriel` on the VPS
today; the repo copy is what you review.

`CRON_SECRET` is not in the crontab. Each line calls
`/opt/prudentgabriel/deploy/cron-fire.sh <job>` which reads `CRON_SECRET=` from
`/opt/prudentgabriel/deploy/.env.production` and POSTs
`https://prudentgabriel.com/api/cron/<job>` with `Authorization: Bearer …`.

The file sets `CRON_TZ=UTC` so 5-field expressions match the registry and the
staging scheduler. The previous host file used the machine timezone (CEST), so
`0 9 * * *` ran at 07:00 UTC. After install, that same line runs at 09:00 UTC.

Install (SSH as someone with sudo):

```bash
cd /opt/prudentgabriel/deploy
sudo bash install-host-cron.sh
```

Until that runs, `deploy` can add only the outbox drain to their user crontab
(so production does not queue mail with nothing to send it):

```bash
crontab -l 2>/dev/null | grep -v 'cron-fire.sh email-outbox' | grep -v '^CRON_TZ=' > /tmp/pg-cron || true
printf 'CRON_TZ=UTC\n* * * * * /opt/prudentgabriel/deploy/cron-fire.sh email-outbox\n' >> /tmp/pg-cron
crontab /tmp/pg-cron
```

After `install-host-cron.sh`, remove that user line or `email-outbox` runs twice
(safe, extra load). Then delete or empty `/etc/cron.d/prudentgabriel` only by
replacing it with the generated file — do not leave the old root file next to
a full user crontab.

## Design

- **Resumable, not fast.** Oldest work first, mark each item after the side
  effect, stop when the time budget is spent. `OK` + `hasMore` is a normal
  partial drain.
- **Handlers** live in `src/lib/cron/jobs/<name>.ts`. Routes are auth wrappers.
  **Run now** uses `executeCronJob`.
- **Auth.** `verifyCronRequest` — Bearer `CRON_SECRET`.
- **Admin.** `/admin/system/jobs` (ADMIN / SUPER_ADMIN).
- **Retention.** `CronRun` rows older than 90 days are deleted on each migrated
  job start. A `RUNNING` row older than 15 minutes is reaped as `TIMED_OUT`.

## Time budget

| Constant | Value | Role |
|----------|-------|------|
| `RUN_BUDGET_MS` | `8_000` on Vercel; `5 * 60_000` otherwise | Default stop |
| `email-outbox.budgetMs` | `50_000` | Minutely drain without overlap |
| `CRON_BATCH_LIMIT` | `200` | Secondary fetch bound |

Stale detection is `2 × max(cronIntervalMs(schedule), budgetMs)`.

## Migrated

| Job | Marker |
|-----|--------|
| `balance-reminders` | `BespokeOrder.balanceReminderSentAt` |
| `stage-approval-reminders` | `StageApproval.reminderSentAt` |
| `unsent-quote-alerts` | `ConsultationBooking.quoteAlertSentAt` |
| `update-performance` | `PerformanceRecord` upsert |
| `review-requests` | review request emails |
| `receipt-reminders` | receipt confirmation |
| `email-outbox` | `EmailMessage` |

## Still on the legacy HTTP handlers

`abandoned-cart`, `expired-coupons`, `rotate-qr`, `late-alert`,
`event-reminders`, `daily-report`, `weekly-report`, `update-bestsellers`.

They are in the catalog (`migrated: false`). Run now and both schedulers POST
their existing routes.
