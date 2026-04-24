"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { ProductCard } from "@/components/common/ProductCard";
import type { ProductListItem } from "@/types/product";

export function NewArrivals({ products }: { products: ProductListItem[] }) {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });
  if (!products.length) return null;
  return (
    <section ref={ref} className="bg-ivory py-section-mobile md:py-section">
      <div className="mx-auto max-w-site px-4">
        <div className="mb-12 flex flex-col justify-end gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <SectionLabel>JUST IN</SectionLabel>
            <h2 className="mt-2 font-display text-4xl text-charcoal">New Arrivals</h2>
          </div>
          <Link href="/shop?sort=newest" className="font-body text-sm text-gold hover:underline">
            View All →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {products.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <ProductCard product={p} priority={i < 4} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
