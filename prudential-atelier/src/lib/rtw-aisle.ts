export const RTW_AISLE = "/rtw";

const RTW_QUERY_KEYS = [
  "sort",
  "tags",
  "tag",
  "page",
  "search",
  "newArrival",
  "isNewArrival",
  "featured",
  "sale",
  "sizes",
  "category",
  "type",
] as const;

/** Where the old mixed /shop listing should send her. Product pages stay /shop/[slug]. */
export function shopListingRedirectPath(searchParams: URLSearchParams): string {
  const category = searchParams.get("category")?.toUpperCase() ?? "";
  const type = searchParams.get("type")?.toUpperCase() ?? "";
  if (category === "BRIDAL") return "/bridal";
  if (category === "KIDDIES") return "/kids";
  if (type === "BESPOKE") return "/atelier";

  const keep = new URLSearchParams();
  for (const key of RTW_QUERY_KEYS) {
    const v = searchParams.get(key);
    if (!v) continue;
    if (key === "category" && (v.toUpperCase() === "BRIDAL" || v.toUpperCase() === "KIDDIES")) continue;
    if (key === "type" && v.toUpperCase() === "BESPOKE") continue;
    if (key === "tag") keep.set("tags", v);
    else keep.set(key, v);
  }
  const q = keep.toString();
  return q ? `${RTW_AISLE}?${q}` : RTW_AISLE;
}

/** CMS and leftover CTAs that still say /shop (the listing), not /shop/slug. */
export function normalizeStorefrontListingHref(href: string): string {
  if (!href || href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return href;
  }
  const hashIndex = href.indexOf("#");
  const withoutHash = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : "";
  const qIndex = withoutHash.indexOf("?");
  const path = (qIndex >= 0 ? withoutHash.slice(0, qIndex) : withoutHash).replace(/\/+$/, "") || "/";
  const query = qIndex >= 0 ? withoutHash.slice(qIndex + 1) : "";
  if (path !== "/shop") return href;
  return shopListingRedirectPath(new URLSearchParams(query)) + hash;
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
