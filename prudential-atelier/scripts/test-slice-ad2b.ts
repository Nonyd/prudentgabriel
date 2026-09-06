/**
 * Slice AD2b — product page: one reviews section, numeric sizes, empty reviews hidden.
 *
 *   pnpm test:slice-ad2b
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compareSizeLabels, sortBySize } from "../src/lib/sizing";
import { standardVariants } from "../src/lib/custom-size";
import { formatAlsoAmount } from "../src/lib/currency";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (rel: string) => readFileSync(join(root, rel), "utf8");

function run() {
  const shuffled = ["10", "12", "6", "8", "18", "20", "22", "14", "16"];
  assert(
    [...shuffled].sort(compareSizeLabels).join(" ") === "6 8 10 12 14 16 18 20 22",
    "sizes sort numerically, not as strings",
  );
  assert(
    standardVariants(shuffled.map((size) => ({ size })))
      .map((v) => v.size)
      .join(" ") === "6 8 10 12 14 16 18 20 22",
    "PDP and bag chips go through standardVariants",
  );
  assert(
    sortBySize(
      [
        { size: "12", id: "a" },
        { size: "6", id: "b" },
        { size: "10", id: "c" },
      ],
      (v) => v.size,
    )
      .map((v) => v.size)
      .join(" ") === "6 10 12",
    "sortBySize is the shared helper",
  );

  const custom = src("src/lib/custom-size.ts");
  assert(custom.includes("sortBySize"), "standardVariants sorts in the shared helper");

  const bagApi = src("src/app/api/shop/sizes/route.ts");
  assert(bagApi.includes("standardVariants"), "bag size select uses the same sorted list");

  const admin = src("src/components/admin/VariantManager.tsx");
  assert(admin.includes("compareSizeLabels"), "admin size table uses the shared compare");

  const chart = src("src/lib/sizing.ts");
  assert(chart.includes("sortBySize"), "size chart modal rows go through the shared sort");

  const page = src("src/app/(storefront)/shop/[slug]/page.tsx");
  assert(!page.includes("nextDynamic(() => import(\"@/components/product/ReviewsSection\")"), "reviews are not a dynamic island that remounts on body");
  assert((page.match(/<ReviewsSection/g) ?? []).length === 1, "the page mounts exactly one reviews section");
  assert(page.includes("excludeProductId={product.id}"), "recently viewed is told which piece she is on");
  assert(page.includes("canWriteReview"), "write-review is gated on a paid order");

  const reviews = src("src/components/product/ReviewsSection.tsx");
  assert(reviews.includes("if (reviews.length === 0 && !canWriteReview) return null"), "no reviews block when empty and she cannot write");
  assert(!reviews.includes("Be the first to review"), "empty-state prompt is gone");
  assert(!reviews.includes("Log in to write a review"), "anonymous visitors are not asked to log in to review");
  assert((reviews.match(/id="reviews"/g) ?? []).length === 1, "one reviews landmark");
  assert(reviews.trimStart().startsWith("\"use client\"") || reviews.includes("<section id=\"reviews\""), "reviews section exists");
  const sectionAt = reviews.indexOf("<section id=\"reviews\"");
  const dialogAt = reviews.indexOf("<Dialog.Root");
  assert(sectionAt >= 0 && dialogAt > sectionAt, "Dialog.Portal is inside the section, not around it");
  assert(reviews.includes("glass-2"), "reviews sit on glass-2 when shown");

  const recent = src("src/components/common/RecentlyViewed.tsx");
  assert(recent.includes("excludeProductId"), "current piece can be excluded");
  assert(recent.includes("p.id !== excludeProductId"), "fetched rows drop the piece she is on");
  assert(recent.includes("Recently viewed"), "heading is Recently viewed");
  assert(!recent.includes("Picked Up Where You Left Off"), "old tense is gone");
  assert(recent.includes('variant="teaser"'), "recently viewed uses glass-2 teaser tiles");

  const look = src("src/components/product/CompleteTheLook.tsx");
  assert(look.includes('variant="teaser"'), "complete the look uses the same tiles");

  const pdp = src("src/components/product/ProductDetailClient.tsx");
  assert(pdp.includes("Choose your size"), "CTA is Choose your size");
  assert(!pdp.includes("Select Size ·"), "old tracked CTA is gone");
  assert(!pdp.includes("Secure checkout"), "tracked trust row is gone");
  assert(pdp.includes("glass-1 glass-pill"), "breadcrumb is a glass-1 pill");
  assert(pdp.includes("reviewCount > 0"), "stars hide when there are no reviews");
  assert(pdp.includes("border-charcoal/10"), "accordions use a hairline, not a border box");

  const gallery = src("src/components/product/ProductGallery.tsx");
  assert(gallery.includes("card-image-dot"), "mobile gallery is Slice S dots");
  assert(gallery.includes("md:hidden"), "thumbnails are not the mobile pattern");
  assert(gallery.includes("glass-1"), "desktop thumbs sit in a glass-1 strip");
  assert(gallery.includes("border-2 border-choc"), "active thumb has a solid edge");

  const price = src("src/components/product/PriceDisplay.tsx");
  assert(price.includes("formatAlsoAmount"), "also-price uses the round-figure helper");
  assert(price.includes(" or "), "also-price is 'or', not a middle dot");
  assert(formatAlsoAmount(130, "USD") === "$130", "round dollars drop cents");
  assert(formatAlsoAmount(104, "GBP") === "£104", "round pounds drop cents");

  const announce = src("src/components/layout/AnnouncementBar.tsx");
  assert(announce.includes("text-charcoal"), "announcement is readable on the field");
  assert(!announce.includes("--ivory-deep"), "faint ivory-on-field announcement is gone");

  const pkg = src("package.json");
  assert(pkg.includes("test:slice-ad2b"), "package.json exposes the slice AD2b script");

  console.log("slice-ad2b: all checks passed");
}

run();
