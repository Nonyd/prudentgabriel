"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

/** A full-screen view of one image, stepping through its group. */
export function ImageLightbox({
  images,
  index,
  onClose,
  onIndex,
}: {
  images: string[];
  index: number | null;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const open = index != null && images.length > 0;
  const count = images.length;
  const step = useCallback(
    (d: number) => {
      if (index == null || count < 2) return;
      onIndex((index + d + count) % count);
    },
    [count, index, onIndex],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, step]);

  if (!open || typeof document === "undefined") return null;
  const src = images[index];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image"
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/85 p-4 md:p-10"
      onClick={onClose}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- any stored image, private ones included */}
      <img
        src={src}
        alt=""
        data-no-lightbox
        className="max-h-full max-w-full rounded-sm object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center bg-white/10 text-white hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>
      {count > 1 ? (
        <>
          <button
            type="button"
            aria-label="Previous image"
            onClick={(e) => {
              e.stopPropagation();
              step(-1);
            }}
            className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center bg-white/10 text-white hover:bg-white/20"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            aria-label="Next image"
            onClick={(e) => {
              e.stopPropagation();
              step(1);
            }}
            className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center bg-white/10 text-white hover:bg-white/20"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 font-sans text-xs text-white/80">
            {index + 1} / {count}
          </p>
        </>
      ) : null}
      <a
        href={src}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-4 right-4 font-sans text-xs text-white/80 underline"
      >
        Open original
      </a>
    </div>,
    document.body,
  );
}

const MIN_SIZE = 40; // avatars, icons and logos are smaller than this or opt out
const IMAGE_HREF = /\/media\/|\/api\/admin\/media\/|\/api\/media\/signed|\.(png|jpe?g|webp|gif|avif)(\?|$)/i;

/** The full-size address for a clicked thumbnail: its own link to the file, else the image. */
function fullSrc(img: HTMLImageElement): string {
  const a = img.closest("a");
  if (a?.href && IMAGE_HREF.test(a.href)) return a.href;
  return img.currentSrc || img.src;
}

function eligible(img: HTMLImageElement): boolean {
  if (img.closest("[data-no-lightbox], nav, header, aside, [role=dialog]")) return false;
  const r = img.getBoundingClientRect();
  if (r.width < MIN_SIZE || r.height < MIN_SIZE) return false;
  if (!img.complete || img.naturalWidth === 0) return false; // broken: nothing to show
  // A link or button around it has its own job (open a product, pick an image) unless it
  // only points at the file itself, or it says it is a thumbnail.
  const a = img.closest("a");
  if (a && !IMAGE_HREF.test(a.getAttribute("href") ?? "")) return false;
  const b = img.closest("button");
  if (b && !b.hasAttribute("data-lightbox")) return false;
  return true;
}

/**
 * Every content image in the portal opens full-size when clicked. Mounted once
 * in the admin and staff shells; images in the same section step together.
 */
export function PortalImageLightbox() {
  const [images, setImages] = useState<string[]>([]);
  const [index, setIndex] = useState<number | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const target = e.target as Element | null;
      const img = target?.closest?.("img") as HTMLImageElement | null;
      if (!img || !img.closest("main") || !eligible(img)) return;
      e.preventDefault();
      e.stopPropagation();
      const group = img.closest("[data-lightbox-group], section, li, form") ?? img.closest("main")!;
      const imgs = Array.from(group.querySelectorAll("img")).filter(eligible);
      const srcs = Array.from(new Set(imgs.map(fullSrc)));
      const mine = fullSrc(img);
      setImages(srcs.length ? srcs : [mine]);
      setIndex(Math.max(0, srcs.indexOf(mine)));
    };
    // Capture: run before a wrapping link opens a new tab.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent =
      "main img:not([data-no-lightbox]){cursor:zoom-in}main a:not([href*='/media/']):not([href*='/api/admin/media']) img,main button:not([data-lightbox]) img,nav img,header img,aside img{cursor:inherit}";
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  return <ImageLightbox images={images} index={index} onClose={() => setIndex(null)} onIndex={setIndex} />;
}
