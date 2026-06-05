"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { HeroCarouselItem } from "@/lib/hero-carousel";

interface HeroCarouselProps {
  items: HeroCarouselItem[];
}

function CarouselMedia({
  item,
  isCenter,
}: {
  item: HeroCarouselItem;
  isCenter: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (item.type !== "video" || !videoRef.current) return;
    if (isCenter) {
      void videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }, [isCenter, item.type]);

  if (item.type === "video") {
    return (
      <video
        ref={videoRef}
        src={item.url}
        autoPlay={isCenter}
        muted
        loop
        playsInline
        className="h-full w-full object-cover"
        style={{ objectFit: "cover", width: "100%", height: "100%" }}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={item.url}
      alt={item.alt ?? "Hero carousel"}
      className="h-full w-full object-cover"
    />
  );
}

export function HeroCarousel({ items }: HeroCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const isPaused = useRef(false);
  const total = items.length;

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (currentIndex >= total) setCurrentIndex(0);
  }, [currentIndex, total]);

  useEffect(() => {
    if (total <= 1) return;
    const timer = setInterval(() => {
      if (!isPaused.current) {
        setCurrentIndex((prev) => (prev + 1) % total);
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [total]);

  const goTo = useCallback(
    (index: number) => {
      if (total === 0) return;
      setCurrentIndex(((index % total) + total) % total);
    },
    [total],
  );

  const goPrev = useCallback(() => goTo(currentIndex - 1), [currentIndex, goTo]);
  const goNext = useCallback(() => goTo(currentIndex + 1), [currentIndex, goTo]);

  if (total === 0) return null;

  const visibleItems = isMobile
    ? [{ item: items[currentIndex], index: currentIndex }]
    : items.map((item, index) => ({ item, index }));

  return (
    <div
      className="relative flex h-full min-h-[420px] w-full flex-col md:min-h-[600px]"
      onMouseEnter={() => {
        isPaused.current = true;
      }}
      onMouseLeave={() => {
        isPaused.current = false;
      }}
    >
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <div
          className="relative h-full w-full"
          style={{ perspective: "1200px" }}
        >
          <div className="relative mx-auto flex h-full min-h-[420px] w-full items-center justify-center md:min-h-[600px]">
            {visibleItems.map(({ item, index }) => {
              let pos = index - currentIndex;
              if (!isMobile) {
                pos = (pos + total) % total;
                if (pos > Math.floor(total / 2)) pos -= total;
              } else {
                pos = 0;
              }

              const isCenter = pos === 0;
              const isAdjacent = Math.abs(pos) === 1;

              return (
                <div
                  key={`${item.url}-${index}`}
                  className="absolute h-full max-h-[520px] w-[min(280px,85vw)] md:max-h-none"
                  style={{
                    left: "50%",
                    top: "50%",
                    aspectRatio: "3 / 4",
                    transform: `translate(-50%, -50%) translateX(${pos * 42}%) scale(${isCenter ? 1 : isAdjacent ? 0.82 : 0.65}) rotateY(${pos * -8}deg)`,
                    zIndex: isCenter ? 10 : isAdjacent ? 5 : 1,
                    opacity: isCenter ? 1 : isAdjacent ? 0.45 : 0,
                    filter: isCenter ? "blur(0px)" : "blur(3px)",
                    visibility: Math.abs(pos) > 1 ? "hidden" : "visible",
                    transition: "all 0.5s ease-in-out",
                    borderRadius: "8px",
                    border: "0.5px solid rgba(226,209,194,0.12)",
                    boxShadow: isCenter ? "0 24px 64px rgba(0,0,0,0.4)" : "none",
                    overflow: "hidden",
                  }}
                >
                  <CarouselMedia item={item} isCenter={isCenter} />
                </div>
              );
            })}
          </div>
        </div>

        {total > 1 ? (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous slide"
              className="absolute top-1/2 z-20 flex -translate-y-1/2 cursor-pointer items-center justify-center transition-all duration-200 hover:scale-105 md:left-[-18px]"
              style={{
                left: isMobile ? "4px" : "-18px",
                width: isMobile ? "28px" : "36px",
                height: isMobile ? "28px" : "36px",
                borderRadius: "50%",
                background: "rgba(68,41,19,0.6)",
                border: "0.5px solid rgba(152,117,91,0.3)",
                color: "#E2D1C2",
                backdropFilter: "blur(8px)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(92,52,34,0.9)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(68,41,19,0.6)";
              }}
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next slide"
              className="absolute top-1/2 z-20 flex -translate-y-1/2 cursor-pointer items-center justify-center transition-all duration-200 hover:scale-105 md:right-[-18px]"
              style={{
                right: isMobile ? "4px" : "-18px",
                width: isMobile ? "28px" : "36px",
                height: isMobile ? "28px" : "36px",
                borderRadius: "50%",
                background: "rgba(68,41,19,0.6)",
                border: "0.5px solid rgba(152,117,91,0.3)",
                color: "#E2D1C2",
                backdropFilter: "blur(8px)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(92,52,34,0.9)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(68,41,19,0.6)";
              }}
            >
              <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </>
        ) : null}
      </div>

      {total > 1 ? (
        <div className="mt-4 flex items-center justify-center gap-1">
          {items.map((_, index) => {
            const active = index === currentIndex;
            return (
              <button
                key={index}
                type="button"
                aria-label={`Go to slide ${index + 1}`}
                onClick={() => goTo(index)}
                className="cursor-pointer border-0 bg-transparent p-0"
                style={{
                  width: active ? "20px" : "6px",
                  height: "4px",
                  borderRadius: "2px",
                  background: active ? "#98755B" : "rgba(152,117,91,0.3)",
                  transition: "width 0.3s ease",
                }}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
