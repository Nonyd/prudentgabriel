/**
 * When can a piece be ordered? One definition, used by the product JSON-LD,
 * the cart and checkout.
 *
 * Stock is not tracked (every piece is made after the order), so a piece is
 * orderable when it is published and has something to order: a standard-size
 * variant, or made-to-measure offered. Everything else is OutOfStock to Google
 * and refused by the cart and checkout.
 */

export type OrderabilityInput = {
  isPublished: boolean;
  customOffered: boolean;
  variants: { size: string }[];
};

export type Unorderable = "UNPUBLISHED" | "NO_SIZE";

function isCustomVariant(size: string): boolean {
  return size.trim().toLowerCase() === "custom";
}

export function whyUnorderable(p: OrderabilityInput): Unorderable | null {
  if (!p.isPublished) return "UNPUBLISHED";
  const hasStandardSize = p.variants.some((v) => !isCustomVariant(v.size));
  if (!hasStandardSize && !p.customOffered) return "NO_SIZE";
  return null;
}

export function isProductOrderable(p: OrderabilityInput): boolean {
  return whyUnorderable(p) === null;
}

/** schema.org ItemAvailability. Google supports InStock/OutOfStock (not MadeToOrder). */
export function schemaAvailability(p: OrderabilityInput): string {
  return isProductOrderable(p) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";
}

/** Customer-facing refusal for the cart / checkout. */
export function unorderableMessage(name: string, reason: Unorderable): string {
  return reason === "UNPUBLISHED"
    ? `${name} is no longer available. Please remove it from your bag.`
    : `${name} cannot be ordered in any size right now. Please remove it from your bag.`;
}
