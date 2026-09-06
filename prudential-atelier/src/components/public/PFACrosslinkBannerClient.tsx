"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { cmsGet } from "@/lib/cms-helpers";

export function PFACrosslinkBannerClient({ cms = {} }: { cms?: Record<string, string> }) {
  const headline = cmsGet(cms, "home_pfa_headline", "Learn the craft from the house");
  const body = cmsGet(
    cms,
    "home_pfa_body",
    "Pattern-cutting, beading and bridal couture — taught in the Lagos atelier.",
  );
  const btnLabel = cmsGet(cms, "home_pfa_button_label", "DISCOVER PFA →");
  const btnLink = cmsGet(cms, "home_pfa_button_link", "/about#academy");
  const external = btnLink.startsWith("http");

  const ctaClass =
    "inline-flex shrink-0 items-center justify-center border border-choc px-7 py-[14px] font-sans text-[13px] font-normal text-choc transition-opacity hover:opacity-80";

  return (
    <section className="px-6 py-14 lg:px-10">
      <motion.div
        className="glass-2 glass-panel mx-auto flex max-w-site min-w-0 flex-col items-start justify-between gap-8 px-8 py-10 lg:flex-row lg:items-center lg:px-12"
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        viewport={{ once: true, margin: "-80px" }}
      >
        <div className="min-w-0 max-w-xl">
          <h2
            className="leading-tight"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "36px",
              color: "var(--choc)",
            }}
          >
            {headline}
          </h2>
          <p
            className="mt-4 leading-relaxed"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "13px",
              fontWeight: 300,
              color: "var(--text-mid)",
            }}
          >
            {body}
          </p>
        </div>
        {external ? (
          <a href={btnLink} target="_blank" rel="noopener noreferrer" className={ctaClass}>
            {btnLabel}
          </a>
        ) : (
          <Link href={btnLink} className={ctaClass}>
            {btnLabel}
          </Link>
        )}
      </motion.div>
    </section>
  );
}
