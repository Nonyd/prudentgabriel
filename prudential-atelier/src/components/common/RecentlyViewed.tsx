"use client";

import { useEffect, useState } from "react";
import { ProductCardRail } from "@/components/common/ProductCardGrid";
import { useRecentlyViewedStore } from "@/store/recentlyViewedStore";
import type { ProductListItem } from "@/types/product";

export function RecentlyViewed({ excludeProductId }: { excludeProductId?: string }) {
  const ids = useRecentlyViewedStore((s) => s.ids);
  const [products, setProducts] = useState<ProductListItem[]>([]);

  useEffect(() => {
    const otherIds = ids.filter((id) => id !== excludeProductId);
    if (!otherIds.length) {
      setProducts([]);
      return;
    }
    const q = otherIds.join(",");
    fetch(`/api/products?ids=${encodeURIComponent(q)}&limit=8&inStock=false`)
      .then((r) => r.json())
      .then((j) => {
        const rows = (j.products ?? []) as ProductListItem[];
        setProducts(rows.filter((p) => p.id !== excludeProductId));
      })
      .catch(() => setProducts([]));
  }, [ids, excludeProductId]);

  const visible = products.filter((p) => p.id !== excludeProductId);
  if (!visible.length) return null;

  return (
    <section className="border-t border-charcoal/10 py-16">
      <h2 className="font-display text-3xl text-charcoal">Recently viewed</h2>
      <div className="mt-8">
        <ProductCardRail products={visible} variant="teaser" />
      </div>
    </section>
  );
}
