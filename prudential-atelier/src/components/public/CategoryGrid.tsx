"use client";

import { motion } from "framer-motion";
import Link from "next/link";

const COLLECTIONS = [
  {
    href: "/bespoke",
    title: "The Bespoke Atelier",
    subtitle: "Commissions designed entirely around you.",
    bg: "bg-choc",
  },
  {
    href: "/bridal",
    title: "Bridal & Ceremony",
    subtitle: "For the day you'll remember forever.",
    bg: "bg-nut",
  },
  {
    href: "/shop",
    title: "Ready-to-Wear",
    subtitle: "House signatures, ready to ship.",
    bg: "bg-dark-nut",
  },
];

export function CategoryGrid() {
  return (
    <section className="bg-ivory px-6 py-20 lg:px-10">
      <div className="mx-auto max-w-site">
        <div className="text-center">
          <p className="font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-lightbr">
            Explore
          </p>
          <h2 className="mt-3 font-serif text-[42px] font-medium leading-tight text-choc">
            Three ways to wear the house
          </h2>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {COLLECTIONS.map((card, index) => (
            <motion.div
              key={card.href}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
              viewport={{ once: true, margin: "-80px" }}
            >
              <Link
                href={card.href}
                className={`group flex h-[280px] flex-col items-center justify-center px-10 py-10 text-center ${card.bg}`}
              >
                <h3 className="font-serif text-[28px] font-medium text-cream">{card.title}</h3>
                <p className="mt-3 max-w-[240px] font-sans text-xs font-light leading-relaxed text-sand">
                  {card.subtitle}
                </p>
                <span className="mt-8 font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-cream underline decoration-lightbr/60 underline-offset-[6px] transition-colors group-hover:text-sand">
                  Discover
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
