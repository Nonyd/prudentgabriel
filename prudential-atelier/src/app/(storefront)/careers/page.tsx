import { prisma } from "@/lib/prisma";
import { CareersListingClient } from "@/components/careers/CareersListingClient";
import { isSkipDbBuild } from "@/lib/skip-db-build";

export const revalidate = 60;

export default async function CareersPage() {
  const jobs = isSkipDbBuild()
    ? []
    : await prisma.jobPosting.findMany({
    where: { isPublished: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="pb-24 pt-16">
      <div className="mx-auto max-w-site px-4 lg:px-6">
        <p className="text-center font-label text-[10px] uppercase tracking-[0.2em] text-lightbr">Careers</p>
        <h1
          className="mt-3 text-center text-choc"
          style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2.5rem, 6vw, 56px)" }}
        >
          Join the house
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-center font-body text-base italic text-text-light">
          We are always looking for exceptional people who love what they do.
        </p>
        <CareersListingClient jobs={jobs} />
      </div>
    </div>
  );
}
