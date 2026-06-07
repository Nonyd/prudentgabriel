"use client";

import Image from "next/image";
import Link from "next/link";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { CollectionsGrid } from "@/components/home/CollectionsGrid";
import { cn, optimizeImageUrl } from "@/lib/utils";
import { PRODUCT_IMAGE_PLACEHOLDER } from "@/lib/product-image-url";

export type FeaturedCollectionItem = {
  id: string;
  name: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  coverImageAlt: string | null;
  productCount: number;
};

function CollectionCard({
  item,
  className,
  aspectClass,
}: {
  item: FeaturedCollectionItem;
  className?: string;
  aspectClass: string;
}) {
  const src = item.coverImage ? optimizeImageUrl(item.coverImage, 900) : PRODUCT_IMAGE_PLACEHOLDER;
  return (
    <Link href={`/collections/${item.slug}`} className={cn("group relative block overflow-hidden", className ?? "")}>
      <div className={cn("relative w-full overflow-hidden bg-[#E8E8E6]", aspectClass)}>
        <Image
          src={src}
          alt={item.coverImageAlt || item.name}
          fill
          className="object-cover object-top transition-transform duration-[600ms] ease-out group-hover:scale-[1.03]"
          sizes="(max-width: 768px) 100vw, 45vw"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-charcoal/60 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-6">
          <h3 className="font-display text-[24px] font-normal italic leading-tight text-white md:text-[28px]">
            {item.name}
          </h3>
          {item.excerpt ? (
            <p className="mt-1 line-clamp-2 font-body text-[13px] font-light text-white/70">{item.excerpt}</p>
          ) : null}
          <p className="mt-2 font-body text-[10px] font-medium uppercase tracking-[0.12em] text-white/50">
            {item.productCount} {item.productCount === 1 ? "piece" : "pieces"}
          </p>
          <p className="mt-2 translate-y-1 font-body text-[11px] font-medium uppercase tracking-[0.12em] text-white opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            Explore →
          </p>
        </div>
      </div>
    </Link>
  );
}

export function FeaturedCollections({
  collections,
  fallbackGrid,
}: {
  collections: FeaturedCollectionItem[];
  fallbackGrid: {
    bridalImage?: string;
    eveningImage?: string;
    formalImage?: string;
    rtwImage?: string;
  };
}) {
  if (collections.length === 0) {
    return (
      <CollectionsGrid
        bridalImage={fallbackGrid.bridalImage}
        eveningImage={fallbackGrid.eveningImage}
        formalImage={fallbackGrid.formalImage}
        rtwImage={fallbackGrid.rtwImage}
      />
    );
  }

  const [a, b, c] = [collections[0], collections[1], collections[2]];

  return (
    <section className="bg-bg-page py-20 md:py-[100px]">
      <div className="mx-auto max-w-[1400px] px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <SectionLabel>Collections</SectionLabel>
            <h2 className="mt-2 font-display text-[40px] font-normal italic leading-none text-black md:text-[52px]">
              The Edit.
            </h2>
            <p className="mt-3 max-w-md font-body text-[14px] font-light text-dark-grey">
              Curated collections, crafted with intention.
            </p>
          </div>
          <Link
            href="/collections"
            className="shrink-0 self-start border-b border-charcoal/20 pb-0.5 font-body text-[11px] font-medium uppercase tracking-[0.12em] text-charcoal transition-colors hover:border-olive hover:text-olive md:self-auto"
          >
            View all collections
          </Link>
        </div>

        <div className="mt-12">
          {collections.length === 1 && a ? (
            <CollectionCard item={a} aspectClass="aspect-[21/9] min-h-[280px] md:min-h-[360px]" />
          ) : collections.length === 2 && a && b ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
              <CollectionCard item={a} aspectClass="aspect-[3/4] min-h-[320px]" />
              <CollectionCard item={b} aspectClass="aspect-[3/4] min-h-[320px]" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
              {a ? (
                <CollectionCard
                  item={a}
                  className="md:col-span-2"
                  aspectClass="aspect-[3/4] min-h-[360px] md:min-h-[520px]"
                />
              ) : null}
              <div className="flex flex-col gap-4 md:gap-6">
                {b ? <CollectionCard item={b} aspectClass="aspect-[3/4] min-h-[240px] flex-1" /> : null}
                {c ? <CollectionCard item={c} aspectClass="aspect-[3/4] min-h-[240px] flex-1" /> : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
