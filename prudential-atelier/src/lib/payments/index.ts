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

/** @deprecated Use getSupportedGateways from `@/lib/payments/config` (async, reads SiteSetting). */
export function getSupportedGateways(currency: PaymentCurrency): PaymentGatewayType[] {
  if (currency === "NGN") return ["PAYSTACK", "FLUTTERWAVE", "MONNIFY", "BANK_TRANSFER"];
  if (currency === "USD") return ["FLUTTERWAVE", "STRIPE"];
  if (currency === "GBP") return ["FLUTTERWAVE", "STRIPE"];
  return [];
}

/** @deprecated Use getBankTransferDetails from `@/lib/payments/config` (async, reads SiteSetting). */
export function getBankTransferDetails(): {
  bankName: string;
  accountNumber: string;
  accountName: string;
} {
  return {
    bankName: process.env.BANK_NAME ?? "Guaranty Trust Bank",
    accountNumber: process.env.BANK_ACCOUNT_NUMBER ?? "0123456789",
    accountName: process.env.BANK_ACCOUNT_NAME ?? "Prudential Atelier Limited",
  };
}

export {
  getSupportedGateways as getSupportedGatewaysFromSettings,
  getBankTransferDetails as getBankTransferDetailsFromSettings,
  getPublicPaymentConfig,
  getWebhookUrl,
} from "@/lib/payments/config";
