"use client";

import { useState } from "react";
import { format } from "date-fns";
import * as Dialog from "@radix-ui/react-dialog";
import { StarRating } from "@/components/ui/StarRating";
import { Button } from "@/components/ui/Button";
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

interface ReviewsSectionProps {
  reviews: ReviewItem[];
  averageRating: number;
  reviewCount: number;
  productId: string;
  canWriteReview: boolean;
}

export function ReviewsSection({
  reviews,
  averageRating,
  reviewCount,
  productId,
  canWriteReview,
}: ReviewsSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const show = expanded ? reviews : reviews.slice(0, 5);

  const dist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    n: reviews.filter((r) => Math.round(r.rating) === star).length,
  }));

  return (
    <section id="reviews" className="scroll-mt-28 border-t border-border py-16">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-display text-3xl text-charcoal">Client Reviews</h2>
        <span className="rounded-full bg-wine-muted px-3 py-1 font-label text-[10px] uppercase text-wine">
          {reviewCount} reviews
        </span>
      </div>

      {reviews.length > 0 && (
        <div className="mb-10 grid gap-8 md:grid-cols-2">
          <div>
            <p className="font-display text-5xl text-gold">{averageRating.toFixed(1)}</p>
            <StarRating rating={averageRating} size="sm" className="mt-2" />
          </div>
          <div className="space-y-2">
            {dist.map(({ star, n }) => (
              <div key={star} className="flex items-center gap-2 text-sm">
                <span className="w-8 text-charcoal-light">{star}★</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-ivory-dark">
                  <div
                    className="h-full rounded-full bg-wine"
                    style={{ width: `${reviewCount ? (n / reviewCount) * 100 : 0}%` }}
                  />
                </div>
                <span className="w-6 text-right text-charcoal-light">{n}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {canWriteReview && (
        <Dialog.Root open={openForm} onOpenChange={setOpenForm}>
          <Dialog.Trigger asChild>
            <Button type="button" variant="secondary" className="mb-8">
              Write a review
            </Button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-[80] bg-charcoal/50" />
            <Dialog.Content className="fixed left-1/2 top-1/2 z-[81] max-h-[90vh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-sm bg-cream p-6 shadow-xl">
              <Dialog.Title className="font-display text-xl text-charcoal">Write a review</Dialog.Title>
              <div className="mt-4">
                <ReviewForm productId={productId} onDone={() => setOpenForm(false)} />
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}

      <ul className="space-y-8">
        {show.map((r) => (
          <li key={r.id} className="border-b border-border pb-8">
            <StarRating rating={r.rating} size="sm" />
            {r.title && <p className="mt-2 font-medium text-charcoal">{r.title}</p>}
            {r.body && <p className="mt-2 font-body text-sm text-charcoal-mid">{r.body}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-charcoal-light">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-wine text-ivory">
                {(r.user.name ?? "?")[0]}
              </span>
              <span>{r.user.name}</span>
              {r.isVerified && (
                <span className="rounded-sm bg-gold/20 px-2 py-0.5 font-label text-[9px] uppercase text-charcoal">
                  Verified Purchase
                </span>
              )}
              <span>{format(new Date(r.createdAt), "MMM d, yyyy")}</span>
            </div>
            <button
              type="button"
              className="mt-3 font-label text-[10px] uppercase tracking-wider text-wine hover:underline"
              onClick={async () => {
                await fetch(`/api/reviews/${r.id}/helpful`, { method: "POST" });
              }}
            >
              Helpful? 👍 {r.helpfulCount}
            </button>
          </li>
        ))}
      </ul>

      {reviews.length > 5 && !expanded && (
        <Button type="button" variant="ghost" className="mt-6" onClick={() => setExpanded(true)}>
          Load More
        </Button>
      )}

      {reviews.length === 0 && (
        <p className="italic text-charcoal-light">Be the first to review this piece</p>
      )}
    </section>
  );
}
