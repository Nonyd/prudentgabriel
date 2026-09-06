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
  heroHeadline = "Dressed for little royals",
  heroSubtext = "Occasion wear and everyday elegance for the smallest members of the house.",
  heroCtaLabel = "Shop Kids",
  pageDescription,
}: {
  initialImages: GalleryImage[];
  initialTotal: number;
  initialHasMore: boolean;
  heroHeadline?: string;
  heroSubtext?: string;
  heroCtaLabel?: string;
  pageDescription?: string;
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
    <div>
      <section className="px-6 pb-20 pt-24 text-center">
        <div className="glass-1 glass-panel mx-auto max-w-xl px-8 py-10">
        <h1
          className="font-display leading-[1.05] text-choc"
          style={{ fontSize: "clamp(40px, 6vw, 52px)" }}
        >
          {heroHeadline}
        </h1>
        <p
          className="mx-auto mt-4 max-w-md font-body leading-[1.8] text-text-mid"
          style={{ fontSize: "15px" }}
        >
          {pageDescription ?? heroSubtext}
        </p>
        <Link href="/shop?category=KIDDIES" className="btn-primary mt-8 inline-block">
          {heroCtaLabel}
        </Link>
        </div>
      </section>

      <section className="mx-auto flex max-w-[1400px] items-center justify-between px-6 pb-4 pt-10">
        <p
          className="uppercase"
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: "10px",
            letterSpacing: "0.15em",
            color: "var(--text-mid)",
          }}
        >
          {initialTotal} works
        </p>
        <a
          href="https://instagram.com/prudential_kids"
          target="_blank"
          rel="noopener noreferrer"
          className="uppercase transition-opacity hover:opacity-80"
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: "10px",
            letterSpacing: "0.15em",
            color: "var(--accent)",
          }}
        >
          @prudential_kids ↗
        </a>
      </section>

      <section className="mx-auto max-w-[1400px] px-6 pb-16">
        <div className="columns-2 md:columns-3 lg:columns-4" style={{ columnGap: "16px" }}>
          {images.map((img, index) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setLightboxIndex(index)}
              className="group relative mb-4 block w-full overflow-hidden text-left"
              style={{ breakInside: "avoid" }}
            >
              <img
                src={optimizeImageUrl(img.url, 700)}
                alt={img.alt || "Prudential Kids"}
                className="block w-full transition-transform duration-400 ease-in-out group-hover:scale-[1.02]"
                loading="lazy"
              />
              {img.caption ? (
                <div
                  className="absolute inset-x-0 bottom-0 translate-y-full px-3 py-2 transition-transform duration-300 group-hover:translate-y-0"
                  style={{ backgroundColor: "var(--accent-soft)" }}
                >
                  <p className="font-body text-[13px]" style={{ color: "var(--text-primary)" }}>
                    {img.caption}
                  </p>
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
              className="border px-12 py-3 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors disabled:opacity-50"
              style={{
                borderColor: "var(--accent)",
                color: "var(--text-primary)",
                backgroundColor: "transparent",
              }}
            >
              {loading ? "Loading…" : "Load more"}
            </button>
          ) : (
            <p className="font-body text-[10px]" style={{ color: "var(--text-light)" }}>
              — {images.length} works —
            </p>
          )}
        </div>
      </section>

      <section className="px-6 py-20" style={{ backgroundColor: "var(--accent-soft)" }}>
        <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2">
          <div className="border border-[var(--border-color)] bg-[var(--bg-card)] p-8 text-center">
            <div className="mx-auto mb-4 flex h-8 w-8 items-center justify-center" style={{ color: "var(--accent)" }}>
              ✂
            </div>
            <h3 className="font-display text-[24px]">Bespoke for Little Ones</h3>
            <p className="mt-2 font-body text-[13px] leading-[1.8]" style={{ color: "var(--text-mid)" }}>
              Custom-made pieces for birthdays, dedications, flower girls, and traditional ceremonies.
            </p>
            <Link
              href="/bespoke"
              className="mt-4 inline-block border px-6 py-2.5 font-sans text-[11px] font-semibold uppercase tracking-[0.12em]"
              style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
            >
              Book bespoke
            </Link>
          </div>
          <div className="border border-[var(--border-color)] bg-[var(--bg-card)] p-8 text-center">
            <div className="mx-auto mb-4 flex h-8 w-8 items-center justify-center" style={{ color: "var(--accent)" }}>
              ⌁
            </div>
            <h3 className="font-display text-[24px]">Ready to Wear</h3>
            <p className="mt-2 font-body text-[13px] leading-[1.8]" style={{ color: "var(--text-mid)" }}>
              Browse our ready-made children&apos;s collection for immediate purchase and delivery.
            </p>
            <Link
              href="/shop?category=KIDDIES"
              className="mt-4 inline-block px-6 py-2.5 font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-[#2a1a0e]"
              style={{ backgroundColor: "var(--cta-bg)" }}
            >
              Shop kiddies
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
