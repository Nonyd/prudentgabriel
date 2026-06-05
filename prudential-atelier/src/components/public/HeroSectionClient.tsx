"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { cmsGet } from "@/lib/cms-helpers";

const DEFAULT_HERO =
  "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=1200&q=85";

export function HeroSectionClient({
  heroImage = DEFAULT_HERO,
  cms = {},
}: {
  heroImage?: string;
  cms?: Record<string, string>;
}) {
  const eyebrow = cmsGet(cms, "home_hero_eyebrow", "PRUDENTIAL ATELIER · LAGOS");
  const line1 = cmsGet(cms, "home_hero_headline_1", "Crafted for the");
  const line2 = cmsGet(cms, "home_hero_headline_2", "Woman Who");
  const line3 = cmsGet(cms, "home_hero_headline_3", "Commands the Room");
  const subtext = cmsGet(
    cms,
    "home_hero_subtext",
    "Atelier couture and ready-to-wear — each piece conceived in our Lagos atelier and finished by hand for weddings, galas, and everyday elegance.",
  );
  const btn1Label = cmsGet(cms, "home_hero_button_1_label", "SHOP COLLECTION");
  const btn1Link = cmsGet(cms, "home_hero_button_1_link", "/shop");
  const btn2Label = cmsGet(cms, "home_hero_button_2_label", "BOOK CONSULTATION");
  const btn2Link = cmsGet(cms, "home_hero_button_2_link", "/consultation");
  const statNum = cmsGet(cms, "home_hero_stat_number", "15+");
  const statLabel = cmsGet(cms, "home_hero_stat_label", "YEARS OF COUTURE");

  return (
    <section className="bg-hero-bg text-cream">
      <div className="mx-auto grid max-w-site gap-10 px-6 py-16 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-10 lg:py-24">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          viewport={{ once: true, margin: "-80px" }}
        >
          <p className="eyebrow text-lightbr">{eyebrow}</p>
          <h1 className="mt-4 font-serif text-[clamp(2.5rem,5vw,4.5rem)] font-medium leading-[1.05] text-cream">
            {line1} {line2} {line3}
          </h1>
          <p className="mt-6 max-w-md copy-body text-sm font-light leading-[1.8] text-cream/85">{subtext}</p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href={btn1Link} className="btn-primary">
              {btn1Label}
            </Link>
            <Link href={btn2Link} className="btn-ghost-dark">
              {btn2Label}
            </Link>
          </div>
        </motion.div>

        <motion.div
          className="img-portrait relative overflow-hidden rounded-lg border border-lightbr/30"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          viewport={{ once: true, margin: "-80px" }}
        >
          <Image
            src={heroImage || DEFAULT_HERO}
            alt="Luxury couture gown"
            fill
            className="object-cover object-top"
            sizes="(max-width: 1024px) 100vw, 50vw"
            priority
          />
          <div className="absolute bottom-6 left-6 border border-lightbr/40 bg-choc/90 px-5 py-4 backdrop-blur-sm">
            <p className="font-serif text-2xl font-medium text-cream">{statNum}</p>
            <p className="mt-1 font-sans text-[9px] font-semibold uppercase tracking-[0.14em] text-lightbr">
              {statLabel}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
