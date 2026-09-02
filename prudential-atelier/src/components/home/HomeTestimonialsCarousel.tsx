"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { type HomepageTestimonial } from "@/lib/testimonials";
import { getInitials } from "@/lib/utils";

const CARD_WIDTH = 580;
const CARD_HEIGHT = 320;
const CARD_GAP = 20;
const SWIPE_THRESHOLD = 50;

function CarouselArrowLeft() {
  return (
    <svg width="24" height="48" viewBox="0 0 24 48" fill="none" aria-hidden>
      <line
        x1="20"
        y1="4"
        x2="4"
        y2="24"
        stroke="var(--lightbr)"
        strokeOpacity="0.4"
        strokeWidth="1.5"
        className="transition-all duration-200 group-hover:[stroke-opacity:0.9]"
      />
      <line
        x1="4"
        y1="24"
        x2="20"
        y2="44"
        stroke="var(--lightbr)"
        strokeOpacity="0.4"
        strokeWidth="1.5"
        className="transition-all duration-200 group-hover:[stroke-opacity:0.9]"
      />
    </svg>
  );
}

function CarouselArrowRight() {
  return (
    <svg width="24" height="48" viewBox="0 0 24 48" fill="none" aria-hidden>
      <line
        x1="4"
        y1="4"
        x2="20"
        y2="24"
        stroke="var(--lightbr)"
        strokeOpacity="0.4"
        strokeWidth="1.5"
        className="transition-all duration-200 group-hover:[stroke-opacity:0.9]"
      />
      <line
        x1="20"
        y1="24"
        x2="4"
        y2="44"
        stroke="var(--lightbr)"
        strokeOpacity="0.4"
        strokeWidth="1.5"
        className="transition-all duration-200 group-hover:[stroke-opacity:0.9]"
      />
    </svg>
  );
}

function GoldStars({ rating }: { rating: number }) {
  return (
    <div className="text-[14px] leading-none tracking-[0.08em] text-[#C9A84C]" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= rating ? "text-[#C9A84C]" : "text-sand"}>
          ★
        </span>
      ))}
    </div>
  );
}

function ClientPhoto({ item, mobile }: { item: HomepageTestimonial; mobile?: boolean }) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(item.imageUrl?.trim()) && !failed;

  if (showImage && item.imageUrl) {
    return (
      <div
        className={
          mobile
            ? "relative h-[200px] w-full shrink-0 overflow-hidden bg-sand"
            : "relative h-full w-[40%] shrink-0 overflow-hidden bg-sand"
        }
      >
        <Image
          src={item.imageUrl}
          alt={item.userName}
          fill
          className="object-cover object-top"
          sizes={mobile ? "100vw" : "232px"}
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={
        mobile
          ? "flex h-[200px] w-full shrink-0 items-center justify-center bg-lightbr"
          : "flex h-full w-[40%] shrink-0 items-center justify-center bg-lightbr"
      }
    >
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-lightbr font-display text-2xl text-choc">
        {item.isAnonymous ? "P" : getInitials(item.userName)}
      </span>
    </div>
  );
}

function TestimonialCard({ item, mobile }: { item: HomepageTestimonial; mobile?: boolean }) {
  const subtitle = item.subtitle;

  return (
    <article
      className={
        mobile
          ? "flex w-full min-w-full shrink-0 flex-col overflow-hidden rounded-lg border-[0.5px] border-sand bg-bg-card"
          : "flex shrink-0 flex-row overflow-hidden rounded-lg border-[0.5px] border-sand bg-bg-card"
      }
      style={mobile ? undefined : { width: CARD_WIDTH, height: CARD_HEIGHT }}
    >
      <ClientPhoto item={item} mobile={mobile} />
      <div className="flex min-w-0 flex-1 flex-col justify-between px-7 py-8 md:w-[60%]">
        <div>
          <GoldStars rating={item.rating} />
          <blockquote className="relative mt-3">
            <span
              className="pointer-events-none absolute -left-1 -top-1 font-display text-[36px] leading-none text-sand"
              aria-hidden
            >
              &ldquo;
            </span>
            <p className="line-clamp-3 pl-4 font-display text-[19px] italic leading-[1.75] text-choc">
              {item.body ?? ""}
            </p>
          </blockquote>
        </div>
        <footer className="mt-4 border-t border-sand pt-3">
          <p className="font-label text-[13px] font-semibold text-choc">{item.userName}</p>
          {subtitle ? (
            <p className="mt-0.5 font-body text-[12px] italic text-text-light">{subtitle}</p>
          ) : null}
        </footer>
      </div>
    </article>
  );
}

