"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import * as Select from "@radix-ui/react-select";
import { ChevronDown } from "lucide-react";
import { optimizeImageUrl } from "@/lib/utils";
import { PRODUCT_IMAGE_PLACEHOLDER } from "@/lib/product-image-url";
import { CollectionGalleryGrid } from "@/components/collections/CollectionGalleryGrid";
import { CollectionReelCell } from "@/components/collections/CollectionReelCell";
import { splitHeroAndGridReels, type CollectionReelRecord } from "@/lib/collection-gallery";
import type { CollectionProductWithMeta } from "@/lib/collection-products";

export type CollectionHero = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  excerpt: string | null;
  coverImage: string | null;
  coverImageAlt: string | null;
  autoTag: string | null;
  season: string | null;
  year: number | null;
};

export type OtherCollectionCard = {
  slug: string;
  name: string;
  coverImage: string | null;
  excerpt: string | null;
  productCount: number;
};

const PAGE_LIMIT = 24;

function heroMetaLine(collection: CollectionHero, total: number) {
  const season = [collection.season, collection.year].filter(Boolean).join(" ");
  const pieces = `${total} ${total === 1 ? "piece" : "pieces"}`;
  return season ? `${season} — ${pieces}` : pieces;
}

export function CollectionDetailPage({
  collection,
  initialProducts,
  total: initialTotal,
  initialPage,
  initialHasNext,
  otherCollections,
  reels = [],
  adminPreview = false,
}: {
  collection: CollectionHero;
  initialProducts: CollectionProductWithMeta[];
  total: number;
  initialPage: number;
  initialHasNext: boolean;
  otherCollections: OtherCollectionCard[];
  reels?: CollectionReelRecord[];
  adminPreview?: boolean;
}) {
  const [sort, setSort] = useState("");
  const [items, setItems] = useState(initialProducts);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);
  const [hasNext, setHasNext] = useState(initialHasNext);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sortBusy, setSortBusy] = useState(false);

  const { hero: heroReel, grid: gridReels } = useMemo(() => splitHeroAndGridReels(reels), [reels]);

  useEffect(() => {
    setItems(initialProducts);
    setTotal(initialTotal);
    setPage(initialPage);
    setHasNext(initialHasNext);
  }, [collection.slug, initialProducts, initialTotal, initialPage, initialHasNext]);

  const refetchFirstPage = useCallback(
    async (nextSort: string) => {
      setSortBusy(true);
      try {
        const u = new URLSearchParams();
        u.set("page", "1");
        u.set("limit", String(PAGE_LIMIT));
        if (nextSort) u.set("sort", nextSort);
        const res = await fetch(`/api/collections/${collection.slug}?${u.toString()}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          products: CollectionProductWithMeta[];
          total: number;
          page: number;
          hasNext: boolean;
        };
        setItems(data.products);
        setTotal(data.total);
        setPage(data.page);
        setHasNext(data.hasNext);
      } finally {
        setSortBusy(false);
      }
    },
    [collection.slug],
  );

  const onSortChange = (value: string) => {
    const v = value === "curated" ? "" : value;
    setSort(v);
    void refetchFirstPage(v);
  };

  const loadMore = useCallback(async () => {
    if (!hasNext || loadingMore || sortBusy) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const u = new URLSearchParams();
      u.set("page", String(next));
      u.set("limit", String(PAGE_LIMIT));
      if (sort) u.set("sort", sort);
      const res = await fetch(`/api/collections/${collection.slug}?${u.toString()}`);
      if (!res.ok) throw new Error("fetch failed");
      const data = (await res.json()) as {
        products: CollectionProductWithMeta[];
        page: number;
        hasNext: boolean;
      };
      setItems((prev) => [...prev, ...data.products]);
      setPage(data.page);
      setHasNext(data.hasNext);
    } catch {
      /* ignore */
    } finally {
      setLoadingMore(false);
    }
  }, [collection.slug, hasNext, loadingMore, sortBusy, page, sort]);

  const heroImg = collection.coverImage ? optimizeImageUrl(collection.coverImage, 1920) : null;
  const sortLabel = useMemo(() => {
    if (!sort) return "Curated order";
    if (sort === "newest") return "Newest";
    if (sort === "price-asc") return "Price: Low–High";
    if (sort === "price-desc") return "Price: High–Low";
    return "Curated order";
  }, [sort]);

  const scrollToGrid = () => {
    document.getElementById("collection-products")?.scrollIntoView({ behavior: "smooth" });
  };

  const liveOthers = otherCollections.filter((o) => o.productCount > 0);

  return (
    <div className="min-h-screen">
      <section className="relative h-[100svh] min-h-[480px] w-full overflow-hidden bg-choc">
        {heroReel ? (
          <div className="absolute inset-0">
            <CollectionReelCell reel={heroReel} className="absolute inset-0 h-full w-full" />
          </div>
        ) : heroImg ? (
          <Image
            src={heroImg}
            alt={collection.coverImageAlt || collection.name}
            fill
            priority
            className="object-cover object-top"
            sizes="100vw"
          />
        ) : (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="select-none font-display text-[120px] font-normal italic text-white/[0.05] md:text-[200px]">
              {collection.name}
            </span>
          </div>
        )}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[rgb(68_41_19_/_0.72)] via-transparent to-transparent"
          aria-hidden
        />

        <div className="absolute bottom-8 left-4 right-4 md:bottom-12 md:left-10 md:right-auto md:max-w-md">
          <div className="glass-1 glass-panel px-6 py-6 md:px-8 md:py-8">
            <h1 className="max-w-[14ch] font-display text-[40px] font-normal leading-[0.95] text-choc md:text-[56px]">
              {collection.name}
            </h1>
            <p className="mt-3 font-sans text-[13px] font-normal text-text-mid">{heroMetaLine(collection, total)}</p>
            <button type="button" onClick={scrollToGrid} className="btn-primary mt-6">
              Shop the collection
            </button>
          </div>
        </div>
      </section>

      {collection.description ? (
        <section className="mx-auto max-w-site px-6 py-16 md:py-20 lg:px-10">
          <p className="max-w-[42rem] text-left font-display text-[20px] font-normal italic leading-[1.7] text-choc md:text-[22px]">
            {collection.description}
          </p>
        </section>
      ) : null}

      <section id="collection-products" className="pb-16 md:pb-20">
        <div className="mx-auto mb-6 flex max-w-[1400px] flex-wrap items-center gap-2 px-4 md:px-6">
          <p className="glass-1 glass-pill px-4 py-2 font-sans text-[13px] font-normal text-text-primary">
            {total} {total === 1 ? "piece" : "pieces"}
          </p>
          <Select.Root value={sort || "curated"} onValueChange={onSortChange}>
            <Select.Trigger className="glass-1 glass-pill inline-flex items-center gap-1 px-4 py-2 font-sans text-[13px] font-normal text-text-primary outline-none">
              <Select.Value>{sortLabel}</Select.Value>
              <ChevronDown className="h-3 w-3 opacity-60" strokeWidth={1.5} aria-hidden />
            </Select.Trigger>
            <Select.Portal>
              <Select.Content position="popper" className="glass-2 glass-panel z-50 min-w-[11rem] shadow-md">
                <Select.Viewport className="p-1">
                  {(
                    [
                      ["curated", "Curated order"],
                      ["newest", "Newest"],
                      ["price-asc", "Price: Low–High"],
                      ["price-desc", "Price: High–Low"],
                    ] as const
                  ).map(([value, label]) => (
                    <Select.Item
                      key={value}
                      value={value}
                      className="cursor-pointer rounded-[999px] px-4 py-2 font-sans text-[13px] font-normal text-charcoal outline-none hover:bg-[var(--ivory-deep)]"
                    >
                      {label}
                    </Select.Item>
                  ))}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </div>

        {sortBusy ? (
          <div className="grid grid-cols-2 gap-px bg-white md:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="overflow-hidden bg-ivory-dark">
                <div className="aspect-[3/4] animate-pulse bg-ivory-dark" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <p
            className="px-6 py-16 text-left font-sans text-[14px] font-normal text-text-mid"
            data-collection-empty={adminPreview ? "preview" : undefined}
          >
            No pieces yet — add pieces on the collection page in admin.
          </p>
        ) : (
          <CollectionGalleryGrid products={items} reels={gridReels} priorityCount={8} />
        )}

        <div className="mx-auto mt-12 flex max-w-[1400px] flex-col items-start gap-2 px-6">
          {hasNext && !sortBusy && !loadingMore && (
            <button
              type="button"
              onClick={() => void loadMore()}
              className="border-0 bg-transparent p-0 font-sans text-[13px] font-normal text-text-mid underline-offset-4 hover:underline"
            >
              Load more — showing {items.length} of {total}
            </button>
          )}
          {loadingMore && <p className="font-sans text-[13px] font-normal text-text-mid">Loading…</p>}
        </div>
      </section>

      {liveOthers.length > 0 ? (
        <section className="px-6 pb-20 lg:px-10">
          <h2 className="font-display text-[28px] font-normal text-choc md:text-[36px]">More collections</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {liveOthers.map((o) => {
              const cover = o.coverImage ? optimizeImageUrl(o.coverImage, 800) : PRODUCT_IMAGE_PLACEHOLDER;
              return (
                <Link
                  key={o.slug}
                  href={`/collections/${o.slug}`}
                  className="glass-2 glass-panel glass-lift group block overflow-hidden"
                >
                  <div className="relative aspect-[3/4] overflow-hidden bg-ivory-dark">
                    <Image src={cover} alt={o.name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
                  </div>
                  <div className="px-4 py-4">
                    <h3 className="font-display text-[20px] font-normal text-choc">{o.name}</h3>
                    <p className="mt-1 font-sans text-[13px] font-normal text-text-mid">
                      {o.productCount} {o.productCount === 1 ? "piece" : "pieces"}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
