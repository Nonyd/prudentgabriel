"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuickAddPhase } from "@/lib/quick-add";
import { QuickAddCta } from "@/components/common/quick-add/QuickAddCta";
import { QuickAddSizeRow } from "@/components/common/quick-add/QuickAddSizeRow";
import type { ProductListItem } from "@/types/product";

export function QuickAddDesktopChrome({
  product,
  isOpen,
  phase,
  variantId,
  onSelectSize,
  imageCount,
  onPrev,
  onNext,
  autoFocus,
}: {
  product: ProductListItem;
  isOpen: boolean;
  phase: QuickAddPhase;
  variantId: string | null;
  onSelectSize: (id: string) => void;
  imageCount: number;
  onPrev: () => void;
  onNext: () => void;
  autoFocus?: boolean;
}) {
  return (
    <>
      {imageCount > 1 ? (
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
            className={cn(
              "quick-add-motion absolute left-1 top-1/2 z-10 hidden h-10 w-8 -translate-y-1/2 items-center justify-center text-cream md:flex",
              "opacity-0 transition-opacity duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
              "[@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 [@media(hover:none)]:opacity-100",
            )}
          >
            <ChevronLeft className="h-5 w-5 drop-shadow-sm" strokeWidth={1.5} />
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
            className={cn(
              "quick-add-motion absolute right-1 top-1/2 z-10 hidden h-10 w-8 -translate-y-1/2 items-center justify-center text-cream md:flex",
              "opacity-0 transition-opacity duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
              "[@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 [@media(hover:none)]:opacity-100",
            )}
          >
            <ChevronRight className="h-5 w-5 drop-shadow-sm" strokeWidth={1.5} />
          </button>
        </>
      ) : null}

      <div
        data-quick-add="sizes"
        aria-hidden={!isOpen}
        className={cn(
          "quick-add-motion pointer-events-none absolute inset-x-0 bottom-0 z-10 hidden md:block",
          "translate-y-2 opacity-0 transition-[opacity,transform] duration-[280ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
          isOpen && "pointer-events-auto translate-y-0 opacity-100",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {isOpen ? (
          <div className="bg-gradient-to-t from-bg-card via-bg-card/95 to-transparent px-3 pb-3 pt-8">
            <QuickAddSizeRow
              variants={product.variants}
              selectedId={variantId}
              onSelect={onSelectSize}
              autoFocus={Boolean(autoFocus && isOpen && phase === "sizes")}
            />
          </div>
        ) : null}
      </div>
    </>
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
  return (
    <button
      type="button"
      data-quick-add="trigger"
      data-quick-add-trigger={product.id}
      aria-label={`Quick add — ${product.name}`}
      aria-expanded={isOpen}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onOpen();
      }}
      className={cn(
        "quick-add-motion absolute left-1/2 z-10 hidden -translate-x-1/2 cursor-pointer items-center justify-center rounded-full bg-choc px-3.5 py-1.5 font-sans text-[10px] font-medium uppercase tracking-[0.14em] text-cream md:inline-flex",
        "bottom-[calc(100%+10px)] transition-opacity duration-[280ms] ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]",
        isOpen
          ? "pointer-events-none opacity-0"
          : "opacity-0 [@media(hover:none)]:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100",
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
