"use client";

import Image from "next/image";
import { Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { HeroCarouselItem } from "@/lib/hero-carousel";
import { HERO_TAP_TO_PLAY_QUERY, heroPlaybackUrl, heroWaitsForTap, isIosDevice } from "@/lib/hero-playback";
import { optimizeImageUrl } from "@/lib/utils";

interface HeroCarouselProps {
  items: HeroCarouselItem[];
}

const IMAGE_ADVANCE_MS = 2500;
const VIDEO_MAX_MS = 60_000;
/** A video card waiting for a tap holds its poster this long, then the carousel moves on. */
const POSTER_HOLD_MS = 6000;

function connectionSaveData(): boolean {
  if (typeof navigator === "undefined") return false;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return Boolean(conn?.saveData);
}

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
  mayPlay,
  waitsForTap,
  onTapToPlay,
}: {
  item: HeroCarouselItem;
  isCenter: boolean;
  isMuted: boolean;
  videoRef?: React.MutableRefObject<HTMLVideoElement | null>;
  onVideoEnded: () => void;
  /** The page has loaded and the hero is near the viewport (or she tapped). */
  mayPlay: boolean;
  /** Phone, Save-Data or reduced motion, and no tap yet. */
  waitsForTap: boolean;
  onTapToPlay: () => void;
}) {
  // Same rules as the /rtw hero (Slice AE's reels): the poster is what paints
  // first; the video mounts only once it may play, and never preloads.
  const showVideo = item.type === "video" && isCenter && mayPlay && !waitsForTap;
  const localRef = useRef<HTMLVideoElement | null>(null);
  const endedRef = useRef(onVideoEnded);
  const mutedRef = useRef(isMuted);
  const [needsTap, setNeedsTap] = useState(false);
  endedRef.current = onVideoEnded;
  mutedRef.current = isMuted;

  const bindVideo = useCallback(
    (el: HTMLVideoElement | null) => {
      localRef.current = el;
      if (!el) return;
      armInlineMuted(el);
      if (videoRef) {
        videoRef.current = el;
      }
    },
    [videoRef],
  );

  useEffect(() => {
    if (item.type !== "video" || !isCenter || !showVideo) return;
    const video = localRef.current;
    if (!video) return;

    armInlineMuted(video);

    let cancelled = false;
    let started = false;

    const markPlaying = () => {
      if (cancelled) return;
      started = true;
      setNeedsTap(false);
      video.muted = mutedRef.current;
    };

    const onEnded = () => {
      if (started && !cancelled) endedRef.current();
    };

    const onError = () => {
      if (!cancelled) setNeedsTap(true);
    };
    let canPlayTimer = 0;
    const onCanPlay = () => {
      canPlayTimer = window.setTimeout(() => {
        if (!cancelled && video.paused) setNeedsTap(true);
      }, 500);
    };

    video.addEventListener("playing", markPlaying);
    video.addEventListener("ended", onEnded);
    video.addEventListener("error", onError);
    video.addEventListener("canplay", onCanPlay);

    // iPhone Safari treats a scripted play() as a failed user-gesture, then will not
    // autoplay that same element. Leave muted autoplay to the attributes; only tap calls play().
    const ios = isIosDevice();
    if (!ios) {
      const attempt = video.play();
      if (attempt) {
        void attempt.then(markPlaying).catch((err: unknown) => {
          if (cancelled) return;
          const name = err instanceof Error ? err.name : "";
          if (name === "AbortError") return;
          setNeedsTap(true);
        });
      }
    }

    const safetyTimer = window.setTimeout(() => {
      if (!cancelled) endedRef.current();
    }, VIDEO_MAX_MS);

    return () => {
      cancelled = true;
      video.removeEventListener("playing", markPlaying);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("error", onError);
      video.removeEventListener("canplay", onCanPlay);
      window.clearTimeout(canPlayTimer);
      window.clearTimeout(safetyTimer);
    };
  }, [isCenter, item.type, item.url, showVideo]);

  useEffect(() => {
    const video = localRef.current;
    if (video) video.muted = isMuted;
  }, [isMuted]);

  const unlock = (event: React.SyntheticEvent) => {
    event.stopPropagation();
    if (!showVideo) {
      // Mounts the video; muted autoplay takes it from there (iPhone included).
      event.preventDefault();
      onTapToPlay();
      return;
    }
    const video = localRef.current;
    if (!video) return;
    armInlineMuted(video);
    void video.play().then(() => {
      setNeedsTap(false);
      video.muted = mutedRef.current;
    });
  };

  if (item.type === "video") {
    const poster = item.poster?.trim();
    return (
      <>
        {poster ? (
          <Image
            src={optimizeImageUrl(poster, 900)}
            alt={item.alt ?? "Hero carousel"}
            fill
            sizes="(max-width: 767px) 72vw, 340px"
            priority={isCenter}
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-choc" aria-hidden />
        )}
        {showVideo ? (
          <video
            ref={bindVideo}
            // The card is at most 340 px wide: the 720-wide encode is sharp at 2x everywhere.
            src={item.phoneUrl ?? heroPlaybackUrl(item.url)}
            poster={poster}
            muted
            playsInline
            autoPlay
            preload="none"
            disablePictureInPicture
            controls={false}
            className="absolute inset-0 h-full w-full object-cover"
            {...{ "webkit-playsinline": "true" }}
          />
        ) : null}
        {isCenter && (needsTap || waitsForTap) ? (
          <button
            type="button"
            onClick={unlock}
            onTouchEnd={unlock}
            aria-label="Play the film"
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
  // Assume a phone until matchMedia runs. iPhone's first paint must not get CSS 3D
  // perspective — Safari refuses muted autoplay inside a 3D containing block.
  const [isMobile, setIsMobile] = useState(true);
  const [saveData, setSaveData] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [afterLoad, setAfterLoad] = useState(false);
  const [nearView, setNearView] = useState(true);
  const [tappedIndex, setTappedIndex] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const centerVideoRef = useRef<HTMLVideoElement | null>(null);
  const isPaused = useRef(false);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const total = items.length;

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const tap = window.matchMedia(HERO_TAP_TO_PLAY_QUERY);
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setIsMobile(mq.matches || tap.matches);
      setReducedMotion(motion.matches);
    };
    update();
    setSaveData(connectionSaveData());
    for (const q of [mq, tap, motion]) q.addEventListener("change", update);
    return () => {
      for (const q of [mq, tap, motion]) q.removeEventListener("change", update);
    };
  }, []);

  // The video waits for the page: poster first, the film after load.
  useEffect(() => {
    let idle = 0;
    const ready = () => {
      idle = window.setTimeout(() => setAfterLoad(true), 300);
    };
    if (document.readyState === "complete") ready();
    else window.addEventListener("load", ready, { once: true });
    return () => {
      window.removeEventListener("load", ready);
      window.clearTimeout(idle);
    };
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const near = new IntersectionObserver((entries) => setNearView(entries.some((e) => e.isIntersecting)), {
      rootMargin: "50% 0px",
    });
    near.observe(el);
    return () => near.disconnect();
  }, []);

  const tapPolicy = heroWaitsForTap({ narrow: isMobile, saveData, reducedMotion });

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
    if (current?.type === "video") {
      if (!tapPolicy || tappedIndex === currentIndex) return;
      // Waiting for a tap: hold the poster, then move on as an image would.
      const hold = window.setTimeout(() => {
        if (!isPaused.current) setCurrentIndex((prev) => (prev + 1) % total);
      }, POSTER_HOLD_MS);
      return () => window.clearTimeout(hold);
    }

    const timer = window.setInterval(() => {
      if (!isPaused.current) {
        setCurrentIndex((prev) => (prev + 1) % total);
      }
    }, IMAGE_ADVANCE_MS);

    return () => window.clearInterval(timer);
  }, [total, currentIndex, items, tapPolicy, tappedIndex]);

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
      ref={rootRef}
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
                    mayPlay={tappedIndex === index || (afterLoad && nearView)}
                    waitsForTap={tapPolicy && tappedIndex !== index}
                    onTapToPlay={() => setTappedIndex(index)}
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
