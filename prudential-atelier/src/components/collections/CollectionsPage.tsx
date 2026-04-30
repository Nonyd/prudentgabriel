"use client";

import Image from "next/image";
import Link from "next/link";
import { cn, optimizeImageUrl } from "@/lib/utils";

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

function CollectionBlock({
  item,
  index,
}: {
  item: CollectionListItem;
  index: number;
}) {
  const isEven = index % 2 === 0;
  const initial = item.name.trim().charAt(0).toUpperCase() || "P";
  const img = item.coverImage ? optimizeImageUrl(item.coverImage, 1200) : null;

  const imageSide = (
    <div className="relative min-h-[350px] flex-1 overflow-hidden bg-[#F2F2F0] md:min-h-[500px] md:w-[60%]">
      {img ? (
        <Link href={`/collections/${item.slug}`} className="group block h-full min-h-[350px] md:min-h-[500px]">
          <Image
            src={img}
            alt={item.coverImageAlt || item.name}
            fill
            className="object-cover object-top transition-transform duration-[600ms] ease-out group-hover:scale-[1.02]"
            sizes="(max-width: 768px) 100vw, 60vw"
          />
        </Link>
      ) : (
        <Link
          href={`/collections/${item.slug}`}
          className="flex h-full min-h-[350px] items-center justify-center md:min-h-[500px]"
        >
          <span className="font-display text-[72px] font-normal italic text-charcoal/[0.1] md:text-[120px]">
            {initial}
          </span>
        </Link>
      )}
    </div>
  );

  const textSide = (
    <div className="flex flex-1 flex-col justify-center bg-white px-6 py-10 md:w-[40%] md:px-16 md:py-0 lg:px-20">
      {item.season ? (
        <p className="mb-4 font-body text-[9px] font-medium uppercase tracking-[0.2em] text-olive">{item.season}</p>
      ) : null}
      <h2 className="font-display text-[32px] font-normal italic leading-none text-black md:text-[52px]">{item.name}</h2>
      {item.excerpt ? (
        <p className="mt-4 max-w-sm font-body text-[15px] font-light leading-[1.8] text-dark-grey">{item.excerpt}</p>
      ) : null}
      <p className="mt-6 font-body text-[11px] font-medium uppercase tracking-[0.15em] text-dark-grey/50">
        {item.productCount} {item.productCount === 1 ? "piece" : "pieces"}
      </p>
      <Link
        href={`/collections/${item.slug}`}
        className="group/ex mt-6 inline-flex w-fit border-b border-black pb-0.5 font-body text-[11px] font-medium uppercase tracking-[0.12em] text-black transition-colors hover:border-olive hover:text-olive"
      >
        Explore collection →
      </Link>
    </div>
  );

  return (
    <article>
      <div
        className={cn(
          "flex min-h-[350px] flex-col md:min-h-[500px] md:flex-row",
          !isEven && "md:flex-row-reverse",
        )}
      >
        {imageSide}
        {textSide}
      </div>
      <div className="h-px w-full bg-[#F0F0EE]" />
    </article>
  );
}

export function CollectionsPage({ collections }: { collections: CollectionListItem[] }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="flex h-[280px] flex-col items-center justify-center bg-black px-6 text-center">
        <p className="font-body text-[9px] font-medium uppercase tracking-[0.25em] text-white/50">Prudent Gabriel</p>
        <h1 className="mt-3 font-display text-[36px] font-normal italic leading-[0.95] text-white md:text-[64px]">
          Collections.
        </h1>
        <p className="mt-3 max-w-md font-body text-[14px] font-light text-white/55">
          Every collection tells a story. Find yours.
        </p>
      </header>

      <section className="bg-white py-16 md:py-20">
        <div className="mx-auto max-w-[1400px] px-6">
          {collections.length === 0 ? (
            <p className="py-20 text-center font-body text-[14px] text-dark-grey">No collections yet.</p>
          ) : (
            collections.map((c, i) => <CollectionBlock key={c.id} item={c} index={i} />)
          )}
        </div>
      </section>
    </div>
  );
}
