"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import * as Select from "@radix-ui/react-select";
import { ChevronDown } from "lucide-react";
import { cn, optimizeImageUrl } from "@/lib/utils";
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
const LOOK_SIZES = "(min-width: 1024px) 22vw, 100vw";
const FEATURED_SIZES = "(min-width: 1024px) 36vw, 100vw";

type LookStill = { url: string; alt: string };

function heroMetaLine(collection: CollectionHero, total: number) {
  const season = [collection.season, collection.year].filter(Boolean).join(" ");
  const pieces = `${total} ${total === 1 ? "piece" : "pieces"}`;
  return season ? `${season} — ${pieces}` : pieces;
}

function stillsFromProducts(cover: string | null, products: CollectionProductWithMeta[]): LookStill[] {
  const seen = new Set<string>();
  if (cover) seen.add(cover);
  const out: LookStill[] = [];
  for (const product of products) {
    const image = product.images.find((im) => im.isPrimary) ?? product.images[0];
    const url = image?.url?.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({ url, alt: image?.alt?.trim() || product.name });
    if (out.length >= 2) break;
  }
  return out;
}

function LookStillFrame({ look, sizes }: { look: LookStill; sizes: string }) {
  return (
    <div className="relative h-full min-h-0 overflow-hidden rounded-[26px]">
      <Image
        src={optimizeImageUrl(look.url, 1200)}
        alt={look.alt}
        fill
        sizes={sizes}
        className="object-cover object-top"
      />
    </div>
  );
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
  const sideLooks = useMemo(
    () => stillsFromProducts(collection.coverImage, initialProducts),
    [collection.coverImage, initialProducts],
  );

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
  const excerpt = collection.excerpt?.trim() ?? "";
  const statement = collection.description?.trim() ?? "";
  const subline = excerpt || heroMetaLine(collection, total);
  const showStatement = Boolean(statement) && statement !== excerpt;
  const hasStage = Boolean(heroReel || heroImg);
  const hasSides = sideLooks.length > 0;
  const sortLabel = useMemo(() => {
    if (!sort) return "Curated order";
    if (sort === "newest") return "Newest";
    if (sort === "price-asc") return "Price: Low–High";
    if (sort === "price-desc") return "Price: High–Low";
    return "Curated order";
  }, [sort]);

  const scrollToGrid = () => {
    const lenisOn = document.documentElement.classList.contains("lenis");
    document
      .getElementById("collection-products")
      ?.scrollIntoView({ behavior: lenisOn ? "auto" : "smooth", block: "start" });
  };

  const liveOthers = otherCollections.filter((o) => o.productCount > 0);

  return (
    <div className="min-h-screen bg-bg-card">
      <section className="hero-under-chrome hero-bleed-chrome relative flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-choc">
        <div className="relative min-h-0 flex-1 pt-3 max-lg:absolute max-lg:inset-0 max-lg:pt-0">
          {hasStage ? (
            <div
              className={cn(
                "absolute inset-0 min-h-0",
                hasSides && "lg:left-[40%] lg:grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.85fr)] lg:grid-rows-2 lg:gap-4 lg:p-5 lg:pr-8",
              )}
            >
              <div className={cn("relative h-full min-h-0", hasSides && "lg:row-span-2")}>
                <div className="absolute inset-0 overflow-hidden rounded-none lg:rounded-[26px]">
                  {heroReel ? (
                    <CollectionReelCell reel={heroReel} className="absolute inset-0 h-full w-full" />
                  ) : heroImg ? (
                    <Image
                      src={heroImg}
                      alt={collection.coverImageAlt || collection.name}
                      fill
                      priority
                      className="object-cover object-top"
                      sizes={FEATURED_SIZES}
                    />
                  ) : null}
                </div>
              </div>
              {sideLooks[0] ? (
                <div className="relative hidden min-h-0 lg:block">
                  <LookStillFrame look={sideLooks[0]} sizes={LOOK_SIZES} />
                </div>
              ) : null}
              {sideLooks[1] ? (
                <div className="relative hidden min-h-0 lg:block">
                  <LookStillFrame look={sideLooks[1]} sizes={LOOK_SIZES} />
                </div>
              ) : null}
            </div>
          ) : (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="select-none font-display text-[120px] font-normal italic text-white/[0.05] md:text-[200px]">
                {collection.name}
              </span>
            </div>
          )}

          <div
            className={cn("pointer-events-none absolute inset-0 z-[1]", hasStage && "lg:hidden")}
            style={{
              background: hasStage
                ? "linear-gradient(to top, rgb(26 15 8 / 0.62) 0%, rgb(26 15 8 / 0.18) 46%, transparent 72%)"
                : "none",
            }}
            aria-hidden
          />

          <div
            className={cn(
              "absolute z-[2] flex",
              hasStage
                ? "inset-x-0 bottom-0 items-end px-5 pb-10 md:px-10 md:pb-14 lg:inset-y-0 lg:right-auto lg:w-[40%] lg:items-center lg:px-10 lg:pb-0"
                : "inset-x-0 bottom-0 items-end px-5 pb-10 md:px-10 md:pb-14 lg:inset-y-0 lg:items-center lg:pb-0",
            )}
          >
            <div className={cn("relative w-full", hasStage ? "max-w-md lg:max-w-none" : "mx-auto max-w-site")}>
              <div className={cn("relative", hasStage ? "lg:max-w-[26rem]" : "max-w-xl")}>
                <div className="hero-copy-scrim" aria-hidden />
                <div className="glass-1 glass-panel hero-copy-panel px-6 py-8 md:px-8 md:py-10">
                  <h1 className="text-balance font-display text-[clamp(2.15rem,4.2vw,3.75rem)] font-normal italic leading-[1.08] text-choc">
                    {collection.name}
                  </h1>
                  <p className="mt-5 max-w-sm font-body text-sm font-light leading-relaxed text-text-mid">{subline}</p>
                  <button type="button" onClick={scrollToGrid} className="btn-primary mt-8 inline-flex active:scale-[0.97]">
                    Shop the collection
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {showStatement ? (
        <section className="mx-auto max-w-site px-6 py-12 lg:px-10 lg:py-16">
          <p className="max-w-[38rem] font-display text-[1.25rem] font-normal italic leading-[1.55] text-choc md:text-[1.375rem]">
            {statement}
          </p>
        </section>
      ) : null}

      <div className="sticky top-[var(--storefront-chrome-offset)] z-30 border-b border-mid-grey bg-bg-card">
        <div className="mx-auto flex min-h-12 max-w-site items-center justify-end gap-4 px-4 py-2 lg:px-10">
          <p className="whitespace-nowrap font-body text-[10px] text-dark-grey">
            {total} {total === 1 ? "piece" : "pieces"}
          </p>
          <Select.Root value={sort || "curated"} onValueChange={onSortChange}>
            <Select.Trigger className="inline-flex items-center gap-1 border-0 bg-transparent font-body text-[10px] font-medium uppercase tracking-[0.1em] text-olive outline-none">
              <Select.Value>{sortLabel}</Select.Value>
              <ChevronDown className="h-3 w-3 shrink-0 opacity-60" strokeWidth={1.5} aria-hidden />
            </Select.Trigger>
            <Select.Portal>
              <Select.Content
                position="popper"
                className="z-50 min-w-[11rem] border-x border-b border-mid-grey bg-bg-card shadow-md"
              >
                <Select.Viewport className="p-0">
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

      <section
        id="collection-products"
        className="scroll-mt-[calc(var(--storefront-chrome-offset)+3rem)] pb-16 pt-10 md:pb-20 md:pt-14"
      >
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

        <div className="mx-auto mt-12 flex max-w-site flex-col items-start gap-2 px-6 lg:px-10">
          {hasNext && !sortBusy && !loadingMore && (
            <button
              type="button"
              onClick={() => void loadMore()}
              className="border-0 bg-transparent p-0 font-body text-[13px] font-normal text-text-mid underline-offset-4 hover:underline"
            >
              Load more — showing {items.length} of {total}
            </button>
          )}
          {loadingMore && <p className="font-body text-[13px] font-normal text-text-mid">Loading…</p>}
        </div>
      </section>

      {liveOthers.length > 0 ? (
        <section className="px-6 pb-20 lg:px-10">
          <h2 className="font-display text-[clamp(1.75rem,3vw,2.25rem)] font-normal italic text-choc">
            More collections
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {liveOthers.map((o) => {
              const cover = o.coverImage ? optimizeImageUrl(o.coverImage, 800) : PRODUCT_IMAGE_PLACEHOLDER;
              return (
                <Link
                  key={o.slug}
                  href={`/collections/${o.slug}`}
                  className="group relative block overflow-hidden rounded-[26px] bg-ivory-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-olive"
                >
                  <div className="relative aspect-[3/4] overflow-hidden">
                    <Image
                      src={cover}
                      alt={o.name}
                      fill
                      className="object-cover object-top transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                    <div
                      className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[rgb(26_15_8_/_0.72)] via-[rgb(26_15_8_/_0.12)] to-transparent"
                      aria-hidden
                    />
                    <div className="absolute inset-x-0 bottom-0 p-5 md:p-6">
                      <h3 className="font-display text-[1.375rem] font-normal italic leading-tight text-ivory-deep">
                        {o.name}
                      </h3>
                      <p className="mt-1 font-body text-[12px] font-light text-ivory-deep/75">
                        {o.productCount} {o.productCount === 1 ? "piece" : "pieces"}
                      </p>
                    </div>
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
