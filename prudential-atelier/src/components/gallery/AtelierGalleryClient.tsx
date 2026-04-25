"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
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

export function AtelierGalleryClient({
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
      const res = await fetch(`/api/gallery?category=ATELIER&page=${next}&limit=50`);
      const j = (await res.json()) as {
        images: GalleryImage[];
        hasMore: boolean;
      };
      setImages((prev) => [...prev, ...j.images]);
      setPage(next);
      setHasMore(j.hasMore);
    } finally {
      setLoading(false);
    }
  }, [page]);

  return (
    <div>
      <section className="flex min-h-[400px] flex-col items-center justify-center bg-black px-4 py-16 text-center">
        <p className="font-body text-[10px] font-medium uppercase tracking-[0.2em] text-white/50">Prudent Gabriel</p>
        <h1 className="mt-3 font-display text-[40px] font-normal italic leading-[0.95] text-white md:text-[72px]">
          The Atelier.
        </h1>
        <p className="mt-4 max-w-md font-body text-sm font-light text-white/60">
          Behind every piece — the hands, the craft, the story.
        </p>
      </section>

      <section className="bg-canvas py-14 md:py-16">
        <div className="mx-auto max-w-[1400px] px-4">
          <p className="mb-6 text-right font-body text-[11px] font-medium uppercase tracking-[0.12em] text-charcoal-mid">
            {total} works
          </p>
          <div className="masonry-grid">
            {images.map((img) => (
              <div key={img.id} className="group masonry-item relative">
                <div className="relative w-full overflow-hidden bg-light-grey">
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
                  <div className="pointer-events-none absolute inset-0 z-[1] bg-black/0 transition-colors duration-300 group-hover:bg-black/30" />
                  {img.caption ? (
                    <p className="pointer-events-none absolute bottom-0 left-0 z-[2] max-w-full p-3 font-body text-xs font-light leading-snug text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100">
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
                className="border border-ink px-12 py-3.5 font-body text-[11px] font-medium uppercase tracking-[0.12em] text-ink transition-colors hover:bg-ink hover:text-[#ffffff] disabled:opacity-50"
              >
                {loading ? "Loading…" : "Load more"}
              </button>
            ) : images.length > 0 ? (
              <p className="font-body text-[11px] uppercase tracking-[0.1em] text-charcoal-mid">— End of Gallery —</p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