type HomeTestimonialsCarouselProps = {
  items: HomepageTestimonial[];
  heading: string;
  subtitle?: string;
};

export function HomeTestimonialsCarousel({ items, heading, subtitle }: HomeTestimonialsCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const total = items.length;
  const cardsPerView = isMobile ? 1 : 2;
  const maxIndex = Math.max(0, total - cardsPerView);
  const viewportWidth = cardsPerView * CARD_WIDTH + (cardsPerView - 1) * CARD_GAP;
  const stepWidth = CARD_WIDTH + CARD_GAP;

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    setCurrentIndex((prev) => Math.min(prev, maxIndex));
  }, [maxIndex]);

  const goTo = useCallback(
    (index: number) => {
      if (total === 0) return;
      setCurrentIndex(Math.min(Math.max(index, 0), maxIndex));
    },
    [maxIndex, total],
  );

  const goPrev = useCallback(() => goTo(currentIndex - 1), [currentIndex, goTo]);
  const goNext = useCallback(() => goTo(currentIndex + 1), [currentIndex, goTo]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > SWIPE_THRESHOLD) {
      if (diff > 0) goNext();
      else goPrev();
    }
  };

  if (items.length === 0) return null;

  const showArrows = total > cardsPerView;

  return (
    <section className="bg-ivory py-20">
      <div className="mx-auto max-w-site px-4 lg:px-10">
        <div className="mb-12">
          <p className="text-center font-label text-[10px] uppercase tracking-[0.2em] text-lightbr">Client Words</p>
          <h2 className="mt-3 text-center font-display text-[42px] leading-tight text-choc">{heading}</h2>
          {subtitle ? (
            <p className="mx-auto mt-3 max-w-xl text-center font-body text-sm text-text-light">{subtitle}</p>
          ) : null}
        </div>

        <div className="relative">
          {showArrows ? (
            <>
              <button
                type="button"
                onClick={goPrev}
                disabled={currentIndex === 0}
                aria-label="Previous testimonial"
                className="group absolute left-0 top-1/2 z-20 flex h-14 w-8 -translate-y-1/2 items-center justify-center transition-all duration-200 hover:scale-110 disabled:pointer-events-none disabled:opacity-30 md:-left-2 lg:-left-6"
                style={{ background: "transparent", border: "none" }}
              >
                <CarouselArrowLeft />
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={currentIndex >= maxIndex}
                aria-label="Next testimonial"
                className="group absolute right-0 top-1/2 z-20 flex h-14 w-8 -translate-y-1/2 items-center justify-center transition-all duration-200 hover:scale-110 disabled:pointer-events-none disabled:opacity-30 md:-right-2 lg:-right-6"
                style={{ background: "transparent", border: "none" }}
              >
                <CarouselArrowRight />
              </button>
            </>
          ) : null}

          <div
            className="mx-auto overflow-hidden"
            style={{ maxWidth: isMobile ? "100%" : viewportWidth }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div
              className="flex transition-transform duration-[400ms] ease-out"
              style={{
                gap: isMobile ? 0 : CARD_GAP,
                transform: isMobile
                  ? `translateX(-${currentIndex * 100}%)`
                  : `translateX(-${currentIndex * stepWidth}px)`,
              }}
            >
              {items.map((item) =>
                isMobile ? (
                  <div key={item.id} className="min-w-full shrink-0">
                    <TestimonialCard item={item} mobile />
                  </div>
                ) : (
                  <TestimonialCard key={item.id} item={item} />
                ),
              )}
            </div>
          </div>

          {total > 1 ? (
            <div className="mt-8 flex items-center justify-center gap-1.5">
              {items.map((_, index) => {
                const active = index === currentIndex;
                return (
                  <button
                    key={index}
                    type="button"
                    aria-label={`Go to testimonial ${index + 1}`}
                    onClick={() => goTo(index)}
                    className="cursor-pointer border-0 bg-transparent p-0"
                    style={{
                      width: active ? "20px" : "6px",
                      height: "4px",
                      borderRadius: "2px",
                      background: active ? "var(--lightbr)" : "var(--sand)",
                      transition: "width 0.3s ease, background 0.3s ease",
                    }}
                  />
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
