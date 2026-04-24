"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-wine px-4 text-center text-ivory">
      <span className="pointer-events-none absolute font-display text-[180px] italic leading-none text-gold/20 md:text-[280px]">
        404
      </span>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative z-[1] max-w-md">
        <h1 className="font-display text-3xl md:text-4xl">This page has left the atelier.</h1>
        <p className="mt-4 font-body text-ivory/70">
          The piece you&apos;re looking for may have been moved or discontinued.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link href="/" className="rounded-sm bg-ivory px-6 py-2 text-sm text-wine">
            Return home
          </Link>
          <Link href="/shop" className="rounded-sm border border-ivory px-6 py-2 text-sm text-ivory">
            Browse collections
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
