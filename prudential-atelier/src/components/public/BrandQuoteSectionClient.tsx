"use client";

import { motion } from "framer-motion";
import { cmsGet } from "@/lib/cms-helpers";

export function BrandQuoteSectionClient({ cms = {} }: { cms?: Record<string, string> }) {
  const label = cmsGet(cms, "home_quote_label", "SINCE THE FIRST STITCH");
  const quote = cmsGet(
    cms,
    "home_quote_text",
    "We don't make clothes. We make the way you'll be remembered — hand-finished, sourced with care, and designed entirely around you.",
  );
  const attribution = cmsGet(
    cms,
    "home_quote_attribution",
    "MRS. PRUDENT GABRIEL-OKOPI · FOUNDER & CREATIVE DIRECTOR",
  );

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
          {label}
        </p>
        <blockquote
          className="mt-8 italic leading-[1.4]"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "34px",
            color: "var(--choc)",
          }}
        >
          {quote}
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
          {attribution}
        </p>
      </motion.div>
    </section>
  );
}
