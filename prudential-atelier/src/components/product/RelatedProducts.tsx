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
      <div className="-mx-4 mt-8 lg:-mx-10">
        <ProductCardGrid products={products} priorityCount={2} className="grid-cols-2 md:grid-cols-4" />
      </div>
    </section>
  );
}
