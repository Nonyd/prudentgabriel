"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import toast from "react-hot-toast";

type JobRow = {
  name: string;
  schedule: string;
  description: string;
  migrated: boolean;
  path: string;
  stale: boolean;
  lastRun: {
    id: string;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    processed: number;
    failed: number;
    hasMore: boolean;
    error: string | null;
    host: string | null;
    durationMs: number | null;
  } | null;
};

type Health = "ok" | "failed" | "overdue" | "running" | "never";
type Filter = "all" | Health;

/** Lagos is UTC+1 all year (no daylight saving); the host crontab runs in UTC. */
const LAGOS_OFFSET_HOURS = 1;
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function lagosTime(hourUtc: number, minute: number): string {
  const h = (hourUtc + LAGOS_OFFSET_HOURS + 24) % 24;
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** The common cron shapes in words, Lagos time. Anything else shows as written. */
function describeSchedule(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;
  const [min, hour, dom, mon, dow] = parts;
  const isNum = (v: string) => /^\d+$/.test(v);
  if (mon === "1,4,7,10" && isNum(min) && isNum(hour) && isNum(dom) && dow === "*") {
    return `Quarterly (Jan, Apr, Jul, Oct) on day ${dom} at ${lagosTime(Number(hour), Number(min))}`;
  }
  if (mon !== "*") return cron;
  if (min === "*" && hour === "*" && dom === "*" && dow === "*") return "Every minute";
  const everyMin = /^\*\/(\d+)$/.exec(min);
  if (everyMin && hour === "*" && dom === "*" && dow === "*") return `Every ${everyMin[1]} minutes`;
  if (isNum(min) && hour === "*" && dom === "*" && dow === "*") return `Every hour, at :${min.padStart(2, "0")}`;
  const everyHour = /^\*\/(\d+)$/.exec(hour);
  if (isNum(min) && everyHour && dom === "*" && dow === "*") return `Every ${everyHour[1]} hours`;
  if (isNum(min) && isNum(hour)) {
    const at = lagosTime(Number(hour), Number(min));
    if (dom === "*" && dow === "*") return `Daily at ${at}`;
    if (dom === "*" && isNum(dow)) return `${DAYS[Number(dow) % 7]}s at ${at}`;
    if (dom === "*" && dow === "1-5") return `Weekdays at ${at}`;
    if (dom === "*" && dow === "1-6") return `Monday to Saturday at ${at}`;
    if (isNum(dom) && dow === "*") return `Monthly on day ${dom} at ${at}`;
  }
  return cron;
}

function health(job: JobRow): Health {
  if (!job.lastRun) return "never";
  if (job.lastRun.status === "RUNNING") return "running";
  if (job.lastRun.status === "FAILED" || job.lastRun.status === "TIMED_OUT") return "failed";
  if (job.stale) return "overdue";
  return "ok";
}

const HEALTH: Record<Health, { label: string; pill: string; dot: string }> = {
  ok: { label: "Healthy", pill: "bg-success-soft text-success", dot: "bg-success" },
  failed: { label: "Failed", pill: "bg-error-soft text-error", dot: "bg-error" },
  overdue: { label: "Overdue", pill: "bg-warning-soft text-warning", dot: "bg-warning" },
  running: { label: "Running", pill: "bg-info-soft text-info", dot: "bg-info" },
  never: { label: "Not run yet", pill: "bg-bg-page text-text-mid", dot: "bg-text-light" },
};

function humanName(name: string): string {
  const s = name.replace(/[-_]/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function ago(iso: string | null | undefined): string {
  if (!iso) return "never";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `${d} days ago`;
}

function exactTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  });
}

function duration(ms: number | null | undefined): string | null {
  if (ms == null) return null;
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  return s < 60 ? `${s.toFixed(1)} s` : `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`;
}

