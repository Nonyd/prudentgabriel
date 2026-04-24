"use client";

const TEXT =
  "PRUDENT GABRIEL · LAGOS, NIGERIA · BESPOKE COUTURE · READY TO WEAR · EST. 2019 · ";

export function BrandMarquee() {
  return (
    <div className="relative h-11 overflow-hidden bg-olive">
      <div className="flex w-max animate-marquee-slow whitespace-nowrap">
        <div className="flex items-center py-3 font-body text-[10px] font-medium uppercase tracking-[0.25em] text-white/80">
          {TEXT}
        </div>
        <div className="flex items-center py-3 font-body text-[10px] font-medium uppercase tracking-[0.25em] text-white/80">
          {TEXT}
        </div>
      </div>
    </div>
  );
}
