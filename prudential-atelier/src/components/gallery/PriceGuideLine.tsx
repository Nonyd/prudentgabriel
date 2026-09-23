import { PRICE_GUIDE_NOTE, priceGuideText, type PriceGuide } from "@/lib/price-guide";

/**
 * BA4: the price guide under an atelier photograph — a reference, never an
 * offer. Renders nothing when the house has not set a floor. `emphasis` is the
 * /atelier piece entry (BB3), where the guide sits beside the description.
 */
export function PriceGuideLine({
  guide,
  className,
  emphasis = false,
}: {
  guide: PriceGuide;
  className?: string;
  emphasis?: boolean;
}) {
  const text = priceGuideText(guide);
  if (!text) return null;
  if (emphasis) {
    return (
      <p className={className} style={{ fontFamily: "var(--font-body)", lineHeight: 1.5 }}>
        <span style={{ display: "block", fontSize: "15px", color: "var(--choc)" }}>{text}</span>
        <span style={{ display: "block", marginTop: "4px", fontSize: "12px", color: "var(--text-light)" }}>
          {PRICE_GUIDE_NOTE}
        </span>
      </p>
    );
  }
  return (
    <p className={className} style={{ fontFamily: "var(--font-body)", fontSize: "12px", lineHeight: 1.5, color: "var(--text-mid)" }}>
      {text} <span style={{ color: "var(--text-light)" }}>{PRICE_GUIDE_NOTE}</span>
    </p>
  );
}
