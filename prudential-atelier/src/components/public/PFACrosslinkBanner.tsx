"use client";

import { motion } from "framer-motion";

export function PFACrosslinkBanner() {
  return (
    <section className="px-6 py-14 lg:px-20 lg:py-14" style={{ backgroundColor: "#6B1C2A" }}>
      <motion.div
        className="mx-auto flex max-w-site flex-col items-start justify-between gap-8 lg:flex-row lg:items-center"
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        viewport={{ once: true, margin: "-80px" }}
      >
        <div className="max-w-xl">
          <p
            className="uppercase"
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: "10px",
              fontWeight: 500,
              letterSpacing: "0.2em",
              color: "var(--sand)",
            }}
          >
            Prudential Fashion Academy
          </p>
          <h2
            className="mt-3 leading-tight"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "36px",
              color: "var(--cream)",
            }}
          >
            Learn the craft from the house
          </h2>
          <p
            className="mt-4 leading-relaxed"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "13px",
              fontWeight: 300,
              color: "var(--sand)",
            }}
          >
            Pattern-cutting, beading and bridal couture — taught in the Lagos atelier.
          </p>
        </div>
        <a
          href="https://pfacademy.ng"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center justify-center px-7 py-[14px] uppercase transition-colors hover:bg-[#C9A84C]/10"
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "0.16em",
            border: "1px solid #C9A84C",
            color: "#C9A84C",
            borderRadius: "2px",
          }}
        >
          Discover PFA →
        </a>
      </motion.div>
    </section>
  );
}
