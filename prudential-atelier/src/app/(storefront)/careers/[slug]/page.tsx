import { notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { JOB_TYPE_LABELS } from "@/lib/job-custom-fields";
import { JobApplicationForm } from "@/components/careers/JobApplicationForm";
import { sanitizeCmsHtml } from "@/lib/sanitize-html";

export const revalidate = 60;

export default async function CareerJobPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ applied?: string }>;
}) {
  const { slug } = await params;
  const { applied } = await searchParams;

  const job = await prisma.jobPosting.findFirst({
    where: { slug, isPublished: true },
  });
  if (!job) notFound();

  return (
    <div className="pb-24 pt-16">
      <div className="mx-auto grid max-w-site gap-10 px-4 lg:grid-cols-[1.5fr_1fr] lg:gap-14 lg:px-6">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-sm bg-sand/60 px-2 py-1 font-label text-[9px] uppercase tracking-wide text-choc">
              {job.department}
            </span>
            <span className="rounded-sm bg-sand/60 px-2 py-1 font-label text-[9px] uppercase tracking-wide text-choc">
              {JOB_TYPE_LABELS[job.type]}
            </span>
            <span className="rounded-sm bg-sand/60 px-2 py-1 font-label text-[9px] uppercase tracking-wide text-choc">
              {job.location}
            </span>
            {job.isPFAPosition ? (
              <span className="rounded-sm bg-amber-100 px-2 py-0.5 font-label text-[9px] uppercase tracking-wide text-amber-900">
                PFA Students
              </span>
            ) : null}
          </div>

          <h1
            className="mt-4 text-choc"
            style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2rem, 5vw, 48px)" }}
          >
            {job.title}
          </h1>

          <section className="mt-8 border-t border-sand pt-6">
            <h2 className="font-label text-[10px] uppercase tracking-[0.16em] text-lightbr">About this role</h2>
            <div
              className="prose prose-sm mt-3 max-w-none font-body text-choc"
              dangerouslySetInnerHTML={{ __html: sanitizeCmsHtml(job.description) }}
            />
          </section>

          <section className="mt-8 border-t border-sand pt-6">
            <h2 className="font-label text-[10px] uppercase tracking-[0.16em] text-lightbr">What we&apos;re looking for</h2>
            <div
              className="prose prose-sm mt-3 max-w-none font-body text-choc"
              dangerouslySetInnerHTML={{ __html: sanitizeCmsHtml(job.requirements) }}
            />
          </section>

          {job.benefits ? (
            <section className="mt-8 border-t border-sand pt-6">
              <h2 className="font-label text-[10px] uppercase tracking-[0.16em] text-lightbr">What we offer</h2>
              <div
                className="prose prose-sm mt-3 max-w-none font-body text-choc"
                dangerouslySetInnerHTML={{ __html: sanitizeCmsHtml(job.benefits) }}
              />
            </section>
          ) : null}

          {job.salaryRange ? (
            <p className="mt-8 font-body text-sm text-choc">{job.salaryRange}</p>
          ) : null}
          {job.deadline ? (
            <p className="mt-2 font-body text-sm text-text-light">
              Apply before: {format(new Date(job.deadline), "MMMM d, yyyy")}
            </p>
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-[3px] border border-sand bg-bg-card p-6 shadow-sm">
            <h2 className="font-label text-[10px] uppercase tracking-[0.16em] text-lightbr">Apply for this role</h2>
            {applied === "1" ? (
              <p className="mt-4 rounded-sm bg-green-50 p-4 font-body text-sm text-green-800">
                Thank you — your application has been received. Check your email for confirmation.
              </p>
            ) : (
              <div className="mt-4">
                <JobApplicationForm job={job} />
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
