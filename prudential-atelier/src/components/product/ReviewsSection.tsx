"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import * as Dialog from "@radix-ui/react-dialog";
import { StarRating } from "@/components/ui/StarRating";
import { ReviewForm } from "@/components/product/ReviewForm";

export interface ReviewItem {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  isVerified: boolean;
  helpfulCount: number;
  createdAt: string;
  user: { name: string | null; image: string | null };
}

function displayName(name: string | null | undefined): string {
  const n = (name ?? "").trim();
  if (!n) return "Client";
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  const initial = last.charAt(0).toUpperCase();
  return `${parts[0]} ${initial}.`;
}

interface ReviewsSectionProps {
  reviews: ReviewItem[];
  averageRating: number;
  reviewCount: number;
  productId: string;
  productSlug: string;
  isLoggedIn: boolean;
}

export function ReviewsSection({
  reviews,
  averageRating,
  reviewCount,
  productId,
  productSlug,
  isLoggedIn,
}: ReviewsSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [sort, setSort] = useState<"newest" | "helpful">("newest");
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(reviews.map((r) => [r.id, r.helpfulCount])),
  );

  const sorted = useMemo(() => {
    const copy = [...reviews];
    if (sort === "helpful") {
      copy.sort((a, b) => (counts[b.id] ?? b.helpfulCount) - (counts[a.id] ?? a.helpfulCount));
    } else {
      copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return copy;
  }, [reviews, sort, counts]);

  const show = expanded ? sorted : sorted.slice(0, 5);

  const dist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    n: reviews.filter((r) => Math.round(r.rating) === star).length,
  }));

  async function markHelpful(id: string) {
    const key = `review_helpful_${id}`;
    if (typeof window !== "undefined" && localStorage.getItem(key)) {
      return;
    }
    const res = await fetch(`/api/reviews/${id}/helpful`, { method: "POST" });
    if (res.ok) {
      if (typeof window !== "undefined") localStorage.setItem(key, "1");
      setCounts((c) => ({ ...c, [id]: (c[id] ?? reviews.find((r) => r.id === id)?.helpfulCount ?? 0) + 1 }));
    }
  }

  return (
    <section id="reviews" className="scroll-mt-28 border-t border-mid-grey py-16">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-display text-3xl text-charcoal">Client Reviews</h2>
        <span className="border border-mid-grey px-3 py-1 font-body text-[10px] font-medium uppercase tracking-[0.12em] text-dark-grey">
          {reviewCount} reviews
        </span>
      </div>

      {reviews.length > 0 && (
        <div className="mb-10 grid gap-8 md:grid-cols-2">
          <div>
            <p className="font-display text-[48px] font-normal italic leading-none text-olive md:text-[52px]">
              {averageRating.toFixed(1)}
            </p>
            <StarRating rating={averageRating} size="sm" className="mt-2" />
            <p className="mt-2 font-body text-[12px] text-dark-grey">Based on {reviewCount} verified reviews</p>
          </div>
          <div className="space-y-2">
            {dist.map(({ star, n }) => (
              <div key={star} className="flex items-center gap-2 font-body text-sm">
                <span className="w-8 text-charcoal">{star}★</span>
                <div className="h-1 flex-1 bg-mid-grey">
                  <div className="h-full bg-olive" style={{ width: `${reviewCount ? (n / reviewCount) * 100 : 0}%` }} />
                </div>
                <span className="w-6 text-right text-dark-grey">{n}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoggedIn && (
        <Dialog.Root open={openForm} onOpenChange={setOpenForm}>
          <Dialog.Trigger asChild>
            <button
              type="button"
              className="mb-8 border border-olive px-5 py-2.5 font-body text-[11px] font-medium uppercase tracking-[0.12em] text-olive transition-colors hover:bg-olive hover:text-white"
            >
              Write a review
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-[80] bg-charcoal/50" />
            <Dialog.Content
              data-lenis-prevent
              className="fixed left-1/2 top-1/2 z-[81] max-h-[85vh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain border border-mid-grey bg-canvas p-6 shadow-xl"
            >
              <Dialog.Title className="font-display text-xl text-charcoal">Write a review</Dialog.Title>
              <div className="mt-4">
                <ReviewForm productId={productId} productSlug={productSlug} onDone={() => setOpenForm(false)} />
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}

      <div className="mb-6 flex items-center gap-4 border-b border-mid-grey pb-3">
        <span className="font-body text-[11px] uppercase tracking-[0.12em] text-dark-grey">Sort</span>
        <button
          type="button"
          className={`font-body text-[12px] ${sort === "newest" ? "text-olive" : "text-charcoal"}`}
          onClick={() => setSort("newest")}
        >
          Newest
        </button>
        <span className="text-mid-grey">|</span>
        <button
          type="button"
          className={`font-body text-[12px] ${sort === "helpful" ? "text-olive" : "text-charcoal"}`}
          onClick={() => setSort("helpful")}
        >
          Most helpful
        </button>
      </div>

      <ul className="divide-y divide-mid-grey">
        {show.map((r) => (
          <li key={r.id} className="py-5">
            <div className="flex flex-wrap items-center gap-2">
              <StarRating rating={r.rating} size="sm" />
              {r.isVerified && (
                <span className="border border-olive px-2 py-0.5 font-body text-[9px] font-medium uppercase tracking-wide text-olive">
                  Verified purchase
                </span>
              )}
              <span className="font-body text-[11px] text-dark-grey">{format(new Date(r.createdAt), "MMM d, yyyy")}</span>
            </div>
            {r.title && <p className="mt-2 font-body text-[14px] font-medium text-ink">{r.title}</p>}
            {r.body && <p className="mt-2 font-body text-[14px] font-light leading-[1.75] text-charcoal">{r.body}</p>}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="font-body text-[13px] text-charcoal">{displayName(r.user.name)}</span>
              <button
                type="button"
                className="font-body text-[11px] text-dark-grey transition-colors hover:text-olive"
                onClick={() => void markHelpful(r.id)}
              >
                Helpful? 👍 {counts[r.id] ?? r.helpfulCount}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {sorted.length > 5 && !expanded && (
        <button
          type="button"
          className="mt-6 font-body text-[11px] font-medium uppercase tracking-wider text-olive underline"
          onClick={() => setExpanded(true)}
        >
          Load more
        </button>
      )}

      {reviews.length === 0 && (
        <p className="font-body text-sm italic text-dark-grey">Be the first to review this piece</p>
      )}
    </section>
  );
}
