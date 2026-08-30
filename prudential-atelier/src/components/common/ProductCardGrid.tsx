"use client";

import { Fragment } from "react";
import { ProductCard } from "@/components/common/ProductCard";
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
}: {
  products: ProductListItem[];
  className?: string;
  priorityCount?: number;
  mobileColumns?: 1 | 2;
  merchBadge?: string;
}) {
  const activeId = useQuickAddStore((s) => s.product?.id ?? null);
  const isOpen = useQuickAddStore((s) => s.phase !== "idle");
  const activeIndex = activeId ? products.findIndex((p) => p.id === activeId) : -1;
  const cols = mobileColumns;
  const activeRow = activeIndex >= 0 ? Math.floor(activeIndex / cols) : -1;

  return (
    <div className={cn("grid gap-px bg-white", className, isOpen && activeIndex >= 0 && "max-md:pb-28")}>
      {products.map((p, i) => {
        const row = Math.floor(i / cols);
        const dimmed = activeRow >= 0 && row === activeRow && p.id !== activeId;
        const endOfRow = i % cols === cols - 1 || i === products.length - 1;
        const showPanel = endOfRow && activeRow === row && isOpen;
        return (
          <Fragment key={p.id}>
            <ProductCard product={p} priority={i < priorityCount} dimmed={dimmed} merchBadge={merchBadge} />
            {showPanel ? (
              <div className={cols === 1 ? "md:hidden" : "col-span-2 md:hidden"}>
                <QuickAddMobilePanel />
              </div>
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}

export function ProductCardRail({
  products,
  itemClassName = "w-[220px] shrink-0",
}: {
  products: ProductListItem[];
  itemClassName?: string;
}) {
  const activeId = useQuickAddStore((s) => s.product?.id ?? null);
  const inRail = Boolean(activeId && products.some((p) => p.id === activeId));

  return (
    <div className={inRail ? "max-md:pb-28" : undefined}>
      <div className="flex gap-px overflow-x-auto bg-white pb-0">
        {products.map((p) => (
          <div key={p.id} className={itemClassName}>
            <ProductCard product={p} />
          </div>
        ))}
      </div>
      {inRail ? (
        <div className="mt-3 md:hidden">
          <QuickAddMobilePanel />
        </div>
      ) : null}
    </div>
  );
}
