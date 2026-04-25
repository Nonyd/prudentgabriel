"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

const DEFAULT_HERO =
  "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1600&q=90";

function lines(text: string | undefined, fallback: string) {
  const t = text?.trim() ? text : fallback;
  return t.split("\n");
}

export function Hero({
  heroImage = DEFAULT_HERO,
  label,
  headline,
  subtext,
  cta1Text,
  cta2Text,
}: {
  heroImage?: string;
  label?: string;
  headline?: string;
  subtext?: string;
  cta1Text?: string;
  cta2Text?: string;
}) {
  const displayLabel = label ?? "SS 2025 COLLECTION";
  const displayHeadline = lines(headline, "The New\nEdit.");
  const displaySub =
    subtext ?? "Designed for the woman who commands every room she enters.";
  const btn1 = cta1Text ?? "SHOP THE COLLECTION";
  const btn2 = cta2Text ?? "BOOK BESPOKE";

  return (
    <section className="relative min-h-[100svh] overflow-hidden">
      <Image
        src={heroImage || DEFAULT_HERO}
        alt="Prudent Gabriel — SS 2025"
        fill
        priority
        className="object-cover object-top"
        sizes="100vw"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[rgba(10,10,10,0.6)] from-0% via-transparent to-transparent to-50%" />

      <div className="absolute bottom-8 left-6 md:bottom-16 md:left-16">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }}
          className="font-body text-[11px] font-medium uppercase tracking-[0.2em] text-white/70"
        >
          {displayLabel}
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8, ease: "easeOut" }}
          className="mt-3 max-w-[14rem] font-display text-[44px] font-normal italic leading-[0.95] text-white md:max-w-none md:text-[80px]"
        >
          {displayHeadline.map((line, i) => (
            <span key={i}>
              {line}
              {i < displayHeadline.length - 1 ? <br /> : null}
            </span>
          ))}
        </motion.h1>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.6, ease: "easeOut" }}
        >
          <p className="mt-4 max-w-xs font-body text-[15px] font-light leading-relaxed text-white/75">{displaySub}</p>
          <div className="mt-8 flex flex-wrap items-center gap-6">
            <Link
              href="/shop"
              className="inline-flex border border-white px-8 py-3.5 font-body text-[11px] font-medium uppercase tracking-[0.12em] text-white transition-colors duration-200 hover:bg-[#ffffff] hover:text-[#0a0a0a]"
            >
              {btn1}
            </Link>
            <Link
              href="/bespoke"
              className="inline-flex items-center gap-2 font-body text-[11px] font-medium uppercase tracking-[0.12em] text-white/60 transition-colors hover:text-white"
            >
              {btn2}
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
            </Link>
          </div>
        </motion.div>
      </div>

      <div className="pointer-events-none absolute bottom-8 right-8 hidden items-center gap-3 md:flex">
        <div className="h-10 w-px bg-white/40" />
        <span
          className="font-body text-[9px] font-medium uppercase tracking-[0.2em] text-white/40 [writing-mode:vertical-rl] [text-orientation:mixed]"
          style={{ transform: "rotate(180deg)" }}
        >
          Scroll
        </span>
      </div>
    </section>
  );
}
