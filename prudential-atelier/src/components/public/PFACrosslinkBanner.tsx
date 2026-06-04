"use client";

import { motion } from "framer-motion";

export function PFACrosslinkBanner() {
  return (
    <section className="bg-wine px-6 py-14 lg:px-20 lg:py-[56px]">
      <motion.div
        className="mx-auto flex max-w-site flex-col items-start justify-between gap-8 lg:flex-row lg:items-center"
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        viewport={{ once: true, margin: "-80px" }}
      >
        <div className="max-w-xl">
          <p className="font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-sand">
            Prudential Fashion Academy
          </p>
          <h2 className="mt-3 font-serif text-[36px] font-medium leading-tight text-cream">
            Learn the craft from the house
          </h2>
          <p className="mt-4 font-sans text-[13px] font-light leading-relaxed text-sand">
            Pattern-cutting, beading and bridal couture — taught in the Lagos atelier.
          </p>
        </div>
        <a
          href="https://pfacademy.ng"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center justify-center border border-gold px-7 py-[14px] font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-gold transition-colors hover:bg-gold/10"
          style={{ borderRadius: "2px" }}
        >
          Discover PFA →
        </a>
      </motion.div>
    </section>
  );
}
