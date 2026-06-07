import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CareersJobsAdminClient } from "@/components/admin/careers/CareersJobsAdminClient";

export default async function AdminCareersPage() {
  const jobs = await prisma.jobPosting.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { applications: true } } },
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">Careers</h1>
          <p className="mt-1 font-body text-sm text-charcoal-mid">Manage job postings and applications.</p>
        </div>
        <Link
          href="/admin/careers/new"
          className="rounded-[3px] bg-choc px-5 py-2.5 font-label text-[11px] font-semibold uppercase tracking-wide text-cream"
        >
          + New Job Posting
        </Link>
      </div>
      <CareersJobsAdminClient jobs={jobs} />
    </div>
  );
}
