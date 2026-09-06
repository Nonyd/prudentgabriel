"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as Select from "@radix-ui/react-select";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductCardGrid } from "@/components/common/ProductCardGrid";
import { CatalogPagination } from "@/components/shop/CatalogPagination";
import type { ProductListItem } from "@/types/product";
import { SHOP_HERO_SUBTITLE, SHOP_HERO_TITLE, SHOP_LISTING, RTW_EXCLUDE_CATEGORY_QUERY } from "@/lib/rtw-aisle";

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
  { id: "all", label: "ALL", params: {} as Record<string, string> },
  { id: "rtw", label: "READY-TO-WEAR", params: { type: "RTW", excludeCategory: RTW_EXCLUDE_CATEGORY_QUERY } },
  { id: "bridal", label: "BRIDAL", params: { category: "BRIDAL" } },
  { id: "atelier", label: "ATELIER", params: { type: "BESPOKE" } },
  { id: "kids", label: "KIDS", params: { category: "KIDDIES" } },
  { id: "accessories", label: "ACCESSORIES", params: { category: "ACCESSORIES" } },
] as const;

function shopPageHref(sp: URLSearchParams, page: number) {
  const n = new URLSearchParams(sp.toString());
  n.delete("limit");
  if (page <= 1) n.delete("page");
  else n.set("page", String(page));
  const q = n.toString();
  return q ? `${SHOP_LISTING}?${q}` : SHOP_LISTING;
}

export function ShopBrowse({
  products: initialProducts,
  total,
  page: initialPage,
  totalPages,
  heroHeadline = SHOP_HERO_TITLE,
  heroSubtext = SHOP_HERO_SUBTITLE,
  hideFilters = false,
}: ShopBrowseProps) {
  const sp = useSearchParams();
  const [items, setItems] = useState<ProductListItem[]>(initialProducts);
  const [page, setPage] = useState(initialPage);

  const queryKey = useMemo(() => sp.toString(), [sp]);

  useEffect(() => {
    setItems(initialProducts);
    setPage(initialPage);
  }, [initialProducts, initialPage, queryKey]);

  const activeFilter = useMemo(() => {
    const cat = sp.get("category");
    const type = sp.get("type");
    if (cat === "BRIDAL") return "bridal";
    if (cat === "KIDDIES") return "kids";
    if (cat === "ACCESSORIES") return "accessories";
    if (type === "RTW") return "rtw";
    if (type === "BESPOKE") return "atelier";
    return "all";
  }, [sp]);

  function filterHref(filterId: (typeof FILTERS)[number]["id"]) {
    const f = FILTERS.find((x) => x.id === filterId)!;
    const n = new URLSearchParams();
    for (const [k, v] of Object.entries(f.params)) n.set(k, v);
    const sort = sp.get("sort");
    if (sort) n.set("sort", sort);
    const q = n.toString();
    return q ? `${SHOP_LISTING}?${q}` : SHOP_LISTING;
  }

  return (
    <div>
      <header className="px-4 py-14 text-center md:py-16">
        <h1 className="font-serif text-[40px] font-normal text-choc md:text-[64px]">{heroHeadline}</h1>
        {heroSubtext ? (
          <p className="mx-auto mt-4 max-w-lg font-serif text-sm font-light text-text-mid">{heroSubtext}</p>
        ) : null}
      </header>

      {!hideFilters ? (
      <div className="border-y border-[0.5px] border-sand px-4 py-4 md:px-8 lg:px-10">
        <div className="mx-auto flex max-w-site flex-col gap-4 md:flex-row md:flex-wrap md:items-center md:justify-between">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0">
            {FILTERS.map((f) => (
              <Link
                key={f.id}
                href={filterHref(f.id)}
                className={cn(
                  "inline-flex min-h-[44px] shrink-0 items-center rounded-full px-5 font-sans text-[13px] font-normal transition-colors",
                  activeFilter === f.id
                    ? "bg-choc text-cream"
                    : "glass-1 glass-pill text-text-mid hover:opacity-80",
                )}
              >
                {f.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <span className="font-sans text-[13px] font-normal text-text-light">
              {total} {total === 1 ? "piece" : "pieces"}
            </span>
            <SortSelect />
          </div>
        </div>
      </div>
      ) : (
        <div className="border-y border-[0.5px] border-sand px-4 py-4 md:px-8 lg:px-10">
          <div className="mx-auto flex max-w-site justify-end">
            <span className="font-sans text-[13px] font-normal text-text-light">
              {total} {total === 1 ? "piece" : "pieces"}
            </span>
          </div>
        </div>
      )}

      <div className={items.length === 0 ? "px-4 py-20 md:px-8 lg:px-10" : undefined}>
        {items.length === 0 ? (
          <div className="flex flex-col items-center text-center">
            <p className="font-serif text-lg text-choc">No pieces match your filters</p>
            <Link
              href={SHOP_LISTING}
              className="mt-6 font-sans text-[11px] font-medium uppercase tracking-wider text-nut underline"
            >
              View all pieces
            </Link>
          </div>
        ) : (
          <ProductCardGrid
            products={items}
            variant="teaser"
            className="grid-cols-2 md:grid-cols-4"
          />
        )}

        <CatalogPagination
          page={page}
          totalPages={totalPages}
          hrefForPage={(p) => shopPageHref(sp, p)}
        />
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
        n.delete("limit");
        router.push(`${SHOP_LISTING}?${n.toString()}`);
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
