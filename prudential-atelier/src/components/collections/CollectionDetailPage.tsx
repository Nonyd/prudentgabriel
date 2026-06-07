"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import * as Select from "@radix-ui/react-select";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn, optimizeImageUrl } from "@/lib/utils";
import { PRODUCT_IMAGE_PLACEHOLDER } from "@/lib/product-image-url";
import { RTWProductCard } from "@/components/rtw/RTWProductCard";
import type { CollectionProductWithMeta } from "@/lib/collection-products";
import type { ProductListItem } from "@/types/product";

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

export function CollectionDetailPage({
  collection,
  initialProducts,
  total: initialTotal,
  initialPage,
  initialHasNext,
  otherCollections,
}: {
  collection: CollectionHero;
  initialProducts: CollectionProductWithMeta[];
  total: number;
  initialPage: number;
  initialHasNext: boolean;
  otherCollections: OtherCollectionCard[];
}) {
  const [sort, setSort] = useState("");
  const [items, setItems] = useState(initialProducts);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);
  const [hasNext, setHasNext] = useState(initialHasNext);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sortBusy, setSortBusy] = useState(false);

  useEffect(() => {
    setItems(initialProducts);
    setTotal(initialTotal);
    setPage(initialPage);
    setHasNext(initialHasNext);
  }, [collection.slug, initialProducts, initialTotal, initialPage, initialHasNext]);

  const refetchFirstPage = useCallback(async (nextSort: string) => {
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
  }, [collection.slug]);

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

  return (
    <div className="min-h-screen bg-bg-card">
      <section className="relative h-[100svh] min-h-[480px] w-full overflow-hidden bg-charcoal">
        {heroImg ? (
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
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[rgba(10,10,10,0.85)] via-transparent to-transparent"
          style={{ backgroundSize: "100% 100%" }}
        />
        <div className="pointer-events-none absolute bottom-8 right-6 hidden flex-col items-center gap-2 text-white/40 md:flex">
          <span className="font-body text-[9px] font-medium uppercase tracking-[0.2em] [writing-mode:vertical-rl]">
            Scroll
          </span>
          <span className="h-12 w-px bg-bg-card/30" />
        </div>

        <div className="absolute bottom-8 left-6 right-6 md:bottom-16 md:left-16 md:right-auto">
          <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}>
            <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
              {collection.season ? (
                <p className="mb-3 font-body text-[10px] font-medium uppercase tracking-[0.2em] text-white/50">
                  {collection.season} collection
                </p>
              ) : null}
            </motion.div>
            <motion.h1
              variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
              className="max-w-[14ch] font-display text-[40px] font-normal italic leading-[0.9] text-white md:text-[72px]"
            >
              {collection.name}
            </motion.h1>
            {collection.excerpt ? (
              <motion.p
                variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
                className="mt-4 max-w-lg font-body text-[16px] font-light text-white/70"
              >
                {collection.excerpt}
              </motion.p>
            ) : null}
            <motion.div
              variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
              className="mt-6 flex flex-wrap gap-8 font-body text-[11px] font-medium uppercase tracking-[0.12em] text-white/60"
            >
              <span>
                {total} {total === 1 ? "piece" : "pieces"}
              </span>
              {collection.season || collection.year ? (
                <span>
                  Season {collection.season ?? "—"}
                  {collection.year ? ` ${collection.year}` : ""}
                </span>
              ) : null}
            </motion.div>
            <motion.div variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }} className="mt-8">
              <button
                type="button"
                onClick={scrollToGrid}
                className="border border-white px-10 py-3.5 font-body text-[11px] font-medium uppercase tracking-[0.12em] text-white transition-colors hover:bg-bg-card hover:text-black"
              >
                Shop the collection
              </button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {collection.description ? (
        <section className="bg-bg-card py-16 md:py-20">
          <div className="mx-auto max-w-2xl px-6 text-center">
            <p className="font-body text-[12px] tracking-[0.3em] text-gold/40">—— ◆ ——</p>
            <p className="mt-6 font-display text-[20px] font-normal italic leading-[1.7] text-charcoal md:text-[22px]">
              {collection.description}
            </p>
          </div>
        </section>
      ) : null}

      <section
        id="collection-products"
        className={cn("py-12 md:py-16", collection.description ? "bg-bg-page" : "bg-bg-card")}
      >
        <div className="mx-auto mb-8 flex max-w-[1400px] flex-col gap-4 px-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-body text-[11px] font-medium uppercase tracking-[0.12em] text-dark-grey/50">
            {total} {total === 1 ? "piece" : "pieces"} in this collection
          </p>
          <Select.Root value={sort || "curated"} onValueChange={onSortChange}>
            <Select.Trigger
              className={cn(
                "inline-flex items-center gap-1 border-0 bg-transparent font-body text-[10px] font-medium uppercase tracking-[0.1em] text-olive outline-none",
              )}
            >
              <Select.Value>{sortLabel}</Select.Value>
              <ChevronDown className="h-3 w-3 opacity-60" strokeWidth={1.5} aria-hidden />
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

        {sortBusy ? (
          <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-4 px-6 md:grid-cols-3 md:gap-5 xl:grid-cols-4 xl:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="overflow-hidden border border-sand/70 bg-bg-card">
                <div className="aspect-[3/4] animate-pulse bg-ivory-dark" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-16 text-center font-body text-[14px] text-dark-grey">No products in this collection yet.</p>
        ) : (
          <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-4 px-6 md:grid-cols-3 md:gap-5 xl:grid-cols-4 xl:gap-6">
            {items.map((p, index) => {
              const cardProduct: ProductListItem = {
                id: p.id,
                name: p.name,
                slug: p.slug,
                description: p.description,
                category: p.category,
                type: p.type,
                basePriceNGN: p.basePriceNGN,
                isOnSale: p.isOnSale,
                isNewArrival: p.isNewArrival,
                isBespokeAvail: p.isBespokeAvail,
                isFeatured: p.isFeatured,
                tags: p.tags,
                images: p.images,
                variants: p.variants,
                colors: p.colors,
                _count: p._count,
              };
              return <RTWProductCard key={p.id} product={cardProduct} priority={index < 8} />;
            })}
          </div>
        )}

        <div className="mx-auto mt-12 flex max-w-[1400px] flex-col items-center gap-2 px-6">
          {hasNext && !sortBusy && !loadingMore && (
            <button
              type="button"
              onClick={() => void loadMore()}
              className="border-0 bg-transparent p-0 font-body text-[11px] font-medium uppercase tracking-wide text-dark-grey underline-offset-2 hover:underline"
            >
              Load more — Showing {items.length} of {total}
            </button>
          )}
          {loadingMore && (
            <p className="font-body text-[11px] font-medium uppercase tracking-wide text-dark-grey">Loading…</p>
          )}
        </div>
      </section>

      {otherCollections.length > 0 ? (
        <section className="bg-[#F5F5F3] py-16 md:py-20">
          <h2 className="text-center font-display text-[28px] font-normal italic text-charcoal md:text-[36px]">
            Explore more collections
          </h2>
          <div className="mx-auto mt-10 grid max-w-[1400px] gap-8 px-6 md:grid-cols-3">
            {otherCollections.map((o) => {
              const cover = o.coverImage ? optimizeImageUrl(o.coverImage, 800) : PRODUCT_IMAGE_PLACEHOLDER;
              return (
                <Link key={o.slug} href={`/collections/${o.slug}`} className="group block">
                  <div className="img-portrait relative overflow-hidden bg-[#EAEAE8]">
                    <Image
                      src={cover}
                      alt={o.name}
                      fill
                      className="object-cover transition-transform duration-[600ms] ease-out group-hover:scale-[1.03]"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                  </div>
                  <h3 className="mt-3 font-display text-[20px] font-normal italic text-charcoal">{o.name}</h3>
                  <p className="mt-1 font-body text-[11px] text-dark-grey">
                    {o.productCount} {o.productCount === 1 ? "piece" : "pieces"}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
