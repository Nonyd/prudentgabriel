"use client";

import { motion } from "framer-motion";

export function BrandQuoteSection() {
  return (
    <section className="bg-ivory px-6 py-[100px] lg:px-10">
      <motion.div
        className="mx-auto max-w-[780px] text-center"
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        viewport={{ once: true, margin: "-80px" }}
      >
        <p className="font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-lightbr">
          Since the First Stitch
        </p>
        <blockquote className="mt-8 font-serif text-[clamp(1.75rem,3.5vw,2.25rem)] font-normal italic leading-[1.35] text-choc">
          We don&apos;t make clothes. We make the way you&apos;ll be remembered — hand-finished,
          sourced with care, and designed entirely around you.
        </blockquote>
        <p className="mt-10 font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-lightbr">
          Mrs. Prudent Gabriel-Okopi · Founder & Creative Director
        </p>
      </motion.div>
    </section>
  );
}
