"use client";

import { SectionLabel } from "@/components/ui/SectionLabel";
import { ProductCardGrid } from "@/components/common/ProductCardGrid";
import type { ProductListItem } from "@/types/product";

export function RelatedProducts({ products }: { products: ProductListItem[] }) {
  if (!products.length) return null;
  return (
    <section className="border-t border-border py-16">
      <div className="px-4 lg:px-0">
        <SectionLabel>YOU MAY ALSO LIKE</SectionLabel>
      </div>
      <div className="mt-8">
        <ProductCardGrid
          products={products}
          priorityCount={2}
          variant="teaser"
          className="grid-cols-2 md:grid-cols-4 px-0 lg:px-0"
        />
      </div>
    </section>
  );
}
