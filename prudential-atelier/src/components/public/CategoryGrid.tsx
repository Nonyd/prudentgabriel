"use client";

import { motion } from "framer-motion";
import Link from "next/link";

const COLLECTIONS = [
  {
    href: "/atelier",
    title: "The Atelier",
    subtitle: "Commissions designed around you.",
    cta: "Commission",
  },
  {
    href: "/bridal",
    title: "Bridal & Ceremony",
    subtitle: "Gowns for the day itself.",
    cta: "Bridal",
  },
  {
    href: "/rtw",
    title: "Ready-to-Wear",
    subtitle: "House signatures, ready to ship.",
    cta: "Shop",
  },
];

export function CategoryGrid() {
  const cards = COLLECTIONS;
  return (
    <section className="px-6 py-20 lg:px-10">
      <div className="mx-auto max-w-site">
        <div className="text-center">
          <h2
            className="leading-tight"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "42px",
              color: "var(--choc)",
            }}
          >
            Atelier, bridal, ready-to-wear
          </h2>
        </div>

        <div className={cards.length === 1 ? "mt-12 grid gap-4" : "mt-12 grid gap-4 md:grid-cols-3"}>
          {cards.map((card, index) => (
            <motion.div
              key={card.href}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
              viewport={{ once: true, margin: "-80px" }}
            >
              <Link
                href={card.href}
                className="glass-2 glass-panel glass-lift group flex h-[280px] flex-col text-center"
              >
                <div className="flex flex-1 flex-col items-center justify-center px-8">
                  <h3
                    className="font-medium"
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "28px",
                      color: "var(--choc)",
                    }}
                  >
                    {card.title}
                  </h3>
                  <p
                    className="mt-3 max-w-[240px] font-light leading-relaxed"
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "12px",
                      color: "var(--text-mid)",
                    }}
                  >
                    {card.subtitle}
                  </p>
                </div>
                <span
                  className="pb-8 font-sans text-[13px] font-normal text-choc underline underline-offset-[6px] transition-opacity group-hover:opacity-80"
                >
                  {card.cta}
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
