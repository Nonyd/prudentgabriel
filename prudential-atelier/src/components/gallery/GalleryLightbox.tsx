"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface LightboxImage {
  id: string;
  url: string;
  alt?: string | null;
  caption?: string | null;
  width?: number | null;
  height?: number | null;
}

interface LightboxProps {
  images: LightboxImage[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
}

export function GalleryLightbox({ images, initialIndex, isOpen, onClose }: LightboxProps) {
  const maxIndex = images.length - 1;
  const safeInitial = useMemo(() => {
    if (images.length === 0) return 0;
    return Math.min(Math.max(initialIndex, 0), maxIndex);
  }, [images.length, initialIndex, maxIndex]);
  const [index, setIndex] = useState(safeInitial);
  const [direction, setDirection] = useState(1);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setIndex(safeInitial);
    setDirection(1);
  }, [isOpen, safeInitial]);

  const goNext = useCallback(() => {
    if (images.length < 2) return;
    setDirection(1);
    setIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const goPrev = useCallback(() => {
    if (images.length < 2) return;
    setDirection(-1);
    setIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") goPrev();
      if (event.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNext, goPrev, isOpen, onClose]);

  if (!isOpen || images.length === 0) return null;
  const current = images[index];

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] bg-black/95"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        onTouchStart={(event) => setTouchStartX(event.touches[0]?.clientX ?? null)}
        onTouchEnd={(event) => {
          if (touchStartX === null) return;
          const endX = event.changedTouches[0]?.clientX ?? touchStartX;
          const distance = endX - touchStartX;
          setTouchStartX(null);
          if (Math.abs(distance) <= 50) return;
          if (distance < 0) goNext();
          else goPrev();
        }}
      >
        <div className="absolute left-0 right-0 top-0 flex items-center justify-between p-4">
          <p className="font-body text-[12px] text-white/60">
            {index + 1} / {images.length}
          </p>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition-colors duration-150 hover:bg-white/20"
            aria-label="Close lightbox"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex h-full w-full items-center justify-center" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            onClick={goPrev}
            className="absolute left-4 top-1/2 z-[101] flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors duration-150 hover:bg-white/20 md:left-8"
            aria-label="Previous image"
          >
            <ChevronLeft size={28} />
          </button>

          <AnimatePresence mode="wait" initial={false}>
            <motion.img
              key={current.id}
              src={current.url}
              alt={current.alt ?? "Gallery image"}
              className="max-h-[85vh] max-w-[85vw] object-contain"
              initial={{ opacity: 0, x: direction > 0 ? 30 : -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction > 0 ? -30 : 30 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
            />
          </AnimatePresence>

          <button
            type="button"
            onClick={goNext}
            className="absolute right-4 top-1/2 z-[101] flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors duration-150 hover:bg-white/20 md:right-8"
            aria-label="Next image"
          >
            <ChevronRight size={28} />
          </button>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4" onClick={(event) => event.stopPropagation()}>
          {current.caption ? (
            <p className="mb-3 text-center font-body text-[13px] font-light italic text-white/80">{current.caption}</p>
          ) : null}
          <div className="mx-auto flex max-w-[600px] gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {images.map((img, thumbIndex) => (
              <button
                key={img.id}
                type="button"
                className={`h-12 w-12 shrink-0 overflow-hidden ${
                  thumbIndex === index ? "opacity-100 ring-1 ring-white" : "opacity-40 hover:opacity-80"
                }`}
                onClick={() => {
                  setDirection(thumbIndex > index ? 1 : -1);
                  setIndex(thumbIndex);
                }}
                aria-label={`View image ${thumbIndex + 1}`}
              >
                <img src={img.url} alt={img.alt ?? `Thumbnail ${thumbIndex + 1}`} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
