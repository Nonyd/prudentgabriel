"use client";

import Image from "next/image";
import { Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { HeroCarouselItem } from "@/lib/hero-carousel";
import { optimizeImageUrl } from "@/lib/utils";

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

/** iOS plays MP4/H.264. Inject a Cloudinary fetch format when the CMS stored a MOV/WebM. */
function heroPlaybackUrl(url: string): string {
  if (!url.includes("/video/upload/") || /\/upload\/[^/]*f_(mp4|auto)/.test(url)) return url;
  return url.replace("/video/upload/", "/video/upload/f_mp4,q_auto,vc_h264/");
}

function armInlineMuted(video: HTMLVideoElement) {
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "true");
  video.setAttribute("webkit-playsinline", "true");
  video.setAttribute("muted", "");
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
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  onVideoEnded: () => void;
}) {
  const localRef = useRef<HTMLVideoElement>(null);
  const endedRef = useRef(onVideoEnded);
  const mutedRef = useRef(isMuted);
  const [needsTap, setNeedsTap] = useState(false);
  endedRef.current = onVideoEnded;
  mutedRef.current = isMuted;

  useEffect(() => {
    if (item.type !== "video" || !isCenter) return;
    const video = localRef.current;
    if (!video) return;

    armInlineMuted(video);
    if (videoRef) {
      (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = video;
    }

    let cancelled = false;
    let started = false;

    const playNow = () => {
      if (cancelled) return;
      armInlineMuted(video);
      const attempt = video.play();
      if (!attempt) return;
      void attempt
        .then(() => {
          if (cancelled) return;
          started = true;
          setNeedsTap(false);
          video.muted = mutedRef.current;
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          const name = err instanceof Error ? err.name : "";
          if (name === "AbortError") return;
          setNeedsTap(true);
        });
    };

    const onEnded = () => {
      if (started && !cancelled) endedRef.current();
    };

    video.addEventListener("ended", onEnded);
    const raf = window.requestAnimationFrame(playNow);
    const safetyTimer = window.setTimeout(() => {
      if (!cancelled) endedRef.current();
    }, VIDEO_MAX_MS);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      video.removeEventListener("ended", onEnded);
      window.clearTimeout(safetyTimer);
      video.pause();
    };
  }, [isCenter, item.type, item.url, videoRef]);

  useEffect(() => {
    const video = localRef.current;
    if (video) video.muted = isMuted;
  }, [isMuted]);

  const unlock = () => {
    const video = localRef.current;
    if (!video) return;
    armInlineMuted(video);
    void video.play().then(() => {
      setNeedsTap(false);
      video.muted = mutedRef.current;
    });
  };

  if (item.type === "video") {
    if (!isCenter) {
      return <div className="absolute inset-0 bg-choc" aria-hidden />;
    }
    return (
      <>
        <video
          ref={localRef}
          src={heroPlaybackUrl(item.url)}
          muted
          playsInline
          autoPlay
          preload="auto"
          disablePictureInPicture
          controls={false}
          className="absolute inset-0 h-full w-full object-cover"
          {...{ "webkit-playsinline": "true" }}
        />
        {needsTap ? (
          <button
            type="button"
            onClick={unlock}
            aria-label="Play video"
            className="absolute inset-0 z-[15] flex items-center justify-center"
          >
            <span
              className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{
                background: "rgba(0,0,0,0.5)",
                border: "0.5px solid rgba(226,209,194,0.2)",
                color: "#E2D1C2",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden>
                <path d="M4 2.5v13l11-6.5L4 2.5z" />
              </svg>
            </span>
          </button>
        ) : null}
      </>
    );
  }

  return (
    <Image
      src={optimizeImageUrl(item.url, 900)}
      alt={item.alt ?? "Hero carousel"}
      fill
      sizes="(max-width: 767px) 72vw, 340px"
      priority={isCenter}
      className="object-cover"
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

  const visibleItems = items.map((item, index) => ({ item, index }));
  const slideOffset = isMobile ? 52 : 42;
  const adjacentScale = isMobile ? 0.78 : 0.82;

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
      <div className="relative flex flex-1 items-center justify-center overflow-visible px-0 md:overflow-hidden">
        <div className="relative h-full w-full" style={{ perspective: isMobile ? "none" : "1200px" }}>
          <div className="relative mx-auto flex min-h-[420px] w-full items-center justify-center md:min-h-[600px]">
            {visibleItems.map(({ item, index }) => {
              let pos = index - currentIndex;
              pos = (pos + total) % total;
              if (pos > Math.floor(total / 2)) pos -= total;

              const isCenter = pos === 0;
              const isAdjacent = Math.abs(pos) === 1;
              const slideTransform = isCenter
                ? "none"
                : `translate(-50%, -50%) translateX(${pos * slideOffset}%) scale(${isAdjacent ? adjacentScale : 0.65}) rotateY(${isMobile ? 0 : pos * -8}deg)`;

              return (
                <div
                  key={`${item.url}-${index}`}
                  className="absolute max-h-[520px] w-[min(300px,72vw)] overflow-hidden md:w-[340px]"
                  style={{
                    ...(isCenter
                      ? { left: 0, right: 0, top: 0, bottom: 0, margin: "auto" }
                      : { left: "50%", top: "50%" }),
                    aspectRatio: "3 / 4",
                    transform: slideTransform,
                    zIndex: isCenter ? 10 : isAdjacent ? 5 : 1,
                    opacity: isCenter ? 1 : isAdjacent ? (isMobile ? 0.55 : 0.45) : 0,
                    visibility: Math.abs(pos) > 1 ? "hidden" : "visible",
                    transition: "transform 0.5s ease-in-out, opacity 0.5s ease-in-out, box-shadow 0.5s ease-in-out",
                    borderRadius: isMobile ? "12px" : "8px",
                    border: "0.5px solid rgba(226,209,194,0.12)",
                    boxShadow: isCenter ? "0 24px 64px rgba(0,0,0,0.4)" : "none",
                    ...(isCenter || isMobile ? {} : { filter: "blur(3px)" }),
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
              className="group absolute left-1 top-1/2 z-20 flex h-14 w-8 -translate-y-1/2 items-center justify-center transition-all duration-200 hover:scale-110 md:left-3"
              style={{ background: "transparent", border: "none" }}
            >
              <CarouselArrowLeft />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next slide"
              className="group absolute right-1 top-1/2 z-20 flex h-14 w-8 -translate-y-1/2 items-center justify-center transition-all duration-200 hover:scale-110 md:right-3"
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
