"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { BlogPreviewImage } from "./BlogPreviewImage";
import type { HouseDoorCard } from "@/lib/house-doors";

export function CategoryGridClient({ cards }: { cards: HouseDoorCard[] }) {
  return (
    <section className="px-6 py-20 lg:px-10">
      <div className="mx-auto max-w-site">
        <div className="text-center">
          <h2 className="font-display text-[42px] font-medium leading-tight text-choc">
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
                className="glass-2 glass-panel glass-lift group relative block overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-choc"
              >
                <div className="img-portrait relative overflow-hidden bg-ivory-dark">
                  <BlogPreviewImage
                    src={card.imageUrl}
                    alt={card.imageAlt}
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                  <div
                    className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent"
                    aria-hidden="true"
                  />
                </div>
                <div className="absolute inset-x-0 bottom-0 px-6 pb-7 pt-16 text-center">
                  <h3 className="font-display text-[28px] font-medium leading-tight text-[#f7f2ec]">{card.title}</h3>
                  <p className="mx-auto mt-2 max-w-[240px] font-body text-xs font-light leading-relaxed text-[#f7f2ec]/80">
                    {card.subtitle}
                  </p>
                  <span className="mt-4 inline-block font-sans text-[13px] font-normal text-[#f7f2ec] underline underline-offset-[6px] transition-opacity duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:opacity-80">
                    {card.cta}
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
