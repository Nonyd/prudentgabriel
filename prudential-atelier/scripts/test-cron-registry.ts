/**
 * Asserts every registry job has a route file and a 5-field schedule,
 * that the committed host crontab matches the registry, and that
 * vercel.json does not list crons.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CRON_JOBS, cronPath } from "../src/lib/cron/jobs";
import { cronMatches, isJobStale } from "../src/lib/cron/schedule";
import { HOST_CRON_FIRE, HOST_CRON_PATH, renderHostCronFile } from "./render-host-cron";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

function main() {
  const errors: string[] = [];
  const root = resolve(__dirname, "..");

  const vercel = JSON.parse(readFileSync(resolve(root, "vercel.json"), "utf8")) as {
    crons?: unknown;
  };
  if (vercel.crons != null) {
    errors.push("vercel.json still has a crons block; Vercel does not schedule this app");
  }

  const repoRoot = resolve(root, "..");
  const hostCronPath = resolve(repoRoot, HOST_CRON_PATH);
  if (!existsSync(hostCronPath)) {
    errors.push(`Missing ${HOST_CRON_PATH} — run scripts/render-host-cron.ts`);
  } else {
    const committed = readFileSync(hostCronPath, "utf8").replace(/\r\n/g, "\n");
    const expected = renderHostCronFile();
    if (committed !== expected) {
      errors.push(
        `${HOST_CRON_PATH} is out of date. Run: pnpm exec tsx --tsconfig tsconfig.scripts.json scripts/render-host-cron.ts`,
      );
    }
    const named = new Set<string>();
    for (const line of committed.split("\n")) {
      const m = line.match(/^(\S+(?:\s+\S+){4})\s+root\s+(\S+)\s+(\S+)\s*$/);
      if (!m) continue;
      const [, schedule, fire, name] = m;
      named.add(name);
      if (fire !== HOST_CRON_FIRE) {
        errors.push(`Host cron for "${name}" does not call ${HOST_CRON_FIRE}`);
      }
      const job = CRON_JOBS.find((j) => j.name === name);
      if (!job) {
        errors.push(`Host cron lists unknown job "${name}"`);
      } else if (job.schedule !== schedule) {
        errors.push(`Host cron "${name}" schedule "${schedule}" != registry "${job.schedule}"`);
      }
    }
    for (const job of CRON_JOBS) {
      if (!named.has(job.name)) {
        errors.push(`Registry job "${job.name}" is missing from ${HOST_CRON_PATH}`);
      }
    }
  }

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

  console.log(
    `OK — ${CRON_JOBS.length} jobs have routes; host crontab matches registry; schedule matcher and stale window checked`,
  );
}

main();
