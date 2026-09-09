"use client";

import { useCallback, useEffect, useRef } from "react";
import { galleryPlaybackUrl, isGalleryVideoUrl } from "@/lib/gallery-media";
import { isIosDevice } from "@/lib/hero-playback";
import { optimizeImageUrl } from "@/lib/utils";

function armInlineMuted(video: HTMLVideoElement) {
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "true");
  video.setAttribute("webkit-playsinline", "true");
  video.setAttribute("muted", "");
}

function GalleryVideo({ url, alt }: { url: string; alt: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const bind = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (!el) return;
    armInlineMuted(el);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    armInlineMuted(video);
    const ios = isIosDevice();
    const view = new IntersectionObserver(
      (entries) => {
        const on = entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.2);
        if (ios) return;
        if (on) void video.play().catch(() => undefined);
        else video.pause();
      },
      { threshold: [0, 0.2, 0.5] },
    );
    view.observe(video);
    return () => view.disconnect();
  }, [url]);

  return (
    <video
      ref={bind}
      src={galleryPlaybackUrl(url)}
      muted
      loop
      playsInline
      autoPlay
      preload="metadata"
      disablePictureInPicture
      controls={false}
      className="block h-full w-full object-cover"
      aria-label={alt}
      {...{ "webkit-playsinline": "true" }}
    />
  );
}

export function GalleryFrame({
  url,
  alt,
  width = 800,
  fill = false,
}: {
  url: string;
  alt: string;
  width?: number;
  fill?: boolean;
}) {
  if (isGalleryVideoUrl(url)) {
    return (
      <div className={fill ? "absolute inset-0 overflow-hidden bg-choc" : "aspect-[3/4] w-full overflow-hidden bg-choc"}>
        <GalleryVideo url={url} alt={alt} />
      </div>
    );
  }
  return (
    <img
      src={optimizeImageUrl(url, width)}
      alt={alt}
      className={
        fill
          ? "absolute inset-0 h-full w-full object-cover object-top"
          : "block h-full w-full object-cover object-top"
      }
      loading={fill ? "eager" : "lazy"}
    />
  );
}
