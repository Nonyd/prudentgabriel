/**
 * Paystack "Currency not supported" is a merchant-account refusal, not a
 * network failure. Returning HTTP 502 for it makes Cloudflare replace the
 * JSON with a blank 502 page, so checkout only shows "Request failed (502)".
 */
export function paystackPublicInitError(message: string, currency?: string): string {
  const m = message.toLowerCase();
  if (m.includes("currency not supported")) {
    if (currency === "USD") {
      return "Paystack cannot charge dollars on this account yet. Pay in naira with card, or transfer USD to the dollar account.";
    }
    if (currency === "GBP") {
      return "Paystack cannot charge pounds on this account yet. Pay in naira with card, or transfer pounds to the sterling account.";
    }
    return "Paystack cannot charge this currency on this account yet. Pay in naira with card, or use bank transfer.";
  }
  const trimmed = message.trim();
  return trimmed || "Payment could not be started";
}

export function paymentInitHttpStatus(message: string): number {
  const m = message.toLowerCase();
  if (
    m.includes("currency not supported") ||
    m.includes("cannot charge") ||
    m.includes("duplicate transaction") ||
    m.includes("not configured") ||
    m.includes("invalid key")
  ) {
    return 400;
  }
  return 500;
}
