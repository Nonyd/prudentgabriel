"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { StarRating } from "@/components/ui/StarRating";

type ProductContext = {
  kind: "product";
  productId: string;
  orderId: string;
  productName: string;
  productImage: string | null;
};

type ConsultationContext = {
  kind: "consultation";
  consultationId: string;
  label: string;
  dateLabel: string;
};

export function ReviewSubmitClient({ context }: { context: ProductContext | ConsultationContext }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const maxBody = context.kind === "consultation" ? 400 : 500;
  const minBody = 20;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) {
      toast.error("Please select a rating");
      return;
    }
    if (body.trim().length < minBody) {
      toast.error(`Please write at least ${minBody} characters`);
      return;
    }
    setSubmitting(true);
    try {
      const payload =
        context.kind === "product"
          ? {
              kind: "product" as const,
              productId: context.productId,
              orderId: context.orderId,
              rating,
              title: title.trim() || undefined,
              body: body.trim(),
            }
          : {
              kind: "consultation" as const,
              consultationId: context.consultationId,
              rating,
              body: body.trim(),
            };

      const res = await fetch("/api/account/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: string; pointsAwarded?: number };
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Could not submit");
        return;
      }
      if (data.pointsAwarded && data.pointsAwarded > 0) {
        toast.success(`Review submitted — +${data.pointsAwarded} points!`);
      }
      setDone(true);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-xl rounded-md border border-sand bg-bg-card px-8 py-12 text-center">
        <p className="font-display text-2xl text-choc">✓ Thank you!</p>
        <p className="mt-4 font-body text-sm text-text-mid">
          Your review has been submitted and will appear after approval.
        </p>
        <Link href="/account" className="btn-primary mt-8 inline-flex px-6 py-3 text-[10px]">
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (context.kind === "consultation") {
    return (
      <form onSubmit={(e) => void handleSubmit(e)} className="mx-auto max-w-xl space-y-8">
        <div>
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-lightbr">
            How was your consultation?
          </p>
          <h1 className="mt-2 font-display text-[32px] text-choc">Share your experience</h1>
        </div>

        <div className="rounded-sm border border-sand bg-bg px-5 py-4">
          <p className="font-sans text-[10px] uppercase tracking-[0.14em] text-text-light">Your consultation</p>
          <p className="mt-1 font-body text-sm text-choc">{context.label}</p>
          <p className="font-body text-xs text-text-mid">{context.dateLabel}</p>
        </div>

        <div>
          <p className="font-sans text-sm text-text-mid">Your rating:</p>
          <StarRating rating={rating} size="lg" variant="gold" interactive onChange={setRating} className="mt-2" />
        </div>

        <div>
          <label htmlFor="review-body" className="font-sans text-sm text-text-mid">
            Your experience:
          </label>
          <textarea
            id="review-body"
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, maxBody))}
            rows={4}
            className="mt-2 w-full rounded-sm border border-sand bg-input-bg px-4 py-3 font-body text-sm text-choc outline-none focus:border-nut"
          />
          <p className="mt-1 font-body text-xs text-text-light">{body.length} / {maxBody}</p>
        </div>

        <button type="submit" disabled={submitting} className="btn-primary px-8 py-3 text-[10px] disabled:opacity-60">
          {submitting ? "Submitting…" : "Submit →"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="mx-auto max-w-3xl">
      <div className="grid gap-8 md:grid-cols-[240px_1fr]">
        {context.productImage ? (
          <div className="relative aspect-[3/4] overflow-hidden rounded-md border border-sand">
            <Image src={context.productImage} alt={context.productName} fill className="object-cover" sizes="240px" />
          </div>
        ) : (
          <div className="flex aspect-[3/4] items-center justify-center rounded-md border border-sand bg-bg font-body text-sm text-text-light">
            {context.productName}
          </div>
        )}

        <div className="space-y-6">
          <div>
            <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-lightbr">Your review</p>
            <h1 className="mt-2 font-display text-[32px] text-choc">{context.productName}</h1>
          </div>

          <div>
            <p className="font-sans text-sm text-text-mid">Your rating:</p>
            <StarRating rating={rating} size="lg" variant="gold" interactive onChange={setRating} className="mt-2" />
          </div>

          <div>
            <label htmlFor="review-title" className="font-sans text-sm text-text-mid">
              Title (optional):
            </label>
            <input
              id="review-title"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 80))}
              className="mt-2 w-full rounded-sm border border-sand bg-input-bg px-4 py-2 font-body text-sm text-choc outline-none focus:border-nut"
            />
          </div>

          <div>
            <label htmlFor="review-body-product" className="font-sans text-sm text-text-mid">
              Your review:
            </label>
            <textarea
              id="review-body-product"
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, maxBody))}
              rows={5}
              className="mt-2 w-full rounded-sm border border-sand bg-input-bg px-4 py-3 font-body text-sm text-choc outline-none focus:border-nut"
            />
            <p className="mt-1 font-body text-xs text-text-light">{body.length} / {maxBody}</p>
          </div>

          <button type="submit" disabled={submitting} className="btn-primary px-8 py-3 text-[10px] disabled:opacity-60">
            {submitting ? "Submitting…" : "Submit review →"}
          </button>
        </div>
      </div>
    </form>
  );
}
