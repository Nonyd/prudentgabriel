export const RTW_AISLE = "/rtw";
export const SHOP_LISTING = "/shop";

export const SHOP_HERO_EYEBROW = "THE HOUSE";
export const SHOP_HERO_TITLE = "Shop";
export const SHOP_HERO_SUBTITLE =
  "Everything the house sells — ready-to-wear, bridal, and kids. Tap a category to find a dress.";

const PREVIOUS_SHOP_HERO_EYEBROW = "THE COLLECTION";
const PREVIOUS_SHOP_HERO_TITLE = "Prudent Gabriel";
const PREVIOUS_SHOP_HERO_SUBTITLE = "Ready-to-wear, bridal, and atelier couture.";

/** Use new house copy unless CMS was deliberately rewritten. */
export function shopHeroCopy(stored: { eyebrow?: string; title?: string; subtitle?: string }) {
  const pick = (value: string | undefined, previous: string, next: string) => {
    const v = value?.trim();
    if (!v || v === previous) return next;
    return v;
  };
  return {
    eyebrow: pick(stored.eyebrow, PREVIOUS_SHOP_HERO_EYEBROW, SHOP_HERO_EYEBROW),
    title: pick(stored.title, PREVIOUS_SHOP_HERO_TITLE, SHOP_HERO_TITLE),
    subtitle: pick(stored.subtitle, PREVIOUS_SHOP_HERO_SUBTITLE, SHOP_HERO_SUBTITLE),
  };
}

function listingPathAndQuery(href: string): { path: string; query: string; hash: string } | null {
  if (!href || href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return null;
  }
  const hashIndex = href.indexOf("#");
  const withoutHash = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : "";
  const qIndex = withoutHash.indexOf("?");
  const path = (qIndex >= 0 ? withoutHash.slice(0, qIndex) : withoutHash).replace(/\/+$/, "") || "/";
  const query = qIndex >= 0 ? withoutHash.slice(qIndex + 1) : "";
  return { path, query, hash };
}

/** CMS leftover /shop on a ready-to-wear CTA should not dump her into the mixed catalogue. Product URLs stay. */
export function readyToWearCtaHref(href: string): string {
  const parts = listingPathAndQuery(href);
  if (!parts) return href || RTW_AISLE;
  if (parts.path === SHOP_LISTING) return RTW_AISLE;
  return href;
}

export function productAisle(product: { type: string; category: string }): { href: string; label: string } {
  if (product.category === "BRIDAL") return { href: "/bridal", label: "Bridal" };
  if (product.type === "BESPOKE") return { href: "/atelier", label: "Atelier" };
  if (product.category === "KIDDIES") return { href: "/kids", label: "Kids" };
  return { href: RTW_AISLE, label: "Ready to Wear" };
}

export type SearchAisle = "rtw" | "bridal" | "atelier";

export const SEARCH_AISLE_LABEL: Record<SearchAisle, string> = {
  rtw: "Ready to Wear",
  bridal: "Bridal",
  atelier: "Atelier",
};

export function searchAisleOf(product: { type: string; category: string }): SearchAisle {
  if (product.category === "BRIDAL") return "bridal";
  if (product.type === "BESPOKE") return "atelier";
  return "rtw";
}

export function groupSearchResults<T extends { type: string; category: string }>(
  items: T[],
): { aisle: SearchAisle; items: T[] }[] {
  const buckets: Record<SearchAisle, T[]> = { rtw: [], bridal: [], atelier: [] };
  for (const item of items) {
    buckets[searchAisleOf(item)].push(item);
  }
  return (["rtw", "bridal", "atelier"] as const)
    .filter((aisle) => buckets[aisle].length > 0)
    .map((aisle) => ({ aisle, items: buckets[aisle] }));
}
