"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Swiper, SwiperSlide } from "swiper/react";
import { FreeMode } from "swiper/modules";
import "swiper/css";
import "swiper/css/free-mode";
import { cn } from "@/lib/utils";
import { PRODUCT_IMAGE_PLACEHOLDER } from "@/lib/product-image-url";

export interface GalleryImage {
  id: string;
  url: string;
  alt: string | null;
}

export function ProductGallery({ images }: { images: GalleryImage[] }) {
  const display: GalleryImage[] =
    images.length > 0
      ? images
      : [{ id: "placeholder", url: PRODUCT_IMAGE_PLACEHOLDER, alt: "Prudent Gabriel" }];
  const [idx, setIdx] = useState(0);
  const main = display[idx] ?? display[0];

  return (
    <div>
      <div className="relative aspect-[3/4] overflow-hidden bg-ivory-dark">
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
              <Image
                src={main.url}
                alt={main.alt ?? ""}
                fill
                className="object-cover object-top transition-transform duration-500 group-hover:scale-[1.08]"
                sizes="(max-width: 1024px) 100vw, 55vw"
                priority={idx === 0}
              />
            )}
          </motion.div>
        </AnimatePresence>
        <div className="absolute bottom-3 right-3 rounded-sm bg-charcoal/70 px-2 py-1 font-label text-[10px] text-ivory">
          {idx + 1} / {display.length}
        </div>
      </div>

      <div className="mt-3 hidden md:block">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {display.map((im, i) => (
            <button
              key={im.id}
              type="button"
              onClick={() => setIdx(i)}
              className={cn(
                "relative h-24 w-[72px] shrink-0 overflow-hidden rounded-sm ring-2 ring-offset-2 ring-offset-cream",
                i === idx ? "ring-wine" : "ring-transparent hover:ring-border",
              )}
            >
              <Image src={im.url} alt="" fill className="object-cover object-top" sizes="72px" />
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 md:hidden">
        <Swiper modules={[FreeMode]} spaceBetween={8} slidesPerView="auto" freeMode>
          {display.map((im, i) => (
            <SwiperSlide key={im.id} style={{ width: 72 }}>
              <button
                type="button"
                onClick={() => setIdx(i)}
                className={cn(
                  "relative block h-24 w-[72px] overflow-hidden rounded-sm ring-2 ring-offset-2 ring-offset-cream",
                  i === idx ? "ring-wine" : "ring-transparent",
                )}
              >
                <Image src={im.url} alt="" fill className="object-cover object-top" sizes="72px" />
              </button>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </div>
  );
}
