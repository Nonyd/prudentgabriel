/**
 * Slice Z4: ready-to-wear aisle plus the whole-store /shop listing.
 *
 *   pnpm test:slice-z4
 */
import {
  groupSearchResults,
  productAisle,
  readyToWearCtaHref,
  shopHeroCopy,
  SHOP_HERO_SUBTITLE,
  SHOP_LISTING,
  RTW_EXCLUDE_CATEGORY_QUERY,
} from "../src/lib/rtw-aisle";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

function main() {
  assert(SHOP_LISTING === "/shop", "the whole store lives at /shop");
  assert(RTW_EXCLUDE_CATEGORY_QUERY.includes("ACCESSORIES"), "RTW listing excludes accessories");
  assert(RTW_EXCLUDE_CATEGORY_QUERY.includes("KIDDIES"), "RTW listing excludes kids");
  assert(RTW_EXCLUDE_CATEGORY_QUERY.includes("BRIDAL"), "RTW listing excludes bridal");
  assert(
    SHOP_HERO_SUBTITLE.includes("Everything the house sells"),
    "shop hero says it is the whole house, not a second RTW aisle",
  );
  assert(SHOP_HERO_SUBTITLE.includes("accessories"), "shop copy names accessories with the rest of the house");
  assert(
    shopHeroCopy({ subtitle: "Ready-to-wear, bridal, and atelier couture." }).subtitle === SHOP_HERO_SUBTITLE,
    "the previous house-description subtitle is replaced",
  );
  assert(
    shopHeroCopy({
      subtitle: "Everything the house sells — ready-to-wear, bridal, and kids. Tap a category to find a dress.",
    }).subtitle === SHOP_HERO_SUBTITLE,
    "the previous kids-only subtitle is replaced",
  );
  assert(
    shopHeroCopy({ subtitle: "Custom line from CMS" }).subtitle === "Custom line from CMS",
    "a deliberate CMS rewrite is kept",
  );

  assert(readyToWearCtaHref("/shop") === "/rtw", "an RTW CTA leftover on /shop still goes to the RTW aisle");
  assert(readyToWearCtaHref("/shop?sort=newest") === "/rtw", "listing leftovers on RTW CTAs do not stay mixed");
  assert(readyToWearCtaHref("/shop/avril-gown") === "/shop/avril-gown", "product URLs stay put");
  assert(readyToWearCtaHref("/rtw") === "/rtw", "an RTW CTA already on /rtw is untouched");
  assert(readyToWearCtaHref("/atelier") === "/atelier", "other doors are untouched");

  assert(productAisle({ type: "RTW", category: "FORMAL" }).label === "Ready to Wear", "RTW breadcrumb");
  assert(productAisle({ type: "RTW", category: "FORMAL" }).href === "/rtw", "RTW breadcrumb href");
  assert(productAisle({ type: "RTW", category: "BRIDAL" }).href === "/bridal", "bridal breadcrumb");
  assert(productAisle({ type: "RTW", category: "ACCESSORIES" }).href === "/shop?category=ACCESSORIES", "accessories breadcrumb is shop");
  assert(productAisle({ type: "RTW", category: "ACCESSORIES" }).label === "Accessories", "accessories aisle label");

  const grouped = groupSearchResults([
    { type: "RTW", category: "FORMAL", name: "Dress" },
    { type: "BESPOKE", category: "FORMAL", name: "Commission" },
    { type: "RTW", category: "BRIDAL", name: "Gown" },
  ]);
  assert(grouped.length === 3, "mixed search is grouped, not a single unlabeled list");
  assert(grouped[0]?.aisle === "rtw" && grouped[0].items[0]?.name === "Dress", "RTW first");
  assert(grouped[1]?.aisle === "bridal", "bridal labeled");
  assert(grouped[2]?.aisle === "atelier", "atelier labeled");

  const withBag = groupSearchResults([
    { type: "RTW", category: "FORMAL", name: "Dress" },
    { type: "RTW", category: "ACCESSORIES", name: "Bag" },
  ]);
  assert(withBag.some((g) => g.aisle === "accessories"), "accessories are not grouped under ready-to-wear");
  assert(withBag.find((g) => g.aisle === "rtw")?.items.every((i) => i.name !== "Bag"), "bags stay out of the RTW search group");

  console.log("test-slice-z4: ok");
}

main();
