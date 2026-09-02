/**
 * Slice S: mobile product-card swipe — cap, dots, tap vs swipe, plus hit.
 *
 *   pnpm test:slice-s
 */
import {
  GALLERY_GRID_IMAGE_TAKE,
  GALLERY_SWIPE_IMAGE_CAP,
  gallerySwipeAlt,
  isQuickAddPlusHit,
  shouldShowGalleryDots,
  shouldSuppressCardNavigation,
  swipeableGallery,
} from "../src/lib/product-gallery";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

function run() {
  assert(GALLERY_SWIPE_IMAGE_CAP <= 5, "grid swipe is a glance, not the PDP gallery");
  assert(GALLERY_SWIPE_IMAGE_CAP >= 4, "enough frames to page through");
  assert(GALLERY_GRID_IMAGE_TAKE >= 6, "desktop arrows still receive the catalogue peak");

  const shots = Array.from({ length: 8 }, (_, i) => ({ url: `https://img/${i}.jpg`, alt: `a${i}` }));
  assert(swipeableGallery(shots).length === GALLERY_SWIPE_IMAGE_CAP, "swipe set is capped");
  assert(swipeableGallery([{ url: "" }, { url: "https://img/1.jpg" }]).length === 1, "blank urls dropped");

  assert(!shouldShowGalleryDots(0), "no images: no dots");
  assert(!shouldShowGalleryDots(1), "single image: no dots, no swipe chrome");
  assert(shouldShowGalleryDots(2), "two images: dots");

  assert(!shouldSuppressCardNavigation(0, 0, 0), "still finger: tap");
  assert(!shouldSuppressCardNavigation(6, 4, 0), "under 10px is still a tap");
  assert(shouldSuppressCardNavigation(12, 1, 0), "horizontal past 10px is a swipe");
  assert(shouldSuppressCardNavigation(0, 0, 20), "native scroll also suppresses the PDP");

  const shot = { left: 0, top: 0, width: 180, height: 240 };
  assert(isQuickAddPlusHit(20, 220, shot), "bottom-left 44px is the +");
  assert(!isQuickAddPlusHit(90, 120, shot), "centre of the photograph is not the +");

  assert(gallerySwipeAlt("Avril", 0, 4) === "Avril", "first alt is the product name");
  assert(gallerySwipeAlt("Avril", 2, 4) === "Avril, image 3 of 4", "later alts are numbered");

  console.log("slice-s: all checks passed");
}

run();
