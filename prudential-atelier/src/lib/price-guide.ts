/**
 * Slice BA4 — a price guide on atelier photographs. Display only.
 *
 * Atelier pieces are negotiated: a gown first quoted at ₦10M may settle at ₦3M
 * or ₦8M, and the site cannot compute a custom price. So the photograph carries
 * a reference, never an offer. A floor ("begin around") is the recommended
 * form — a range reads as uncertainty and invites negotiation — but a ceiling
 * is supported if the house wants both ends.
 *
 * Nothing chargeable reads this: the values live on GalleryImage, which no
 * cart, order, invoice or quotation path touches. Ready-to-wear pricing
 * (src/lib/pricing.ts, Slice L) is separate and unchanged.
 */

export type PriceGuide = { priceFloorNGN: number | null; priceCeilingNGN: number | null };

export const PRICE_GUIDE_NOTE = "A guide, not a price. Every commission is quoted after the consultation.";

function naira(n: number): string {
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}

/** Null when there is no floor: no guide is better than a half one. */
export function priceGuideText(guide: PriceGuide): string | null {
  const floor = guide.priceFloorNGN;
  if (!floor || floor <= 0) return null;
  const ceiling = guide.priceCeilingNGN;
  if (ceiling && ceiling > floor) {
    return `Pieces like this range from about ${naira(floor)} to ${naira(ceiling)}.`;
  }
  return `Pieces like this begin around ${naira(floor)}.`;
}

/**
 * BB2: the same guide in the few words a gallery card has room for, beside
 * PRICE_GUIDE_SHORT_NOTE. Null when there is no floor.
 */
export function priceGuideShort(guide: PriceGuide): string | null {
  const floor = guide.priceFloorNGN;
  if (!floor || floor <= 0) return null;
  const ceiling = guide.priceCeilingNGN;
  if (ceiling && ceiling > floor) return `About ${naira(floor)} – ${naira(ceiling)}`;
  return `Begins around ${naira(floor)}`;
}

export const PRICE_GUIDE_SHORT_NOTE = "A guide, not a price";

/** Admin validation: a ceiling needs a floor and must not be below it. */
export function priceGuideError(guide: PriceGuide): string | null {
  const { priceFloorNGN: floor, priceCeilingNGN: ceiling } = guide;
  if (ceiling != null && floor == null) return "Set a floor before a ceiling.";
  if (floor != null && ceiling != null && ceiling < floor) return "The ceiling cannot be below the floor.";
  return null;
}
