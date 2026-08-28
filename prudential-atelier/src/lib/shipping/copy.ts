export const DEFAULT_QUOTE_CONSENT =
  "We'll confirm your shipping personally. Rates to your destination aren't available automatically right now — a representative will contact you within one business day to confirm the cost and method before we dispatch.";

export const DEFAULT_DDU_DISCLOSURE =
  "International orders may attract import duties and taxes on arrival, payable by the recipient. These are set by your country's customs authority and are not included in the price.";

export const SHIPPING_QUOTE_CONSENT_KEY = "shipping_quote_pending_consent";
export const SHIPPING_DDU_KEY = "shipping_ddu_disclosure";
export const SHIPPING_UNCOLLECTED_DAYS_KEY = "shipping_uncollected_days";

export async function getShippingCopy(): Promise<{
  quoteConsent: string;
  dduDisclosure: string;
  uncollectedDays: number;
}> {
  const { getSetting } = await import("@/lib/settings");
  const [consent, ddu, daysRaw] = await Promise.all([
    getSetting(SHIPPING_QUOTE_CONSENT_KEY),
    getSetting(SHIPPING_DDU_KEY),
    getSetting(SHIPPING_UNCOLLECTED_DAYS_KEY),
  ]);
  const days = daysRaw ? Number.parseInt(daysRaw, 10) : 7;
  return {
    quoteConsent: consent?.trim() || DEFAULT_QUOTE_CONSENT,
    dduDisclosure: ddu?.trim() || DEFAULT_DDU_DISCLOSURE,
    uncollectedDays: Number.isFinite(days) && days > 0 ? days : 7,
  };
}
