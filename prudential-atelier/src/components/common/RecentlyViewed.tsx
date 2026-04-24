"use client";

import { useEffect, useState } from "react";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { ProductCard } from "@/components/common/ProductCard";
import { useRecentlyViewedStore } from "@/store/recentlyViewedStore";
import type { ProductListItem } from "@/types/product";

export function RecentlyViewed() {
  const ids = useRecentlyViewedStore((s) => s.ids);
  const [products, setProducts] = useState<ProductListItem[]>([]);

  useEffect(() => {
    if (!ids.length) {
      setProducts([]);
      return;
    }
    const q = ids.join(",");
    fetch(`/api/products?ids=${encodeURIComponent(q)}&limit=8&inStock=false`)
      .then((r) => r.json())
      .then((j) => setProducts(j.products ?? []))
      .catch(() => setProducts([]));
  }, [ids]);

  if (!ids.length || !products.length) return null;

  return (
    <section className="border-t border-border py-16">
      <SectionLabel>RECENTLY VIEWED</SectionLabel>
      <h2 className="mt-4 font-display text-3xl text-charcoal">Picked Up Where You Left Off</h2>
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
