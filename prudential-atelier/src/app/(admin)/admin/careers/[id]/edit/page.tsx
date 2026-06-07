import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { JobEditorClient } from "@/components/admin/careers/JobEditorClient";

export default async function AdminCareersEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await prisma.jobPosting.findUnique({ where: { id } });
  if (!job) notFound();

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Edit job posting</h1>
      <JobEditorClient job={job} />
    </div>
  );
}
