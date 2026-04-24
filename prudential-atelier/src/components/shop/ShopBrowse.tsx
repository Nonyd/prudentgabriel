"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as Select from "@radix-ui/react-select";
import { LayoutGrid, List, SlidersHorizontal } from "lucide-react";
import { useInView } from "react-intersection-observer";
import { ProductCard } from "@/components/common/ProductCard";
import { FilterDrawer } from "@/components/shop/FilterDrawer";
import { ActiveFilters } from "@/components/shop/ActiveFilters";
import { optimizeProductCardImageUrl, PRODUCT_IMAGE_PLACEHOLDER } from "@/lib/product-image-url";
import { convertFromNGN, formatPrice } from "@/lib/currency";
import { useCurrencyStore } from "@/store/currencyStore";
import { cn } from "@/lib/utils";
import type { ProductListItem } from "@/types/product";

interface ShopBrowseProps {
  products: ProductListItem[];
  total: number;
  page: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export function ShopBrowse({
  products: initialProducts,
  total,
  page: initialPage,
  totalPages: initialTotalPages,
  hasNext: initialHasNext,
}: ShopBrowseProps) {
  const sp = useSearchParams();
  const router = useRouter();
  const [filterOpen, setFilterOpen] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [items, setItems] = useState<ProductListItem[]>(initialProducts);
  const [page, setPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [hasNext, setHasNext] = useState(initialHasNext);
  const [loadingMore, setLoadingMore] = useState(false);

  const queryKey = useMemo(() => sp.toString(), [sp]);

  useEffect(() => {
    setItems(initialProducts);
    setPage(initialPage);
    setTotalPages(initialTotalPages);
    setHasNext(initialHasNext);
  }, [initialProducts, initialPage, initialTotalPages, initialHasNext, queryKey]);

  const loadMore = useCallback(async () => {
    if (!hasNext || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const u = new URLSearchParams(sp.toString());
      u.set("page", String(next));
      const res = await fetch(`/api/products?${u.toString()}`);
      if (!res.ok) throw new Error("fetch failed");
      const data = (await res.json()) as {
        products: ProductListItem[];
        hasNext: boolean;
        page: number;
        totalPages: number;
      };
      setItems((prev) => [...prev, ...data.products]);
      setPage(data.page);
      setHasNext(data.hasNext);
      setTotalPages(data.totalPages);
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

  return (
    <div>
      <section className="relative flex h-[240px] flex-col justify-center bg-black px-6 md:h-[280px]">
        <div className="mx-auto w-full max-w-[1400px] text-center md:px-8">
          <p className="font-body text-[10px] font-medium uppercase tracking-[0.2em] text-white/50">Prudent Gabriel</p>
          <h1 className="mt-3 font-display text-[36px] font-normal italic leading-[0.95] text-white md:text-[56px]">
            The Edit.
          </h1>
          <p className="mt-3 font-body text-[13px] font-light text-white/55">Ready-to-Wear · Bespoke · Bridal</p>
        </div>
      </section>

      <header className="sticky top-0 z-40 flex h-12 items-center justify-between border-b border-mid-grey bg-white px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            className="inline-flex items-center gap-2 font-body text-[11px] font-medium uppercase tracking-[0.14em] text-charcoal hover:text-olive"
          >
            <SlidersHorizontal className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
            <span className="hidden sm:inline">Filter</span>
          </button>
        </div>
        <p className="truncate px-2 text-center font-body text-[11px] text-dark-grey">
          Showing {items.length}
          {total > items.length ? ` of ${total}` : ""} pieces
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <SortSelect />
          <div className="flex border border-mid-grey">
            <button
              type="button"
              aria-label="Grid view"
              onClick={() => setView("grid")}
              className={cn(
                "p-2 text-charcoal transition-colors",
                view === "grid" ? "bg-olive text-white" : "hover:bg-light-grey",
              )}
            >
              <LayoutGrid className="h-4 w-4" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              aria-label="List view"
              onClick={() => setView("list")}
              className={cn(
                "border-l border-mid-grey p-2 text-charcoal transition-colors",
                view === "list" ? "bg-olive text-white" : "hover:bg-light-grey",
              )}
            >
              <List className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </header>

      <FilterDrawer open={filterOpen} onOpenChange={setFilterOpen} showTrigger={false} />

      <ActiveFilters />

      <div className="mx-auto max-w-[1400px] px-6 py-8 md:px-8">
        {items.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <p className="font-display text-lg text-charcoal">No pieces match your search</p>
            <button
              type="button"
              onClick={() => router.push("/shop")}
              className="mt-6 font-body text-[11px] font-medium uppercase tracking-wider text-olive underline"
            >
              Clear All Filters
            </button>
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-2 gap-0.5 bg-mid-grey md:grid-cols-3">
            {items.map((p, i) => (
              <div key={`${p.id}-${i}`} className="bg-white">
                <ProductCard product={p} priority={i < 6} />
              </div>
            ))}
          </div>
        ) : (
          <ShopListRows products={items} />
        )}

        {hasNext && (
          <div ref={sentinelRef} className="flex justify-center py-10">
            {loadingMore ? (
              <p className="font-body text-[11px] text-dark-grey">Loading more…</p>
            ) : (
              <span className="h-8 w-8" aria-hidden />
            )}
          </div>
        )}

        {!hasNext && items.length > 0 && items.length === total && (
          <p className="pb-8 text-center font-body text-[11px] text-dark-grey">Showing all {total} pieces</p>
        )}
      </div>
    </div>
  );
}

function ShopListRows({ products }: { products: ProductListItem[] }) {
  const currency = useCurrencyStore((s) => s.currency);
  const rates = useCurrencyStore((s) => s.rates);
  return (
    <ul className="border border-mid-grey bg-white">
      {products.map((p) => {
        const prices = p.variants.map((v) => (v.salePriceNGN != null ? v.salePriceNGN : v.priceNGN));
        const low = Math.min(...prices);
        const multi = p.variants.length > 1;
        const fmt = formatPrice(convertFromNGN(low, currency, rates), currency);
        const img = optimizeProductCardImageUrl(p.images[0]?.url || PRODUCT_IMAGE_PLACEHOLDER);
        return (
          <li key={p.id} className="flex gap-4 border-b border-mid-grey p-4 last:border-b-0">
            <Link href={`/shop/${p.slug}`} className="relative block h-24 w-[4.5rem] shrink-0 overflow-hidden bg-light-grey">
              <Image src={img} alt={p.images[0]?.alt || p.name} fill className="object-cover object-top" sizes="80px" />
            </Link>
            <div className="min-w-0 flex-1">
              <Link
                href={`/shop/${p.slug}`}
                className="font-body text-[14px] text-charcoal transition-colors hover:text-olive line-clamp-2"
              >
                {p.name}
              </Link>
              <p className="mt-1 font-body text-[13px] font-light text-dark-grey">
                {multi ? "From " : ""}
                {fmt}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function SortSelect() {
  const sp = useSearchParams();
  const router = useRouter();
  const sort = sp.get("sort") ?? "newest";
  return (
    <Select.Root
      value={sort}
      onValueChange={(v) => {
        const n = new URLSearchParams(sp.toString());
        n.set("sort", v);
        n.delete("page");
        router.push(`/shop?${n.toString()}`);
      }}
    >
      <Select.Trigger className="inline-flex items-center gap-1 border-0 bg-transparent font-body text-[11px] font-medium text-charcoal outline-none hover:text-olive">
        <Select.Value placeholder="Sort" />
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="z-50 min-w-[10rem] border border-mid-grey bg-white shadow-md">
          <Select.Viewport className="p-1">
            {[
              ["newest", "Newest"],
              ["price-asc", "Price: Low to High"],
              ["price-desc", "Price: High to Low"],
              ["featured", "Featured"],
            ].map(([value, label]) => (
              <Select.Item
                key={value}
                value={value}
                className="cursor-pointer px-3 py-2 font-body text-[12px] text-charcoal hover:bg-light-grey"
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
