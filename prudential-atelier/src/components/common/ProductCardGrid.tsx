"use client";

import { Fragment } from "react";
import { ProductCard } from "@/components/common/ProductCard";
import { GallerySwipeNudgeHost } from "@/components/common/GallerySwipeNudgeHost";
import { QuickAddMobilePanel } from "@/components/common/quick-add/QuickAddMobile";
import { cn } from "@/lib/utils";
import { useQuickAddStore } from "@/store/quickAddStore";
import type { ProductListItem } from "@/types/product";

export function ProductCardGrid({
  products,
  className,
  priorityCount = 4,
  mobileColumns = 2,
  merchBadge,
  variant = "gallery",
}: {
  products: ProductListItem[];
  className?: string;
  priorityCount?: number;
  mobileColumns?: 1 | 2;
  merchBadge?: string;
  /** Homepage teasers sit in glass frames. Shop/RTW galleries stay photography-only. */
  variant?: "gallery" | "teaser";
}) {
  const activeId = useQuickAddStore((s) => s.product?.id ?? null);
  const isOpen = useQuickAddStore((s) => s.phase !== "idle");
  const activeIndex = activeId ? products.findIndex((p) => p.id === activeId) : -1;
  const cols = mobileColumns;
  const activeRow = activeIndex >= 0 ? Math.floor(activeIndex / cols) : -1;
  const teaser = variant === "teaser";

  return (
    <GallerySwipeNudgeHost>
      <div
        className={cn(
          "grid min-w-0 [&>*]:min-w-0",
          teaser ? "gap-4 bg-transparent px-4 lg:px-6" : "gap-px bg-white",
          className,
          isOpen && activeIndex >= 0 && "max-md:pb-28",
        )}
      >
        {products.map((p, i) => {
          const row = Math.floor(i / cols);
          const dimmed = activeRow >= 0 && row === activeRow && p.id !== activeId;
          const endOfRow = i % cols === cols - 1 || i === products.length - 1;
          const showPanel = endOfRow && activeRow === row && isOpen;
          const card = <ProductCard product={p} priority={i < priorityCount} dimmed={dimmed} merchBadge={merchBadge} />;
          return (
            <Fragment key={p.id}>
              {teaser ? (
                <div className="glass-2 glass-panel glass-lift overflow-hidden">{card}</div>
              ) : (
                card
              )}
              {showPanel ? (
                <div className={cols === 1 ? "md:hidden" : "col-span-2 md:hidden"}>
                  <QuickAddMobilePanel />
                </div>
              ) : null}
            </Fragment>
          );
        })}
      </div>
    </GallerySwipeNudgeHost>
  );
}

export function ProductCardRail({
  products,
  itemClassName = "w-[220px] shrink-0",
  variant = "gallery",
}: {
  products: ProductListItem[];
  itemClassName?: string;
  variant?: "gallery" | "teaser";
}) {
  const activeId = useQuickAddStore((s) => s.product?.id ?? null);
  const inRail = Boolean(activeId && products.some((p) => p.id === activeId));
  const teaser = variant === "teaser";

  return (
    <GallerySwipeNudgeHost>
      <div className={inRail ? "max-md:pb-28" : undefined}>
        <div className={cn("flex overflow-x-auto pb-0", teaser ? "gap-4 bg-transparent" : "gap-px bg-white")}>
          {products.map((p) => (
            <div key={p.id} className={itemClassName}>
              {teaser ? (
                <div className="glass-2 glass-panel glass-lift overflow-hidden">
                  <ProductCard product={p} />
                </div>
              ) : (
                <ProductCard product={p} />
              )}
            </div>
          ))}
        </div>
        {inRail ? (
          <div className="mt-3 md:hidden">
            <QuickAddMobilePanel />
          </div>
        ) : null}
      </div>
    </GallerySwipeNudgeHost>
  );
}
