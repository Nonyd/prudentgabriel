"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { cn, optimizeImageUrl } from "@/lib/utils";
import { PRODUCT_IMAGE_PLACEHOLDER } from "@/lib/product-image-url";

export type CollectionListItem = {
  id: string;
  name: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  coverImageAlt: string | null;
  season: string | null;
  year: number | null;
  productCount: number;
};

function CollectionCard({ item, index }: { item: CollectionListItem; index: number }) {
  const reduceMotion = useReducedMotion();
  const src = item.coverImage ? optimizeImageUrl(item.coverImage, 900) : PRODUCT_IMAGE_PLACEHOLDER;

  const card = (
    <Link
      href={`/collections/${item.slug}`}
      className="group relative block cursor-pointer overflow-hidden bg-[#F8F8F6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-olive"
      aria-label={`${item.name}, ${item.productCount} ${item.productCount === 1 ? "piece" : "pieces"}`}
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden">
        <Image
          src={src}
          alt={item.coverImageAlt || item.name}
          fill
          priority={index < 3}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px"
          className="object-cover object-top transition-transform duration-300 ease-out motion-reduce:transition-none group-hover:scale-[1.03] motion-reduce:group-hover:scale-100"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-charcoal/55 via-charcoal/5 to-transparent opacity-80 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:transition-none" />
        <div className="absolute inset-x-0 bottom-0 p-4 md:p-5">
          {item.season ? (
            <p className="font-body text-[9px] font-medium uppercase tracking-[0.2em] text-white/60">{item.season}</p>
          ) : null}
          <h2 className="mt-1 font-display text-[22px] font-normal italic leading-tight text-white md:text-[26px]">
            {item.name}
          </h2>
          {item.excerpt ? (
            <p className="mt-1 line-clamp-2 font-body text-[12px] font-light leading-relaxed text-white/75">
              {item.excerpt}
            </p>
          ) : null}
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="font-body text-[10px] font-medium uppercase tracking-[0.12em] text-white/55">
              {item.productCount} {item.productCount === 1 ? "piece" : "pieces"}
            </p>
            <span className="translate-x-1 font-body text-[10px] font-medium uppercase tracking-[0.12em] text-white opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 motion-reduce:translate-x-0 motion-reduce:opacity-100 motion-reduce:transition-none">
              View
            </span>
          </div>
        </div>
      </div>
    </Link>
  );

  if (reduceMotion) return card;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.06, 0.3), ease: [0.22, 1, 0.36, 1] }}
    >
      {card}
    </motion.div>
  );
}

export function CollectionsPage({ collections }: { collections: CollectionListItem[] }) {
  const reduceMotion = useReducedMotion();
  const totalPieces = collections.reduce((sum, c) => sum + c.productCount, 0);

  return (
    <div className="min-h-screen bg-bg-card pb-20">
      <header className="flex h-[140px] flex-col items-center justify-center border-b border-mid-grey bg-bg-card md:h-[200px]">
        <p className="font-body text-[9px] font-medium uppercase tracking-[0.25em] text-dark-grey">
          Ready to Wear
        </p>
        <h1 className="mt-2 text-center font-display text-[32px] font-normal italic leading-[0.95] text-black md:text-[56px]">
          Collections
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-center font-body text-sm font-light text-dark-grey">
          Curated edits of house signatures — each collection with its own mood, silhouette, and story.
        </p>
      </header>

      <section className="mx-auto max-w-[1400px] px-4 pt-10 md:px-6 md:pt-14">
        <div className="flex flex-col gap-3 border-b border-mid-grey pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-body text-[10px] font-medium uppercase tracking-[0.12em] text-olive">
              {collections.length} {collections.length === 1 ? "collection" : "collections"}
            </p>
            {totalPieces > 0 ? (
              <p className="mt-1 font-body text-[11px] text-dark-grey/70">
                {totalPieces} ready-to-wear {totalPieces === 1 ? "piece" : "pieces"} across the edit
              </p>
            ) : null}
          </div>
          <Link
            href="/rtw"
            className="inline-flex w-fit cursor-pointer border-b border-charcoal/25 pb-0.5 font-body text-[11px] font-medium uppercase tracking-[0.12em] text-charcoal transition-colors duration-200 hover:border-olive hover:text-olive"
          >
            Shop all ready-to-wear
          </Link>
        </div>

        {collections.length === 0 ? (
          <p className="py-24 text-center font-body text-sm text-dark-grey">No collections published yet.</p>
        ) : (
          <div
            className={cn(
              "mt-8 grid gap-px bg-mid-grey",
              collections.length === 1
                ? "grid-cols-1 max-w-sm mx-auto"
                : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
            )}
          >
            {collections.map((c, i) => (
              <div key={c.id} className="bg-bg-card">
                <CollectionCard item={c} index={i} />
              </div>
            ))}
          </div>
        )}
      </section>

      {collections.length > 0 ? (
        <section className="mx-auto mt-16 max-w-[1400px] px-4 md:px-6">
          <div
            className={cn(
              "flex flex-col items-center justify-between gap-6 border border-mid-grey bg-bg-page px-6 py-10 text-center md:flex-row md:px-10 md:text-left",
              !reduceMotion && "transition-colors duration-200 hover:border-olive/30",
            )}
          >
            <div>
              <p className="font-body text-[9px] font-medium uppercase tracking-[0.2em] text-olive">The full range</p>
              <h2 className="mt-2 font-display text-[28px] font-normal italic text-charcoal md:text-[36px]">
                Browse every piece
              </h2>
              <p className="mt-2 max-w-md font-body text-[14px] font-light text-dark-grey">
                Shop the full ready-to-wear catalogue.
              </p>
            </div>
            <Link
              href="/rtw"
              className="inline-flex shrink-0 cursor-pointer items-center justify-center border border-charcoal bg-charcoal px-8 py-3.5 font-body text-[11px] font-medium uppercase tracking-[0.12em] text-white transition-colors duration-200 hover:border-olive hover:bg-olive"
            >
              View all pieces
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
