"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as Select from "@radix-ui/react-select";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductCardGrid } from "@/components/common/ProductCardGrid";
import { CatalogPagination } from "@/components/shop/CatalogPagination";
import { RTWLandingHero } from "@/components/rtw/RTWLandingHero";
import type { HeroCarouselItem } from "@/lib/hero-carousel";
import { CATALOG_PAGE_SIZE } from "@/lib/rtw-aisle";
import { RTW_GRID_ID, type RTWHeroLook } from "@/lib/rtw-hero";
import type { ProductListItem } from "@/types/product";

type ChipId = "ALL" | "DRESSES" | "JUMPSUITS" | "SETS" | "SUITS";

const CHIPS: { id: ChipId; label: string; tag?: string }[] = [
  { id: "ALL", label: "All" },
  { id: "DRESSES", label: "Dresses", tag: "dress" },
  { id: "JUMPSUITS", label: "Jumpsuits", tag: "jumpsuit" },
  { id: "SETS", label: "Sets", tag: "set" },
  { id: "SUITS", label: "Suits", tag: "suit" },
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
  heroItems: HeroCarouselItem[];
  heroLooks?: RTWHeroLook[];
  heroSideLooks?: RTWHeroLook[];
  heroHeadline: string;
  heroSubline: string;
  heroCta: string;
  promiseBand: string;
}

export function RTWPageClient({
  initialProducts,
  total,
  page: initialPage,
  totalPages,
  collections,
  heroItems,
  heroLooks = [],
  heroSideLooks = [],
  heroHeadline,
  heroSubline,
  heroCta,
  promiseBand,
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
      ? "Price: low–high"
      : sortValue === "price-desc"
        ? "Price: high–low"
        : sortValue === "newest"
          ? "Recent"
          : sortValue === "bestsellers"
            ? "Best selling"
            : "Featured";

  const go = (href: string) => startTransition(() => router.push(href, { scroll: false }));

  return (
    <div className="min-h-screen bg-bg-card pb-20">
      <RTWLandingHero
        items={heroItems}
        looks={heroLooks}
        sideLooks={heroSideLooks}
        headline={heroHeadline}
        subline={heroSubline}
        ctaLabel={heroCta}
      />

      <div className="border-b border-mid-grey px-4 py-4 lg:px-10">
        <div className="mx-auto flex max-w-site gap-2 overflow-x-auto pb-1 lg:flex-wrap lg:overflow-visible lg:pb-0">
          {CHIPS.map((chip) => {
            const selected = activeChip === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                aria-current={selected ? "true" : undefined}
                onClick={() => go(rtwHref(sp, { tags: chip.tag ?? null }))}
                className={cn(
                  "glass-1 glass-pill min-h-9 shrink-0 px-4 py-1.5 font-body text-[13px] font-normal tracking-normal transition-opacity duration-150 ease-out active:scale-[0.97]",
                  selected ? "border-[var(--glass-edge-bright)] text-choc" : "text-dark-grey hover:text-choc",
                )}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="sticky top-0 z-30 border-b border-mid-grey bg-bg-card">
        <div className="mx-auto flex min-h-12 max-w-site items-center justify-end gap-4 px-4 py-2 lg:px-10">
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
          <Select.Root value={sortValue} onValueChange={(v) => go(rtwHref(sp, { sort: v }))}>
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

      <div id={RTW_GRID_ID} className="scroll-mt-36 pt-10 md:scroll-mt-28 md:pt-14">
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

      {promiseBand.trim() ? (
        <p className="mx-auto mt-16 max-w-site px-6 text-center font-body text-sm font-light text-dark-grey lg:px-10">
          {promiseBand}
        </p>
      ) : null}
    </div>
  );
}
