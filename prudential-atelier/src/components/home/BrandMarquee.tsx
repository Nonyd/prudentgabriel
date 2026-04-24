"use client";

const TEXT =
  "PRUDENTIAL ATELIER · BESPOKE COUTURE · LAGOS, NIGERIA · EST. 2019 · OVER 5,000 DESIGNERS TRAINED · ";

export function BrandMarquee() {
  return (
    <div className="relative h-12 overflow-hidden border-y border-gold/30 bg-wine">
      <div className="flex w-max animate-marquee whitespace-nowrap">
        <div className="font-label text-[11px] tracking-[0.2em] text-gold">{TEXT}</div>
        <div className="font-label text-[11px] tracking-[0.2em] text-gold">{TEXT}</div>
      </div>
    </div>
  );
}
