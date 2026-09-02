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

/** How far the first-session hint peeks, as a fraction of the card width. */
export const GALLERY_NUDGE_PEEK_RATIO = 0.15;
/** Out and back. */
export const GALLERY_NUDGE_MS = 600;

/**
 * Scroll offset for the session nudge. t=0 and t=1 sit at the origin.
 * Ease-out to the peek, ease-in back. No overshoot.
 */
export function galleryNudgeOffset(
  progress01: number,
  width: number,
  peekRatio = GALLERY_NUDGE_PEEK_RATIO,
): number {
  const t = Math.min(1, Math.max(0, progress01));
  const peak = width * peekRatio;
  if (t <= 0.5) {
    const u = t * 2;
    const eased = 1 - (1 - u) ** 3;
    return peak * eased;
  }
  const u = (t - 0.5) * 2;
  const eased = u ** 3;
  return peak * (1 - eased);
}

export function cardIsMeaningfullyInViewport(
  rect: { top: number; bottom: number; height: number },
  viewportHeight: number,
): boolean {
  const visible = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
  return visible >= Math.min(rect.height * 0.4, 80);
}
