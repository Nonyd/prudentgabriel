"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as Select from "@radix-ui/react-select";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { RTWProductCard } from "@/components/rtw/RTWProductCard";
import type { ProductListItem } from "@/types/product";

type ChipId = "ALL" | "DRESSES" | "JUMPSUITS" | "SETS" | "SUITS" | "KIDDIES" | "ACCESSORIES";

const CHIPS: { id: ChipId; label: string }[] = [
  { id: "ALL", label: "ALL" },
  { id: "DRESSES", label: "DRESSES" },
  { id: "JUMPSUITS", label: "JUMPSUITS" },
  { id: "SETS", label: "SETS" },
  { id: "SUITS", label: "SUITS" },
  { id: "KIDDIES", label: "KIDDIES" },
  { id: "ACCESSORIES", label: "ACCESSORIES" },
];

function activeChipFromSearchParams(sp: URLSearchParams): ChipId {
  const c = sp.get("category");
  if (c === "KIDDIES") return "KIDDIES";
  if (c === "ACCESSORIES") return "ACCESSORIES";
  const raw = sp.get("tags") ?? sp.get("tag");
  if (!raw) return "ALL";
  const first = raw.split(",")[0]?.trim();
  if (first === "dress") return "DRESSES";
  if (first === "jumpsuit") return "JUMPSUITS";
  if (first === "set") return "SETS";
  if (first === "suit") return "SUITS";
  return "ALL";
}

function chipHref(sp: URLSearchParams, chip: ChipId): string {
  const sort = sp.get("sort") ?? "newest";
  const n = new URLSearchParams();
  if (sort && sort !== "newest") n.set("sort", sort);
  switch (chip) {
    case "ALL":
      break;
    case "DRESSES":
      n.set("tags", "dress");
      break;
    case "JUMPSUITS":
      n.set("tags", "jumpsuit");
      break;
    case "SETS":
      n.set("tags", "set");
      break;
    case "SUITS":
      n.set("tags", "suit");
      break;
    case "KIDDIES":
      n.set("category", "KIDDIES");
      break;
    case "ACCESSORIES":
      n.set("category", "ACCESSORIES");
      break;
    default:
      break;
  }
  const q = n.toString();
  return q ? `/rtw?${q}` : "/rtw";
}

function augmentProductQuery(sp: URLSearchParams): URLSearchParams {
  const u = new URLSearchParams(sp.toString());
  u.set("type", "RTW");
  u.set("excludeCategory", "BRIDAL");
  if (!u.get("limit")) u.set("limit", "40");
  return u;
}

function RTWGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-px bg-mid-grey md:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="aspect-[3/4] animate-pulse bg-[#F8F8F6]" />
      ))}
    </div>
  );
}

export interface RTWPageClientProps {
  initialProducts: ProductListItem[];
  total: number;
  page: number;
  hasNext: boolean;
  heroLabel: string;
  heroTitle: string;
}

