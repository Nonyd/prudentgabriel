"use client";

import { Fragment } from "react";
import { ProductCard } from "@/components/common/ProductCard";
import { GallerySwipeNudgeHost } from "@/components/common/GallerySwipeNudgeHost";
import { QuickAddMobilePanel } from "@/components/common/quick-add/QuickAddMobile";
import { CollectionReelCell } from "@/components/collections/CollectionReelCell";
import { interleaveCollectionGallery, type CollectionReelRecord } from "@/lib/collection-gallery";
import { cn } from "@/lib/utils";
import { useQuickAddStore } from "@/store/quickAddStore";
import type { ProductListItem } from "@/types/product";

export function CollectionGalleryGrid({
  products,
  reels,
  priorityCount = 8,
}: {
  products: ProductListItem[];
  reels: CollectionReelRecord[];
  priorityCount?: number;
}) {
  const { cells } = interleaveCollectionGallery(products, reels);
  const activeId = useQuickAddStore((s) => s.product?.id ?? null);
  const isOpen = useQuickAddStore((s) => s.phase !== "idle");
  const cols = 2;
  const productIndex = activeId ? products.findIndex((p) => p.id === activeId) : -1;
  const activeRow = productIndex >= 0 ? Math.floor(productIndex / cols) : -1;

  return (
    <GallerySwipeNudgeHost>
      <div
        className={cn(
          "grid min-w-0 grid-flow-dense grid-cols-2 gap-px bg-white md:grid-cols-3 xl:grid-cols-4 [&>*]:min-w-0",
          isOpen && productIndex >= 0 && "max-md:pb-28",
        )}
      >
        {cells.map((cell, i) => {
          if (cell.type === "reel") {
            return (
              <CollectionReelCell
                key={`reel-${cell.reel.id}`}
                reel={cell.reel}
                className="relative row-span-2 aspect-[9/16] min-h-0 overflow-hidden bg-ivory-dark"
              />
            );
          }
          const p = cell.product;
          const pIndex = products.findIndex((item) => item.id === p.id);
          const row = Math.floor(pIndex / cols);
          const dimmed = activeRow >= 0 && row === activeRow && p.id !== activeId;
          const endOfRow = pIndex % cols === cols - 1 || pIndex === products.length - 1;
          const showPanel = endOfRow && activeRow === row && isOpen;
          return (
            <Fragment key={p.id}>
              <ProductCard product={p} priority={i < priorityCount} dimmed={dimmed} />
              {showPanel ? (
                <div className="col-span-2 md:hidden">
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
