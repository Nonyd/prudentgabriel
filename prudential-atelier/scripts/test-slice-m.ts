/**
 * Slice M: gallery hover-swap eligibility.
 *
 *   pnpm test:slice-m
 */
import { canGalleryHoverSwap, GALLERY_GRID_IMAGE_TAKE } from "../src/lib/product-gallery";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

function run() {
  assert(!canGalleryHoverSwap(0), "no images: no hover swap");
  assert(!canGalleryHoverSwap(1), "single image: no arrows, no hover swap");
  assert(canGalleryHoverSwap(2), "two images: hover swap and arrows");
  assert(canGalleryHoverSwap(6), "full gallery still swaps");
  assert(GALLERY_GRID_IMAGE_TAKE >= 6, "grid fetch covers the catalogue peak of 6 shots");
  console.log("slice-m: all checks passed");
}

run();
