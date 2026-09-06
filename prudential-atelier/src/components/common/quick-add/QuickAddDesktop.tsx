"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuickAddPhase } from "@/lib/quick-add";
import { QuickAddCta } from "@/components/common/quick-add/QuickAddCta";
import { QuickAddSizeRow } from "@/components/common/quick-add/QuickAddSizeRow";
import { standardVariants } from "@/lib/custom-size";
import type { ProductListItem } from "@/types/product";

export function QuickAddDesktopChrome({
  imageCount,
  onPrev,
  onNext,
}: {
  imageCount: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (imageCount < 2) return null;

  return (
    <>
      <button
        type="button"
        data-quick-add="chrome"
        aria-label="Previous image"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onPrev();
        }}
        className="product-gallery-hover-only product-gallery-nav quick-add-motion left-2 hidden glass-1 glass-pill md:flex"
      >
        <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
      </button>
      <button
        type="button"
        data-quick-add="chrome"
        aria-label="Next image"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onNext();
        }}
        className="product-gallery-hover-only product-gallery-nav quick-add-motion right-2 hidden glass-1 glass-pill md:flex"
      >
        <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
      </button>
    </>
  );
}

export function QuickAddDesktopSizes({
  product,
  isOpen,
  phase,
  variantId,
  onSelectSize,
  autoFocus,
}: {
  product: ProductListItem;
  isOpen: boolean;
  phase: QuickAddPhase;
  variantId: string | null;
  onSelectSize: (id: string) => void;
  autoFocus?: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div
      data-quick-add="sizes"
      className="quick-add-motion mt-3 hidden md:block"
      onClick={(e) => e.stopPropagation()}
    >
      <QuickAddSizeRow
        variants={standardVariants(product.variants)}
        selectedId={variantId}
        onSelect={onSelectSize}
        autoFocus={Boolean(autoFocus && phase === "sizes")}
      />
      {product.customOffered ? (
        <p className="mt-3 font-body text-[11px] leading-5 text-charcoal-mid">
          Made to your measurements is available on the{" "}
          <a href={`/shop/${product.slug}`} className="text-choc underline">
            product page
          </a>
          .
        </p>
      ) : null}
    </div>
  );
}

export function QuickAddDesktopTrigger({
  product,
  isOpen,
  onOpen,
}: {
  product: ProductListItem;
  isOpen: boolean;
  onOpen: () => void;
}) {
  if (isOpen) return null;

  return (
    <button
      type="button"
      data-quick-add="trigger"
      data-quick-add-trigger={product.id}
      aria-label={`Quick add — ${product.name}`}
      aria-expanded={false}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onOpen();
      }}
      className={cn(
        "quick-add-motion relative z-10 hidden cursor-pointer items-center justify-center rounded-full bg-choc px-3.5 py-1.5 font-sans text-[10px] font-medium uppercase tracking-[0.14em] text-cream md:inline-flex",
        "active:scale-[0.97]",
      )}
    >
      Quick view
    </button>
  );
}

export function QuickAddDesktopPriceSwap({
  isOpen,
  phase,
  ctaLabel,
  error,
  onAdd,
  children,
}: {
  isOpen: boolean;
  phase: QuickAddPhase;
  ctaLabel: string;
  error: string | null;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative mt-2.5 hidden min-h-10 md:block">
      <div
        className={cn(
          "quick-add-motion transition-[opacity,transform] duration-[280ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
          isOpen ? "pointer-events-none absolute inset-x-0 top-0 opacity-0" : "relative opacity-100",
        )}
      >
        {children}
      </div>
      <div
        data-quick-add="cta"
        aria-hidden={!isOpen}
        className={cn(
          "quick-add-motion transition-[opacity,transform] duration-[280ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
          isOpen
            ? "relative translate-y-0 opacity-100"
            : "pointer-events-none absolute inset-x-0 top-0 translate-y-1 opacity-0",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <QuickAddCta phase={phase} label={ctaLabel} onClick={onAdd} />
        {error ? (
          <p className="absolute left-0 right-0 top-full mt-1 font-sans text-[11px] text-choc" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