export function RTWPageClient({
  initialProducts,
  total,
  page: initialPage,
  hasNext: initialHasNext,
  heroLabel,
  heroTitle,
}: RTWPageClientProps) {
  const sp = useSearchParams();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState(initialProducts);
  const [page, setPage] = useState(initialPage);
  const [hasMore, setHasMore] = useState(initialHasNext);
  const [loadingMore, setLoadingMore] = useState(false);

  const queryKey = sp.toString();

  useEffect(() => {
    setItems(initialProducts);
    setPage(initialPage);
    setHasMore(initialHasNext);
  }, [initialProducts, initialPage, initialHasNext, queryKey]);

  const activeChip = useMemo(() => activeChipFromSearchParams(sp), [sp]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || isPending) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const u = augmentProductQuery(new URLSearchParams(sp.toString()));
      u.set("page", String(next));
      const res = await fetch(`/api/products?${u.toString()}`);
      if (!res.ok) throw new Error("fetch failed");
      const data = (await res.json()) as {
        products: ProductListItem[];
        hasNext: boolean;
        page: number;
      };
      setItems((prev) => [...prev, ...data.products]);
      setPage(data.page);
      setHasMore(data.hasNext);
    } catch {
      /* ignore */
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, isPending, page, sp]);

  const sortValue = sp.get("sort") ?? "newest";
  const sortTriggerLabel =
    sortValue === "price-asc"
      ? "PRICE: LOW–HIGH"
      : sortValue === "price-desc"
        ? "PRICE: HIGH–LOW"
        : "NEWEST";

  return (
    <div className="min-h-screen bg-white pb-20">
      <header className="flex h-[140px] flex-col items-center justify-center border-b border-mid-grey bg-white md:h-[200px]">
        <p className="font-body text-[9px] font-medium uppercase tracking-[0.25em] text-dark-grey">{heroLabel}</p>
        <h1 className="mt-2 text-center font-display text-[32px] font-normal italic leading-[0.95] text-black md:text-[56px]">
          {heroTitle}
        </h1>
      </header>

      <div className="sticky top-0 z-30 border-b border-mid-grey bg-white">
        <div className="mx-auto flex h-12 max-w-[1600px] items-center gap-4 px-6">
          <div className="scrollbar-hide flex min-w-0 flex-1 items-center gap-0 overflow-x-auto">
            {CHIPS.map((chip) => {
              const selected = activeChip === chip.id;
              const href = chipHref(sp, chip.id);
              return (
                <button
                  key={chip.id}
                  type="button"
                  aria-current={selected ? "true" : undefined}
                  onClick={() =>
                    startTransition(() => {
                      router.push(href, { scroll: false });
                    })
                  }
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
          <div className="ml-auto flex shrink-0 items-center gap-4">
            <p className="whitespace-nowrap font-body text-[10px] text-dark-grey">{total} pieces</p>
            <Select.Root
              value={sortValue}
              onValueChange={(v) => {
                const n = augmentProductQuery(new URLSearchParams(sp.toString()));
                n.set("sort", v);
                n.delete("page");
                startTransition(() => {
                  router.push(`/rtw?${n.toString()}`, { scroll: false });
                });
              }}
            >
              <Select.Trigger
                className={cn(
                  "inline-flex items-center gap-1 border-0 bg-transparent font-body text-[10px] font-medium uppercase tracking-[0.1em] text-olive outline-none transition-colors",
                )}
              >
                <Select.Value>{sortTriggerLabel}</Select.Value>
                <ChevronDown className="h-3 w-3 shrink-0 opacity-60" strokeWidth={1.5} aria-hidden />
              </Select.Trigger>
              <Select.Portal>
                <Select.Content
                  position="popper"
                  className="z-50 min-w-[10rem] border-x border-b border-mid-grey bg-white shadow-md"
                >
                  <Select.Viewport className="p-0">
                    {(
                      [
                        ["newest", "Newest"],
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

      <div className="mx-auto max-w-[1600px] px-4 pt-8">
        {isPending ? (
          <RTWGridSkeleton />
        ) : items.length === 0 ? (
          <p className="py-20 text-center font-body text-sm text-dark-grey">No pieces in this view yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-px bg-mid-grey md:grid-cols-3 xl:grid-cols-4">
            {items.map((p, index) => (
              <div key={p.id} className="bg-white">
                <RTWProductCard product={p} priority={index < 8} />
              </div>
            ))}
          </div>
        )}

        <div className="mt-12 flex flex-col items-center gap-2">
          {hasMore && !isPending && !loadingMore && (
            <button
              type="button"
              onClick={() => void loadMore()}
              className="cursor-pointer border-0 bg-transparent p-0 font-body text-[11px] font-medium uppercase tracking-wide text-dark-grey underline-offset-2 hover:underline"
            >
              LOAD MORE — Showing {items.length} of {total}
            </button>
          )}
          {loadingMore && (
            <p className="font-body text-[11px] font-medium uppercase tracking-wide text-dark-grey">LOADING...</p>
          )}
          {!hasMore && items.length > 0 && (
            <p className="font-body text-[10px] text-dark-grey/50">— {total} pieces —</p>
          )}
        </div>
      </div>
    </div>
  );
}
