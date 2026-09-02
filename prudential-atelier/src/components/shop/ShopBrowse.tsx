"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as Select from "@radix-ui/react-select";
import { ChevronDown } from "lucide-react";
import { useInView } from "react-intersection-observer";
import { cn } from "@/lib/utils";
import { ProductCardGrid } from "@/components/common/ProductCardGrid";
import type { ProductListItem } from "@/types/product";

interface ShopBrowseProps {
  products: ProductListItem[];
  total: number;
  page: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  heroEyebrow?: string;
  heroHeadline?: string;
  heroSubtext?: string;
  hideFilters?: boolean;
}

const FILTERS = [
  { id: "all", label: "ALL", params: {} },
  { id: "rtw", label: "READY-TO-WEAR", params: { type: "RTW" } },
  { id: "bridal", label: "BRIDAL", params: { category: "BRIDAL" } },
  { id: "atelier", label: "ATELIER", params: { type: "BESPOKE" } },
  { id: "kids", label: "KIDS", params: { category: "KIDDIES" } },
] as const;

export function ShopBrowse({
  products: initialProducts,
  total,
  page: initialPage,
  hasNext: initialHasNext,
  heroEyebrow = "THE COLLECTION",
  heroHeadline = "Prudent Gabriel",
  heroSubtext = "Ready-to-wear, bridal, and atelier couture.",
  hideFilters = false,
}: ShopBrowseProps) {
  const sp = useSearchParams();
  const router = useRouter();
  const [items, setItems] = useState<ProductListItem[]>(initialProducts);
  const [page, setPage] = useState(initialPage);
  const [hasNext, setHasNext] = useState(initialHasNext);
  const [loadingMore, setLoadingMore] = useState(false);

  const queryKey = useMemo(() => sp.toString(), [sp]);

  useEffect(() => {
    setItems(initialProducts);
    setPage(initialPage);
    setHasNext(initialHasNext);
  }, [initialProducts, initialPage, initialHasNext, queryKey]);

  const activeFilter = useMemo(() => {
    const cat = sp.get("category");
    const type = sp.get("type");
    if (cat === "BRIDAL") return "bridal";
    if (cat === "KIDDIES") return "kids";
    if (type === "RTW") return "rtw";
    if (type === "BESPOKE") return "atelier";
    return "all";
  }, [sp]);

  const loadMore = useCallback(async () => {
    if (!hasNext || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const u = new URLSearchParams(sp.toString());
      u.set("page", String(next));
      const res = await fetch(`/api/products?${u.toString()}`);
      if (!res.ok) throw new Error("fetch failed");
      const data = (await res.json()) as { products: ProductListItem[]; hasNext: boolean; page: number };
      setItems((prev) => [...prev, ...data.products]);
      setPage(data.page);
      setHasNext(data.hasNext);
    } catch {
      /* ignore */
    } finally {
      setLoadingMore(false);
    }
  }, [hasNext, loadingMore, page, sp]);

  const { ref: sentinelRef, inView } = useInView({ rootMargin: "240px" });

  useEffect(() => {
    if (inView) void loadMore();
  }, [inView, loadMore]);

  function applyFilter(filterId: (typeof FILTERS)[number]["id"]) {
    const f = FILTERS.find((x) => x.id === filterId)!;
    const n = new URLSearchParams();
    for (const [k, v] of Object.entries(f.params)) n.set(k, v);
    n.set("limit", sp.get("limit") ?? "20");
    const sort = sp.get("sort");
    if (sort) n.set("sort", sort);
    router.push(`/shop?${n.toString()}`);
  }

  return (
    <div className="bg-ivory">
      <header className="px-4 py-14 text-center md:py-16">
        <p className="font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-lightbr">{heroEyebrow}</p>
        <h1 className="mt-3 font-serif text-[40px] font-normal text-choc md:text-[64px]">{heroHeadline}</h1>
        {heroSubtext ? (
          <p className="mx-auto mt-4 max-w-lg font-serif text-sm font-light text-text-mid">{heroSubtext}</p>
        ) : null}
      </header>

      {!hideFilters ? (
      <div className="border-y border-[0.5px] border-sand bg-ivory px-4 py-4 md:px-8 lg:px-10">
        <div className="mx-auto flex max-w-site flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => applyFilter(f.id)}
                className={cn(
                  "rounded-full px-4 py-2 font-sans text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors",
                  activeFilter === f.id
                    ? "bg-choc text-cream"
                    : "border border-[0.5px] border-sand text-text-mid hover:border-nut/50",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <span className="font-sans text-[11px] uppercase tracking-[0.1em] text-text-light">
              {total} {total === 1 ? "PIECE" : "PIECES"}
            </span>
            <SortSelect />
          </div>
        </div>
      </div>
      ) : (
        <div className="border-y border-[0.5px] border-sand bg-ivory px-4 py-4 md:px-8 lg:px-10">
          <div className="mx-auto flex max-w-site justify-end">
            <span className="font-sans text-[11px] uppercase tracking-[0.1em] text-text-light">
              {total} {total === 1 ? "PIECE" : "PIECES"}
            </span>
          </div>
        </div>
      )}

      <div className={items.length === 0 ? "px-4 py-20 md:px-8 lg:px-10" : undefined}>
        {items.length === 0 ? (
          <div className="flex flex-col items-center text-center">
            <p className="font-serif text-lg text-choc">No pieces match your filters</p>
            <button
              type="button"
              onClick={() => router.push("/shop")}
              className="mt-6 font-sans text-[11px] font-medium uppercase tracking-wider text-nut underline"
            >
              View all pieces
            </button>
          </div>
        ) : (
          <ProductCardGrid
            products={items}
            className="grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
          />
        )}

        {hasNext && (
          <div ref={sentinelRef} className="flex justify-center py-10">
            {loadingMore ? (
              <p className="font-sans text-[11px] text-text-light">Loading more…</p>
            ) : (
              <span className="h-8 w-8" aria-hidden />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SortSelect() {
  const sp = useSearchParams();
  const router = useRouter();
  const sort = sp.get("sort") ?? "featured";
  const labels: Record<string, string> = {
    featured: "Featured",
    "price-asc": "Price Low–High",
    "price-desc": "Price High–Low",
    newest: "Newest",
  };

  return (
    <Select.Root
      value={sort === "newest" ? "newest" : sort}
      onValueChange={(v) => {
        const n = new URLSearchParams(sp.toString());
        n.set("sort", v);
        n.delete("page");
        router.push(`/shop?${n.toString()}`);
      }}
    >
      <Select.Trigger className="inline-flex items-center gap-1.5 font-sans text-[11px] uppercase tracking-[0.1em] text-text-mid outline-none">
        <span className="text-text-light">Sort</span>
        <Select.Value>{labels[sort] ?? "Featured"}</Select.Value>
        <ChevronDown className="h-3.5 w-3.5" />
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="z-50 min-w-[10rem] rounded-sm border border-sand bg-bg-card shadow-md">
          <Select.Viewport className="p-1">
            {[
              ["featured", "Featured"],
              ["price-asc", "Price Low–High"],
              ["price-desc", "Price High–Low"],
              ["newest", "Newest"],
            ].map(([value, label]) => (
              <Select.Item
                key={value}
                value={value}
                className="cursor-pointer rounded-sm px-3 py-2 font-sans text-[12px] text-choc outline-none hover:bg-sand/30"
              >
                {label}
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
