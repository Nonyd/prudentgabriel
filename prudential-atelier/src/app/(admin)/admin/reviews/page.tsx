import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { AdminReviewsHub } from "@/components/admin/AdminReviewsHub";

const reviewInclude = {
  user: { select: { name: true } },
  product: { select: { name: true, slug: true } },
  consultation: {
    select: {
      offering: { select: { deliveryMode: true } },
    },
  },
} as const;

export default async function AdminReviewsPage() {
  const [reviews, testimonials] = await Promise.all([
    prisma.review.findMany({
      orderBy: { createdAt: "desc" },
      include: reviewInclude,
    }),
    prisma.testimonial.findMany({
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true, image: true, email: true } } },
    }),
  ]);

  const productReviews = reviews.filter((r) => r.consultationId == null);
  const consultationReviews = reviews.filter((r) => r.consultationId != null);
  const pendingCount =
    productReviews.filter((r) => !r.isApproved).length +
    consultationReviews.filter((r) => !r.isApproved).length +
    testimonials.filter((t) => !t.isApproved).length;

  return (
    <Suspense fallback={<div className="font-body text-sm text-charcoal-mid">Loading…</div>}>
      <AdminReviewsHub
        productReviews={productReviews}
        consultationReviews={consultationReviews}
        testimonials={testimonials}
        pendingCount={pendingCount}
      />
    </Suspense>
  );
}
