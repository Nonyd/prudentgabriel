"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Volume2, VolumeX } from "lucide-react";
import type { CollectionReelRecord } from "@/lib/collection-gallery";
import {
  reelMediaSrc,
  shouldAutoplayReel,
  shouldPrefetchReelVideo,
} from "@/lib/collection-reel-playback";
import { optimizeImageUrl } from "@/lib/utils";

const playingIds = new Set<string>();
const MAX_PLAYING = 2;

function requestPlaySlot(id: string): boolean {
  if (playingIds.has(id)) return true;
  if (playingIds.size >= MAX_PLAYING) return false;
  playingIds.add(id);
  return true;
}

function releasePlaySlot(id: string) {
  playingIds.delete(id);
}

function connectionSaveData(): boolean {
  if (typeof navigator === "undefined") return false;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return Boolean(conn?.saveData);
}

export function CollectionReelCell({
  reel,
  className,
}: {
  reel: CollectionReelRecord;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);
  const [nearView, setNearView] = useState(false);
  const [muted, setMuted] = useState(true);
  const [tappedToPlay, setTappedToPlay] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [saveData, setSaveData] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  const poster = reelMediaSrc(reel.posterKey);
  const videoSrc = reelMediaSrc(reel.videoKey);
  const prefetch = shouldPrefetchReelVideo({
    withinOneViewport: nearView,
    saveData,
    reducedMotion,
  });
  const wantAutoplay = shouldAutoplayReel({
    inView,
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
    const el = rootRef.current;
    if (!el) return;
    const near = new IntersectionObserver(
      (entries) => setNearView(entries.some((e) => e.isIntersecting)),
      { rootMargin: "100% 0px", threshold: 0 },
    );
    const view = new IntersectionObserver(
      (entries) => setInView(entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.25)),
      { threshold: [0, 0.25, 0.5] },
    );
    near.observe(el);
    view.observe(el);
    return () => {
      near.disconnect();
      view.disconnect();
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !prefetch) return;

    const play = () => {
      if (!wantAutoplay) {
        video.pause();
        releasePlaySlot(reel.id);
        return;
      }
      if (!requestPlaySlot(reel.id)) {
        video.pause();
        return;
      }
      video.muted = muted;
      video.playsInline = true;
      void video.play().catch(() => {
        releasePlaySlot(reel.id);
      });
    };

    play();
    return () => {
      video.pause();
      releasePlaySlot(reel.id);
    };
  }, [prefetch, wantAutoplay, muted, reel.id]);

  const onTapSound = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (reducedMotion || saveData) {
        setTappedToPlay(true);
      }
      setMuted((m) => !m);
      const video = videoRef.current;
      if (video) video.muted = !muted;
    },
    [muted, reducedMotion, saveData],
  );

  const onPosterTap = useCallback(() => {
    if (reducedMotion || saveData) {
      setTappedToPlay(true);
      return;
    }
    setMuted((m) => !m);
  }, [reducedMotion, saveData]);

  return (
    <article
      ref={rootRef}
      data-collection-reel={reel.id}
      data-reel-playing={wantAutoplay ? "true" : undefined}
      className={className ?? "relative min-h-0 overflow-hidden bg-ivory-dark"}
    >
      <div className="absolute inset-0">
        {poster ? (
          <Image
            src={optimizeImageUrl(poster, 720)}
            alt={reel.productName ? `${reel.productName} in motion` : "Collection reel"}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, 25vw"
            priority={false}
          />
        ) : null}

        {prefetch ? (
          <video
            ref={videoRef}
            src={videoSrc}
            poster={poster || undefined}
            muted={muted}
            loop
            playsInline
            preload="metadata"
            disablePictureInPicture
            onPlaying={() => setVideoReady(true)}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ opacity: videoReady ? 1 : 0 }}
          />
        ) : null}

        <button
          type="button"
          onClick={onPosterTap}
          className="absolute inset-0 z-[1]"
          aria-label={reel.productName ? `Play ${reel.productName}` : "Play reel"}
        />

        <button
          type="button"
          onClick={onTapSound}
          aria-label={muted ? "Unmute reel" : "Mute reel"}
          className="glass-1 glass-pill absolute bottom-3 right-3 z-[2] flex h-9 w-9 items-center justify-center text-choc"
        >
          {muted ? <VolumeX className="h-3.5 w-3.5" strokeWidth={1.5} /> : <Volume2 className="h-3.5 w-3.5" strokeWidth={1.5} />}
        </button>

        {reel.productSlug && reel.productName ? (
          <Link
            href={`/shop/${reel.productSlug}`}
            className="absolute bottom-3 left-3 z-[2] max-w-[calc(100%-4.5rem)] font-sans text-[12px] font-normal text-ivory-deep"
            style={{ textShadow: "0 1px 10px rgb(0 0 0 / 0.55)" }}
          >
            {reel.productName}
          </Link>
        ) : null}
      </div>
    </article>
  );
}
