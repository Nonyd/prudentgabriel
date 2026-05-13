"use client";

import { useCallback, useState } from "react";
import type { GalleryImage } from "@prisma/client";
import { optimizeImageUrl } from "@/lib/utils";
import { GalleryLightbox } from "@/components/gallery/GalleryLightbox";

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
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const total = initialTotal;

  const loadMore = useCallback(async () => {
    setLoading(true);
    try {
      const next = page + 1;
      const res = await fetch(`/api/gallery?category=ATELIER&page=${next}&limit=24`);
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
          <div className="mb-6 flex items-center justify-between">
            <p className="font-body text-[11px] font-medium uppercase tracking-[0.12em] text-charcoal-mid">{total} works</p>
            <a
              href="https://instagram.com/prudential_atelier"
              target="_blank"
              rel="noopener noreferrer"
              className="font-body text-[10px] uppercase tracking-[0.12em] text-olive"
            >
              @prudential_atelier ↗
            </a>
          </div>
          <div className="columns-2 gap-1 px-4 pt-8 md:columns-3 lg:columns-4" style={{ columnGap: "4px" }}>
            {images.map((img, index) => (
              <div
                key={img.id}
                className="group relative cursor-pointer"
                style={{ breakInside: "avoid", marginBottom: "4px", display: "block" }}
                onClick={() => setLightboxIndex(index)}
              >
                <img
                  src={optimizeImageUrl(img.url, 600)}
                  alt={img.alt || "Prudent Gabriel Atelier"}
                  style={{ width: "100%", height: "auto", display: "block" }}
                  loading="lazy"
                />
                {img.caption ? (
                  <div
                    style={{
                      padding: "8px 4px",
                      fontSize: "11px",
                      fontFamily: "Jost, sans-serif",
                      color: "#8A8A85",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {splitLines(img.caption)}
                  </div>
                ) : null}
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
      <GalleryLightbox
        images={images}
        initialIndex={lightboxIndex ?? 0}
        isOpen={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
      />
    </div>
  );
}
