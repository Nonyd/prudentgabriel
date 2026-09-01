"use client";

import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, EffectFade, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/effect-fade";
import "swiper/css/pagination";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
import type { Swiper as SwiperType } from "swiper";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { StarRating } from "@/components/ui/StarRating";

const DATA = [
  {
    quote: "The gown arrived in London looking better than the sitting. Packaging, finish, fit.",
    name: "Ngozi O.",
    occasion: "London",
  },
  {
    quote: "Mrs. Gabriel-Okopi understood the brief on the first visit. Guests asked who made it.",
    name: "Amara O.",
    occasion: "Bride, Lagos 2024",
  },
  {
    quote: "Sharper than anything I have had made abroad. I wore it to a board meeting in Abuja.",
    name: "Chidinma E.",
    occasion: "Abuja",
  },
  {
    quote: "From consultation to delivery, the studio kept every date they named.",
    name: "Temi A.",
    occasion: "Bespoke, Lagos",
  },
];

export function Testimonials() {
  const swiperRef = useRef<SwiperType | null>(null);
  return (
    <section className="bg-off-white py-section-mobile md:py-section">
      <div className="mx-auto max-w-site px-4 text-center">
        <SectionLabel>Clients</SectionLabel>
        <h2 className="mt-4 font-display text-4xl font-normal italic text-charcoal md:text-5xl">From the fitting room</h2>
      </div>
      <div className="relative mx-auto mt-12 max-w-3xl px-4">
        <button
          type="button"
          className="absolute left-0 top-1/2 z-10 hidden -translate-y-1/2 border border-olive p-2 text-olive md:block"
          aria-label="Previous"
          onClick={() => swiperRef.current?.slidePrev()}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 border border-olive p-2 text-olive md:block"
          aria-label="Next"
          onClick={() => swiperRef.current?.slideNext()}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <Swiper
          modules={[Autoplay, EffectFade, Pagination]}
          effect="fade"
          loop
          autoplay={{ delay: 5000, disableOnInteraction: false }}
          pagination={{ clickable: true }}
          onSwiper={(s) => {
            swiperRef.current = s;
          }}
          className="pb-10"
        >
          {DATA.map((t) => (
            <SwiperSlide key={t.name}>
              <div className="relative px-4 pb-8 pt-8 text-center md:px-12">
                <p className="relative z-10 font-display text-xl italic text-charcoal md:text-2xl">{t.quote}</p>
                <p className="mt-6 font-body text-sm font-medium text-charcoal">{t.name}</p>
                <p className="mt-1 font-body text-xs text-olive">{t.occasion}</p>
                <div className="mt-3 flex justify-center">
                  <StarRating rating={5} size="sm" />
                </div>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
}
