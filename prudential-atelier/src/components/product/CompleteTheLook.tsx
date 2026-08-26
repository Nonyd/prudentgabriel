"use client";

import { SectionLabel } from "@/components/ui/SectionLabel";
import { ProductCardRail } from "@/components/common/ProductCardGrid";
import type { ProductListItem } from "@/types/product";

export function CompleteTheLook({ products }: { products: ProductListItem[] }) {
  if (!products.length) return null;
  return (
    <section className="border-t border-border py-16">
      <SectionLabel>COMPLETE THE LOOK</SectionLabel>
      <h2 className="mt-4 font-display text-3xl text-charcoal">Style It With</h2>
      <div className="mt-8">
        <ProductCardRail products={products} />
      </div>
    </section>
  );
}
