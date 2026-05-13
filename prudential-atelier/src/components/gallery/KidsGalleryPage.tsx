"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import type { GalleryImage } from "@prisma/client";
import { optimizeImageUrl } from "@/lib/utils";
import { GalleryLightbox } from "@/components/gallery/GalleryLightbox";

export function KidsGalleryPage({
  initialImages,
  initialTotal,
  initialHasMore,
}: {
  initialImages: GalleryImage[];
  initialTotal: number;
  initialHasMore: boolean;
}) {
  const [images, setImages] = useState(initialImages);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const loadMore = useCallback(async () => {
    setLoading(true);
    try {
      const next = page + 1;
      const res = await fetch(`/api/gallery?category=KIDS&page=${next}&limit=24`);
      const j = (await res.json()) as { images: GalleryImage[]; hasMore: boolean };
      setImages((prev) => [...prev, ...j.images]);
      setPage(next);
      setHasMore(j.hasMore);
    } finally {
      setLoading(false);
    }
  }, [page]);

  return (
    <div className="bg-white">
      <section className="px-6 pb-16 pt-20 text-center">
        <p className="font-body text-[9px] uppercase tracking-[0.3em] text-olive">PRUDENTIAL KIDS</p>
        <h1 className="mt-3 font-display text-[44px] italic leading-[0.9] text-black md:text-[80px]">Little Ones.</h1>
        <p className="mx-auto mt-4 max-w-sm text-center font-body text-[14px] font-light text-dark-grey">
          Dressed for their greatest moments.
        </p>
        <div className="mx-auto mt-8 flex w-fit gap-2">
          <span className="h-3 w-3 bg-olive" />
          <span className="h-3 w-3 bg-[#F9E8E8]" />
          <span className="h-3 w-3 bg-black" />
        </div>
      </section>

      <section className="mx-auto flex max-w-[1400px] items-center justify-between px-6 pb-4">
        <p className="font-body text-[10px] uppercase tracking-[0.15em] text-dark-grey/50">{initialTotal} works</p>
        <a
          href="https://instagram.com/prudential_kids"
          target="_blank"
          rel="noopener noreferrer"
          className="font-body text-[10px] uppercase tracking-[0.15em] text-olive"
        >
          @prudential_kids ↗
        </a>
      </section>

      <section className="mx-auto max-w-[1400px] px-6 pb-16">
        <div className="columns-2 md:columns-3 lg:columns-4" style={{ columnGap: "8px" }}>
          {images.map((img, index) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setLightboxIndex(index)}
              className="group relative mb-2 block w-full overflow-hidden text-left"
              style={{ breakInside: "avoid" }}
            >
              <img
                src={optimizeImageUrl(img.url, 700)}
                alt={img.alt || "Prudential Kids"}
                className="block w-full transition-transform duration-400 ease-in-out group-hover:scale-[1.02]"
                loading="lazy"
              />
              {img.caption ? (
                <div className="absolute inset-x-0 bottom-0 translate-y-full bg-white px-2.5 py-2 transition-transform duration-300 group-hover:translate-y-0">
                  <p className="font-body text-[11px] text-black">{img.caption}</p>
                </div>
              ) : null}
            </button>
          ))}
        </div>

        <div className="mt-8 text-center">
          {hasMore ? (
            <button
              type="button"
              disabled={loading}
              onClick={() => void loadMore()}
              className="border border-black/20 px-12 py-3 font-body text-[11px] uppercase tracking-[0.14em] text-black transition-colors hover:border-black hover:bg-black hover:text-white disabled:opacity-50"
            >
              {loading ? "LOADING..." : "LOAD MORE"}
            </button>
          ) : (
            <p className="font-body text-[10px] text-dark-grey/40">— {images.length} works —</p>
          )}
        </div>
      </section>

      <section className="bg-[#F9F9F7] px-6 py-20">
        <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2">
          <div className="border border-[#EBEBEA] bg-white p-8 text-center">
            <div className="mx-auto mb-4 flex h-8 w-8 items-center justify-center text-olive">✂</div>
            <h3 className="font-display text-[24px]">Bespoke for Little Ones</h3>
            <p className="mt-2 font-body text-[13px] font-light text-dark-grey">
              Custom-made pieces for birthdays, dedications, flower girls, and traditional ceremonies.
            </p>
            <Link
              href="/bespoke"
              className="mt-4 inline-block border border-olive px-6 py-2.5 font-body text-[11px] uppercase tracking-[0.12em] text-olive"
            >
              BOOK BESPOKE
            </Link>
          </div>
          <div className="border border-[#EBEBEA] bg-white p-8 text-center">
            <div className="mx-auto mb-4 flex h-8 w-8 items-center justify-center text-olive">⌁</div>
            <h3 className="font-display text-[24px]">Ready to Wear</h3>
            <p className="mt-2 font-body text-[13px] font-light text-dark-grey">
              Browse our ready-made children&apos;s collection for immediate purchase and delivery.
            </p>
            <Link
              href="/shop?category=KIDDIES"
              className="mt-4 inline-block bg-olive px-6 py-2.5 font-body text-[11px] uppercase tracking-[0.12em] text-white"
            >
              SHOP KIDDIES
            </Link>
          </div>
        </div>
      </section>

      <GalleryLightbox
        images={images}
        initialIndex={lightboxIndex ?? 0}
        isOpen={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
      />
    </div>
  );
}
