"use client";

import { Plus, X } from "lucide-react";
import { QuickAddCta } from "@/components/common/quick-add/QuickAddCta";
import { QuickAddSizeRow } from "@/components/common/quick-add/QuickAddSizeRow";
import { useProductQuickAdd } from "@/hooks/useQuickAdd";
import { useIsMdUp } from "@/hooks/useMediaQuery";
import { useQuickAddStore } from "@/store/quickAddStore";
import type { ProductListItem } from "@/types/product";

export function QuickAddMobileTrigger({
  productName,
  productId,
  soldOut,
  isOpen,
  onOpen,
}: {
  productName: string;
  productId: string;
  soldOut: boolean;
  isOpen: boolean;
  onOpen: () => void;
}) {
  if (soldOut) {
    return (
      <span className="absolute bottom-2 left-2 z-10 bg-choc/80 px-2 py-1 font-sans text-[9px] font-medium uppercase tracking-[0.12em] text-cream md:hidden">
        Sold out
      </span>
    );
  }

  if (isOpen) return null;

  return (
    <button
      type="button"
      data-quick-add="trigger"
      data-quick-add-trigger={productId}
      aria-label={`Quick add — ${productName}`}
      aria-expanded={false}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onOpen();
      }}
      className="absolute bottom-2 left-2 z-10 flex h-11 w-11 cursor-pointer items-center justify-center bg-choc text-cream transition-transform duration-150 active:scale-[0.97] md:hidden"
    >
      <Plus className="h-4 w-4" strokeWidth={1.75} />
    </button>
  );
}

export function QuickAddMobileClose({
  productName,
  onClose,
}: {
  productName: string;
  onClose: () => void;
}) {
  return (
    <button
      type="button"
      data-quick-add="trigger"
      aria-label={`Close quick add — ${productName}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
      className="absolute right-2 top-2 z-20 flex h-11 w-11 items-center justify-center bg-choc text-cream md:hidden"
    >
      <X className="h-4 w-4" strokeWidth={1.75} />
    </button>
  );
}

export function QuickAddMobilePanel() {
  const product = useQuickAddStore((s) => s.product);
  if (!product) return null;
  return <QuickAddMobilePanelInner product={product} />;
}

function QuickAddMobilePanelInner({ product }: { product: ProductListItem }) {
  const qa = useProductQuickAdd(product);
  const isMd = useIsMdUp();
  if (!qa.isOpen) return null;

  return (
    <div
      data-quick-add="panel"
      className="scroll-mb-28 border border-sand/70 bg-bg-card px-4 py-4 pb-6 md:hidden"
    >
      <p className="font-serif text-[16px] leading-snug text-choc">{product.name}</p>
      <p className="mt-2 font-body text-[13px] font-medium text-choc">{qa.priceLabel}</p>
      <div className="mt-4">
        <QuickAddSizeRow
          variants={product.variants}
          selectedId={qa.variantId}
          onSelect={qa.selectSize}
          autoFocus={!isMd}
          compact
        />
      </div>
      {qa.error ? (
        <p className="mt-3 font-sans text-[12px] text-choc" role="alert">
          {qa.error}
        </p>
      ) : null}
    </div>
  );
}

export function QuickAddStickyBar() {
  const product = useQuickAddStore((s) => s.product);
  if (!product) return null;
  return <QuickAddStickyBarInner product={product} />;
}

function QuickAddStickyBarInner({ product }: { product: ProductListItem }) {
  const qa = useProductQuickAdd(product);
  if (!qa.isOpen) return null;

  return (
    <div
      data-quick-add="sticky"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-sand bg-bg-card px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 md:hidden"
    >
      <QuickAddCta
        phase={qa.phase}
        label={qa.ctaLabel}
        onClick={() => void qa.add()}
        className="h-12 text-[11px]"
      />
    </div>
  );
}
