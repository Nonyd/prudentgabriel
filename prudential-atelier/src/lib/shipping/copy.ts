export const DEFAULT_UNAVAILABLE_QUOTE_CONSENT =
  "We'll confirm your shipping personally. Rates to your destination aren't available automatically right now — a representative will contact you within one business day to confirm the cost and method before we dispatch.";

/** Slice K alias — LIVE-mode fallback copy. */
export const DEFAULT_QUOTE_CONSENT = DEFAULT_UNAVAILABLE_QUOTE_CONSENT;

export const DEFAULT_MANUAL_QUOTE_CONSENT =
  "We arrange delivery personally. Once your piece is ready, a member of the house will contact you to confirm the courier and cost before it ships.";

export const DEFAULT_DDU_DISCLOSURE =
  "International orders may attract import duties and taxes on arrival, payable by the recipient. These are set by your country's customs authority and are not included in the price.";

/** LIVE mode, API unavailable — apologetic and temporary. */
export const SHIPPING_QUOTE_CONSENT_KEY = "shipping_quote_pending_consent";
/** MANUAL mode — confident and permanent. */
export const SHIPPING_QUOTE_MANUAL_CONSENT_KEY = "shipping_quote_manual_consent";
export const SHIPPING_DDU_KEY = "shipping_ddu_disclosure";
export const SHIPPING_UNCOLLECTED_DAYS_KEY = "shipping_uncollected_days";

export const SHIPPING_MODE_NIGERIA_KEY = "shipping_mode_nigeria";
export const SHIPPING_MODE_INTERNATIONAL_KEY = "shipping_mode_international";

export type QuoteConsentReason = "manual" | "unavailable";

export async function getShippingCopy(): Promise<{
  quoteConsent: string;
  manualConsent: string;
  unavailableConsent: string;
  dduDisclosure: string;
  uncollectedDays: number;
}> {
  const { getSetting } = await import("@/lib/settings");
  const [consent, manual, ddu, daysRaw] = await Promise.all([
    getSetting(SHIPPING_QUOTE_CONSENT_KEY),
    getSetting(SHIPPING_QUOTE_MANUAL_CONSENT_KEY),
    getSetting(SHIPPING_DDU_KEY),
    getSetting(SHIPPING_UNCOLLECTED_DAYS_KEY),
  ]);
  const days = daysRaw ? Number.parseInt(daysRaw, 10) : 7;
  const unavailableConsent = consent?.trim() || DEFAULT_UNAVAILABLE_QUOTE_CONSENT;
  const manualConsent = manual?.trim() || DEFAULT_MANUAL_QUOTE_CONSENT;
  return {
    quoteConsent: unavailableConsent,
    manualConsent,
    unavailableConsent,
    dduDisclosure: ddu?.trim() || DEFAULT_DDU_DISCLOSURE,
    uncollectedDays: Number.isFinite(days) && days > 0 ? days : 7,
  };
}

export function consentForQuote(
  reason: QuoteConsentReason,
  copy: { manualConsent: string; unavailableConsent: string },
): string {
  return reason === "manual" ? copy.manualConsent : copy.unavailableConsent;
}
