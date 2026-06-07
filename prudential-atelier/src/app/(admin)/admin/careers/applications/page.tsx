import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CareersApplicationsAdminClient } from "@/components/admin/careers/CareersApplicationsAdminClient";

export default async function AdminCareersApplicationsPage() {
  const [applications, jobs] = await Promise.all([
    prisma.jobApplication.findMany({
      orderBy: { createdAt: "desc" },
      include: { job: { select: { title: true, slug: true } } },
    }),
    prisma.jobPosting.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } }),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">Applications</h1>
          <p className="mt-1 font-body text-sm text-charcoal-mid">Review and manage job applications.</p>
        </div>
        <Link href="/admin/careers" className="font-body text-sm text-olive hover:underline">
          ← Job postings
        </Link>
      </div>
      <CareersApplicationsAdminClient applications={applications} jobs={jobs} />
    </div>
  );
}
