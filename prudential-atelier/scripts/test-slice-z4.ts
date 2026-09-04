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
} from "../src/lib/rtw-aisle";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

function main() {
  assert(SHOP_LISTING === "/shop", "the whole store lives at /shop");
  assert(
    SHOP_HERO_SUBTITLE.includes("Everything the house sells"),
    "shop hero says it is the whole house, not a second RTW aisle",
  );
  assert(
    shopHeroCopy({ subtitle: "Ready-to-wear, bridal, and atelier couture." }).subtitle === SHOP_HERO_SUBTITLE,
    "the previous house-description subtitle is replaced",
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
  assert(productAisle({ type: "BESPOKE", category: "FORMAL" }).href === "/atelier", "atelier breadcrumb");

  const grouped = groupSearchResults([
    { type: "RTW", category: "FORMAL", name: "Dress" },
    { type: "BESPOKE", category: "FORMAL", name: "Commission" },
    { type: "RTW", category: "BRIDAL", name: "Gown" },
  ]);
  assert(grouped.length === 3, "mixed search is grouped, not a single unlabeled list");
  assert(grouped[0]?.aisle === "rtw" && grouped[0].items[0]?.name === "Dress", "RTW first");
  assert(grouped[1]?.aisle === "bridal", "bridal labeled");
  assert(grouped[2]?.aisle === "atelier", "atelier labeled");

  const rtwOnly = groupSearchResults([{ type: "RTW", category: "CASUAL", name: "Set" }]);
  assert(rtwOnly.length === 1 && rtwOnly[0]?.aisle === "rtw", "a dress-only search needs no extra aisle labels");

  console.log("test-slice-z4: ok");
}

main();
