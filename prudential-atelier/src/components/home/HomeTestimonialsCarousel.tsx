"use client";

import Image from "next/image";
import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, EffectFade, Navigation, Pagination } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import "swiper/css";
import "swiper/css/effect-fade";
import "swiper/css/pagination";
import { formatLoyaltyTier, type HomepageTestimonial } from "@/lib/testimonials";
import { getInitials } from "@/lib/utils";
import { cn } from "@/lib/utils";

function GoldStars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5 text-[14px]" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= rating ? "text-[#C9A84C]" : "text-sand"}>
          ★
        </span>
      ))}
    </div>
  );
}

function ClientPhoto({ item }: { item: HomepageTestimonial }) {
  if (item.imageUrl) {
    return (
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-sand md:absolute md:inset-0 md:aspect-auto md:h-full">
        <Image
          src={item.imageUrl}
          alt={item.userName}
          fill
          className="object-cover object-top"
          sizes="(max-width: 768px) 100vw, 480px"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-choc/30 via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:via-transparent md:to-white/10" />
      </div>
    );
  }

  return (
    <div className="flex aspect-[4/5] w-full items-center justify-center bg-gradient-to-br from-lightbr to-choc md:absolute md:inset-0 md:aspect-auto md:h-full">
      <span className="font-display text-5xl text-white/90">{getInitials(item.userName)}</span>
    </div>
  );
}

function TestimonialSlide({ item }: { item: HomepageTestimonial }) {
  const tier = formatLoyaltyTier(item.loyaltyTier);
  const subtitle = [tier, item.productName].filter(Boolean).join(" · ");

  return (
    <div className="grid overflow-hidden rounded-md border border-sand bg-white shadow-sm md:min-h-[440px] md:grid-cols-[42%_58%]">
      <ClientPhoto item={item} />
      <div className="relative flex flex-col justify-center px-6 py-8 md:px-10 md:py-12 lg:px-14">
        <span
          className="pointer-events-none absolute right-6 top-4 font-display text-[72px] leading-none text-sand md:right-10 md:top-6 md:text-[96px]"
          aria-hidden
        >
          &rdquo;
        </span>
        <GoldStars rating={item.rating} />
        <blockquote className="relative z-10 mt-5">
          <p className="font-display text-xl italic leading-[1.7] text-choc md:text-2xl">{item.body ?? ""}</p>
        </blockquote>
        <footer className="relative z-10 mt-8 border-t border-sand/80 pt-6">
          <p className="font-label text-sm font-medium text-choc">{item.userName}</p>
          {subtitle ? <p className="mt-1 font-body text-xs italic text-text-light">{subtitle}</p> : null}
        </footer>
      </div>
    </div>
  );
}

type HomeTestimonialsCarouselProps = {
  items: HomepageTestimonial[];
  heading: string;
  subtitle?: string;
};

export function HomeTestimonialsCarousel({ items, heading, subtitle }: HomeTestimonialsCarouselProps) {
  const swiperRef = useRef<SwiperType | null>(null);

  if (items.length === 0) return null;

  const single = items.length === 1;

  return (
    <section className="bg-ivory py-16 md:py-20">
      <div className="mx-auto max-w-site px-4">
        <p className="text-center font-label text-[10px] uppercase tracking-[0.2em] text-lightbr">Client Words</p>
        <h2 className="mt-3 text-center font-display text-3xl leading-tight text-choc md:text-[42px]">{heading}</h2>
        {subtitle ? (
          <p className="mx-auto mt-3 max-w-xl text-center font-body text-sm text-text-light">{subtitle}</p>
        ) : null}

        <div className="relative mx-auto mt-10 max-w-5xl md:mt-12">
          {!single ? (
            <>
              <button
                type="button"
                className="absolute -left-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-sand bg-white/95 p-2.5 text-choc shadow-sm transition hover:border-olive hover:text-olive md:-left-5 lg:flex"
                aria-label="Previous testimonial"
                onClick={() => swiperRef.current?.slidePrev()}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="absolute -right-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-sand bg-white/95 p-2.5 text-choc shadow-sm transition hover:border-olive hover:text-olive md:-right-5 lg:flex"
                aria-label="Next testimonial"
                onClick={() => swiperRef.current?.slideNext()}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          ) : null}

          <Swiper
            modules={[Autoplay, EffectFade, Pagination, Navigation]}
            effect="fade"
            fadeEffect={{ crossFade: true }}
            loop={!single}
            autoplay={single ? false : { delay: 6500, disableOnInteraction: false, pauseOnMouseEnter: true }}
            pagination={{ clickable: true, dynamicBullets: true }}
            onSwiper={(s) => {
              swiperRef.current = s;
            }}
            className={cn("home-testimonials-swiper pb-12", single && "pb-0")}
          >
            {items.map((item) => (
              <SwiperSlide key={item.id}>
                <TestimonialSlide item={item} />
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      </div>
    </section>
  );
}
