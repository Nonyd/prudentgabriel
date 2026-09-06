"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { PRODUCT_IMAGE_PLACEHOLDER } from "@/lib/product-image-url";
import { shouldShowGalleryDots } from "@/lib/product-gallery";
import { ImagePlaceholder } from "@/components/ui/ImagePlaceholder";

export interface GalleryImage {
  id: string;
  url: string;
  alt: string | null;
}

function GalleryImageTile({
  src,
  alt,
  className,
  sizes,
  priority,
}: {
  src: string;
  alt: string;
  className?: string;
  sizes: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (failed || !src.trim()) {
    return <ImagePlaceholder className={cn("absolute inset-0 h-full w-full", className)} />;
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      className={className}
      sizes={sizes}
      priority={priority}
      onError={() => setFailed(true)}
    />
  );
}

export function ProductGallery({ images }: { images: GalleryImage[] }) {
  const display: GalleryImage[] =
    images.length > 0
      ? images
      : [{ id: "placeholder", url: PRODUCT_IMAGE_PLACEHOLDER, alt: "Prudent Gabriel" }];
  const [idx, setIdx] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const main = display[idx] ?? display[0];
  const showDots = shouldShowGalleryDots(display.length);

  const scrollTo = (i: number) => {
    const el = scrollerRef.current;
    setIdx(i);
    if (!el) return;
    const width = el.clientWidth;
    if (!width) return;
    el.scrollTo({ left: i * width, behavior: "smooth" });
  };

  return (
    <div>
      <div className="md:hidden">
        <div className="relative">
          <div
            ref={scrollerRef}
            className="flex snap-x snap-mandatory overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            onScroll={(e) => {
              const el = e.currentTarget;
              const width = el.clientWidth;
              if (!width) return;
              const next = Math.round(el.scrollLeft / width);
              if (next !== idx) setIdx(Math.max(0, Math.min(display.length - 1, next)));
            }}
          >
            {display.map((im, i) => (
              <div key={im.id} className="img-portrait relative w-full shrink-0 snap-center overflow-hidden bg-ivory-dark">
                <GalleryImageTile
                  src={im.url}
                  alt={im.alt ?? ""}
                  className="object-cover object-top"
                  sizes="100vw"
                  priority={i === 0}
                />
              </div>
            ))}
          </div>
          {showDots ? (
            <div className="card-image-dots" role="group" aria-label="Image position">
              {display.map((im, i) => (
                <button
                  key={im.id}
                  type="button"
                  aria-label={`Image ${i + 1} of ${display.length}`}
                  aria-current={i === idx}
                  className={cn("card-image-dot", i === idx && "card-image-dot-active")}
                  onClick={() => scrollTo(i)}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="hidden md:block">
        <div className="img-portrait relative overflow-hidden bg-ivory-dark">
          <AnimatePresence mode="wait">
            <motion.div
              key={main.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="absolute inset-0 group"
            >
              {main && (
                <GalleryImageTile
                  src={main.url}
                  alt={main.alt ?? ""}
                  className="object-cover object-top transition-transform duration-500 group-hover:scale-[1.08]"
                  sizes="(max-width: 1024px) 100vw, 55vw"
                  priority={idx === 0}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {display.length > 1 ? (
          <div className="mt-3 glass-1 glass-panel p-2">
            <div className="flex gap-2">
              {display.map((im, i) => (
                <button
                  key={im.id}
                  type="button"
                  onClick={() => setIdx(i)}
                  aria-current={i === idx}
                  className={cn(
                    "relative aspect-square w-[72px] shrink-0 overflow-hidden bg-ivory-dark",
                    i === idx ? "border-2 border-choc" : "border border-transparent opacity-80 hover:opacity-100",
                  )}
                >
                  <GalleryImageTile src={im.url} alt="" className="object-cover object-top" sizes="72px" />
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
