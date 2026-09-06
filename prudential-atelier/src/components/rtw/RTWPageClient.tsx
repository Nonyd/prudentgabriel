"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as Select from "@radix-ui/react-select";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductCardGrid } from "@/components/common/ProductCardGrid";
import { CatalogPagination } from "@/components/shop/CatalogPagination";
import type { ProductListItem } from "@/types/product";
import { CATALOG_PAGE_SIZE } from "@/lib/rtw-aisle";

type ChipId = "ALL" | "GOWNS" | "PANTS" | "DRESSES" | "JUMPSUITS" | "SETS" | "SUITS";

const CHIPS: { id: ChipId; label: string; tag?: string }[] = [
  { id: "ALL", label: "ALL" },
  { id: "GOWNS", label: "GOWNS", tag: "gown" },
  { id: "PANTS", label: "PANTS", tag: "pants" },
  { id: "DRESSES", label: "DRESSES", tag: "dress" },
  { id: "JUMPSUITS", label: "JUMPSUITS", tag: "jumpsuit" },
  { id: "SETS", label: "SETS", tag: "set" },
  { id: "SUITS", label: "SUITS", tag: "suit" },
];

function activeChipFromSearchParams(sp: URLSearchParams): ChipId {
  const raw = sp.get("tags") ?? sp.get("tag");
  if (!raw) return "ALL";
  const first = raw.split(",")[0]?.trim();
  const match = CHIPS.find((c) => c.tag === first);
  return match?.id ?? "ALL";
}

function rtwHref(sp: URLSearchParams, updates: Record<string, string | null>): string {
  const n = new URLSearchParams();
  const sort = updates.sort !== undefined ? updates.sort : sp.get("sort");
  const collection = updates.collection !== undefined ? updates.collection : sp.get("collection");
  const tags = updates.tags !== undefined ? updates.tags : (sp.get("tags") ?? sp.get("tag"));
  const page = updates.page !== undefined ? updates.page : null;
  if (sort && sort !== "featured") n.set("sort", sort);
  if (collection) n.set("collection", collection);
  if (tags) n.set("tags", tags);
  if (page && page !== "1") n.set("page", page);
  const q = n.toString();
  return q ? `/rtw?${q}` : "/rtw";
}

function RTWGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 bg-transparent px-4 md:grid-cols-4 lg:px-6">
      {Array.from({ length: CATALOG_PAGE_SIZE }).map((_, i) => (
        <div key={i} className="glass-2 glass-panel overflow-hidden">
          <div className="aspect-[3/4] animate-pulse bg-ivory-dark" />
        </div>
      ))}
    </div>
  );
}

export interface RTWPageClientProps {
  initialProducts: ProductListItem[];
  total: number;
  page: number;
  totalPages: number;
  hasNext: boolean;
  collections: { name: string; slug: string }[];
  heroLabel: string;
  heroTitle: string;
  heroSubtitle?: string;
}

