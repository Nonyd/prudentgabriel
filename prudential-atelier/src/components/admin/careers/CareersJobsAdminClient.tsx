"use client";

import Link from "next/link";
import { format } from "date-fns";
import type { JobPosting } from "@prisma/client";
import { JOB_TYPE_LABELS } from "@/lib/job-custom-fields";

type JobRow = JobPosting & { _count: { applications: number } };

function statusFor(job: JobRow): { label: string; className: string } {
  if (job.deadline && job.deadline < new Date()) {
    return { label: "Expired", className: "text-amber-800" };
  }
  if (job.isPublished) {
    return { label: "Live", className: "text-green-800" };
  }
  return { label: "Draft", className: "text-charcoal-mid" };
}

export function CareersJobsAdminClient({ jobs }: { jobs: JobRow[] }) {
  return (
    <div className="mt-6 overflow-x-auto rounded-sm border border-[#EBEBEA] bg-canvas">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="border-b border-[#EBEBEA] font-label text-[11px] uppercase tracking-wide text-[#A8A8A4]">
          <tr>
            <th className="p-3">Title</th>
            <th className="p-3">Dept</th>
            <th className="p-3">Type</th>
            <th className="p-3">Apps</th>
            <th className="p-3">Status</th>
            <th className="p-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {jobs.length === 0 ? (
            <tr>
              <td colSpan={6} className="p-8 text-center font-body text-sm text-charcoal-mid">
                No job postings yet.
              </td>
            </tr>
          ) : (
            jobs.map((job) => {
              const status = statusFor(job);
              return (
                <tr key={job.id} className="border-b border-[#F5F5F3]">
                  <td className="p-3 font-body">{job.title}</td>
                  <td className="p-3 font-body text-charcoal-mid">{job.department}</td>
                  <td className="p-3 font-body text-charcoal-mid">{JOB_TYPE_LABELS[job.type]}</td>
                  <td className="p-3 font-body">{job._count.applications}</td>
                  <td className="p-3">
                    <span className={`font-body text-xs ${status.className}`}>● {status.label}</span>
                  </td>
                  <td className="p-3">
                    <Link href={`/admin/careers/${job.id}/edit`} className="font-body text-xs text-olive hover:underline">
                      Edit
                    </Link>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      {jobs.some((j) => j.deadline) ? (
        <p className="p-3 font-body text-xs text-charcoal-mid">
          Deadlines shown on public listings where set ({format(new Date(), "MMM d, yyyy")} today).
        </p>
      ) : null}
    </div>
  );
}
