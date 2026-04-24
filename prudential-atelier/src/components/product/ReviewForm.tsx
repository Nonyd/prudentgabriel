"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { StarRating } from "@/components/ui/StarRating";

const schema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().max(80).optional(),
  body: z.string().min(10, "Please write at least 10 characters").max(1000),
});

type Form = z.infer<typeof schema>;

type Eligibility = {
  canReview: boolean;
  hasReviewed: boolean;
  isVerifiedBuyer: boolean;
  reason?: string;
};

export function ReviewForm({
  productId,
  productSlug,
  onDone,
}: {
  productId: string;
  productSlug: string;
  onDone: () => void;
}) {
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [done, setDone] = useState<{ points: number } | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { rating: 5, body: "", title: "" },
  });

  const rating = watch("rating");
  const bodyLen = watch("body")?.length ?? 0;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/reviews/eligibility?productId=${encodeURIComponent(productId)}`)
      .then((r) => {
        if (r.status === 401) {
          if (!cancelled) {
            setEligibility({
              canReview: false,
              hasReviewed: false,
              isVerifiedBuyer: false,
              reason: "Sign in to leave a review.",
            });
          }
          return null;
        }
        return r.json();
      })
      .then((j) => {
        if (!cancelled && j) setEligibility(j as Eligibility);
      })
      .catch(() => {
        if (!cancelled) setLoadErr(true);
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const onSubmit = async (data: Form) => {
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId,
        rating: data.rating,
        title: data.title || undefined,
        body: data.body,
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.status === 403) {
      toast.error((j as { error?: string }).error ?? "You cannot review this product.");
      return;
    }
    if (res.status === 409) {
      toast.error((j as { error?: string }).error ?? "Already reviewed.");
      return;
    }
    if (!res.ok) {
      toast.error((j as { error?: string }).error ?? "Could not submit review.");
      return;
    }
    const points = typeof (j as { pointsAwarded?: number }).pointsAwarded === "number" ? (j as { pointsAwarded: number }).pointsAwarded : 0;
    setDone({ points });
  };

  if (loadErr) {
    return <p className="font-body text-sm text-dark-grey">Could not load review eligibility.</p>;
  }

  if (!eligibility) {
    return <p className="font-body text-sm text-dark-grey">Checking eligibility…</p>;
  }

  if (done) {
    return (
      <div className="space-y-4 rounded-sm border border-mid-grey bg-cream p-5">
        <p className="font-body text-sm text-charcoal">✓ Review submitted! It will appear after our team approves it.</p>
        {done.points > 0 && (
          <p className="font-body text-sm text-olive">
            You&apos;ve earned {done.points} loyalty points for this review.
          </p>
        )}
        <button
          type="button"
          onClick={() => onDone()}
          className="font-body text-[11px] font-medium uppercase tracking-wider text-olive underline"
        >
          Close
        </button>
      </div>
    );
  }

  if (eligibility.reason === "Sign in to leave a review.") {
    return (
      <p className="font-body text-sm text-charcoal">
        <Link href="/auth/login" className="text-olive underline">
          Sign in
        </Link>{" "}
        to leave a review.
      </p>
    );
  }

  if (!eligibility.isVerifiedBuyer) {
    return (
      <div className="space-y-4">
        <p className="font-body text-sm leading-relaxed text-charcoal">
          Only verified buyers can review this product.{" "}
          <Link href={`/shop/${productSlug}`} className="text-olive underline">
            Purchase this item
          </Link>{" "}
          to leave a review.
        </p>
        <p className="font-body text-xs text-dark-grey">You need a completed paid order containing this product.</p>
      </div>
    );
  }

  if (eligibility.hasReviewed) {
    return <p className="font-body text-sm text-charcoal">You have already reviewed this product.</p>;
  }

  if (!eligibility.canReview) {
    return <p className="font-body text-sm text-charcoal">{eligibility.reason ?? "You cannot review this product."}</p>;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div>
        <p className="mb-2 font-body text-[11px] font-medium uppercase tracking-[0.12em] text-dark-grey">Rating *</p>
        <StarRating
          rating={rating}
          interactive
          size="md"
          className="scale-110"
          onChange={(r) => setValue("rating", r)}
        />
      </div>
      <div>
        <label className="font-body text-[11px] font-medium uppercase tracking-[0.12em] text-dark-grey">
          Title (optional)
        </label>
        <input
          className="mt-1 w-full border border-mid-grey bg-white px-3 py-2 font-body text-sm text-charcoal outline-none focus:border-olive"
          placeholder="Summarise your experience"
          maxLength={80}
          {...register("title")}
        />
      </div>
      <div>
        <label className="font-body text-[11px] font-medium uppercase tracking-[0.12em] text-dark-grey">Review *</label>
        <textarea
          className="mt-1 min-h-[120px] w-full border border-mid-grey bg-white px-3 py-2 font-body text-sm text-charcoal outline-none focus:border-olive"
          placeholder="Tell others about the fit, quality, and delivery..."
          maxLength={1000}
          {...register("body")}
        />
        <div className="mt-1 flex justify-between font-body text-xs text-dark-grey">
          <span>{errors.body?.message}</span>
          <span>{bodyLen}/1000</span>
        </div>
      </div>
      <Button type="submit" loading={isSubmitting} className="h-11 w-full bg-olive text-white hover:opacity-90">
        Submit review
      </Button>
    </form>
  );
}
