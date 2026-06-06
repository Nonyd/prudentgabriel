import { prisma } from "@/lib/prisma";
import { ReviewsAdminClient } from "@/components/admin/ReviewsAdminClient";

export default async function AdminReviewsPage() {
  const reviews = await prisma.review.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true } }, product: { select: { name: true, slug: true } } },
  });

  const pendingCount = reviews.filter((r) => !r.isApproved).length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">Reviews</h1>
          <p className="mt-1 font-body text-sm text-charcoal-mid">
            Moderate product reviews and choose which appear on the homepage.
          </p>
        </div>
        {pendingCount > 0 ? (
          <span className="rounded-sm bg-amber-50 px-3 py-1 font-body text-xs text-amber-900">
            {pendingCount} pending approval
          </span>
        ) : (
          <span className="font-body text-xs text-[#1B5E20]">All reviews moderated ✓</span>
        )}
      </div>
      <ReviewsAdminClient reviews={reviews} />
    </div>
  );
}
