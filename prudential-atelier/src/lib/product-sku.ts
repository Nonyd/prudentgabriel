/** Default SKU pattern: PA-[SLUG6]-[SIZE] (alphanumeric only, uppercased). */
export function buildDefaultProductSku(slug: string, sizeLabel: string): string {
  const slugPart = slug
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 6)
    .toUpperCase() || "ITEM";
  const sizePart = sizeLabel
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 8)
    .toUpperCase() || "SIZE";
  return `PA-${slugPart}-${sizePart}`;
}
