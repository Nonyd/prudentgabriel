/** How many shots the shop grid loads for hover-swap + arrows. Catalogue peaks at 6. */
export const GALLERY_GRID_IMAGE_TAKE = 8;

/** Swipe strip on the grid. The PDP keeps the rest of the gallery. */
export const GALLERY_SWIPE_IMAGE_CAP = 5;

/** A move past this is a swipe, not a tap to the PDP or Quick Add. */
export const GALLERY_SWIPE_NAV_THRESHOLD_PX = 10;

export const QUICK_ADD_PLUS_SIZE_PX = 44;
export const QUICK_ADD_PLUS_INSET_PX = 8;

export type GalleryShot = { url: string; alt?: string | null };

export function canGalleryHoverSwap(imageCount: number): boolean {
  return imageCount >= 2;
}

export function swipeableGallery<T extends GalleryShot>(images: T[], cap = GALLERY_SWIPE_IMAGE_CAP): T[] {
  return images.filter((im) => im.url?.trim()).slice(0, cap);
}

export function shouldShowGalleryDots(imageCount: number): boolean {
  return imageCount >= 2;
}

export function shouldSuppressCardNavigation(
  deltaX: number,
  deltaY: number,
  scrollDelta = 0,
  threshold = GALLERY_SWIPE_NAV_THRESHOLD_PX,
): boolean {
  return Math.hypot(deltaX, deltaY) > threshold || Math.abs(scrollDelta) > 4;
}

export function isQuickAddPlusHit(
  clientX: number,
  clientY: number,
  shot: { left: number; top: number; width: number; height: number },
): boolean {
  const left = shot.left + QUICK_ADD_PLUS_INSET_PX;
  const top = shot.top + shot.height - QUICK_ADD_PLUS_INSET_PX - QUICK_ADD_PLUS_SIZE_PX;
  return (
    clientX >= left &&
    clientX <= left + QUICK_ADD_PLUS_SIZE_PX &&
    clientY >= top &&
    clientY <= top + QUICK_ADD_PLUS_SIZE_PX
  );
}

export function gallerySwipeAlt(productName: string, index: number, total: number): string {
  if (index === 0) return productName;
  return `${productName}, image ${index + 1} of ${total}`;
}
