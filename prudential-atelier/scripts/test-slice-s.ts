/**
 * Slice S: mobile product-card swipe — cap, dots, tap vs swipe, plus hit.
 *
 *   pnpm test:slice-s
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  GALLERY_GRID_IMAGE_TAKE,
  GALLERY_NUDGE_MS,
  GALLERY_NUDGE_PEEK_RATIO,
  GALLERY_SWIPE_IMAGE_CAP,
  cardIsMeaningfullyInViewport,
  galleryNudgeOffset,
  gallerySwipeAlt,
  isQuickAddPlusHit,
  shouldShowGalleryDots,
  shouldSuppressCardNavigation,
  swipeableGallery,
  firstEligibleNudgeCard,
} from "../src/lib/product-gallery";
import {
  consumeGalleryNudge,
  galleryNudgeStillAvailable,
  markGallerySwipeUsed,
  resetGallerySwipeSessionForTests,
} from "../src/lib/gallery-swipe-session";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "../src");

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

  assert(GALLERY_NUDGE_PEEK_RATIO === 0.15, "nudge peeks a sixth of the card, not a permanent sliver");
  assert(GALLERY_NUDGE_MS === 600, "nudge is a short out-and-back");
  assert(galleryNudgeOffset(0, 200) === 0, "nudge starts at rest");
  assert(galleryNudgeOffset(1, 200) === 0, "nudge ends at rest, no overshoot");
  const mid = galleryNudgeOffset(0.5, 200);
  assert(Math.abs(mid - 30) < 0.01, "peak is 15% of width");
  assert(galleryNudgeOffset(0.25, 200) < mid, "ease-out on the way out");
  assert(galleryNudgeOffset(0.75, 200) < mid, "ease-in on the way back");
  assert(cardIsMeaningfullyInViewport({ top: 0, bottom: 200, height: 200 }, 800), "full card in view");
  assert(!cardIsMeaningfullyInViewport({ top: 790, bottom: 990, height: 200 }, 800), "2px sliver is not in view");
  assert(
    firstEligibleNudgeCard([
      { inView: true, hasSwipe: false },
      { inView: true, hasSwipe: true },
    ]) === 1,
    "single-image first card does not take the nudge",
  );
  assert(firstEligibleNudgeCard([{ inView: true, hasSwipe: false }]) === null, "no swipe in view: wait, do not consume");

  resetGallerySwipeSessionForTests();
  assert(galleryNudgeStillAvailable(), "fresh session can nudge");
  assert(consumeGalleryNudge(true) === false, "reduced motion consumes without playing");
  assert(!galleryNudgeStillAvailable(), "reduced motion still counts as the one hint");
  resetGallerySwipeSessionForTests();
  assert(consumeGalleryNudge() === true, "first call plays");
  assert(consumeGalleryNudge() === false, "second call is silent");
  resetGallerySwipeSessionForTests();
  markGallerySwipeUsed();
  assert(consumeGalleryNudge() === false, "a real swipe cancels the hint");

  const sessionSrc = readFileSync(join(srcRoot, "lib/gallery-swipe-session.ts"), "utf8");
  assert(!sessionSrc.includes("localStorage"), "nudge is not persisted in localStorage");
  assert(!sessionSrc.includes("sessionStorage"), "nudge is not persisted in sessionStorage");

  const css = readFileSync(join(srcRoot, "styles/globals.css"), "utf8");
  assert(css.includes("scroll-snap-type: x mandatory"), "native snap, not a JS carousel");
  assert(css.includes("touch-action: pan-x pan-y pinch-zoom"), "vertical page scroll still allowed");

  const swipeSrc = readFileSync(join(srcRoot, "components/common/ProductCardImageSwipe.tsx"), "utf8");
  assert(swipeSrc.includes('scrollSnapType = "none"'), "nudge disables snap so a 15% peek is not eaten");
  assert(swipeSrc.includes("flushSync"), "rest frames mount before the finger moves");

  const cardSrc = readFileSync(join(srcRoot, "components/common/ProductCard.tsx"), "utf8");
  assert(cardSrc.includes('layout === "mobile"'), "swipe mounts after a real matchMedia, not SSR-as-mobile");
  assert(cardSrc.includes("ProductCardImageSwipe"), "one swipe component on the product card");

  console.log("slice-s: all checks passed");
}

run();
