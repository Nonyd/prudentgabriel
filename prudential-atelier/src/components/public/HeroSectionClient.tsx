"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

const DEFAULT_HERO =
  "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=1200&q=85";

export function HeroSectionClient({ heroImage = DEFAULT_HERO }: { heroImage?: string }) {
  return (
    <section className="bg-hero-bg text-cream">
      <div className="mx-auto grid max-w-site gap-10 px-6 py-16 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-10 lg:py-24">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          viewport={{ once: true, margin: "-80px" }}
        >
          <p className="eyebrow text-lightbr">Prudential Atelier · Lagos</p>
          <h1 className="mt-4 font-serif text-[clamp(2.5rem,5vw,4.5rem)] font-medium leading-[1.05] text-cream">
            Crafted for the Woman Who Commands the Room
          </h1>
          <p className="mt-6 max-w-md copy-body text-sm font-light leading-[1.8] text-cream/85">
            Atelier couture and ready-to-wear — each piece conceived in our Lagos atelier and
            finished by hand for weddings, galas, and everyday elegance.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/shop" className="btn-primary">
              Shop Collection
            </Link>
            <Link href="/consultation" className="btn-ghost-dark">
              Book Consultation
            </Link>
          </div>
        </motion.div>

        <motion.div
          className="img-portrait relative overflow-hidden rounded-lg border border-lightbr/30"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          viewport={{ once: true, margin: "-80px" }}
        >
          <Image
            src={heroImage || DEFAULT_HERO}
            alt="Luxury couture gown"
            fill
            className="object-cover object-top"
            sizes="(max-width: 1024px) 100vw, 50vw"
            priority
          />
          <div className="absolute bottom-6 left-6 border border-lightbr/40 bg-choc/90 px-5 py-4 backdrop-blur-sm">
            <p className="font-serif text-2xl font-medium text-cream">15+</p>
            <p className="mt-1 font-sans text-[9px] font-semibold uppercase tracking-[0.14em] text-lightbr">
              Years of Couture
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
