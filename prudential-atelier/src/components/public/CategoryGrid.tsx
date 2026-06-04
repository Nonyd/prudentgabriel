"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

const CATEGORIES = [
  {
    href: "/shop",
    name: "Ready to Wear",
    sub: "The Edit",
    image: "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=600&q=80",
  },
  {
    href: "/bespoke",
    name: "Bespoke",
    sub: "Made for You",
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80",
  },
  {
    href: "/bridal",
    name: "Bridal",
    sub: "Prudential Bride",
    image: "https://images.unsplash.com/photo-1519741497674-611481863552?w=600&q=80",
  },
  {
    href: "/kids",
    name: "Kids",
    sub: "Little Icons",
    image: "https://images.unsplash.com/photo-1503454537845-7315a1a0a4a8?w=600&q=80",
  },
];

export function CategoryGrid() {
  return (
    <section className="bg-ivory px-6 py-20 lg:px-10">
      <div className="mx-auto max-w-site">
        <p className="eyebrow">Collections</p>
        <h2 className="mt-3 font-serif text-[clamp(2rem,3vw,2.625rem)] font-medium text-choc">
          Explore the House
        </h2>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORIES.map((cat, index) => (
            <motion.div
              key={cat.href + cat.name}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
              viewport={{ once: true, margin: "-80px" }}
            >
              <Link href={cat.href} className="group block overflow-hidden rounded-lg">
                <div className="relative aspect-[3/4] overflow-hidden">
                  <Image
                    src={cat.image}
                    alt={cat.name}
                    fill
                    className="object-cover transition duration-500 group-hover:scale-[1.03] group-hover:brightness-110"
                    sizes="(max-width: 640px) 100vw, 25vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-choc/85 via-choc/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 p-5">
                    <p className="font-serif text-xl font-medium text-cream">{cat.name}</p>
                    <p className="mt-1 font-sans text-[9px] font-semibold uppercase tracking-[0.14em] text-lightbr">
                      {cat.sub}
                    </p>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
