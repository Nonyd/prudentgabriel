"use client";

import { useEffect, useId, useState } from "react";
import Image from "next/image";
import { GallerySwipeNudgeHost } from "@/components/common/GallerySwipeNudgeHost";
import { ProductCardImageSwipe } from "@/components/common/ProductCardImageSwipe";
import { QuickAddDesktopChrome } from "@/components/common/quick-add/QuickAddDesktop";
import { GALLERY_GRID_CLASS, GALLERY_GRID_SEAMS } from "@/components/common/gallery-grid";
import type { AtelierPiece } from "@/lib/atelier-gallery";
import { priceGuideRest } from "@/lib/price-guide";
import { optimizeProductCardImageUrl } from "@/lib/product-image-url";
import { cn } from "@/lib/utils";

/** Where a piece leads: the screening questions at the foot of this page, not a shop page. */
export const ATELIER_BEGIN_ID = "begin";

/** Columns on a wide screen: three or four, whichever leaves the fewest empty cells (four on a tie). */
export function atelierGridColumns(count: number): 2 | 3 | 4 {
  if (count <= 2) return 2;
  const empty = (cols: number) => (cols - (count % cols)) % cols;
  return empty(3) < empty(4) ? 3 : 4;
}

const LG_COLS = { 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-3 lg:grid-cols-4" } as const;

/**
 * One gown, one place in the grid: the shop's gallery card (Slices M/S) without
 * the shop. Its frames page inside the card; seams, swipe and hover reveal are
 * the shop's.
 *
 * DELIBERATE DEPARTURE from the shop grid, which is photography-only at rest:
 * the gown's name and its price guide sit at rest under every frame, at every
 * width ("Adaeze · from ₦3,000,000"). The shop can hide a price because it is
 * one tap away on the product page. An atelier gown has no product page, and the
 * question every visitor arrives with is what it costs; a price shown only on
 * hover is never seen on a phone. Only the description waits for hover or
 * keyboard focus. Do not "fix" this back to the shop's behaviour.
 * (globals.css: .atelier-piece-rest, .atelier-piece-card)
 */
export function AtelierPieceCard({
  piece,
  priority = false,
  className,
}: {
  piece: AtelierPiece;
  priority?: boolean;
  className?: string;
}) {
  const nameId = useId();
  const [index, setIndex] = useState(0);
  const [layout, setLayout] = useState<"ssr" | "mobile" | "desktop">("ssr");

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setLayout(mq.matches ? "desktop" : "mobile");
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const frames = piece.frames;
  const price = priceGuideRest(piece.guide);
  const label = piece.title ?? frames[0]?.alt ?? "A piece from the atelier";
  const href = `#${ATELIER_BEGIN_ID}`;
  const shown = frames[index] ?? frames[0];
  const mobileSwipe = layout === "mobile" && frames.length >= 2;
  const cycle = (dir: -1 | 1) => setIndex((i) => (i + dir + frames.length) % frames.length);

  return (
    <article
      className={cn("product-gallery-card atelier-piece-card group", className)}
      data-gallery-card=""
      data-atelier-piece={piece.id}
      {...(piece.title ? { "aria-labelledby": nameId } : { "aria-label": label })}
    >
      {/* Anchors the hover description to the photograph, above the line at rest. */}
      <div className="relative">
        <div className="product-gallery-shot">
          {mobileSwipe ? (
            <ProductCardImageSwipe
              href={href}
              productName={label}
              images={frames}
              priority={priority}
              enableQuickAddHit={false}
              onQuickAdd={() => undefined}
            />
          ) : (
            <a
              href={href}
              aria-label={`Begin a commission: ${label}`}
              className="absolute inset-0 z-[1] block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-cream"
            >
              {shown ? (
                <Image
                  key={shown.id}
                  src={optimizeProductCardImageUrl(shown.url)}
                  alt={shown.alt}
                  fill
                  sizes="(max-width: 767px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className="object-cover object-top"
                  priority={priority}
                />
              ) : null}
            </a>
          )}
          {piece.description ? <div className="product-gallery-scrim" aria-hidden /> : null}
          <QuickAddDesktopChrome imageCount={frames.length} onPrev={() => cycle(-1)} onNext={() => cycle(1)} />
        </div>

        {piece.description ? (
          <div className="product-gallery-meta" data-atelier-words="">
            <p className="line-clamp-4 font-body text-[13px] leading-relaxed text-text-mid">{piece.description}</p>
          </div>
        ) : null}
      </div>

      {piece.title || price ? (
        <p className="atelier-piece-rest" data-atelier-rest="">
          {piece.title ? (
            <span id={nameId} className="atelier-piece-name">
              {piece.title}
            </span>
          ) : null}
          {piece.title && price ? <span className="atelier-piece-sep" aria-hidden> · </span> : null}
          {price ? <span className="atelier-piece-price">{piece.title ? price : price.charAt(0).toUpperCase() + price.slice(1)}</span> : null}
        </p>
      ) : null}
    </article>
  );
}

export function AtelierPieceGrid({ pieces }: { pieces: AtelierPiece[] }) {
  return (
    <GallerySwipeNudgeHost>
      <div className={cn(GALLERY_GRID_CLASS, GALLERY_GRID_SEAMS, "grid-cols-2", LG_COLS[atelierGridColumns(pieces.length)])}>
        {pieces.map((piece, i) => (
          <AtelierPieceCard
            key={piece.id}
            piece={piece}
            // Two across on a phone: an odd last gown takes the row rather than leave half of it blank.
            className={pieces.length % 2 === 1 && i === pieces.length - 1 ? "max-md:col-span-2" : undefined}
          />
        ))}
      </div>
    </GallerySwipeNudgeHost>
  );
}
