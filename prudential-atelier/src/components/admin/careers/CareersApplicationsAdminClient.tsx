"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import type { ApplicationStatus, JobApplication, JobPosting } from "@prisma/client";

type AppRow = JobApplication & { job: { title: string; slug: string } };

const STATUSES: ApplicationStatus[] = [
  "NEW",
  "REVIEWED",
  "SHORTLISTED",
  "INTERVIEWED",
  "REJECTED",
  "HIRED",
];

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  NEW: "bg-blue-50 text-blue-900",
  REVIEWED: "bg-slate-100 text-slate-800",
  SHORTLISTED: "bg-green-50 text-green-900",
  INTERVIEWED: "bg-purple-50 text-purple-900",
  REJECTED: "bg-red-50 text-red-900",
  HIRED: "bg-emerald-100 text-emerald-900",
};

export function CareersApplicationsAdminClient({
  applications,
  jobs,
}: {
  applications: AppRow[];
  jobs: Pick<JobPosting, "id" | "title">[];
}) {
  const [jobId, setJobId] = useState("");
  const [status, setStatus] = useState("");
  const [pfaOnly, setPfaOnly] = useState(false);

  const filtered = useMemo(() => {
    return applications.filter((a) => {
      if (jobId && a.jobId !== jobId) return false;
      if (status && a.status !== status) return false;
      if (pfaOnly && !a.isPFAApplication) return false;
      return true;
    });
  }, [applications, jobId, status, pfaOnly]);

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap gap-3">
        <select value={jobId} onChange={(e) => setJobId(e.target.value)} className="rounded-sm border border-sand px-3 py-2 font-body text-sm">
          <option value="">All jobs</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.title}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-sm border border-sand px-3 py-2 font-body text-sm">
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 font-body text-sm">
          <input type="checkbox" checked={pfaOnly} onChange={(e) => setPfaOnly(e.target.checked)} />
          PFA only
        </label>
      </div>

      <div className="overflow-x-auto rounded-sm border border-sand bg-canvas">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-sand font-label text-[11px] uppercase tracking-wide text-[#A8A8A4]">
            <tr>
              <th className="p-3">Applicant</th>
              <th className="p-3">Position</th>
              <th className="p-3">Submitted</th>
              <th className="p-3">Status</th>
              <th className="p-3">PFA</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id} className="border-b border-[#F5F5F3]">
                <td className="p-3">
                  <p className="font-body">{a.fullName}</p>
                  <p className="font-body text-xs text-charcoal-mid">{a.email}</p>
                </td>
                <td className="p-3 font-body text-charcoal-mid">{a.job.title}</td>
                <td className="p-3 font-body text-xs text-charcoal-mid">
                  {format(new Date(a.createdAt), "MMM d, yyyy")}
                </td>
                <td className="p-3">
                  <span className={`rounded-sm px-2 py-0.5 font-label text-[9px] uppercase ${STATUS_COLORS[a.status]}`}>
                    {a.status}
                  </span>
                </td>
                <td className="p-3">{a.isPFAApplication && a.pfaVerified ? "✓" : "—"}</td>
                <td className="space-y-1 p-3">
                  <Link href={`/admin/careers/applications/${a.id}`} className="block font-body text-xs text-olive hover:underline">
                    View
                  </Link>
                  {a.cvUrl ? (
                    <a href={a.cvUrl} target="_blank" rel="noreferrer" className="block font-body text-xs text-olive hover:underline">
                      Download CV
                    </a>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
