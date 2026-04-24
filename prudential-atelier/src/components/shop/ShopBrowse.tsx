"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SectionLabel } from "@/components/ui/SectionLabel";
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
      <section className="relative flex min-h-[280px] flex-col items-center justify-center bg-wine px-4 py-16 text-center">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.35'/%3E%3C/svg%3E")`,
          }}
        />
        <div className="relative z-10 max-w-2xl">
          <SectionLabel light className="text-ivory/90">
            THE COLLECTION
          </SectionLabel>
          <h1 className="mt-4 font-display text-4xl italic text-ivory md:text-5xl">The Edit</h1>
          <p className="mt-3 font-body text-ivory/70">Discover pieces made for you</p>
          <div className="mt-8 flex max-w-xl flex-wrap justify-center gap-2">
            {CHIPS.map((c) => {
              const active = c.category ? currentCat === c.category : !currentCat;
              const href = c.category ? `/shop?category=${c.category}` : "/shop";
              return (
                <Link
                  key={c.label}
                  href={href}
                  className={cn(
                    "rounded-full border px-3 py-1.5 font-label text-[10px] uppercase tracking-wider transition-colors",
                    active
                      ? "border-ivory bg-ivory text-wine"
                      : "border-ivory/50 text-ivory hover:border-ivory",
                  )}
                >
                  {c.label}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <div className="mx-auto flex max-w-site gap-8 px-4 py-12 lg:px-6">
        <div className="hidden w-[280px] shrink-0 lg:block">
          <FilterPanel />
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <p className="text-sm text-charcoal-light">
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
              <svg className="mb-4 h-16 w-16 text-wine" viewBox="0 0 64 64" fill="none" stroke="currentColor">
                <path d="M12 20h40l-4 32H16L12 20z" strokeWidth="1.5" />
                <path d="M20 20V14a12 12 0 0124 0v6" strokeWidth="1.5" />
              </svg>
              <p className="font-display text-lg text-charcoal">No pieces match your search</p>
              <Link
                href="/shop"
                className="mt-6 font-label text-[11px] uppercase tracking-wider text-wine underline"
              >
                Clear All Filters
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-6 md:grid-cols-3 xl:grid-cols-3">
              {products.map((p, i) => (
                <ProductCard key={p.id} product={p} priority={i < 4} />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <nav className="mt-12 flex flex-wrap items-center justify-center gap-2">
              <Link
                href={buildHref(Math.max(1, page - 1))}
                className={cn(
                  "rounded-sm border border-border px-3 py-2 font-label text-[10px] uppercase",
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
                      {showEllipsis && <span className="text-charcoal-light">…</span>}
                      <Link
                        href={buildHref(n)}
                        className={cn(
                          "flex h-9 min-w-[2.25rem] items-center justify-center rounded-sm border font-label text-[11px]",
                          n === page ? "border-wine bg-wine text-ivory" : "border-border hover:border-wine",
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
                  "rounded-sm border border-border px-3 py-2 font-label text-[10px] uppercase",
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
      <Select.Trigger className="inline-flex items-center gap-2 rounded-sm border border-border bg-cream px-3 py-2 font-label text-[10px] uppercase">
        <Select.Value placeholder="Sort" />
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="z-50 rounded-sm border border-border bg-cream shadow-lg">
          <Select.Viewport className="p-1">
            <Select.Item value="newest" className="cursor-pointer px-3 py-2 text-sm hover:bg-wine-muted">
              Newest
            </Select.Item>
            <Select.Item value="price-asc" className="cursor-pointer px-3 py-2 text-sm hover:bg-wine-muted">
              Price: Low to High
            </Select.Item>
            <Select.Item value="price-desc" className="cursor-pointer px-3 py-2 text-sm hover:bg-wine-muted">
              Price: High to Low
            </Select.Item>
            <Select.Item value="featured" className="cursor-pointer px-3 py-2 text-sm hover:bg-wine-muted">
              Featured
            </Select.Item>
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
