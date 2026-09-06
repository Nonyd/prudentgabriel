"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { HeroCarousel } from "@/components/sections/HeroCarousel";
import { cmsGet } from "@/lib/cms-helpers";
import { readyToWearCtaHref } from "@/lib/rtw-aisle";
import type { HeroCarouselItem } from "@/lib/hero-carousel";

export function HeroSectionClient({
  cms = {},
  carouselItems,
}: {
  cms?: Record<string, string>;
  carouselItems: HeroCarouselItem[];
}) {
  const line1 = cmsGet(cms, "home_hero_headline_1", "Crafted for the");
  const line2 = cmsGet(cms, "home_hero_headline_2", "Woman Who");
  const line3 = cmsGet(cms, "home_hero_headline_3", "Commands the Room");
  const subtext = cmsGet(
    cms,
    "home_hero_subtext",
    "Atelier couture and ready-to-wear — each piece conceived in our Lagos atelier and finished by hand for weddings, galas, and everyday elegance.",
  );
  const btn1Label = cmsGet(cms, "home_hero_button_1_label", "SHOP COLLECTION");
  const btn1Link = readyToWearCtaHref(cmsGet(cms, "home_hero_button_1_link", "/rtw"));
  const btn2Label = cmsGet(cms, "home_hero_button_2_label", "BOOK CONSULTATION");
  const btn2Link = cmsGet(cms, "home_hero_button_2_link", "/consultation");
  const statNum = cmsGet(cms, "home_hero_stat_number", "15+");
  const statLabel = cmsGet(cms, "home_hero_stat_label", "YEARS OF COUTURE");

  return (
    <section className="hero-under-chrome">
      <div className="mx-auto grid min-w-0 max-w-site gap-10 px-6 py-16 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-10 lg:py-24">
        <motion.div
          className="relative"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          viewport={{ once: true, margin: "-80px" }}
        >
          <div className="hero-copy-scrim" aria-hidden="true" />
          <div className="glass-1 glass-panel hero-copy-panel px-7 py-8 lg:px-10 lg:py-10">
            <h1 className="font-serif text-[clamp(2.5rem,5vw,4.5rem)] font-medium leading-[1.05] text-choc">
              {line1} {line2} {line3}
            </h1>
            <p className="mt-6 max-w-md font-sans text-sm font-light leading-[1.8] text-text-mid">{subtext}</p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link href={btn1Link} className="btn-primary">
                {btn1Label}
              </Link>
              <Link href={btn2Link} className="btn-ghost-light">
                {btn2Label}
              </Link>
            </div>
            <div className="hero-stat mt-8">
              <span className="stat-number block font-serif text-[36px] text-choc">{statNum}</span>
              <span className="stat-label mt-1 block font-sans text-[13px] font-normal text-text-mid">{statLabel}</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="relative min-h-[520px] w-full min-w-0 overflow-visible md:min-h-[600px]"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          viewport={{ once: true, margin: "-80px" }}
        >
          <HeroCarousel items={carouselItems} />
        </motion.div>
      </div>
    </section>
  );
}
