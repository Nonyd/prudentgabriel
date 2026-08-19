/**
 * Asserts every registry job has a route file and a 5-field schedule,
 * and that schedule matching / stale windows behave as documented.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { CRON_JOBS, cronPath } from "../src/lib/cron/jobs";
import { cronMatches, isJobStale } from "../src/lib/cron/schedule";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

function main() {
  const errors: string[] = [];
  const root = resolve(__dirname, "..");

  for (const job of CRON_JOBS) {
    const parts = job.schedule.trim().split(/\s+/);
    if (parts.length !== 5) {
      errors.push(`Job "${job.name}" schedule is not 5 fields: ${job.schedule}`);
    }
    const routeFile = resolve(root, "src/app/api/cron", job.name, "route.ts");
    if (!existsSync(routeFile)) {
      errors.push(`Registry job "${job.name}" has no ${cronPath(job.name)} route at ${routeFile}`);
    }
  }

  const mondayNine = new Date(Date.UTC(2026, 7, 17, 9, 0, 0)); // Mon
  const sundayNine = new Date(Date.UTC(2026, 7, 16, 9, 0, 0)); // Sun
  const mondayEight = new Date(Date.UTC(2026, 7, 17, 8, 0, 0));
  const anyMinute = new Date(Date.UTC(2026, 7, 19, 12, 34, 0));

  assert(cronMatches("* * * * *", anyMinute), "minutely should always match");
  assert(cronMatches("0 9 * * *", mondayNine), "daily 09:00 should match");
  assert(!cronMatches("0 9 * * *", mondayEight), "daily 09:00 should miss 08:00");
  assert(cronMatches("0 9 * * 1-6", mondayNine), "Mon–Sat should match Monday");
  assert(!cronMatches("0 9 * * 1-6", sundayNine), "Mon–Sat should miss Sunday");

  const now = new Date("2026-08-19T12:00:00.000Z");
  assert(
    !isJobStale({
      schedule: "* * * * *",
      budgetMs: 50_000,
      lastOkAt: new Date(now.getTime() - 90_000),
      now,
    }),
    "90s gap with 50s budget / 60s interval is not stale (threshold 120s)",
  );
  assert(
    isJobStale({
      schedule: "* * * * *",
      budgetMs: 50_000,
      lastOkAt: new Date(now.getTime() - 121_000),
      now,
    }),
    "121s gap with 50s budget is stale",
  );

  if (errors.length) {
    console.error("Cron registry drift:\n" + errors.map((e) => `  - ${e}`).join("\n"));
    process.exit(1);
  }

  console.log(`OK — ${CRON_JOBS.length} jobs have routes; schedule matcher and stale window checked`);
}

main();
