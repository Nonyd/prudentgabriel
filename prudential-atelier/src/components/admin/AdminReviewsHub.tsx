"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { ReviewsAdminClient, type ReviewAdminRow } from "@/components/admin/ReviewsAdminClient";
import { TestimonialsAdminClient, type TestimonialAdminRow } from "@/components/admin/TestimonialsAdminClient";

type MainTab = "product" | "consultation" | "testimonials";

export function AdminReviewsHub({
  productReviews,
  consultationReviews,
  testimonials,
  pendingCount,
}: {
  productReviews: ReviewAdminRow[];
  consultationReviews: ReviewAdminRow[];
  testimonials: TestimonialAdminRow[];
  pendingCount: number;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get("tab");
  const tab: MainTab =
    tabParam === "consultation" || tabParam === "testimonials" ? tabParam : "product";

  function setTab(next: MainTab) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "product") params.delete("tab");
    else params.set("tab", next);
    const q = params.toString();
    router.replace(q ? `/admin/reviews?${q}` : "/admin/reviews");
  }

  const tabs: { id: MainTab; label: string }[] = [
    { id: "product", label: "Product Reviews" },
    { id: "consultation", label: "Consultation Reviews" },
    { id: "testimonials", label: "Testimonials" },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">Reviews</h1>
          <p className="mt-1 font-body text-sm text-charcoal-mid">
            Moderate product reviews, consultation reviews, and client testimonials.
          </p>
        </div>
        {pendingCount > 0 ? (
          <span className="rounded-sm bg-amber-50 px-3 py-1 font-body text-xs text-amber-900">
            {pendingCount} pending approval
          </span>
        ) : (
          <span className="font-body text-xs text-[#1B5E20]">All moderated ✓</span>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-1 rounded-sm border border-[#EBEBEA] bg-canvas p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-sm px-4 py-2 font-body text-xs transition-colors ${
              tab === t.id ? "bg-olive text-white" : "text-charcoal hover:bg-light-grey"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "product" ? <ReviewsAdminClient reviews={productReviews} variant="product" /> : null}
      {tab === "consultation" ? <ReviewsAdminClient reviews={consultationReviews} variant="consultation" /> : null}
      {tab === "testimonials" ? <TestimonialsAdminClient testimonials={testimonials} /> : null}
    </div>
  );
}