export function CronJobsClient() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/system/jobs");
    if (!res.ok) {
      toast.error("Could not load jobs");
      setLoading(false);
      return;
    }
    const j = (await res.json()) as { jobs: JobRow[] };
    setJobs(j.jobs);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<Health, number> = { ok: 0, failed: 0, overdue: 0, running: 0, never: 0 };
    for (const job of jobs) c[health(job)] += 1;
    return c;
  }, [jobs]);

  // Problems first, then by name.
  const order: Record<Health, number> = { failed: 0, overdue: 1, running: 2, never: 3, ok: 4 };
  const shown = jobs
    .filter((job) => filter === "all" || health(job) === filter)
    .sort((a, b) => order[health(a)] - order[health(b)] || a.name.localeCompare(b.name));

  async function runNow(name: string) {
    setRunning(name);
    try {
      const res = await fetch("/api/admin/system/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const j = (await res.json()) as { error?: string; processed?: number; failed?: number; hasMore?: boolean };
      if (!res.ok) {
        toast.error(j.error ?? "Run failed");
      } else {
        toast.success(
          typeof j.processed === "number"
            ? j.hasMore
              ? `Done: ${j.processed} handled, more left for the next run`
              : `Done: ${j.processed} handled${j.failed ? `, ${j.failed} failed` : ""}`
            : "Job started",
        );
      }
      await load();
    } finally {
      setRunning(null);
    }
  }

  if (loading) {
    return <p className="mt-6 font-body text-sm text-text-mid">Loading jobs…</p>;
  }

  const chips: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "All", count: jobs.length },
    { key: "failed", label: "Failed", count: counts.failed },
    { key: "overdue", label: "Overdue", count: counts.overdue },
    { key: "running", label: "Running", count: counts.running },
    { key: "never", label: "Not run yet", count: counts.never },
    { key: "ok", label: "Healthy", count: counts.ok },
  ];
  const problems = counts.failed + counts.overdue;

  return (
    <div className="mt-6">
      <div
        className={clsx(
          "glass-1 border px-5 py-4 font-body text-sm",
          problems ? "border-warning/40" : "border-sand",
        )}
        role="status"
      >
        {problems ? (
          <p className="text-ink">
            <strong className="font-medium">{problems} job{problems === 1 ? " needs" : "s need"} a look.</strong>{" "}
            Failed jobs show their error below; an overdue job has not succeeded for more than twice its schedule.
          </p>
        ) : (
          <p className="text-ink">
            <strong className="font-medium">All {jobs.length} jobs are running on schedule.</strong> Nothing to do.
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 font-body text-11px">
        {chips
          .filter((c) => c.key === "all" || c.count > 0)
          .map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setFilter(c.key)}
              className={clsx(
                "admin-chip glass-1 glass-pill uppercase tracking-[0.08em]",
                filter === c.key ? "border-[var(--glass-edge-bright)] text-choc" : "text-ink",
              )}
            >
              {c.label} · {c.count}
            </button>
          ))}
      </div>

      <ul className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((job) => {
          const h = health(job);
          const run = job.lastRun;
          return (
            <li key={job.name} className="glass-1 flex flex-col border border-sand p-4 font-body">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{humanName(job.name)}</p>
                  <p className="mt-0.5 text-xs text-text-mid">{describeSchedule(job.schedule)}</p>
                </div>
                <span
                  className={clsx(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-10px uppercase tracking-[0.08em]",
                    HEALTH[h].pill,
                  )}
                >
                  <span className={clsx("h-1.5 w-1.5 rounded-full", HEALTH[h].dot)} aria-hidden />
                  {HEALTH[h].label}
                </span>
              </div>

              <p className="mt-3 text-xs leading-5 text-text-mid">{job.description}</p>

              <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-sand pt-3 text-xs">
                <div>
                  <dt className="text-10px uppercase tracking-[0.08em] text-text-light">Last run</dt>
                  <dd className="mt-0.5 text-ink" title={run ? exactTime(run.startedAt) : undefined}>
                    {ago(run?.startedAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-10px uppercase tracking-[0.08em] text-text-light">Handled</dt>
                  <dd className="mt-0.5 text-ink">
                    {run ? run.processed : "—"}
                    {run?.failed ? <span className="text-error"> · {run.failed} failed</span> : null}
                  </dd>
                </div>
                <div>
                  <dt className="text-10px uppercase tracking-[0.08em] text-text-light">Took</dt>
                  <dd className="mt-0.5 text-ink">{duration(run?.durationMs) ?? "—"}</dd>
                </div>
              </dl>

              {run?.hasMore && run.status === "OK" ? (
                <p className="mt-2 text-xs text-olive">More waiting: the next run continues where this one stopped.</p>
              ) : null}
              {run?.error ? (
                <p className="mt-2 break-words rounded-sm bg-error-soft px-2.5 py-2 text-xs text-error">{run.error}</p>
              ) : null}

              <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                <span className="truncate font-mono text-10px text-text-light" title={job.schedule}>
                  {job.schedule}
                </span>
                <button
                  type="button"
                  disabled={running !== null}
                  onClick={() => void runNow(job.name)}
                  className="shrink-0 rounded-full border border-sand bg-bg-surface px-3.5 py-1.5 text-11px font-medium uppercase tracking-[0.08em] text-ink transition-colors hover:border-choc disabled:opacity-50"
                >
                  {running === job.name ? "Running…" : "Run now"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {shown.length === 0 ? <p className="mt-6 font-body text-sm text-text-mid">No jobs in this group.</p> : null}
    </div>
  );
}
