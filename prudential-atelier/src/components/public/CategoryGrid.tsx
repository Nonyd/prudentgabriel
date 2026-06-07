"use client";

import { motion } from "framer-motion";
import Link from "next/link";

const COLLECTIONS = [
  {
    href: "/atelier",
    title: "The Atelier",
    subtitle: "Commissions designed entirely around you.",
    bg: "#442913",
  },
  {
    href: "/bridal",
    title: "Bridal & Ceremony",
    subtitle: "For the day you'll remember forever.",
    bg: "#5C3422",
  },
  {
    href: "/shop",
    title: "Ready-to-Wear",
    subtitle: "House signatures, ready to ship.",
    bg: "#3a1f0c",
  },
];

export function CategoryGrid() {
  return (
    <section className="bg-bg-page px-6 py-20 lg:px-10">
      <div className="mx-auto max-w-site">
        <div className="text-center">
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
            Explore
          </p>
          <h2
            className="mt-3 leading-tight"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "42px",
              color: "var(--choc)",
            }}
          >
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
                className="group flex h-[280px] flex-col text-center"
                style={{ backgroundColor: card.bg }}
              >
                <div className="flex flex-1 flex-col items-center justify-center px-8">
                  <h3
                    className="font-medium"
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "28px",
                      color: "var(--cream)",
                    }}
                  >
                    {card.title}
                  </h3>
                  <p
                    className="mt-3 max-w-[240px] font-light leading-relaxed"
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "12px",
                      color: "var(--sand)",
                    }}
                  >
                    {card.subtitle}
                  </p>
                </div>
                <span
                  className="pb-8 uppercase underline decoration-[var(--lightbr)] underline-offset-[6px] transition-opacity group-hover:opacity-80"
                  style={{
                    fontFamily: "var(--font-ui)",
                    fontSize: "10px",
                    fontWeight: 600,
                    letterSpacing: "0.16em",
                    color: "var(--cream)",
                  }}
                >
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
