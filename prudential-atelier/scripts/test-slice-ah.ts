/**
 * Slice AH — Ready to Wear as a landing page.
 *
 *   pnpm test:slice-ah
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { rtwHeroCopy, rtwHeroLooks, rtwHeroSideLooks, rtwHeroPlaybackUrl, RTW_GRID_ID, RTW_HERO_HEADLINE, RTW_HERO_SUBLINE } from "../src/lib/rtw-hero";
import {
  heroVideoNeedsCompress,
  heroVideoOutputSize,
  heroVideoTargetBitrate,
  MAX_HERO_VIDEO_BYTES,
  MAX_HERO_VIDEO_SECONDS,
} from "../src/lib/hero-video-limits";
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

function runLooks() {
  const looks = rtwHeroLooks([
    { name: "Avril", images: [{ url: "/media/a.jpg", alt: "Avril look", isPrimary: true }] },
    { name: "Avril dup", images: [{ url: "/media/a.jpg", alt: "dup", isPrimary: true }] },
    { name: "Dalia", images: [{ url: "", alt: null }, { url: "/media/d.jpg", alt: null }] },
  ]);
  assert(looks.length === 2, "duplicate urls and empty urls are skipped");
  assert(looks[0]?.url === "/media/a.jpg", "primary image wins");
  assert(looks[1]?.alt === "Dalia", "missing alt falls back to the piece name");

  const cmsSides = rtwHeroSideLooks({
    top: "/media/cms-top.jpg",
    bottom: "/media/cms-bottom.jpg",
    fallback: looks,
  });
  assert(cmsSides[0]?.url === "/media/cms-top.jpg", "upper look is the CMS image");
  assert(cmsSides[1]?.url === "/media/cms-bottom.jpg", "lower look is the CMS image");

  const mixed = rtwHeroSideLooks({ top: "/media/cms-top.jpg", fallback: looks });
  assert(mixed[0]?.url === "/media/cms-top.jpg", "set CMS image wins its slot");
  assert(mixed[1]?.url === "/media/d.jpg", "empty CMS slot still uses the catalogue");
}

function runPlaybackUrl() {
  const raw = rtwHeroPlaybackUrl("https://res.cloudinary.com/demo/video/upload/v1/clip.webm");
  assert(raw.includes("w_1080,c_limit,f_mp4,q_auto:eco,vc_h264"), "bare Cloudinary video is capped and remuxed to H.264");

  const already = rtwHeroPlaybackUrl(
    "https://res.cloudinary.com/demo/video/upload/f_mp4,q_auto,vc_h264/v1/clip.mp4",
  );
  assert(already.includes("w_1080,c_limit,f_mp4,q_auto,vc_h264"), "existing H.264 transform still gets a width cap");
  assert(!already.includes("w_1080,c_limit,w_1080"), "width cap is not doubled");

  const sized = rtwHeroPlaybackUrl("https://res.cloudinary.com/demo/video/upload/w_720,f_mp4/v1/clip.mp4");
  assert(sized.includes("/upload/w_720,f_mp4/"), "an explicit width is left alone");

  const local = rtwHeroPlaybackUrl("/media/public/hero.webm");
  assert(local.includes("/media/public/hero.mp4"), "iPhone cannot play local WebM; playback is H.264");
  assert(local.includes("pgv=4"), "local media still cache-busts");
}

function runHeroVideoLimits() {
  assert(heroVideoNeedsCompress({ sizeBytes: 1_000_000, mime: "video/webm", width: 1080, height: 1920 }), "WebM is always remuxed");
  assert(
    heroVideoNeedsCompress({ sizeBytes: MAX_HERO_VIDEO_BYTES + 1, mime: "video/mp4", width: 1080, height: 1920 }),
    "an oversized MP4 is compressed",
  );
  assert(
    !heroVideoNeedsCompress({ sizeBytes: 4_000_000, mime: "video/mp4", width: 1080, height: 1080 }),
    "a small 1080p MP4 is stored as-is",
  );
  assert(heroVideoOutputSize(2160, 3840).width === 1080 && heroVideoOutputSize(2160, 3840).height === 1920, "4K portrait scales to 1080 on the long edge");
  assert(heroVideoOutputSize(1920, 1080).width === 1080 && heroVideoOutputSize(1920, 1080).height === 608, "4K landscape scales without upscaling");
  assert(heroVideoOutputSize(720, 1280).width === 720 && heroVideoOutputSize(720, 1280).height === 1280, "smaller clips are not upscaled");
  assert(
    heroVideoTargetBitrate(MAX_HERO_VIDEO_SECONDS) * MAX_HERO_VIDEO_SECONDS < MAX_HERO_VIDEO_BYTES * 8,
    "90-second muted target fits under the stored cap",
  );
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
  assert(cms.includes("rtw_hero_look_top"), "upper look is CMS-managed");
  assert(cms.includes("rtw_hero_look_bottom"), "lower look is CMS-managed");
  assert(cms.includes("rtw_hero_headline"), "RTW headline is CMS-managed");
  assert(cms.includes("rtw_hero_cta_label"), "RTW CTA is CMS-managed");
  assert(cms.includes("home_bridal_headline"), "bridal band copy is CMS-managed");

  assert(hero.includes("glass-1"), "RTW hero copy sits on glass-1");
  assert(hero.includes("hero-copy-scrim"), "RTW hero has a scrim under the glass");
  assert(hero.includes("LookWall"), "empty CMS stages catalogue photography, not a chocolate void");
  assert(hero.includes("min-h-0 flex-1"), "hero media sits in the space below the nav");
  assert(hero.includes("featuredItems"), "CMS image or video stitches into the tall centre cell");
  assert(hero.includes("sideLooks"), "right-column tiles take CMS looks");
  assert(!hero.includes("!hasCampaign && looks"), "campaign media does not replace the look wall");
  assert(hero.includes("preload=\"metadata\""), "RTW hero video is poster-first, not preload auto");
  assert(hero.includes("autoPlay"), "iPhone muted autoplay is an attribute, not a scripted play()");
  assert(hero.includes("isIosDevice"), "RTW hero does not script play() on iPhone");
  assert(hero.includes("IntersectionObserver"), "hero video pauses when the centre cell leaves the viewport");
  assert(hero.includes("visibilitychange"), "hero video pauses when the tab is hidden");
  assert(hero.includes(`#${RTW_GRID_ID}`) || hero.includes("RTW_GRID_ID"), "CTA scrolls to the grid");
  assert(hero.includes("shouldPrefetchReelVideo"), "portrait video follows AE prefetch");
  assert(src("src/lib/media/stream.ts").includes("ensureMp4FromWebm"), "local WebM is transcoded to MP4 when iPhone asks for the sibling");
  assert(src("src/components/admin/AdminVideoUrlField.tsx").includes("compressHeroVideo"), "CMS hero uploads are compressed to H.264");
  assert(client.includes("heroSideLooks"), "look wall sides come from the page");
  assert(!client.includes("rtwHeroLooks"), "client does not pick catalogue looks itself");
  assert(!hero.includes("unsplash"), "RTW hero does not fall back to Unsplash");

  assert(client.includes('label: "Dresses"'), "chips are sentence case");
  assert(client.includes("glass-1 glass-pill"), "chips are glass-1 pills");
  assert(client.includes("ProductCardGrid"), "gallery grid is unchanged");
  assert(client.includes('variant="teaser"'), "RTW tiles stay teasers");
  assert(!client.includes("CollectionGalleryGrid"), "reels stay collection-only for now");
  assert(client.includes("promiseBand"), "promise band renders on the landing page");

  assert(rtwPage.includes("rtwHeroCopy"), "page uses the copy helper so Ready-to-Wear cannot leak");
  assert(rtwPage.includes("rtwHeroSideLooks"), "page builds side looks from CMS");
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
  runLooks();
  runPlaybackUrl();
  runHeroVideoLimits();
  runCarouselParse();
  runSource();
  console.log("slice-ah: all checks passed");
}

run();
