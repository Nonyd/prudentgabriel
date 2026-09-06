/**
 * Slice AE — collection page, reels, footer.
 *
 *   pnpm test:slice-ae
 */
import "./preload-test-env";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ProductCategory, ProductType } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { findLivePublishedCollection } from "../src/lib/live-collections";
import { uniqueProductCountsForCollections } from "../src/lib/collection-products";
import { interleaveCollectionGallery } from "../src/lib/collection-gallery";
import {
  pickPlayingReelIds,
  shouldAutoplayReel,
  shouldPrefetchReelVideo,
} from "../src/lib/collection-reel-playback";
import {
  collectionReelTooLarge,
  MAX_COLLECTION_REEL_BYTES,
} from "../src/lib/collection-reel-limits";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (rel: string) => readFileSync(join(root, rel), "utf8");
const stamp = `slice-ae-${Date.now()}`;
const ids = { productIds: [] as string[], collectionIds: [] as string[] };

async function cleanup() {
  if (ids.collectionIds.length) {
    await prisma.collection.deleteMany({ where: { id: { in: ids.collectionIds } } });
  }
  if (ids.productIds.length) {
    await prisma.product.deleteMany({ where: { id: { in: ids.productIds } } });
  }
}

async function testEmptyCollectionIsNotPublic() {
  const empty = await prisma.collection.create({
    data: {
      name: `${stamp} Empty`,
      slug: `${stamp}-empty`,
      isPublished: true,
    },
  });
  ids.collectionIds.push(empty.id);

  const found = await findLivePublishedCollection(empty.slug);
  assert(found === null, "published collection with zero live pieces is not public");

  const product = await prisma.product.create({
    data: {
      name: `${stamp} Piece`,
      slug: `${stamp}-piece`,
      description: "x",
      category: ProductCategory.FORMAL,
      type: ProductType.RTW,
      priceNGN: 10_000,
      basePriceNGN: 10_000,
      isPublished: true,
    },
  });
  ids.productIds.push(product.id);
  await prisma.collectionProduct.create({
    data: { collectionId: empty.id, productId: product.id, sortOrder: 0 },
  });

  const live = await findLivePublishedCollection(empty.slug);
  assert(live?.id === empty.id, "collection becomes public once it has a live piece");

  await prisma.product.update({ where: { id: product.id }, data: { isPublished: false } });
  const [count] = await uniqueProductCountsForCollections([{ id: empty.id, autoTag: null }]);
  assert(count === 0, "unpublished pieces do not count as live");
  const gone = await findLivePublishedCollection(empty.slug);
  assert(gone === null, "unpublishing the only piece hides the collection again");
}

function testReelPlaybackRules() {
  assert(shouldPrefetchReelVideo({ withinOneViewport: true, saveData: false, reducedMotion: false }) === true, "prefetch near viewport");
  assert(shouldPrefetchReelVideo({ withinOneViewport: true, saveData: true, reducedMotion: false }) === false, "no prefetch on save-data");
  assert(shouldPrefetchReelVideo({ withinOneViewport: true, saveData: false, reducedMotion: true }) === false, "no prefetch on reduced motion");

  assert(shouldAutoplayReel({ inView: true, saveData: false, reducedMotion: false, tappedToPlay: false }) === true, "autoplay in view");
  assert(shouldAutoplayReel({ inView: false, saveData: false, reducedMotion: false, tappedToPlay: false }) === false, "pause out of view");
  assert(shouldAutoplayReel({ inView: true, saveData: true, reducedMotion: false, tappedToPlay: false }) === false, "save-data waits for tap");
  assert(shouldAutoplayReel({ inView: true, saveData: true, reducedMotion: false, tappedToPlay: true }) === true, "save-data plays after tap");

  const playing = pickPlayingReelIds(["a", "b", "c"], ["a"], 2);
  assert(playing.length === 2, "at most two reels play");
  assert(playing.includes("a") && playing.includes("b"), "keeps current then fills from in-view");
  const paused = pickPlayingReelIds(["c"], ["a", "b"], 2);
  assert(paused.length === 1 && paused[0] === "c", "out-of-view reels lose their slot");
}

function testGalleryInterleave() {
  const products = [{ id: "p1" }, { id: "p2" }, { id: "p3" }, { id: "p4" }];
  const reels = [
    {
      id: "r1",
      position: 3,
      sortOrder: 0,
      isActive: true,
      videoKey: "/media/public/x.mp4",
      posterKey: "/media/public/x.jpg",
      productId: null,
    },
  ];
  const { cells, hero } = interleaveCollectionGallery(products, reels);
  assert(hero === null, "position 3 is not a hero reel");
  assert(cells[3]?.type === "reel", "reel sits after the 3rd piece");
  assert(cells.filter((c) => c.type === "product").length === 4, "all products remain");
}

function testSourceContracts() {
  const page = src("src/components/collections/CollectionDetailPage.tsx");
  assert(!page.includes("—— ◆ ——") && !page.includes("SCROLL"), "collection page dropped the diamond and SCROLL");
  assert(page.includes("glass-1"), "hero panel is glass-1");
  assert(page.includes("Shop the collection"), "one shop CTA");
  assert(page.includes("No pieces yet — add pieces on the collection page in admin."), "admin empty copy");

  const reelCell = src("src/components/collections/CollectionReelCell.tsx");
  assert(reelCell.includes("poster"), "poster is on the reel cell");
  assert(reelCell.includes("shouldPrefetchReelVideo"), "video waits until near the viewport");
  assert(reelCell.includes("loop"), "reels loop");
  assert(!/controls/.test(reelCell) || reelCell.includes("disablePictureInPicture"), "no native controls chrome");

  const upload = src("src/app/api/admin/upload/route.ts");
  assert(upload.includes("Reel must be under 10MB"), "upload refuses a reel over 10MB");
  assert(upload.includes("MAX_COLLECTION_REEL_BYTES"), "reel cap is the shared 10MB constant");

  const footer = src("src/components/public/Footer.tsx");
  assert(footer.includes("lg:grid-cols-4"), "footer is four columns at 1440");
  assert(footer.includes("grid-cols-2"), "footer is two columns at 390");
  assert(footer.includes("data-footer-columns"), "footer columns are marked for tests");
  assert(footer.includes("data-footer-stay-close"), "newsletter is the stay-close column");
  assert(footer.includes("col-span-2"), "newsletter goes full width on mobile");
  assert(footer.includes("Developed with love by SonsHub Media Ltd"), "credit lives in the legal row");
  assert(!footer.includes("International luxury couture"), "house tagline left the footer");
}

async function run() {
  assert(collectionReelTooLarge(MAX_COLLECTION_REEL_BYTES + 1) === true, "10MB + 1 is refused");
  assert(collectionReelTooLarge(MAX_COLLECTION_REEL_BYTES) === false, "exactly 10MB is allowed");
  testReelPlaybackRules();
  testGalleryInterleave();
  testSourceContracts();
  await testEmptyCollectionIsNotPublic();
  console.log("slice-ae: all checks passed");
}

run()
  .catch(async (e) => {
    console.error(e);
    await cleanup();
    process.exit(1);
  })
  .then(async () => {
    await cleanup();
    await prisma.$disconnect();
  });
