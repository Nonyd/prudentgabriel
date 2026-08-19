import { CRON_JOBS, cronPath } from "@/lib/cron/jobs";
import { cronMatches } from "@/lib/cron/schedule";

const TICK_MS = 15_000;
const START_DELAY_MS = 20_000;

let started = false;
const lastFiredMinute = new Map<string, number>();
const inFlight = new Set<string>();

function utcMinuteKey(now: Date): number {
  return Math.floor(now.getTime() / 60_000);
}

function cronBaseUrl(): string {
  const port = process.env.PORT?.trim() || "3000";
  return `http://127.0.0.1:${port}`;
}

async function fireJob(name: string, path: string): Promise<void> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    console.error(JSON.stringify({ cronScheduler: true, error: "CRON_SECRET unset" }));
    return;
  }
  const url = `${cronBaseUrl()}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(
      JSON.stringify({
        cronScheduler: true,
        job: name,
        status: res.status,
        error: body.slice(0, 300),
      }),
    );
  }
}

export async function tickCronScheduler(now = new Date()): Promise<string[]> {
  const minute = utcMinuteKey(now);
  const due: string[] = [];
  for (const job of CRON_JOBS) {
    if (!cronMatches(job.schedule, now)) continue;
    if (lastFiredMinute.get(job.name) === minute) continue;
    if (inFlight.has(job.name)) continue;
    lastFiredMinute.set(job.name, minute);
    due.push(job.name);
    inFlight.add(job.name);
    void fireJob(job.name, cronPath(job.name)).finally(() => {
      inFlight.delete(job.name);
    });
  }
  return due;
}

export function startCronScheduler(): void {
  if (started) return;
  if (process.env.CRON_SCHEDULER !== "1") return;
  started = true;
  console.info(JSON.stringify({ cronScheduler: true, status: "starting", delayMs: START_DELAY_MS }));
  const run = () => {
    void tickCronScheduler().catch((err) => {
      console.error(
        JSON.stringify({
          cronScheduler: true,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    });
  };
  setTimeout(() => {
    run();
    setInterval(run, TICK_MS);
  }, START_DELAY_MS);
}
