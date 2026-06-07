"use client";

import Link from "next/link";

export function ShareYourStoryCard({ status }: { status: "write" | "pending" }) {
  if (status === "pending") {
    return (
      <section className="mt-8 rounded-md border border-sand bg-bg-card px-6 py-8 md:px-10">
        <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-lightbr">✓ Testimonial submitted</p>
        <p className="mt-3 font-body text-sm text-text-mid">Your testimonial is awaiting approval.</p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-md bg-choc px-6 py-10 text-cream md:px-10 md:py-12">
      <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-lightbr">✦ Share your story</p>
      <p className="mt-4 max-w-xl font-display text-xl italic leading-relaxed text-cream/95 md:text-[22px]">
        Your experience matters. Share it and inspire other women to begin their Prudential journey.
      </p>
      <Link
        href="/account/testimonial/new"
        className="mt-8 inline-flex rounded-sm border border-cream px-6 py-3 font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-cream transition-colors hover:bg-cream/10"
      >
        Write a testimonial →
      </Link>
    </section>
  );
}
