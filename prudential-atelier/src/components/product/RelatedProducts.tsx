"use client";

import { SectionLabel } from "@/components/ui/SectionLabel";
import { ProductCardGrid } from "@/components/common/ProductCardGrid";
import type { ProductListItem } from "@/types/product";

export function RelatedProducts({ products }: { products: ProductListItem[] }) {
  if (!products.length) return null;
  return (
    <section className="border-t border-border py-16">
      <SectionLabel>YOU MAY ALSO LIKE</SectionLabel>
      <div className="mt-8">
        <ProductCardGrid
          products={products}
          priorityCount={2}
          className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5 lg:gap-6"
        />
      </div>
    </section>
  );
}
