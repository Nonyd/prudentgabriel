"use client";

import { SectionLabel } from "@/components/ui/SectionLabel";
import { ProductCard } from "@/components/common/ProductCard";
import type { ProductListItem } from "@/types/product";

export function RelatedProducts({ products }: { products: ProductListItem[] }) {
  if (!products.length) return null;
  return (
    <section className="border-t border-border py-16">
      <SectionLabel>YOU MAY ALSO LIKE</SectionLabel>
      <div className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-4">
        {products.map((p, i) => (
          <ProductCard key={p.id} product={p} priority={i < 2} />
        ))}
      </div>
    </section>
  );
}
