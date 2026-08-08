/**
 * Asserts src/lib/cron/jobs.ts matches vercel.json crons (path + schedule).
 * Phase 5: point this at the VPS scheduler config instead of vercel.json.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CRON_JOBS, cronPath } from "../src/lib/cron/jobs";

type VercelCron = { path: string; schedule: string };

function loadVercelCrons(): VercelCron[] {
  const raw = readFileSync(resolve(__dirname, "../vercel.json"), "utf8");
  const json = JSON.parse(raw) as { crons?: VercelCron[] };
  if (!Array.isArray(json.crons)) {
    throw new Error("vercel.json missing crons array");
  }
  return json.crons;
}

function main() {
  const vercel = loadVercelCrons();
  const vercelByPath = new Map(vercel.map((c) => [c.path, c.schedule]));
  const errors: string[] = [];

  for (const job of CRON_JOBS) {
    const path = cronPath(job.name);
    const schedule = vercelByPath.get(path);
    if (schedule === undefined) {
      errors.push(`Registry job "${job.name}" has no vercel.json entry for ${path}`);
      continue;
    }
    if (schedule !== job.schedule) {
      errors.push(
        `Schedule drift for ${job.name}: registry="${job.schedule}" vercel="${schedule}"`,
      );
    }
    vercelByPath.delete(path);
  }

  for (const [path, schedule] of Array.from(vercelByPath.entries())) {
    errors.push(`vercel.json has ${path} (${schedule}) with no registry entry`);
  }

  if (errors.length) {
    console.error("Cron registry drift:\n" + errors.map((e) => `  - ${e}`).join("\n"));
    process.exit(1);
  }

  console.log(`OK — ${CRON_JOBS.length} jobs match vercel.json`);
}

main();
