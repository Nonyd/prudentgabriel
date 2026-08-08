"use client";

import { useCallback, useEffect, useState } from "react";
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

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusClass(status: string | undefined, stale: boolean): string {
  if (stale) return "text-amber-800";
  if (status === "OK") return "text-emerald-800";
  if (status === "FAILED" || status === "TIMED_OUT") return "text-red-800";
  if (status === "RUNNING") return "text-olive";
  return "text-[#6B6B68]";
}

export function CronJobsClient() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);

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

  async function runNow(name: string) {
    setRunning(name);
    try {
      const res = await fetch("/api/admin/system/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const j = (await res.json()) as {
        error?: string;
        processed?: number;
        failed?: number;
        hasMore?: boolean;
      };
      if (!res.ok) {
        toast.error(j.error ?? "Run failed");
      } else {
        toast.success(
          typeof j.processed === "number"
            ? j.hasMore
              ? `Done — processed ${j.processed}, backlog remains`
              : `Done — processed ${j.processed}, failed ${j.failed ?? 0}`
            : "Job triggered",
        );
      }
      await load();
    } finally {
      setRunning(null);
    }
  }

  if (loading) {
    return <p className="mt-6 font-body text-sm text-[#6B6B68]">Loading jobs…</p>;
  }

  return (
    <div className="mt-8 overflow-x-auto border border-sand">
      <table className="w-full min-w-[960px] border-collapse font-body text-xs">
        <thead>
          <tr className="bg-[#37392d] text-left text-[10px] font-medium uppercase tracking-[0.1em] text-white">
            <th className="px-3 py-2">Job</th>
            <th className="px-3 py-2">Schedule</th>
            <th className="px-3 py-2">Last run</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Processed</th>
            <th className="px-3 py-2">Duration</th>
            <th className="px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.name} className="border-t border-sand align-top">
              <td className="px-3 py-3">
                <div className="font-medium text-ink">{job.name}</div>
                <div className="mt-0.5 text-[#6B6B68]">{job.description}</div>
                {!job.migrated ? (
                  <div className="mt-1 text-[10px] uppercase tracking-wide text-[#98755B]">
                    Legacy handler
                  </div>
                ) : null}
                {job.stale ? (
                  <div className="mt-1 text-[10px] font-medium uppercase tracking-wide text-amber-800">
                    Stale — last OK older than 2× interval
                  </div>
                ) : null}
              </td>
              <td className="px-3 py-3 font-mono text-[11px] text-olive">{job.schedule}</td>
              <td className="px-3 py-3 text-ink">
                {formatWhen(job.lastRun?.startedAt)}
                {job.lastRun?.host ? (
                  <div className="text-[10px] text-[#6B6B68]">{job.lastRun.host}</div>
                ) : null}
              </td>
              <td className={`px-3 py-3 font-medium ${statusClass(job.lastRun?.status, job.stale)}`}>
                {job.lastRun?.status ?? "never"}
                {job.lastRun?.hasMore && job.lastRun.status === "OK" ? (
                  <div className="mt-1 font-normal text-[10px] text-olive">
                    Backlog remains (time budget)
                  </div>
                ) : null}
                {job.lastRun?.error ? (
                  <div className="mt-1 max-w-[220px] font-normal text-[10px] text-red-700">
                    {job.lastRun.error}
                  </div>
                ) : null}
              </td>
              <td className="px-3 py-3 text-ink">
                {job.lastRun
                  ? `${job.lastRun.processed}${job.lastRun.failed ? ` / ${job.lastRun.failed} fail` : ""}`
                  : "—"}
              </td>
              <td className="px-3 py-3 text-[#6B6B68]">
                {job.lastRun?.durationMs != null ? `${job.lastRun.durationMs} ms` : "—"}
              </td>
              <td className="px-3 py-3">
                <button
                  type="button"
                  disabled={running === job.name}
                  onClick={() => void runNow(job.name)}
                  className="rounded-sm border border-sand bg-white px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-ink hover:border-olive disabled:opacity-50"
                >
                  {running === job.name ? "Running…" : "Run now"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
