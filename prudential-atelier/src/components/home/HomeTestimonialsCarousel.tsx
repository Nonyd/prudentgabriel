"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Navigation, Pagination } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import "swiper/css";
import "swiper/css/pagination";
import { formatLoyaltyTier, type HomepageTestimonial } from "@/lib/testimonials";
import { getInitials } from "@/lib/utils";
import { cn } from "@/lib/utils";

function chunkPairs(items: HomepageTestimonial[]): HomepageTestimonial[][] {
  const pairs: HomepageTestimonial[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    pairs.push(items.slice(i, i + 2));
  }
  return pairs;
}

function GoldStars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5 text-[13px]" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= rating ? "text-[#C9A84C]" : "text-sand"}>
          ★
        </span>
      ))}
    </div>
  );
}

function ClientPhoto({ item }: { item: HomepageTestimonial }) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(item.imageUrl?.trim()) && !failed;

  if (showImage && item.imageUrl) {
    return (
      <div className="relative h-full min-h-[200px] w-[108px] shrink-0 overflow-hidden bg-sand sm:w-[128px] md:w-[148px]">
        <Image
          src={item.imageUrl}
          alt={item.userName}
          fill
          className="object-cover object-top"
          sizes="148px"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[200px] w-[108px] shrink-0 items-center justify-center bg-gradient-to-br from-lightbr to-choc sm:w-[128px] md:w-[148px]">
      <span className="font-display text-3xl text-white/90 md:text-4xl">{getInitials(item.userName)}</span>
    </div>
  );
}

function TestimonialCard({ item }: { item: HomepageTestimonial }) {
  const tier = formatLoyaltyTier(item.loyaltyTier);
  const subtitle = [tier, item.productName].filter(Boolean).join(" · ");

  return (
    <article className="flex h-full min-h-[200px] overflow-hidden rounded-md border border-sand bg-white shadow-sm">
      <ClientPhoto item={item} />
      <div className="flex min-w-0 flex-1 flex-col justify-center px-4 py-5 sm:px-5 md:py-6">
        <GoldStars rating={item.rating} />
        <blockquote className="mt-3">
          <p className="line-clamp-5 font-display text-[15px] italic leading-[1.65] text-choc md:text-base md:leading-[1.7]">
            &ldquo;{item.body ?? ""}&rdquo;
          </p>
        </blockquote>
        <footer className="mt-4 border-t border-sand/70 pt-3">
          <p className="font-label text-sm font-medium text-choc">{item.userName}</p>
          {subtitle ? <p className="mt-0.5 line-clamp-1 font-body text-xs italic text-text-light">{subtitle}</p> : null}
        </footer>
      </div>
    </article>
  );
}

type HomeTestimonialsCarouselProps = {
  items: HomepageTestimonial[];
  heading: string;
  subtitle?: string;
};

export function HomeTestimonialsCarousel({ items, heading, subtitle }: HomeTestimonialsCarouselProps) {
  const swiperRef = useRef<SwiperType | null>(null);
  const slides = chunkPairs(items);

  if (items.length === 0) return null;

  const singleSlide = slides.length <= 1;

  return (
    <section className="bg-ivory py-16 md:py-20">
      <div className="mx-auto max-w-site px-4 lg:px-6">
        <p className="text-center font-label text-[10px] uppercase tracking-[0.2em] text-lightbr">Client Words</p>
        <h2 className="mt-3 text-center font-display text-3xl leading-tight text-choc md:text-[42px]">{heading}</h2>
        {subtitle ? (
          <p className="mx-auto mt-3 max-w-xl text-center font-body text-sm text-text-light">{subtitle}</p>
        ) : null}

        <div className="relative mx-auto mt-10 md:mt-12">
          {!singleSlide ? (
            <>
              <button
                type="button"
                className="absolute -left-1 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-sand bg-white/95 p-2.5 text-choc shadow-sm transition hover:border-olive hover:text-olive md:-left-4 lg:flex"
                aria-label="Previous testimonials"
                onClick={() => swiperRef.current?.slidePrev()}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="absolute -right-1 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-sand bg-white/95 p-2.5 text-choc shadow-sm transition hover:border-olive hover:text-olive md:-right-4 lg:flex"
                aria-label="Next testimonials"
                onClick={() => swiperRef.current?.slideNext()}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          ) : null}

          <Swiper
            modules={[Autoplay, Pagination, Navigation]}
            loop={slides.length > 1}
            autoplay={
              slides.length > 1 ? { delay: 7000, disableOnInteraction: false, pauseOnMouseEnter: true } : false
            }
            pagination={{ clickable: true, dynamicBullets: slides.length > 3 }}
            onSwiper={(s) => {
              swiperRef.current = s;
            }}
            className={cn("home-testimonials-swiper pb-12", singleSlide && "pb-0")}
          >
            {slides.map((pair, slideIndex) => (
              <SwiperSlide key={`slide-${slideIndex}`}>
                <div
                  className={cn(
                    "grid gap-5 md:gap-6",
                    pair.length === 2 ? "md:grid-cols-2" : "md:grid-cols-1 md:max-w-[calc(50%-12px)] md:mx-auto",
                  )}
                >
                  {pair.map((item) => (
                    <TestimonialCard key={item.id} item={item} />
                  ))}
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      </div>
    </section>
  );
}
