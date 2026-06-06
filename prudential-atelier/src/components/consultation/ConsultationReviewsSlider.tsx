"use client";

import { useCallback, useEffect, useState } from "react";
import type { ConsultationReviewSlide } from "@/lib/consultation-reviews";

function CarouselArrowLeft() {
  return (
    <svg width="24" height="48" viewBox="0 0 24 48" fill="none" aria-hidden>
      <line x1="20" y1="4" x2="4" y2="24" stroke="rgba(68,41,19,0.4)" strokeWidth="1.5" className="transition-all duration-200 group-hover:stroke-[rgba(68,41,19,0.9)]" />
      <line x1="4" y1="24" x2="20" y2="44" stroke="rgba(68,41,19,0.4)" strokeWidth="1.5" className="transition-all duration-200 group-hover:stroke-[rgba(68,41,19,0.9)]" />
    </svg>
  );
}

function CarouselArrowRight() {
  return (
    <svg width="24" height="48" viewBox="0 0 24 48" fill="none" aria-hidden>
      <line x1="4" y1="4" x2="20" y2="24" stroke="rgba(68,41,19,0.4)" strokeWidth="1.5" className="transition-all duration-200 group-hover:stroke-[rgba(68,41,19,0.9)]" />
      <line x1="20" y1="24" x2="4" y2="44" stroke="rgba(68,41,19,0.4)" strokeWidth="1.5" className="transition-all duration-200 group-hover:stroke-[rgba(68,41,19,0.9)]" />
    </svg>
  );
}

export function ConsultationReviewsSlider({ items }: { items: ConsultationReviewSlide[] }) {
  const [index, setIndex] = useState(0);
  const count = items.length;

  const go = useCallback(
    (delta: number) => {
      if (count <= 1) return;
      setIndex((i) => (i + delta + count) % count);
    },
    [count],
  );

  useEffect(() => {
    if (count <= 1) return;
    const timer = window.setInterval(() => go(1), 5000);
    return () => window.clearInterval(timer);
  }, [count, go]);

  if (count === 0) return null;

  const item = items[index]!;

  return (
    <section className="mt-12 bg-ivory py-12">
      <p className="text-center font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-lightbr">
        What our clients say
      </p>

      <div className="relative mx-auto mt-8 flex max-w-3xl items-center justify-center gap-4 px-4">
        {count > 1 ? (
          <button
            type="button"
            onClick={() => go(-1)}
            className="group shrink-0 p-2"
            aria-label="Previous review"
          >
            <CarouselArrowLeft />
          </button>
        ) : null}

        <div className="min-w-0 flex-1 text-center">
          <blockquote className="relative mx-auto max-w-[600px]">
            <span className="pointer-events-none absolute -left-2 -top-4 font-display text-[48px] leading-none text-sand" aria-hidden>
              &ldquo;
            </span>
            <p className="px-6 font-display text-[22px] italic leading-[1.75] text-choc">{item.body}</p>
          </blockquote>
          <footer className="mt-6 font-sans text-[12px] text-text-light">
            — {item.userName} · {item.consultationLabel}
          </footer>
        </div>

        {count > 1 ? (
          <button
            type="button"
            onClick={() => go(1)}
            className="group shrink-0 p-2"
            aria-label="Next review"
          >
            <CarouselArrowRight />
          </button>
        ) : null}
      </div>

      {count > 1 ? (
        <div className="mt-6 flex justify-center gap-1.5">
          {items.map((r, i) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Go to review ${i + 1}`}
              className={`h-1 rounded-sm transition-all duration-300 ${
                i === index ? "w-5 bg-lightbr" : "w-1.5 bg-sand"
              }`}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
