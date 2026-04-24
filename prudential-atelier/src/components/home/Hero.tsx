"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionLabel } from "@/components/ui/SectionLabel";

const HERO_IMG =
  "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=1400&q=80";

export function Hero() {
  return (
    <section className="relative min-h-[100svh] overflow-hidden">
      <Image
        src={HERO_IMG}
        alt="Prudential Atelier — Luxury Nigerian Fashion"
        fill
        priority
        className="object-cover object-top"
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-charcoal/80 via-charcoal/20 to-transparent" />
      <div className="absolute bottom-[15%] left-1/2 w-full max-w-3xl -translate-x-1/2 px-4 text-center">
        <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.2 } } }}>
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 30 },
              show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" } },
            }}
          >
            <SectionLabel light className="text-ivory">
              THE NEW COLLECTION
            </SectionLabel>
          </motion.div>
          <motion.h1
            className="mt-4 font-display text-4xl italic leading-none text-ivory md:text-6xl"
            variants={{
              hidden: { opacity: 0, y: 30 },
              show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" } },
            }}
          >
            Dressed in Stories,
            <br />
            Draped in Legacy.
          </motion.h1>
          <motion.p
            className="mx-auto mt-4 max-w-lg font-body text-lg text-ivory/80"
            variants={{
              hidden: { opacity: 0, y: 30 },
              show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" } },
            }}
          >
            Bespoke couture and ready-to-wear for the woman who commands every room.
          </motion.p>
          <motion.div
            className="mt-8 flex flex-wrap justify-center gap-4"
            variants={{
              hidden: { opacity: 0, y: 30 },
              show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" } },
            }}
          >
            <Link
              href="/shop"
              className={cn(
                "inline-flex items-center justify-center px-8 py-4 font-label uppercase tracking-[0.14em]",
                "rounded-sm bg-wine text-ivory transition-colors hover:bg-wine-hover",
              )}
            >
              Shop The Collection
            </Link>
            <Link
              href="/bespoke"
              className={cn(
                "inline-flex items-center justify-center px-8 py-4 font-label uppercase tracking-[0.14em]",
                "rounded-sm border border-ivory/60 text-ivory transition-colors hover:bg-ivory/10",
              )}
            >
              Book Bespoke
            </Link>
          </motion.div>
        </motion.div>
      </div>
      <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-wine">
        <div className="h-10 w-px animate-pulse bg-wine" />
        <ArrowDown className="h-4 w-4" />
      </div>
    </section>
  );
}
