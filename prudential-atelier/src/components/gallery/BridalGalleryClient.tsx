"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { GalleryImage } from "@prisma/client";

function splitLines(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => (
    <span key={i}>
      {line}
      {i < lines.length - 1 ? <br /> : null}
    </span>
  ));
}

export function BridalGalleryClient({
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
  const total = initialTotal;

  const loadMore = useCallback(async () => {
    setLoading(true);
    try {
      const next = page + 1;
      const res = await fetch(`/api/gallery?category=BRIDAL&page=${next}&limit=50`);
      const j = (await res.json()) as { images: GalleryImage[]; hasMore: boolean };
      setImages((prev) => [...prev, ...j.images]);
      setPage(next);
      setHasMore(j.hasMore);
    } finally {
      setLoading(false);
    }
  }, [page]);

  return (
    <div>
      <section
        className="flex min-h-[400px] flex-col items-center justify-center px-4 py-16 text-center"
        style={{ backgroundColor: "var(--bride-bg)" }}
      >
        <p
          className="font-body text-[10px] font-medium uppercase tracking-[0.2em]"
          style={{ color: "var(--bride-accent)" }}
        >
          Prudential Bride
        </p>
        <h1
          className="mt-3 font-display text-[40px] font-normal italic leading-[0.95] md:text-[72px]"
          style={{ color: "var(--bride-dark)" }}
        >
          Bridesals.
        </h1>
        <p className="mt-4 max-w-md font-body text-sm font-light text-charcoal/70">
          Every bride is a masterpiece. Every gown, a legacy.
        </p>
      </section>

      <section className="bg-white py-14 md:py-16">
        <div className="mx-auto max-w-[1400px] px-4">
          <p className="mb-6 text-right font-body text-[11px] font-medium uppercase tracking-[0.12em] text-[#6B6B68]">
            {total} works
          </p>
          <div className="masonry-grid">
            {images.map((img) => (
              <div key={img.id} className="group masonry-item relative">
                <div className="relative w-full overflow-hidden bg-[#faf7f4]">
                  {img.width && img.height ? (
                    <Image
                      src={img.url}
                      alt={img.alt ?? ""}
                      width={img.width}
                      height={img.height}
                      className="h-auto w-full object-cover"
                      sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    />
                  ) : (
                    <div className="relative aspect-[3/4] w-full">
                      <Image src={img.url} alt={img.alt ?? ""} fill className="object-cover" sizes="25vw" />
                    </div>
                  )}
                  <div
                    className="pointer-events-none absolute inset-0 z-[1] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    style={{ backgroundColor: "rgba(42, 31, 26, 0.2)" }}
                  />
                  {img.caption ? (
                    <p className="pointer-events-none absolute bottom-0 left-0 z-[2] max-w-full p-3 font-body text-xs font-light leading-snug text-white opacity-0 mix-blend-normal transition-opacity duration-300 group-hover:opacity-100">
                      {splitLines(img.caption)}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col items-center">
            {hasMore ? (
              <button
                type="button"
                disabled={loading}
                onClick={() => void loadMore()}
                className="border px-12 py-3.5 font-body text-[11px] font-medium uppercase tracking-[0.12em] transition-colors disabled:opacity-50"
                style={{ borderColor: "var(--bride-dark)", color: "var(--bride-dark)" }}
              >
                {loading ? "Loading…" : "Load more"}
              </button>
            ) : images.length > 0 ? (
              <p className="font-body text-[11px] uppercase tracking-[0.1em] text-[#6B6B68]">— End of Gallery —</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="py-20 text-center" style={{ backgroundColor: "var(--bride-bg)" }}>
        <h2 className="font-display text-[32px] font-normal italic md:text-[40px]" style={{ color: "var(--bride-dark)" }}>
          Begin Your Bridal Journey.
        </h2>
        <p className="mx-auto mt-4 max-w-md font-body text-sm font-light text-charcoal/70">
          Each Prudential Bride gown is created exclusively for you.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            href="/consultation"
            className="inline-block px-8 py-3.5 font-body text-[11px] font-medium uppercase tracking-[0.12em] text-white"
            style={{ backgroundColor: "var(--bride-dark)" }}
          >
            Book bridal consultation
          </Link>
          <Link
            href="/shop?category=BRIDAL"
            className="inline-block border px-8 py-3.5 font-body text-[11px] font-medium uppercase tracking-[0.12em]"
            style={{ borderColor: "var(--bride-dark)", color: "var(--bride-dark)" }}
          >
            Explore bridal collection
          </Link>
        </div>
      </section>
    </div>
  );
}
