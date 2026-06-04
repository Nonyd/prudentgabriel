"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80";

export function BespokeJourneySection({ imageUrl = DEFAULT_IMAGE }: { imageUrl?: string }) {
  return (
    <section className="grid min-h-[400px] lg:grid-cols-2">
      <motion.div
        className="flex flex-col justify-center bg-choc px-8 py-16 lg:px-[60px] lg:py-20"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        viewport={{ once: true, margin: "-80px" }}
      >
        <p className="font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-lightbr">
          The Bespoke Journey
        </p>
        <h2 className="mt-4 font-serif text-[clamp(2rem,4vw,3rem)] font-medium leading-[1.1] text-cream">
          Thirteen stages,{" "}
          <span className="italic">one unforgettable piece.</span>
        </h2>
        <p className="mt-6 max-w-md font-sans text-[13px] font-light leading-[1.85] text-sand">
          From the first consultation to the final fitting, every commission is documented and
          shared with you at each step — sketches, fabrics, beading and all. Follow your outfit as
          it comes to life.
        </p>
        <Link
          href="/bespoke"
          className="mt-10 inline-flex w-fit items-center justify-center border border-cream bg-transparent px-7 py-[14px] font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-cream transition-colors hover:bg-cream/10"
          style={{ borderRadius: "2px" }}
        >
          Begin Your Commission →
        </Link>
      </motion.div>

      <motion.div
        className="relative min-h-[320px] bg-nut lg:min-h-full"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
        viewport={{ once: true, margin: "-80px" }}
      >
        <Image
          src={imageUrl || DEFAULT_IMAGE}
          alt="Bespoke couture process"
          fill
          className="object-cover"
          sizes="(max-width: 1024px) 100vw, 50vw"
        />
      </motion.div>
    </section>
  );
}
