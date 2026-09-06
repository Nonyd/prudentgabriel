"use client";

import { ProductCardRail } from "@/components/common/ProductCardGrid";
import type { ProductListItem } from "@/types/product";

export function CompleteTheLook({ products }: { products: ProductListItem[] }) {
  if (!products.length) return null;
  return (
    <section className="border-t border-charcoal/10 py-16">
      <h2 className="font-display text-3xl text-charcoal">Complete the look</h2>
      <div className="mt-8">
        <ProductCardRail products={products} variant="teaser" />
      </div>
    </section>
  );
}
