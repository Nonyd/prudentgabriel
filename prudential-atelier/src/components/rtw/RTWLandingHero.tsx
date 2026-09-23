"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { HeroCarouselItem } from "@/lib/hero-carousel";
import { shouldAutoplayReel, shouldPrefetchReelVideo } from "@/lib/collection-reel-playback";
import { RTW_GRID_ID, type RTWHeroLook } from "@/lib/rtw-hero";
import { HERO_TAP_TO_PLAY_QUERY, heroVideoSrc, heroWaitsForTap, isIosDevice } from "@/lib/hero-playback";
import { cn, optimizeImageUrl } from "@/lib/utils";

const IMAGE_ADVANCE_MS = 4500;
const FEATURED_SIZES = "(min-width: 1024px) 36vw, 100vw";
const SIDE_SIZES = "(min-width: 1024px) 22vw, 100vw";

function connectionSaveData(): boolean {
  if (typeof navigator === "undefined") return false;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return Boolean(conn?.saveData);
}

function armInlineMuted(video: HTMLVideoElement) {
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "true");
  video.setAttribute("webkit-playsinline", "true");
  video.setAttribute("muted", "");
}

function HeroSlide({
  item,
  active,
  inView,
  nearView,
  pageVisible,
  priority,
  sizes,
}: {
  item: HeroCarouselItem;
  active: boolean;
  inView: boolean;
  nearView: boolean;
  pageVisible: boolean;
  priority: boolean;
  sizes: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [saveData, setSaveData] = useState(false);
  // Until the browser says otherwise, assume a phone: the server HTML carries the
  // poster and no <video>, so the poster is what paints first everywhere.
  const [narrow, setNarrow] = useState(true);
  const [afterLoad, setAfterLoad] = useState(false);
  const [tappedToPlay, setTappedToPlay] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const ios = isIosDevice();

  const waitsForTap = heroWaitsForTap({ narrow, saveData, reducedMotion });
  const prefetch = shouldPrefetchReelVideo({
    withinOneViewport: active && nearView,
    saveData,
    reducedMotion,
  });
  const wantAutoplay = shouldAutoplayReel({
    inView: active && inView && pageVisible,
    saveData: waitsForTap,
    reducedMotion: false,
    tappedToPlay,
  });
  // Wide screens: the video joins after the page has loaded (poster first), and
  // only while the hero is within a viewport of the screen.
  // Narrow screens: only once she taps.
  const showVideo = tappedToPlay ? active : !waitsForTap && afterLoad && nearView && (active || prefetch);

  const bindVideo = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (!el) return;
    armInlineMuted(el);
  }, []);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const width = window.matchMedia(HERO_TAP_TO_PLAY_QUERY);
    const sync = () => {
      setReducedMotion(motion.matches);
      setNarrow(width.matches);
    };
    sync();
    motion.addEventListener("change", sync);
    width.addEventListener("change", sync);
    setSaveData(connectionSaveData());
    return () => {
      motion.removeEventListener("change", sync);
      width.removeEventListener("change", sync);
    };
  }, []);

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
    const video = videoRef.current;
    if (!video || item.type !== "video" || !showVideo) return;
    armInlineMuted(video);

    // iPhone Safari treats a scripted play() as a failed gesture and then will
    // not autoplay that same element. Leave muted autoplay to the attributes.
    if (ios) {
      let canPlayTimer = 0;
      const onCanPlay = () => {
        canPlayTimer = window.setTimeout(() => {
          if (video.paused) setNeedsTap(true);
        }, 800);
      };
      video.addEventListener("canplay", onCanPlay);
      return () => {
        video.removeEventListener("canplay", onCanPlay);
        window.clearTimeout(canPlayTimer);
      };
    }

    if (!wantAutoplay) {
      video.pause();
      return;
    }
    void video.play().catch(() => setNeedsTap(true));
    return () => {
      video.pause();
    };
  }, [showVideo, wantAutoplay, item.type, item.url, ios]);

  const poster = item.poster?.trim() || undefined;

  if (item.type === "video") {
    const play = () => {
      setTappedToPlay(true);
      setNeedsTap(false);
      const video = videoRef.current;
      if (video) {
        armInlineMuted(video);
        void video.play().catch(() => setNeedsTap(true));
      }
    };
    const offerPlay = needsTap || (waitsForTap && !tappedToPlay);
    return (
      <div className="absolute inset-0">
        {poster ? (
          <Image
            src={optimizeImageUrl(poster, 1600)}
            alt={item.alt ?? ""}
            fill
            priority={priority}
            sizes={sizes}
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-choc" aria-hidden />
        )}
        {showVideo ? (
          <video
            ref={bindVideo}
            src={heroVideoSrc(item, narrow)}
            poster={poster}
            muted
            playsInline
            loop
            autoPlay
            preload="none"
            disableRemotePlayback
            disablePictureInPicture
            controls={false}
            onPlaying={() => setNeedsTap(false)}
            onError={() => setNeedsTap(true)}
            className="absolute inset-0 h-full w-full object-cover"
            {...{ "webkit-playsinline": "true" }}
          />
        ) : null}
        {offerPlay && active ? (
          <button
            type="button"
            onClick={play}
            onTouchEnd={(event) => {
              event.preventDefault();
              event.stopPropagation();
              play();
            }}
            aria-label="Play the film"
            className="absolute inset-0 z-[1]"
          >
            <span className="absolute right-5 top-[calc(env(safe-area-inset-top)+5.5rem)] inline-flex items-center gap-2 rounded-full bg-choc/55 px-4 py-2 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-cream backdrop-blur-sm">
              <span aria-hidden>▶</span> Play film
            </span>
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <Image
      src={optimizeImageUrl(item.url, 1600)}
      alt={item.alt ?? ""}
      fill
      priority={priority}
      sizes={sizes}
      className="object-cover"
    />
  );
}

function LookFrame({
  look,
  priority,
  className,
  sizes = SIDE_SIZES,
}: {
  look: RTWHeroLook;
  priority?: boolean;
  className?: string;
  sizes?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-[26px]", className)}>
      <Image
        src={optimizeImageUrl(look.url, 1200)}
        alt={look.alt}
        fill
        priority={priority}
        sizes={sizes}
        className="object-cover object-top"
      />
    </div>
  );
}

function FeaturedFrame({
  items,
  looks,
  index,
  onIndex,
  bleed = false,
}: {
  items: HeroCarouselItem[];
  looks: RTWHeroLook[];
  index: number;
  onIndex: (n: number) => void;
  bleed?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);
  const [nearView, setNearView] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  const featuredLook = looks[0];

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const near = new IntersectionObserver(
      (entries) => setNearView(entries.some((e) => e.isIntersecting)),
      { rootMargin: "50% 0px", threshold: 0 },
    );
    const view = new IntersectionObserver(
      (entries) => setInView(entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.2)),
      { threshold: [0, 0.2, 0.5] },
    );
    near.observe(el);
    view.observe(el);
    return () => {
      near.disconnect();
      view.disconnect();
    };
  }, []);

  useEffect(() => {
    const sync = () => setPageVisible(document.visibilityState === "visible");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  if (items.length === 0 && !featuredLook) return null;

  return (
    <div ref={rootRef} className={cn("absolute inset-0 overflow-hidden rounded-none", !bleed && "lg:rounded-[26px]")}>
      {items.length > 0
        ? items.map((item, i) => (
            <div
              key={`${item.type}-${item.url}-${i}`}
              className="absolute inset-0 transition-opacity duration-500 ease-out"
              style={{ opacity: i === index ? 1 : 0 }}
              aria-hidden={i !== index}
            >
              <HeroSlide
                item={item}
                active={i === index}
                inView={inView}
                nearView={nearView}
                pageVisible={pageVisible}
                priority={i === 0}
                sizes={FEATURED_SIZES}
              />
            </div>
          ))
        : featuredLook
          ? (
              <LookFrame
                look={featuredLook}
                priority
                className={cn("absolute inset-0 rounded-none", !bleed && "lg:rounded-[26px]")}
                sizes={FEATURED_SIZES}
              />
            )
          : null}
      {items.length > 1 ? (
        <div className="absolute bottom-4 left-1/2 z-[1] flex -translate-x-1/2 gap-2">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Show slide ${i + 1}`}
              aria-current={i === index ? "true" : undefined}
              onClick={() => onIndex(i)}
              className={`h-1.5 rounded-full transition-all duration-200 ease-out ${
                i === index ? "w-6 bg-ivory-deep" : "w-1.5 bg-ivory-deep/40"
              }`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function LookWall({
  looks,
  sideLooks,
  featuredItems,
  featuredIndex,
  onFeaturedIndex,
  bleed = false,
}: {
  looks: RTWHeroLook[];
  sideLooks: RTWHeroLook[];
  featuredItems: HeroCarouselItem[];
  featuredIndex: number;
  onFeaturedIndex: (n: number) => void;
  bleed?: boolean;
}) {
  const campaign = featuredItems.length > 0;
  if (bleed) {
    if (!campaign && !looks[0]) return null;
    return (
      <div className="absolute inset-0">
        <FeaturedFrame items={featuredItems} looks={looks} index={featuredIndex} onIndex={onFeaturedIndex} bleed />
      </div>
    );
  }
  const featuredLook = looks[0];
  const sides = sideLooks.length
    ? sideLooks.slice(0, 2)
    : campaign
      ? looks.slice(0, 2)
      : looks.slice(1, 3);
  const b = sides[0];
  const c = sides[1];
  const hasFeatured = campaign || Boolean(featuredLook);
  if (!hasFeatured) return null;

  return (
    <div
      className={cn(
        "absolute inset-0 min-h-0 lg:left-[40%] lg:grid lg:gap-4 lg:p-5 lg:pr-8",
        c
          ? "lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.85fr)] lg:grid-rows-2"
          : b
            ? "lg:grid-cols-2"
            : "lg:grid-cols-1",
      )}
    >
      <div className={cn("relative h-full min-h-0", Boolean(c) && "lg:row-span-2")}>
        <FeaturedFrame
          items={featuredItems}
          looks={looks}
          index={featuredIndex}
          onIndex={onFeaturedIndex}
        />
      </div>
      {b ? (
        <div className="relative hidden min-h-0 lg:block">
          <LookFrame look={b} className="absolute inset-0" />
        </div>
      ) : null}
      {c ? (
        <div className="relative hidden min-h-0 lg:block">
          <LookFrame look={c} className="absolute inset-0" />
        </div>
      ) : null}
    </div>
  );
}

export function RTWLandingHero({
  items,
  looks = [],
  sideLooks = [],
  headline,
  subline,
  ctaLabel,
  ctaHref,
  bleed = false,
}: {
  items: HeroCarouselItem[];
  looks?: RTWHeroLook[];
  sideLooks?: RTWHeroLook[];
  headline: string;
  subline: string;
  ctaLabel: string;
  /** A page of its own (/atelier → /consultation). Without it the CTA scrolls to the /rtw grid. */
  ctaHref?: string;
  /**
   * One photograph edge to edge at every width, the copy on its glass panel over
   * it (BB2: /atelier). Without it, wide screens get the /rtw look wall.
   */
  bleed?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const count = items.length;
  const hasCampaign = count > 0;
  const hasStage = hasCampaign || looks.length > 0 || sideLooks.length > 0;
  const active = hasCampaign ? items[Math.min(index, count - 1)]! : null;

  const go = useCallback(
    (next: number) => {
      if (count < 2) return;
      setIndex((next + count) % count);
    },
    [count],
  );

  useEffect(() => {
    if (count < 2) return;
    const current = items[index];
    if (current?.type === "video") return;
    const id = window.setTimeout(() => go(index + 1), IMAGE_ADVANCE_MS);
    return () => window.clearTimeout(id);
  }, [count, go, index, items]);

  return (
    <section className="hero-under-chrome hero-bleed-chrome relative flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-choc">
      <div
        className={cn(
          "relative min-h-0 flex-1",
          bleed ? "absolute inset-0" : "pt-3 max-lg:absolute max-lg:inset-0 max-lg:pt-0",
        )}
      >
        {hasStage ? (
          <LookWall
            bleed={bleed}
            looks={looks}
            sideLooks={sideLooks}
            featuredItems={items}
            featuredIndex={index}
            onFeaturedIndex={setIndex}
          />
        ) : null}

        {bleed && hasStage ? (
          <div
            className="pointer-events-none absolute inset-0 z-[1] hidden lg:block"
            style={{
              background:
                "linear-gradient(to right, rgb(26 15 8 / 0.5) 0%, rgb(26 15 8 / 0.2) 38%, transparent 62%)",
            }}
            aria-hidden
          />
        ) : null}
        <div
          className={cn("pointer-events-none absolute inset-0 z-[1]", hasStage && "lg:hidden")}
          style={{
            background: hasStage
              ? "linear-gradient(to top, rgb(26 15 8 / 0.62) 0%, rgb(26 15 8 / 0.18) 46%, transparent 72%)"
              : "none",
          }}
          aria-hidden
        />

        <div
          className={cn(
            "absolute z-[2] flex",
            bleed && hasStage
              ? "inset-x-0 bottom-0 items-end px-5 pb-10 md:px-10 md:pb-14 lg:inset-y-0 lg:right-auto lg:w-[46%] lg:items-center lg:pl-16 lg:pr-0 lg:pb-0"
              : hasStage
              ? "inset-x-0 bottom-0 items-end px-5 pb-10 md:px-10 md:pb-14 lg:inset-y-0 lg:right-auto lg:w-[40%] lg:items-center lg:px-10 lg:pb-0"
              : "inset-x-0 bottom-0 items-end px-5 pb-10 md:px-10 md:pb-14 lg:inset-y-0 lg:items-center lg:pb-0",
          )}
        >
          <div className={cn("relative w-full", hasStage ? "max-w-md lg:max-w-none" : "mx-auto max-w-site")}>
            <div className={cn("relative", hasStage ? "lg:max-w-[26rem]" : "max-w-xl")}>
              <div className="hero-copy-scrim" aria-hidden />
              <div className="glass-1 glass-panel hero-copy-panel px-6 py-8 md:px-8 md:py-10">
                <h1 className="text-balance font-display text-[clamp(2.15rem,4.2vw,3.75rem)] font-normal italic leading-[1.08] text-choc">
                  {headline}
                </h1>
                <p className="mt-5 max-w-sm font-body text-sm font-light leading-relaxed text-text-mid">{subline}</p>
                {ctaHref ? (
                  <Link href={ctaHref} className="btn-primary mt-8 inline-flex active:scale-[0.97]">
                    {ctaLabel}
                  </Link>
                ) : (
                  <a
                    href={`#${RTW_GRID_ID}`}
                    className="btn-primary mt-8 inline-flex active:scale-[0.97]"
                    onClick={(e) => {
                      e.preventDefault();
                      const lenisOn = document.documentElement.classList.contains("lenis");
                      document
                        .getElementById(RTW_GRID_ID)
                        ?.scrollIntoView({ behavior: lenisOn ? "auto" : "smooth", block: "start" });
                    }}
                  >
                    {ctaLabel}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {active ? <span className="sr-only">{active.alt}</span> : null}
    </section>
  );
}
