import { prisma } from "@/lib/prisma";
import { ReviewsAdminClient } from "@/components/admin/ReviewsAdminClient";

export default async function AdminReviewsPage() {
  const pending = await prisma.review.findMany({
    where: { isApproved: false },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true } }, product: { select: { name: true, slug: true } } },
  });
  return (
    <div>
      <h1 className="font-display text-2xl text-ivory">Reviews</h1>
      <ReviewsAdminClient pending={pending} />
    </div>
  );
}
