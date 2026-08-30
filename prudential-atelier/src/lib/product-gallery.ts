/** How many shots the shop grid loads for hover-swap + arrows. Catalogue peaks at 6. */
export const GALLERY_GRID_IMAGE_TAKE = 8;

export function canGalleryHoverSwap(imageCount: number): boolean {
  return imageCount >= 2;
}
