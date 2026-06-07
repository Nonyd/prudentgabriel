import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { ApplicationDetailClient } from "@/components/admin/careers/ApplicationDetailClient";

export default async function AdminCareersApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const application = await prisma.jobApplication.findUnique({
    where: { id },
    include: {
      job: true,
      emailsSent: { orderBy: { sentAt: "desc" } },
    },
  });
  if (!application) notFound();

  return (
    <div>
      <Link href="/admin/careers/applications" className="font-body text-sm text-olive hover:underline">
        ← All applications
      </Link>
      <h1 className="mt-4 font-display text-2xl text-ink">Application — {application.job.title}</h1>
      <p className="mt-1 font-body text-sm text-charcoal-mid">
        Submitted {format(new Date(application.createdAt), "MMMM d, yyyy")}
      </p>
      <ApplicationDetailClient application={application} />
    </div>
  );
}
