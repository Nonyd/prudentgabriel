"use client";

import { motion } from "framer-motion";

export function BrandQuoteSection() {
  return (
    <section className="px-6 py-[100px] lg:px-10" style={{ backgroundColor: "var(--ivory)" }}>
      <motion.div
        className="mx-auto max-w-[760px] text-center"
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        viewport={{ once: true, margin: "-80px" }}
      >
        <p
          className="uppercase"
          style={{
              fontFamily: "var(--font-ui)",
            fontSize: "10px",
            fontWeight: 500,
            letterSpacing: "0.2em",
            color: "var(--lightbr)",
          }}
        >
          Since the First Stitch
        </p>
        <blockquote
          className="mt-8 italic leading-[1.4]"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "34px",
            color: "var(--choc)",
          }}
        >
          We don&apos;t make clothes. We make the way you&apos;ll be remembered — hand-finished,
          sourced with care, and designed entirely around you.
        </blockquote>
        <p
          className="mt-10 uppercase"
          style={{
              fontFamily: "var(--font-ui)",
            fontSize: "10px",
            letterSpacing: "0.2em",
            color: "var(--lightbr)",
          }}
        >
          Mrs. Prudent Gabriel-Okopi · Founder & Creative Director
        </p>
      </motion.div>
    </section>
  );
}
