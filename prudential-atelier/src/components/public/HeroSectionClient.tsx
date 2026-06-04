"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

const DEFAULT_HERO =
  "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=1200&q=85";

export function HeroSectionClient({ heroImage = DEFAULT_HERO }: { heroImage?: string }) {
  return (
    <section className="relative grid min-h-[100svh] bg-choc lg:grid-cols-2">
      <motion.div
        className="flex flex-col justify-center px-6 py-16 lg:py-0 lg:pl-[140px] lg:pr-12"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        viewport={{ once: true, margin: "-80px" }}
      >
        <p className="font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-lightbr">
          SPRING / SUMMER 2026 · THE ATELIER
        </p>
        <h1 className="mt-6 font-serif text-[clamp(3rem,7vw,5.5rem)] font-normal italic leading-none text-cream">
          Couture, considered.
        </h1>
        <p className="mt-6 max-w-[380px] font-sans text-sm font-light leading-[1.8] text-sand">
          Bespoke and ready-to-wear, made in the Prudential Atelier for the moments you&apos;ll
          remember.
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/shop"
            className="inline-flex items-center justify-center bg-lightbr px-7 py-[14px] font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:bg-nut"
            style={{ borderRadius: "2px" }}
          >
            Explore the Collection
          </Link>
          <Link
            href="/bespoke"
            className="inline-flex items-center justify-center border border-lightbr bg-transparent px-7 py-[14px] font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-cream transition-colors hover:border-cream hover:text-cream"
            style={{ borderRadius: "2px" }}
          >
            Begin a Commission →
          </Link>
        </div>
      </motion.div>

      <motion.div
        className="relative min-h-[50vh] lg:min-h-[100svh]"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        viewport={{ once: true, margin: "-80px" }}
      >
        <Image
          src={heroImage || DEFAULT_HERO}
          alt="Prudential Atelier couture"
          fill
          className="object-cover object-top"
          sizes="(max-width: 1024px) 100vw, 50vw"
          priority
        />
      </motion.div>
    </section>
  );
}
