export type CollectionReelRecord = {
  id: string;
  position: number;
  sortOrder: number;
  isActive: boolean;
  videoKey: string;
  posterKey: string;
  productId: string | null;
  productName?: string | null;
  productSlug?: string | null;
};

export type GalleryCell =
  | { type: "product"; productId: string }
  | { type: "reel"; reel: CollectionReelRecord };

/** Default grid slots: after the 3rd, 8th, then 14th piece. */
export const DEFAULT_REEL_POSITIONS = [3, 8, 14] as const;

export function splitHeroAndGridReels(reels: CollectionReelRecord[]) {
  const active = reels.filter((r) => r.isActive);
  const hero = active.filter((r) => r.position === 0).sort((a, b) => a.sortOrder - b.sortOrder)[0] ?? null;
  const grid = active
    .filter((r) => r.position !== 0)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.position - b.position);
  return { hero, grid };
}

/**
 * Inserts reels after the Nth product (`position`), then appends leftovers.
 * Products are identified only by id so this stays UI-agnostic.
 */
export function interleaveCollectionGallery<T extends { id: string }>(
  products: T[],
  reels: CollectionReelRecord[],
): { hero: CollectionReelRecord | null; cells: Array<{ type: "product"; product: T } | { type: "reel"; reel: CollectionReelRecord }> } {
  const { hero, grid } = splitHeroAndGridReels(reels);
  const cells: Array<{ type: "product"; product: T } | { type: "reel"; reel: CollectionReelRecord }> = [];
  let productIndex = 0;
  let reelIndex = 0;

  while (productIndex < products.length || reelIndex < grid.length) {
    const nextReel = grid[reelIndex];
    if (nextReel && productIndex === nextReel.position) {
      cells.push({ type: "reel", reel: nextReel });
      reelIndex += 1;
      continue;
    }
    if (productIndex < products.length) {
      cells.push({ type: "product", product: products[productIndex]! });
      productIndex += 1;
      continue;
    }
    cells.push({ type: "reel", reel: nextReel! });
    reelIndex += 1;
  }

  return { hero, cells };
}
