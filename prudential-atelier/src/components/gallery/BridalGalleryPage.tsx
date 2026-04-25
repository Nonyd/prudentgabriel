"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import type { GalleryImage } from "@prisma/client";
import { optimizeImageUrl } from "@/lib/utils";
import { GalleryLightbox } from "@/components/gallery/GalleryLightbox";

export function BridalGalleryPage({
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
      const res = await fetch(`/api/gallery?category=BRIDAL&page=${next}&limit=24`);
      const j = (await res.json()) as { images: GalleryImage[]; hasMore: boolean };
      setImages((prev) => [...prev, ...j.images]);
      setPage(next);
      setHasMore(j.hasMore);
    } finally {
      setLoading(false);
    }
  }, [page]);

  return (
    <div className="bg-[#FAF7F4]">
      <section className="px-6 pb-16 pt-20 text-center">
        <p className="font-body text-[9px] uppercase tracking-[0.3em] text-[#C8A97A]">PRUDENTIAL BRIDE</p>
        <h1 className="mt-3 font-display text-[44px] italic leading-[0.9] text-[#2A1F1A] md:text-[80px]">Bridal.</h1>
        <p className="mx-auto mt-4 max-w-sm font-body text-[14px] font-light text-charcoal/60">
          Every bride is a masterpiece. Every gown, a legacy.
        </p>
        <div className="mx-auto mt-8 flex w-[120px] items-center justify-center gap-2 text-[#C8A97A]/40">
          <span className="h-px flex-1 bg-current" />
          <span className="text-[10px]">◆</span>
          <span className="h-px flex-1 bg-current" />
        </div>
      </section>

      <section className="mx-auto flex max-w-[1200px] items-center justify-between px-6 pb-4">
        <p className="font-body text-[10px] uppercase tracking-[0.15em] text-charcoal/40">{initialTotal} works</p>
        <a
          href="https://instagram.com/prudential_bridal"
          target="_blank"
          rel="noopener noreferrer"
          className="font-body text-[10px] uppercase tracking-[0.15em] text-[#C8A97A]"
        >
          @prudential_bridal ↗
        </a>
      </section>

      <section className="mx-auto max-w-[1200px] px-6 pb-16">
        <div className="columns-1 md:columns-2 lg:columns-3" style={{ columnGap: "12px" }}>
          {images.map((img, index) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setLightboxIndex(index)}
              className="group relative mb-3 block w-full cursor-pointer overflow-hidden text-left"
              style={{ breakInside: "avoid" }}
            >
              <img
                src={optimizeImageUrl(img.url, 800)}
                alt={img.alt || "Prudential Bride"}
                className="block w-full transition-opacity duration-200 group-hover:opacity-90"
                loading="lazy"
              />
              {img.caption ? (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/40 to-transparent px-4 pb-3 pt-5 opacity-0 transition-opacity duration-250 group-hover:opacity-100">
                  <p className="font-body text-[12px] font-light italic text-white">{img.caption}</p>
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
              className="border border-[#2A1F1A]/30 px-12 py-3 font-body text-[11px] uppercase tracking-[0.14em] text-[#2A1F1A] transition-colors hover:border-[#2A1F1A] hover:bg-[#2A1F1A] hover:text-[#FAF7F4] disabled:opacity-50"
            >
              {loading ? "LOADING..." : "LOAD MORE"}
            </button>
          ) : (
            <p className="font-body text-[10px] text-charcoal/30">— {images.length} works —</p>
          )}
        </div>
      </section>

      <section className="border-t border-[#C8A97A]/20 px-6 py-20 text-center">
        <div className="mx-auto max-w-xl">
          <h2 className="font-display text-[32px] italic text-[#2A1F1A] md:text-[48px]">Begin Your Bridal Journey.</h2>
          <p className="mx-auto mt-4 max-w-md font-body text-[14px] font-light text-charcoal/60">
            Each Prudential Bride gown is created exclusively for you, in our Lagos atelier.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/consultation"
              className="bg-[#2A1F1A] px-8 py-3.5 font-body text-[11px] uppercase tracking-[0.14em] text-[#FAF7F4]"
            >
              BOOK BRIDAL CONSULTATION
            </Link>
            <Link
              href="/shop?category=BRIDAL"
              className="border border-[#2A1F1A] px-8 py-3.5 font-body text-[11px] uppercase tracking-[0.14em] text-[#2A1F1A]"
            >
              EXPLORE BRIDAL COLLECTION
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
