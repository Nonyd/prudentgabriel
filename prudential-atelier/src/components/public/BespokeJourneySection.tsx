"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { cmsGet } from "@/lib/cms-helpers";

export function BespokeJourneySection({ cms = {} }: { cms?: Record<string, string> }) {
  const headline = cmsGet(cms, "home_journey_headline", "Thirteen stages, one unforgettable piece.");
  const body = cmsGet(
    cms,
    "home_journey_body",
    "From the first consultation to the final fitting, every commission is documented and shared with you at each step.",
  );
  const btnLabel = cmsGet(cms, "home_journey_button_label", "Begin Your Commission →");
  const btnLink = cmsGet(cms, "home_journey_button_link", "/atelier");

  return (
    <section className="px-6 py-16 lg:px-10">
      <motion.div
        className="glass-2 glass-panel mx-auto grid min-h-[380px] max-w-site overflow-hidden lg:grid-cols-2"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        viewport={{ once: true, margin: "-80px" }}
      >
        <div className="flex flex-col justify-center px-8 py-16 lg:px-[60px] lg:py-[80px]">
          <h2
            className="leading-[1.1]"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "44px",
              color: "var(--choc)",
            }}
          >
            {headline.includes(",") ? (
              <>
                {headline.split(",")[0]},
                <span className="italic"> {headline.split(",").slice(1).join(",").trim()}</span>
              </>
            ) : (
              headline
            )}
          </h2>
          <p
            className="mt-6 max-w-md leading-[1.85]"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "13px",
              fontWeight: 300,
              color: "var(--text-mid)",
            }}
          >
            {body}
          </p>
          <Link href={btnLink} className="btn-ghost-light mt-10 inline-flex w-fit">
            {btnLabel}
          </Link>
        </div>
        <div className="min-h-[220px] bg-[var(--nut)]/18 lg:min-h-full" aria-hidden="true" />
      </motion.div>
    </section>
  );
}
