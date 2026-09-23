import { PRICE_GUIDE_NOTE, priceGuideText, type PriceGuide } from "@/lib/price-guide";

/**
 * BA4: the price guide under an atelier photograph — a reference, never an
 * offer. Renders nothing when the house has not set a floor.
 */
export function PriceGuideLine({ guide, className }: { guide: PriceGuide; className?: string }) {
  const text = priceGuideText(guide);
  if (!text) return null;
  return (
    <p className={className} style={{ fontFamily: "var(--font-body)", fontSize: "12px", lineHeight: 1.5, color: "var(--text-mid)" }}>
      {text} <span style={{ color: "var(--text-light)" }}>{PRICE_GUIDE_NOTE}</span>
    </p>
  );
}
