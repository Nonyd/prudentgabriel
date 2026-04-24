"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ProductCard } from "@/components/common/ProductCard";
import { FilterPanel } from "@/components/shop/FilterPanel";
import { FilterDrawer } from "@/components/shop/FilterDrawer";
import * as Select from "@radix-ui/react-select";
import { cn } from "@/lib/utils";
import type { ProductListItem } from "@/types/product";

const CHIPS: { label: string; category?: string }[] = [
  { label: "All" },
  { label: "Bridal", category: "BRIDAL" },
  { label: "Evening Wear", category: "EVENING_WEAR" },
  { label: "Formal", category: "FORMAL" },
  { label: "Casual", category: "CASUAL" },
  { label: "Kiddies", category: "KIDDIES" },
  { label: "Accessories", category: "ACCESSORIES" },
];

interface ShopBrowseProps {
  products: ProductListItem[];
  total: number;
  page: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export function ShopBrowse({ products, total, page, totalPages, hasNext, hasPrev }: ShopBrowseProps) {
  const sp = useSearchParams();
  const currentCat = sp.get("category") ?? "";

  const buildHref = (p: number) => {
    const n = new URLSearchParams(sp.toString());
    n.set("page", String(p));
    return `/shop?${n.toString()}`;
  };

  return (
    <div>
      <section className="relative flex h-[280px] flex-col justify-center bg-black px-6 md:h-[320px]">
        <div className="mx-auto w-full max-w-[1400px] text-center md:px-8">
          <p className="font-body text-[10px] font-medium uppercase tracking-[0.2em] text-white/50">Prudent Gabriel</p>
          <h1 className="mt-3 font-display text-[40px] font-normal italic leading-[0.95] text-white md:text-[72px]">The Edit.</h1>
          <p className="mt-4 font-body text-[14px] font-light text-white/55">Ready-to-Wear · Bespoke · Bridal</p>
        </div>
      </section>

      <div className="border-b border-mid-grey bg-white py-4">
        <div className="mx-auto flex max-w-[1400px] gap-2 overflow-x-auto px-6 md:px-8">
          {CHIPS.map((c) => {
            const active = c.category ? currentCat === c.category : !currentCat;
            const href = c.category ? `/shop?category=${c.category}` : "/shop";
            return (
              <Link
                key={c.label}
                href={href}
                className={cn(
                  "shrink-0 border px-4 py-2 font-body text-[11px] font-medium uppercase tracking-[0.12em] transition-colors duration-200",
                  active
                    ? "border-transparent bg-olive text-white"
                    : "border-mid-grey bg-white text-charcoal hover:bg-olive-light",
                )}
              >
                {c.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mx-auto flex max-w-site gap-8 px-4 py-10 lg:px-6">
        <div className="hidden w-[280px] shrink-0 lg:block">
          <FilterPanel />
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <p className="font-body text-sm text-dark-grey">
              Showing {products.length} of {total} pieces
            </p>
            <div className="flex items-center gap-3">
              <FilterDrawer />
              <div className="hidden md:block lg:hidden">
                <SortSelect />
              </div>
            </div>
          </div>

          {products.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
              <svg className="mb-4 h-16 w-16 text-olive/80" viewBox="0 0 64 64" fill="none" stroke="currentColor">
                <path d="M12 20h40l-4 32H16L12 20z" strokeWidth="1.5" />
                <path d="M20 20V14a12 12 0 0124 0v6" strokeWidth="1.5" />
              </svg>
              <p className="font-display text-lg text-charcoal">No pieces match your search</p>
              <Link href="/shop" className="mt-6 font-body text-[11px] font-medium uppercase tracking-wider text-olive underline">
                Clear All Filters
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-px bg-mid-grey md:grid-cols-3 xl:grid-cols-4">
              {products.map((p, i) => (
                <div key={p.id} className="bg-white">
                  <ProductCard product={p} priority={i < 4} />
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <nav className="mt-12 flex flex-wrap items-center justify-center gap-2">
              <Link
                href={buildHref(Math.max(1, page - 1))}
                className={cn(
                  "border border-mid-grey px-3 py-2 font-body text-[10px] font-medium uppercase",
                  !hasPrev && "pointer-events-none opacity-40",
                )}
              >
                ← Prev
              </Link>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((n) => n === 1 || n === totalPages || (n >= page - 2 && n <= page + 2))
                .map((n, idx, arr) => {
                  const prev = arr[idx - 1];
                  const showEllipsis = prev && n - prev > 1;
                  return (
                    <span key={n} className="flex items-center gap-2">
                      {showEllipsis && <span className="text-dark-grey">…</span>}
                      <Link
                        href={buildHref(n)}
                        className={cn(
                          "flex h-9 min-w-[2.25rem] items-center justify-center border font-body text-[11px]",
                          n === page ? "border-olive bg-olive text-white" : "border-mid-grey hover:border-olive",
                        )}
                      >
                        {n}
                      </Link>
                    </span>
                  );
                })}
              <Link
                href={buildHref(Math.min(totalPages, page + 1))}
                className={cn(
                  "border border-mid-grey px-3 py-2 font-body text-[10px] font-medium uppercase",
                  !hasNext && "pointer-events-none opacity-40",
                )}
              >
                Next →
              </Link>
            </nav>
          )}
        </div>
      </div>
    </div>
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
      <Select.Trigger className="inline-flex items-center gap-2 border border-mid-grey bg-white px-3 py-2 font-body text-[10px] font-medium uppercase">
        <Select.Value placeholder="Sort" />
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="z-50 border border-mid-grey bg-white shadow-md">
          <Select.Viewport className="p-1">
            <Select.Item value="newest" className="cursor-pointer px-3 py-2 text-sm hover:bg-light-grey">
              Newest
            </Select.Item>
            <Select.Item value="price-asc" className="cursor-pointer px-3 py-2 text-sm hover:bg-light-grey">
              Price: Low to High
            </Select.Item>
            <Select.Item value="price-desc" className="cursor-pointer px-3 py-2 text-sm hover:bg-light-grey">
              Price: High to Low
            </Select.Item>
            <Select.Item value="featured" className="cursor-pointer px-3 py-2 text-sm hover:bg-light-grey">
              Featured
            </Select.Item>
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
