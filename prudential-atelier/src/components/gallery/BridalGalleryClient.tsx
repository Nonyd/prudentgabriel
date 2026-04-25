"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import type { GalleryImage } from "@prisma/client";
import { optimizeImageUrl } from "@/lib/utils";

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
          Bridal.
        </h1>
        <p className="mt-4 max-w-md font-body text-sm font-light text-charcoal/70">
          Every bride is a masterpiece. Every gown, a legacy.
        </p>
      </section>

      <section className="bg-canvas py-14 md:py-16">
        <div className="mx-auto max-w-[1400px] px-4">
          <p className="mb-6 text-right font-body text-[11px] font-medium uppercase tracking-[0.12em] text-charcoal-mid">
            {total} works
          </p>
          <div className="columns-2 gap-1 px-4 pt-8 md:columns-3 lg:columns-4" style={{ columnGap: "4px" }}>
            {images.map((img) => (
              <div key={img.id} className="group relative" style={{ breakInside: "avoid", marginBottom: "4px", display: "block" }}>
                <img
                  src={optimizeImageUrl(img.url, 600)}
                  alt={img.alt || "Prudential Bride"}
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
                className="border px-12 py-3.5 font-body text-[11px] font-medium uppercase tracking-[0.12em] transition-colors disabled:opacity-50"
                style={{ borderColor: "var(--bride-dark)", color: "var(--bride-dark)" }}
              >
                {loading ? "Loading…" : "Load more"}
              </button>
            ) : images.length > 0 ? (
              <p className="font-body text-[11px] uppercase tracking-[0.1em] text-charcoal-mid">— End of Gallery —</p>
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
