"use client";

import { useEffect, useId, useState } from "react";
import Image from "next/image";
import { GallerySwipeNudgeHost } from "@/components/common/GallerySwipeNudgeHost";
import { ProductCardImageSwipe } from "@/components/common/ProductCardImageSwipe";
import { QuickAddDesktopChrome } from "@/components/common/quick-add/QuickAddDesktop";
import { GALLERY_GRID_CLASS, GALLERY_GRID_SEAMS } from "@/components/common/gallery-grid";
import type { AtelierPiece } from "@/lib/atelier-gallery";
import { PRICE_GUIDE_SHORT_NOTE, priceGuideShort } from "@/lib/price-guide";
import { optimizeProductCardImageUrl } from "@/lib/product-image-url";
import { cn } from "@/lib/utils";

/** Where a piece leads: the screening questions at the foot of this page, not a shop page. */
export const ATELIER_BEGIN_ID = "begin";

/** Columns on a wide screen: never a ragged last row when the count allows it. */
export function atelierGridColumns(count: number): 2 | 3 | 4 {
  if (count <= 2) return 2;
  if (count === 3 || (count % 4 !== 0 && count % 3 === 0)) return 3;
  return 4;
}

const LG_COLS = { 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-3 lg:grid-cols-4" } as const;

/**
 * BB2.1: one gown, one place in the grid — the shop's gallery card (Slices M/S)
 * without the shop: photography at rest; name, words and price guide on hover or
 * keyboard focus on a desktop, at rest on touch; its frames page inside the card.
 */
export function AtelierPieceCard({ piece, priority = false }: { piece: AtelierPiece; priority?: boolean }) {
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
  const guide = priceGuideShort(piece.guide);
  const hasWords = Boolean(piece.title || piece.description || guide);
  const label = piece.title ?? frames[0]?.alt ?? "A piece from the atelier";
  const href = `#${ATELIER_BEGIN_ID}`;
  const shown = frames[index] ?? frames[0];
  const mobileSwipe = layout === "mobile" && frames.length >= 2;
  const cycle = (dir: -1 | 1) => setIndex((i) => (i + dir + frames.length) % frames.length);

  return (
    <article
      className="product-gallery-card group"
      data-gallery-card=""
      data-atelier-piece={piece.id}
      {...(piece.title ? { "aria-labelledby": nameId } : { "aria-label": label })}
    >
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
        {hasWords ? <div className="product-gallery-scrim" aria-hidden /> : null}
        <QuickAddDesktopChrome imageCount={frames.length} onPrev={() => cycle(-1)} onNext={() => cycle(1)} />
      </div>

      {hasWords ? (
        <div className="product-gallery-meta">
          {piece.title ? (
            <h3 id={nameId} className="product-gallery-name line-clamp-2 font-serif text-[15px] leading-snug text-choc md:text-base">
              {piece.title}
            </h3>
          ) : null}
          {piece.description ? (
            <p className={cn("line-clamp-3 font-body text-[12px] leading-relaxed text-text-mid", piece.title && "mt-1.5")}>
              {piece.description}
            </p>
          ) : null}
          {guide ? (
            <p className={cn("font-body text-[13px]", (piece.title || piece.description) && "mt-2.5")}>
              <span className="font-medium text-choc">{guide}</span>
              <span className="block text-[11px] text-text-light">{PRICE_GUIDE_SHORT_NOTE}</span>
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function AtelierPieceGrid({ pieces }: { pieces: AtelierPiece[] }) {
  return (
    <GallerySwipeNudgeHost>
      <div className={cn(GALLERY_GRID_CLASS, GALLERY_GRID_SEAMS, "grid-cols-2", LG_COLS[atelierGridColumns(pieces.length)])}>
        {pieces.map((piece) => (
          <AtelierPieceCard key={piece.id} piece={piece} />
        ))}
      </div>
    </GallerySwipeNudgeHost>
  );
}