export function RTWPageClient({
  initialProducts,
  total,
  page: initialPage,
  totalPages,
  collections,
  heroLabel,
  heroTitle,
  heroSubtitle,
}: RTWPageClientProps) {
  const sp = useSearchParams();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState(initialProducts);
  const [page, setPage] = useState(initialPage);

  const queryKey = sp.toString();

  useEffect(() => {
    setItems(initialProducts);
    setPage(initialPage);
  }, [initialProducts, initialPage, queryKey]);

  const activeChip = useMemo(() => activeChipFromSearchParams(sp), [sp]);
  const collectionValue = sp.get("collection") || "all";

  const sortValue = sp.get("sort") ?? "featured";
  const sortTriggerLabel =
    sortValue === "price-asc"
      ? "PRICE: LOW–HIGH"
      : sortValue === "price-desc"
        ? "PRICE: HIGH–LOW"
        : sortValue === "newest"
          ? "RECENT"
          : sortValue === "bestsellers"
            ? "BEST SELLING"
            : "FEATURED";

  const go = (href: string) => startTransition(() => router.push(href, { scroll: false }));

  return (
    <div className="min-h-screen bg-bg-card pb-20">
      <header className="flex h-[140px] flex-col items-center justify-center border-b border-mid-grey bg-bg-card md:h-[200px]">
        <p className="font-body text-[9px] font-medium uppercase tracking-[0.25em] text-dark-grey">{heroLabel}</p>
        <h1 className="mt-2 text-center font-display text-[32px] font-normal italic leading-[0.95] text-black md:text-[56px]">
          {heroTitle}
        </h1>
        {heroSubtitle ? (
          <p className="mx-auto mt-3 max-w-lg text-center font-body text-sm font-light text-dark-grey">{heroSubtitle}</p>
        ) : null}
      </header>

      <div className="sticky top-0 z-30 border-b border-mid-grey bg-bg-card">
        <div className="mx-auto flex min-h-12 max-w-site flex-col gap-2 px-4 py-2 lg:flex-row lg:items-center lg:gap-4 lg:px-10">
          <div className="scrollbar-hide flex min-w-0 flex-1 items-center gap-0 overflow-x-auto">
            {CHIPS.map((chip) => {
              const selected = activeChip === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  aria-current={selected ? "true" : undefined}
                  onClick={() => go(rtwHref(sp, { tags: chip.tag ?? null }))}
                  className={cn(
                    "shrink-0 border border-transparent px-4 py-1.5 font-body text-[10px] font-medium uppercase tracking-[0.1em] transition-colors duration-150 ease-out",
                    selected
                      ? "border-black text-black"
                      : "text-dark-grey hover:border-mid-grey hover:text-black",
                  )}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
          <div className="flex shrink-0 items-center gap-4">
            {collections.length > 0 ? (
              <Select.Root
                value={collectionValue}
                onValueChange={(v) => go(rtwHref(sp, { collection: v === "all" ? null : v }))}
              >
                <Select.Trigger className="inline-flex items-center gap-1 border-0 bg-transparent font-body text-[10px] font-medium uppercase tracking-[0.1em] text-olive outline-none">
                  <Select.Value>
                    {collectionValue === "all"
                      ? "ALL COLLECTIONS"
                      : collections.find((c) => c.slug === collectionValue)?.name ?? "ALL COLLECTIONS"}
                  </Select.Value>
                  <ChevronDown className="h-3 w-3 shrink-0 opacity-60" strokeWidth={1.5} aria-hidden />
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content
                    position="popper"
                    className="z-50 min-w-[11rem] border-x border-b border-mid-grey bg-bg-card shadow-md"
                  >
                    <Select.Viewport className="p-0">
                      <Select.Item
                        value="all"
                        className="cursor-pointer px-5 py-2.5 font-body text-[12px] text-charcoal outline-none hover:bg-[#FAFAFA] hover:text-olive"
                      >
                        All collections
                      </Select.Item>
                      {collections.map((c) => (
                        <Select.Item
                          key={c.slug}
                          value={c.slug}
                          className="cursor-pointer px-5 py-2.5 font-body text-[12px] text-charcoal outline-none hover:bg-[#FAFAFA] hover:text-olive"
                        >
                          {c.name}
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            ) : null}
            <p className="whitespace-nowrap font-body text-[10px] text-dark-grey">{total} pieces</p>
            <Select.Root
              value={sortValue}
              onValueChange={(v) => go(rtwHref(sp, { sort: v }))}
            >
              <Select.Trigger className="inline-flex items-center gap-1 border-0 bg-transparent font-body text-[10px] font-medium uppercase tracking-[0.1em] text-olive outline-none transition-colors">
                <Select.Value>{sortTriggerLabel}</Select.Value>
                <ChevronDown className="h-3 w-3 shrink-0 opacity-60" strokeWidth={1.5} aria-hidden />
              </Select.Trigger>
              <Select.Portal>
                <Select.Content
                  position="popper"
                  className="z-50 min-w-[10rem] border-x border-b border-mid-grey bg-bg-card shadow-md"
                >
                  <Select.Viewport className="p-0">
                    {(
                      [
                        ["featured", "Featured"],
                        ["newest", "Recent"],
                        ["bestsellers", "Best selling"],
                        ["price-asc", "Price: Low–High"],
                        ["price-desc", "Price: High–Low"],
                      ] as const
                    ).map(([value, label]) => (
                      <Select.Item
                        key={value}
                        value={value}
                        className="cursor-pointer px-5 py-2.5 font-body text-[12px] text-charcoal outline-none hover:bg-[#FAFAFA] hover:text-olive"
                      >
                        {label}
                      </Select.Item>
                    ))}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
          </div>
        </div>
      </div>

      <div className="pt-10 md:pt-14">
        {isPending ? (
          <RTWGridSkeleton />
        ) : items.length === 0 ? (
          <p className="py-20 text-center font-body text-sm text-dark-grey">No pieces in this view yet.</p>
        ) : (
          <ProductCardGrid
            products={items}
            variant="teaser"
            priorityCount={8}
            className="grid-cols-2 md:grid-cols-4"
          />
        )}

        {!isPending ? (
          <CatalogPagination
            page={page}
            totalPages={totalPages}
            hrefForPage={(p) => rtwHref(sp, { page: p <= 1 ? null : String(p) })}
          />
        ) : null}
      </div>
    </div>
  );
}
