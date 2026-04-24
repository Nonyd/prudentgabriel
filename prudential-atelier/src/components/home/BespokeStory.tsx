"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Button } from "@/components/ui/Button";

const IMG = "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=1200&q=80";

export function BespokeStory() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-5%", "5%"]);
  const { ref: vRef, inView } = useInView({ triggerOnce: true, threshold: 0.15 });

  return (
    <section ref={sectionRef} className="overflow-hidden bg-ivory-dark">
      <div ref={vRef} className="mx-auto grid max-w-site md:grid-cols-[3fr_2fr]">
        <motion.div style={{ y }} className="relative min-h-[320px] md:min-h-[560px]">
          <Image src={IMG} alt="Atelier" fill className="object-cover" sizes="(max-width:768px) 100vw, 60vw" />
        </motion.div>
        <div className="flex flex-col justify-center px-5 py-12 md:px-12 md:py-16 lg:px-20">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
          >
            <SectionLabel>THE ATELIER</SectionLabel>
            <h2 className="mt-4 font-display text-3xl text-charcoal md:text-4xl">
              Every Stitch,
              <br />A Signature.
            </h2>
            <p className="mt-6 font-body text-charcoal-mid">
              From our Lagos atelier to your most important moments — each piece begins with a conversation and ends
              as a legacy.
            </p>
            <div className="mt-10 space-y-6">
              {[
                ["01", "Consultation", "A call, a vision, a plan built around you."],
                ["02", "Crafting", "Pattern, fabric, hand-sewn by our master tailors."],
                ["03", "Delivery", "Your piece, your story, delivered to perfection."],
              ].map(([n, t, d]) => (
                <div key={n} className="flex gap-4">
                  <span className="w-12 shrink-0 font-display text-5xl italic leading-none text-wine/30">{n}</span>
                  <div>
                    <p className="font-body text-sm font-medium text-charcoal">{t}</p>
                    <p className="mt-1 font-body text-[13px] text-charcoal-light">{d}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link href="/bespoke">
                <Button type="button" size="lg">
                  Begin Your Journey
                </Button>
              </Link>
              <Link href="/consultation">
                <Button type="button" size="lg" variant="secondary">
                  Book a Consultation
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
