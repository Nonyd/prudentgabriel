"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { HeroCarouselItem } from "@/lib/hero-carousel";
import { shouldAutoplayReel, shouldPrefetchReelVideo } from "@/lib/collection-reel-playback";
import { RTW_GRID_ID, rtwHeroPlaybackUrl } from "@/lib/rtw-hero";
import { optimizeImageUrl } from "@/lib/utils";

const IMAGE_ADVANCE_MS = 4500;

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
  priority,
}: {
  item: HeroCarouselItem;
  active: boolean;
  priority: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [saveData, setSaveData] = useState(false);
  const [tappedToPlay, setTappedToPlay] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  const prefetch = shouldPrefetchReelVideo({
    withinOneViewport: active,
    saveData,
    reducedMotion,
  });
  const wantAutoplay = shouldAutoplayReel({
    inView: active,
    saveData,
    reducedMotion,
    tappedToPlay,
  });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    setSaveData(connectionSaveData());
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || item.type !== "video") return;
    armInlineMuted(video);
    if (!prefetch || !wantAutoplay) {
      video.pause();
      return;
    }
    void video.play().catch(() => undefined);
    return () => {
      video.pause();
    };
  }, [prefetch, wantAutoplay, item.type, item.url]);

  const poster = item.poster?.trim() || undefined;

  if (item.type === "video") {
    return (
      <div className="absolute inset-0">
        {poster ? (
          <Image
            src={optimizeImageUrl(poster, 1600)}
            alt={item.alt ?? ""}
            fill
            priority={priority}
            sizes="100vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-choc" aria-hidden />
        )}
        {prefetch ? (
          <video
            ref={videoRef}
            src={rtwHeroPlaybackUrl(item.url)}
            poster={poster}
            muted
            playsInline
            loop
            preload="metadata"
            disablePictureInPicture
            onPlaying={() => setVideoReady(true)}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ opacity: videoReady ? 1 : 0 }}
            {...{ "webkit-playsinline": "true" }}
          />
        ) : null}
        {(reducedMotion || saveData) && !tappedToPlay ? (
          <button
            type="button"
            onClick={() => setTappedToPlay(true)}
            aria-label="Play video"
            className="absolute inset-0 z-[1]"
          />
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
      sizes="100vw"
      className="object-cover"
    />
  );
}

export function RTWLandingHero({
  items,
  headline,
  subline,
  ctaLabel,
}: {
  items: HeroCarouselItem[];
  headline: string;
  subline: string;
  ctaLabel: string;
}) {
  const [index, setIndex] = useState(0);
  const count = items.length;
  const active = count > 0 ? items[Math.min(index, count - 1)]! : null;

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
    <section className="hero-under-chrome relative h-[100dvh] max-h-[100dvh] overflow-hidden bg-choc">
      {items.map((item, i) => (
        <div
          key={`${item.type}-${item.url}-${i}`}
          className="absolute inset-0 transition-opacity duration-500 ease-out"
          style={{ opacity: i === index ? 1 : 0 }}
          aria-hidden={i !== index}
        >
          <HeroSlide item={item} active={i === index} priority={i === 0} />
        </div>
      ))}

      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            "linear-gradient(to top, rgb(26 15 8 / 0.52) 0%, rgb(26 15 8 / 0.12) 42%, transparent 68%)",
        }}
        aria-hidden
      />

      <div className="absolute inset-x-0 bottom-0 z-[2] px-5 pb-10 md:px-10 md:pb-14">
        <div className="relative mx-auto w-full max-w-site">
          <div className="relative max-w-xl">
            <div className="hero-copy-scrim" aria-hidden />
            <div className="glass-1 glass-panel hero-copy-panel px-6 py-7 md:px-8 md:py-8">
              <h1 className="font-display text-[clamp(2rem,6vw,3.5rem)] font-normal italic leading-[1.1] text-choc">
                {headline}
              </h1>
              <p className="mt-4 max-w-md font-body text-sm font-light leading-relaxed text-text-mid">{subline}</p>
              <a href={`#${RTW_GRID_ID}`} className="btn-primary mt-7 inline-flex active:scale-[0.97]">
                {ctaLabel}
              </a>
            </div>
          </div>
        </div>
      </div>

      {count > 1 ? (
        <div className="absolute bottom-6 right-5 z-[3] flex gap-2 md:right-10">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Show slide ${i + 1}`}
              aria-current={i === index ? "true" : undefined}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all duration-200 ease-out ${
                i === index ? "w-6 bg-ivory-deep" : "w-1.5 bg-ivory-deep/40"
              }`}
            />
          ))}
        </div>
      ) : null}

      {active ? <span className="sr-only">{active.alt}</span> : null}
    </section>
  );
}
