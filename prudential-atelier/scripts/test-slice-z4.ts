/**
 * Slice Z4: one ready-to-wear aisle. /shop listing is not a second catalogue.
 *
 *   pnpm test:slice-z4
 */
import {
  groupSearchResults,
  normalizeStorefrontListingHref,
  productAisle,
  shopListingRedirectPath,
} from "../src/lib/rtw-aisle";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

function main() {
  assert(shopListingRedirectPath(new URLSearchParams()) === "/rtw", "bare /shop goes to the RTW aisle");
  assert(
    shopListingRedirectPath(new URLSearchParams("sort=newest")) === "/rtw?sort=newest",
    "listing filters follow her to /rtw",
  );
  assert(shopListingRedirectPath(new URLSearchParams("category=BRIDAL")) === "/bridal", "bridal keeps its own door");
  assert(shopListingRedirectPath(new URLSearchParams("category=KIDDIES")) === "/kids", "kids keeps its own door");
  assert(shopListingRedirectPath(new URLSearchParams("type=BESPOKE")) === "/atelier", "atelier keeps its own door");
  assert(
    shopListingRedirectPath(new URLSearchParams("category=FORMAL")) === "/rtw?category=FORMAL",
    "a dress category stays on the RTW aisle",
  );

  assert(normalizeStorefrontListingHref("/shop") === "/rtw", "CMS /shop listing is rewritten");
  assert(normalizeStorefrontListingHref("/shop?sale=true") === "/rtw?sale=true", "sale CTA follows");
  assert(normalizeStorefrontListingHref("/shop/avril-gown") === "/shop/avril-gown", "product URLs stay put");
  assert(normalizeStorefrontListingHref("/atelier") === "/atelier", "other doors are untouched");

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
