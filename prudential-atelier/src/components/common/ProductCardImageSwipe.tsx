"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { optimizeProductCardImageUrl } from "@/lib/product-image-url";
import {
  GALLERY_NUDGE_MS,
  galleryNudgeOffset,
  gallerySwipeAlt,
  isQuickAddPlusHit,
  shouldShowGalleryDots,
  shouldSuppressCardNavigation,
  type GalleryShot,
} from "@/lib/product-gallery";
import { markGallerySwipeUsed } from "@/lib/gallery-swipe-session";
import { ImagePlaceholder } from "@/components/ui/ImagePlaceholder";

type ProductCardImageSwipeProps = {
  href: string;
  productName: string;
  images: GalleryShot[];
  priority?: boolean;
  enableQuickAddHit?: boolean;
  onQuickAdd: () => void;
};

export function ProductCardImageSwipe({
  href,
  productName,
  images,
  priority,
  enableQuickAddHit,
  onQuickAdd,
}: ProductCardImageSwipeProps) {
  const router = useRouter();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const gesture = useRef({ x: 0, y: 0, scroll: 0 });
  const nudging = useRef(false);
  const [index, setIndex] = useState(0);
  const [loadRest, setLoadRest] = useState(false);
  const showDots = shouldShowGalleryDots(images.length);

  const revealRest = useCallback(() => setLoadRest(true), []);

  const playNudge = useCallback(() => {
    const el = scrollerRef.current;
    if (!el || nudging.current) return;
    revealRest();
    const width = el.clientWidth;
    if (!width) return;
    nudging.current = true;
    const started = performance.now();
    const tick = (now: number) => {
      if (!nudging.current) return;
      const t = Math.min(1, (now - started) / GALLERY_NUDGE_MS);
      el.scrollLeft = galleryNudgeOffset(t, width);
      if (t < 1) {
        requestAnimationFrame(tick);
        return;
      }
      el.scrollLeft = 0;
      nudging.current = false;
    };
    requestAnimationFrame(tick);
  }, [revealRest]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onNudge = () => playNudge();
    el.addEventListener("gallery-nudge", onNudge);
    return () => el.removeEventListener("gallery-nudge", onNudge);
  }, [playNudge]);

  const syncIndex = useCallback(() => {
    const el = scrollerRef.current;
    if (!el || !el.clientWidth) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  }, []);

  const goTo = useCallback(
    (next: number) => {
      const el = scrollerRef.current;
      if (!el) return;
      const clamped = Math.max(0, Math.min(images.length - 1, next));
      revealRest();
      const reduce =
        typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollTo({ left: clamped * el.clientWidth, behavior: reduce ? "auto" : "smooth" });
      setIndex(clamped);
    },
    [images.length, revealRest],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      goTo(index + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      goTo(index - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      router.push(href);
    }
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    revealRest();
    if (nudging.current) {
      nudging.current = false;
      if (scrollerRef.current) scrollerRef.current.scrollLeft = 0;
    }
    gesture.current = {
      x: e.clientX,
      y: e.clientY,
      scroll: scrollerRef.current?.scrollLeft ?? 0,
    };
  };

  const onScrollerScroll = () => {
    if (!nudging.current) {
      const left = scrollerRef.current?.scrollLeft ?? 0;
      if (left > 4) markGallerySwipeUsed();
    }
    syncIndex();
  };

  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const el = scrollerRef.current;
    const dx = e.clientX - gesture.current.x;
    const dy = e.clientY - gesture.current.y;
    const scrollDelta = (el?.scrollLeft ?? 0) - gesture.current.scroll;
    if (shouldSuppressCardNavigation(dx, dy, scrollDelta)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (enableQuickAddHit && el && isQuickAddPlusHit(e.clientX, e.clientY, el.getBoundingClientRect())) {
      e.preventDefault();
      e.stopPropagation();
      onQuickAdd();
      return;
    }
    router.push(href);
  };

  const first = images[0];
  const hasFirst = Boolean(first?.url?.trim());

  return (
    <>
      <div
        ref={scrollerRef}
        className="card-images"
        data-gallery-swipe="true"
        role="region"
        aria-roledescription="carousel"
        aria-label={`${productName} images`}
        tabIndex={0}
        onFocus={revealRest}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onScroll={onScrollerScroll}
        onClick={onClick}
      >
        {images.map((img, i) => {
          const show = i === 0 || loadRest;
          const src = img.url?.trim() ? optimizeProductCardImageUrl(img.url) : "";
          return (
            <div key={`${src}-${i}`} className="card-image-slide">
              {show && src ? (
                <Image
                  src={src}
                  alt={gallerySwipeAlt(productName, i, images.length)}
                  fill
                  sizes="(max-width: 767px) 50vw, 25vw"
                  className="object-cover object-top"
                  priority={priority && i === 0}
                  draggable={false}
                />
              ) : i === 0 && !hasFirst ? (
                <ImagePlaceholder className="absolute inset-0 h-full w-full" />
              ) : null}
            </div>
          );
        })}
      </div>
      {showDots ? (
        <div className="card-image-dots" role="group" aria-label={`${productName} image position`}>
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`View image ${i + 1} of ${images.length}`}
              aria-current={i === index ? "true" : undefined}
              className={cn("card-image-dot", i === index && "card-image-dot-active")}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                goTo(i);
              }}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}
