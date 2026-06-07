"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import type { JobPosting, JobType } from "@prisma/client";
import { JOB_TYPE_FILTERS, JOB_TYPE_LABELS } from "@/lib/job-custom-fields";

export function CareersListingClient({ jobs }: { jobs: JobPosting[] }) {
  const [filter, setFilter] = useState<JobType | "ALL">("ALL");

  const filtered = filter === "ALL" ? jobs : jobs.filter((j) => j.type === filter);

  return (
    <>
      <div className="mt-10 flex flex-wrap gap-2">
        {JOB_TYPE_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`rounded-[3px] px-4 py-2 font-label text-[10px] uppercase tracking-[0.14em] ${
              filter === f.value ? "bg-choc text-cream" : "border border-sand text-choc"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-10 space-y-4">
        {filtered.length === 0 ? (
          <p className="font-body text-sm text-text-light">No open positions in this category right now.</p>
        ) : (
          filtered.map((job) => {
            const expired = job.deadline ? job.deadline < new Date() : false;
            return (
              <article
                key={job.id}
                className="flex flex-col gap-4 rounded-[3px] border border-sand bg-white p-6 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-2xl text-choc">{job.title}</h2>
                    {job.isPFAPosition ? (
                      <span className="rounded-sm bg-amber-100 px-2 py-0.5 font-label text-[9px] uppercase tracking-wide text-amber-900">
                        PFA Students
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 font-body text-sm text-text-light">
                    {job.department} · {JOB_TYPE_LABELS[job.type]} · {job.location}
                  </p>
                  {job.deadline ? (
                    <p className="mt-1 font-body text-xs text-text-light">
                      Application deadline: {format(new Date(job.deadline), "MMMM d, yyyy")}
                      {expired ? " (closed)" : ""}
                    </p>
                  ) : null}
                </div>
                <Link
                  href={`/careers/${job.slug}`}
                  className="inline-flex shrink-0 items-center justify-center rounded-[3px] border border-choc px-5 py-2.5 font-label text-[10px] font-semibold uppercase tracking-wide text-choc hover:bg-choc hover:text-cream"
                >
                  View & Apply →
                </Link>
              </article>
            );
          })
        )}
      </div>
    </>
  );
}
