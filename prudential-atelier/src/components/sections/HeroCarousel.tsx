"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { HeroCarouselItem } from "@/lib/hero-carousel";

interface HeroCarouselProps {
  items: HeroCarouselItem[];
}

const IMAGE_ADVANCE_MS = 2500;
const VIDEO_MAX_MS = 60_000;

function CarouselArrowLeft() {
  return (
    <svg width="24" height="48" viewBox="0 0 24 48" fill="none" aria-hidden>
      <line
        x1="20"
        y1="4"
        x2="4"
        y2="24"
        stroke="rgba(226,209,194,0.6)"
        strokeWidth="1.5"
        className="transition-all duration-200 group-hover:stroke-[rgba(226,209,194,1)]"
      />
      <line
        x1="4"
        y1="24"
        x2="20"
        y2="44"
        stroke="rgba(226,209,194,0.6)"
        strokeWidth="1.5"
        className="transition-all duration-200 group-hover:stroke-[rgba(226,209,194,1)]"
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
        stroke="rgba(226,209,194,0.6)"
        strokeWidth="1.5"
        className="transition-all duration-200 group-hover:stroke-[rgba(226,209,194,1)]"
      />
      <line
        x1="20"
        y1="24"
        x2="4"
        y2="44"
        stroke="rgba(226,209,194,0.6)"
        strokeWidth="1.5"
        className="transition-all duration-200 group-hover:stroke-[rgba(226,209,194,1)]"
      />
    </svg>
  );
}

function CarouselMedia({
  item,
  isCenter,
  isMuted,
  videoRef,
  onVideoEnded,
}: {
  item: HeroCarouselItem;
  isCenter: boolean;
  isMuted: boolean;
  videoRef?: React.RefObject<HTMLVideoElement>;
  onVideoEnded: () => void;
}) {
  const fallbackRef = useRef<HTMLVideoElement>(null);
  const activeRef = videoRef ?? fallbackRef;

  useEffect(() => {
    const video = activeRef.current;
    if (item.type !== "video" || !video) return;

    if (isCenter) {
      video.muted = isMuted;
      void video.play().catch(() => {});

      const handleEnded = () => onVideoEnded();
      video.addEventListener("ended", handleEnded);

      const safetyTimer = window.setTimeout(() => {
        onVideoEnded();
      }, VIDEO_MAX_MS);

      return () => {
        video.removeEventListener("ended", handleEnded);
        window.clearTimeout(safetyTimer);
      };
    }

    video.muted = true;
    video.pause();
    video.currentTime = 0;
    return undefined;
  }, [activeRef, isCenter, isMuted, item.type, onVideoEnded]);

  if (item.type === "video") {
    return (
      <video
        ref={activeRef}
        src={item.url}
        muted
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
  const [isMuted, setIsMuted] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const centerVideoRef = useRef<HTMLVideoElement>(null);
  const isPaused = useRef(false);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
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

  const goTo = useCallback(
    (index: number) => {
      if (total === 0) return;
      setCurrentIndex(((index % total) + total) % total);
    },
    [total],
  );

  const goPrev = useCallback(() => goTo(currentIndex - 1), [currentIndex, goTo]);
  const goNext = useCallback(() => goTo(currentIndex + 1), [currentIndex, goTo]);

  const handleVideoEnded = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % total);
  }, [total]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (centerVideoRef.current) {
        centerVideoRef.current.muted = next;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (total <= 1) return;

    const current = items[currentIndex];
    if (current?.type === "video") return;

    const timer = window.setInterval(() => {
      if (!isPaused.current) {
        setCurrentIndex((prev) => (prev + 1) % total);
      }
    }, IMAGE_ADVANCE_MS);

    return () => window.clearInterval(timer);
  }, [total, currentIndex, items]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goNext();
      else goPrev();
    }
  };

  if (total === 0) return null;

  const visibleItems = isMobile
    ? [{ item: items[currentIndex], index: currentIndex }]
    : items.map((item, index) => ({ item, index }));

  return (
    <div
      className="relative flex h-full w-full flex-col md:min-h-[600px]"
      onMouseEnter={() => {
        isPaused.current = true;
      }}
      onMouseLeave={() => {
        isPaused.current = false;
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="relative flex flex-1 items-center justify-center overflow-visible px-4 md:overflow-hidden md:px-0">
        <div className="relative h-full w-full" style={{ perspective: "1200px" }}>
          <div className="relative mx-auto flex min-h-[520px] w-full items-center justify-center md:min-h-[600px]">
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
                  className="absolute max-h-[520px] w-[min(340px,85vw)] overflow-hidden sm:w-[340px]"
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
                    borderRadius: isMobile ? "12px" : "8px",
                    border: "0.5px solid rgba(226,209,194,0.12)",
                    boxShadow: isCenter ? "0 24px 64px rgba(0,0,0,0.4)" : "none",
                  }}
                >
                  <CarouselMedia
                    item={item}
                    isCenter={isCenter}
                    isMuted={isMuted}
                    videoRef={isCenter ? centerVideoRef : undefined}
                    onVideoEnded={handleVideoEnded}
                  />
                  {item.type === "video" ? (
                    <button
                      type="button"
                      onClick={toggleMute}
                      aria-label={isMuted ? "Unmute video" : "Mute video"}
                      className="absolute flex items-center justify-center"
                      style={{
                        bottom: "12px",
                        right: "12px",
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        background: "rgba(0,0,0,0.5)",
                        backdropFilter: "blur(8px)",
                        WebkitBackdropFilter: "blur(8px)",
                        border: "0.5px solid rgba(226,209,194,0.2)",
                        color: "#E2D1C2",
                        cursor: "pointer",
                        transition: "all 0.2s ease, opacity 0.3s ease",
                        zIndex: 20,
                        opacity: isCenter ? 1 : 0,
                        pointerEvents: isCenter ? "auto" : "none",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(0,0,0,0.75)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "rgba(0,0,0,0.5)";
                      }}
                    >
                      {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>
                  ) : null}
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
              className={`group absolute top-1/2 z-20 flex h-14 w-8 -translate-y-1/2 items-center justify-center transition-all duration-200 hover:scale-110 ${
                isMobile ? "-left-4" : "left-3"
              }`}
              style={{ background: "transparent", border: "none" }}
            >
              <CarouselArrowLeft />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next slide"
              className={`group absolute top-1/2 z-20 flex h-14 w-8 -translate-y-1/2 items-center justify-center transition-all duration-200 hover:scale-110 ${
                isMobile ? "-right-4" : "right-3"
              }`}
              style={{ background: "transparent", border: "none" }}
            >
              <CarouselArrowRight />
            </button>
          </>
        ) : null}
      </div>

      {total > 1 ? (
        <div className="mt-4 flex items-center justify-center gap-1.5">
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
                  width: active ? "28px" : "8px",
                  height: "5px",
                  borderRadius: "3px",
                  background: active ? "#98755B" : "rgba(152,117,91,0.35)",
                  transition: "width 0.3s ease, background 0.3s ease",
                }}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
