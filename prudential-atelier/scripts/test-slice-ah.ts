/**
 * Slice AH — Ready to Wear as a landing page.
 *
 *   pnpm test:slice-ah
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { rtwHeroCopy, RTW_GRID_ID, RTW_HERO_HEADLINE, RTW_HERO_SUBLINE } from "../src/lib/rtw-hero";
import { HOMEPAGE_BESTSELLERS_ADMIN_NOTE } from "../src/lib/homepage-bestsellers";
import { parseHeroCarouselItems } from "../src/lib/hero-carousel";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (rel: string) => readFileSync(join(root, rel), "utf8");

function runCopy() {
  const defaults = rtwHeroCopy({});
  assert(defaults.headline === RTW_HERO_HEADLINE, "default headline is not the nav label");
  assert(!defaults.headline.toLowerCase().includes("ready-to-wear"), "headline is not Ready to Wear");
  assert(defaults.subline.includes("Lagos"), "subline says Lagos");
  assert(defaults.subline.includes("7-12"), "subline says 7-12 days");
  assert(defaults.cta.length > 0, "CTA has a label");
  assert(defaults.promise.includes("7-12"), "promise band says 7-12 days");

  const legacy = rtwHeroCopy({ legacyTitle: "Ready-to-Wear", legacySubtitle: "" });
  assert(legacy.headline === RTW_HERO_HEADLINE, "stored Ready-to-Wear title is ignored");

  const custom = rtwHeroCopy({ headline: "This season, from the house" });
  assert(custom.headline === "This season, from the house", "Glory can replace the headline");
}

function runCarouselParse() {
  const items = parseHeroCarouselItems(
    JSON.stringify([
      { type: "image", url: "/media/public/rtw.jpg", alt: "Look" },
      { type: "video", url: "/media/public/rtw.mp4", poster: "/media/public/rtw-poster.jpg" },
    ]),
  );
  assert(items.length === 2, "parses two slides");
  assert(items[1]?.poster === "/media/public/rtw-poster.jpg", "video poster survives parse");
}

function runSource() {
  const page = src("src/app/(storefront)/page.tsx");
  const rtwPage = src("src/app/(storefront)/rtw/page.tsx");
  const client = src("src/components/rtw/RTWPageClient.tsx");
  const hero = src("src/components/rtw/RTWLandingHero.tsx");
  const bestsellers = src("src/components/public/BestSellers.tsx");
  const bridal = src("src/components/public/HomeBridalBand.tsx");
  const journal = src("src/components/public/BlogPreview.tsx");
  const cms = src("src/lib/cms-config.ts");
  const reports = src("src/components/admin/finance/WhatsSellingPanel.tsx");
  const pay = src("src/lib/order-payment.ts");
  const grid = src("src/components/common/ProductCardGrid.tsx");
  const pkg = src("package.json");

  const heroIdx = page.indexOf("<HeroSection");
  const doorsIdx = page.indexOf("<CategoryGrid");
  const sellIdx = page.indexOf("<BestSellers");
  const bridalIdx = page.indexOf("<HomeBridalBand");
  const journeyIdx = page.indexOf("<BespokeJourney");
  assert(heroIdx >= 0 && doorsIdx > heroIdx, "three doors sit directly under the hero");
  assert(sellIdx > doorsIdx, "top sellers follow the three doors");
  assert(bridalIdx > sellIdx, "bridal imagery follows top sellers");
  assert(journeyIdx > bridalIdx, "atelier journey stays after bridal");

  assert(cms.includes("rtw_hero_carousel"), "RTW hero media is a CMS carousel");
  assert(cms.includes("rtw_hero_headline"), "RTW headline is CMS-managed");
  assert(cms.includes("rtw_hero_cta_label"), "RTW CTA is CMS-managed");
  assert(cms.includes("home_bridal_headline"), "bridal band copy is CMS-managed");

  assert(hero.includes("glass-1"), "RTW hero copy sits on glass-1");
  assert(hero.includes("hero-copy-scrim"), "RTW hero has a scrim under the glass");
  assert(hero.includes("preload=\"metadata\""), "RTW hero video is poster-first, not preload auto");
  assert(hero.includes(`#${RTW_GRID_ID}`) || hero.includes("RTW_GRID_ID"), "CTA scrolls to the grid");
  assert(hero.includes("shouldPrefetchReelVideo"), "portrait video follows AE prefetch");

  assert(client.includes('label: "Dresses"'), "chips are sentence case");
  assert(client.includes("glass-1 glass-pill"), "chips are glass-1 pills");
  assert(client.includes("ProductCardGrid"), "gallery grid is unchanged");
  assert(client.includes('variant="teaser"'), "RTW tiles stay teasers");
  assert(!client.includes("CollectionGalleryGrid"), "reels stay collection-only for now");
  assert(client.includes("promiseBand"), "promise band renders on the landing page");

  assert(rtwPage.includes("rtwHeroCopy"), "page uses the copy helper so Ready-to-Wear cannot leak");
  assert(rtwPage.includes("queryProductList"), "grid still loads the catalogue");

  assert(bestsellers.includes("rankedProductIdsByUnitsSold"), "Best sellers still rank on purchase volume");
  assert(bestsellers.includes("featuredFallback"), "until there are orders it falls back to Featured");
  assert(bestsellers.includes('merchBadge="Best seller"'), "Best seller badge string stays for slice N");
  assert(!bestsellers.includes("orderCount"), "homepage row does not rank on Product.orderCount");
  assert(pay.includes("orderCount: { increment: qty }"), "paid orders increment Product.orderCount");

  assert(bridal.includes("GalleryCategory.BRIDAL"), "bridal band uses the bridal gallery");
  assert(bridal.includes("if (images.length === 0) return null"), "bridal band hides when empty");
  assert(!bridal.includes("glass-"), "bridal photography is not glassed");

  assert(journal.includes("if (posts.length === 0) return null"), "journal section hides with zero posts");

  assert(reports.includes("HOMEPAGE_BESTSELLERS_ADMIN_NOTE"), "admin reports say when Featured is the fallback");
  assert(HOMEPAGE_BESTSELLERS_ADMIN_NOTE.includes("Featured"), "admin note names Featured");

  assert(grid.includes('variant?: "gallery" | "teaser"'), "gallery vs teaser is still explicit");
  assert(pkg.includes("test:slice-ah"), "package.json exposes the slice AH script");
}

function run() {
  runCopy();
  runCarouselParse();
  runSource();
  console.log("slice-ah: all checks passed");
}

run();
