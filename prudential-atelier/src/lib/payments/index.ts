export type PaymentGatewayType =
  | "PAYSTACK"
  | "FLUTTERWAVE"
  | "STRIPE"
  | "MONNIFY"
  | "BANK_TRANSFER";

export type PaymentCurrency = "NGN" | "USD" | "GBP";

export function generatePaymentReference(prefix: string): string {
  return `PA-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export function toKobo(ngn: number): number {
  return Math.round(ngn * 100);
}

export function fromKobo(kobo: number): number {
  return kobo / 100;
}

/**
 * @deprecated Use getSupportedGateways from `@/lib/payments/config` (async, BankAccount resolver).
 * BANK_TRANSFER is omitted here on purpose — offering it without an active BankAccount
 * row is the Slice D / Slice P defect.
 */
export function getSupportedGateways(currency: PaymentCurrency): PaymentGatewayType[] {
  if (currency === "NGN") return ["PAYSTACK", "FLUTTERWAVE", "MONNIFY"];
  if (currency === "USD") return ["FLUTTERWAVE", "STRIPE"];
  if (currency === "GBP") return ["FLUTTERWAVE", "STRIPE"];
  return [];
}

/**
 * @deprecated Use getBankTransferDetails from `@/lib/payments/config`.
 * Never returns dummy account numbers; leftover callers get blanks.
 */
export function getBankTransferDetails(): {
  bankName: string;
  accountNumber: string;
  accountName: string;
} {
  return { bankName: "", accountNumber: "", accountName: "" };
}

export {
  getSupportedGateways as getSupportedGatewaysFromSettings,
  getBankTransferDetails as getBankTransferDetailsFromSettings,
  getPublicPaymentConfig,
  getWebhookUrl,
} from "@/lib/payments/config";

