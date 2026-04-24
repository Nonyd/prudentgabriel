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
    quote:
      "I wore the Amore Bridal Gown and every single guest could not stop staring. Mrs. Gabriel-Okopi understood my vision completely. This is not just a dress — it is an heirloom.",
    name: "Amara O.",
    occasion: "Bride, Lagos 2024",
  },
  {
    quote:
      "The Lagos Power Suit made me walk into that boardroom and own every second. The tailoring is sharper than anything I have bought abroad. Nigerian excellence at its finest.",
    name: "Chidinma E.",
    occasion: "Corporate Client, Abuja",
  },
  {
    quote:
      "I ordered the Celestial Sequin Gown from London and it arrived better than the photos. The packaging was luxurious, the quality was extraordinary. I will shop nowhere else.",
    name: "Ngozi O.",
    occasion: "Client, London UK",
  },
  {
    quote:
      "From my first consultation to the delivery of my bespoke piece, everything was handled with such professionalism and heart. This brand is the future of Nigerian fashion.",
    name: "Temi A.",
    occasion: "Bespoke Client, Lagos",
  },
];

export function Testimonials() {
  const swiperRef = useRef<SwiperType | null>(null);
  return (
    <section className="bg-off-white py-section-mobile md:py-section">
      <div className="mx-auto max-w-site px-4 text-center">
        <SectionLabel>Client Love</SectionLabel>
        <h2 className="mt-4 font-display text-4xl font-normal italic text-charcoal md:text-5xl">From Our Women</h2>
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
                <span className="pointer-events-none absolute left-4 top-0 font-display text-[120px] leading-none text-olive/15">
                  “
                </span>
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
