export const EUR_QUOTE_UNSUPPORTED =
  "Euro quotations aren't supported yet; use GBP, USD or naira.";

/**
 * Slice L has no EUR rate. Sending a euro quote would show euros and book
 * naira-equivalent — the same lie AI1 fixed for USD/GBP.
 */
export function quotationCurrencySendable(
  currency: string | null | undefined,
): { ok: true } | { ok: false; error: string } {
  const cur = (currency || "NGN").toUpperCase();
  if (cur === "EUR") {
    return { ok: false, error: EUR_QUOTE_UNSUPPORTED };
  }
  return { ok: true };
}
