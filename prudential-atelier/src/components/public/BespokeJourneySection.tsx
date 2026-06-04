"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export function BespokeJourneySection() {
  return (
    <section className="grid min-h-[380px] lg:grid-cols-2">
      <motion.div
        className="flex flex-col justify-center px-8 py-16 lg:px-[60px] lg:py-[80px]"
        style={{ backgroundColor: "#442913" }}
        initial={{ opacity: 0, y: 40 }}
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
          The Bespoke Journey
        </p>
        <h2
          className="mt-4 leading-[1.1]"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "44px",
            color: "var(--cream)",
          }}
        >
          Thirteen stages, <span className="italic">one unforgettable piece.</span>
        </h2>
        <p
          className="mt-6 max-w-md leading-[1.85]"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "13px",
            fontWeight: 300,
            color: "var(--sand)",
          }}
        >
          From the first consultation to the final fitting, every commission is documented and
          shared with you at each step.
        </p>
        <Link href="/bespoke" className="btn-ghost-dark mt-10 inline-flex w-fit">
          Begin Your Commission →
        </Link>
      </motion.div>

      <motion.div
        className="min-h-[280px] lg:min-h-full"
        style={{ backgroundColor: "var(--nut)" }}
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
        viewport={{ once: true, margin: "-80px" }}
        aria-hidden
      />
    </section>
  );
}
