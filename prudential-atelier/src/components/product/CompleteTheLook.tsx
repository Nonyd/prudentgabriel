"use client";

import { SectionLabel } from "@/components/ui/SectionLabel";
import { ProductCard } from "@/components/common/ProductCard";
import type { ProductListItem } from "@/types/product";

export function CompleteTheLook({ products }: { products: ProductListItem[] }) {
  if (!products.length) return null;
  return (
    <section className="border-t border-border py-16">
      <SectionLabel>COMPLETE THE LOOK</SectionLabel>
      <h2 className="mt-4 font-display text-3xl text-charcoal">Style It With</h2>
      <div className="mt-8 flex gap-6 overflow-x-auto pb-2">
        {products.map((p) => (
          <div key={p.id} className="w-[220px] shrink-0">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}
