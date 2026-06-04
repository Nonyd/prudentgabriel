import { getSetting } from "@/lib/settings";
import type { PaymentCurrency, PaymentGatewayType } from "@/lib/payments/index";

const WEBHOOK_BASE = "https://prudentgabriel.vercel.app/api/webhooks";

function envOrNull(key: string): string | null {
  const v = process.env[key];
  return v?.trim() ? v.trim() : null;
}

async function settingOrEnv(settingKey: string, envKey: string): Promise<string | null> {
  const fromDb = await getSetting(settingKey);
  if (fromDb?.trim()) return fromDb.trim();
  return envOrNull(envKey);
}

async function isEnabled(settingKey: string, fallback = true): Promise<boolean> {
  const v = await getSetting(settingKey);
  if (v === "false") return false;
  if (v === "true") return true;
  return fallback;
}

export function getWebhookUrl(gateway: "paystack" | "flutterwave" | "stripe" | "monnify"): string {
  return `${WEBHOOK_BASE}/${gateway}`;
}

export async function getPaystackSecret(): Promise<string | null> {
  return settingOrEnv("paystack_secret_key", "PAYSTACK_SECRET_KEY");
}

export async function getPaystackPublicKey(): Promise<string | null> {
  return settingOrEnv("paystack_public_key", "NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY");
}

export async function getFlutterwaveSecret(): Promise<string | null> {
  return settingOrEnv("flutterwave_secret_key", "FLUTTERWAVE_SECRET_KEY");
}

export async function getFlutterwavePublicKey(): Promise<string | null> {
  return settingOrEnv("flutterwave_public_key", "NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY");
}

export async function getStripeSecret(): Promise<string | null> {
  return settingOrEnv("stripe_secret_key", "STRIPE_SECRET_KEY");
}

export async function getStripePublicKey(): Promise<string | null> {
  return settingOrEnv(
    "stripe_public_key",
    "NEXT_PUBLIC_STRIPE_PUBLIC_KEY",
  ) ?? envOrNull("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
}

export async function getStripeWebhookSecret(): Promise<string | null> {
  return settingOrEnv("stripe_webhook_secret", "STRIPE_WEBHOOK_SECRET");
}

export async function getMonnifyApiKey(): Promise<string | null> {
  return settingOrEnv("monnify_api_key", "MONNIFY_API_KEY");
}

export async function getMonnifySecret(): Promise<string | null> {
  return settingOrEnv("monnify_secret_key", "MONNIFY_SECRET_KEY");
}

export async function getMonnifyContractCode(): Promise<string | null> {
  return settingOrEnv("monnify_contract_code", "MONNIFY_CONTRACT_CODE");
}

export async function getMonnifyBaseUrl(): Promise<string> {
  const env = envOrNull("MONNIFY_BASE_URL");
  return (env ?? "https://api.monnify.com").replace(/\/$/, "");
}

export async function getBankTransferDetails(): Promise<{
  bankName: string;
  accountNumber: string;
  accountName: string;
}> {
  const bankName = (await getSetting("bank_name"))?.trim() || envOrNull("BANK_NAME");
  const accountNumber =
    (await getSetting("bank_account_number"))?.trim() || envOrNull("BANK_ACCOUNT_NUMBER");
  const accountName =
    (await getSetting("bank_account_name"))?.trim() || envOrNull("BANK_ACCOUNT_NAME");

  return {
    bankName: bankName ?? "Guaranty Trust Bank",
    accountNumber: accountNumber ?? "0123456789",
    accountName: accountName ?? "Prudential Atelier Limited",
  };
}

export async function getSupportedGateways(currency: PaymentCurrency): Promise<PaymentGatewayType[]> {
  const [paystack, flutterwave, stripe, monnify] = await Promise.all([
    isEnabled("paystack_enabled"),
    isEnabled("flutterwave_enabled"),
    isEnabled("stripe_enabled"),
    isEnabled("monnify_enabled"),
  ]);

  const out: PaymentGatewayType[] = [];
  if (currency === "NGN") {
    if (paystack) out.push("PAYSTACK");
    if (flutterwave) out.push("FLUTTERWAVE");
    if (monnify) out.push("MONNIFY");
    out.push("BANK_TRANSFER");
  } else if (currency === "USD") {
    if (flutterwave) out.push("FLUTTERWAVE");
    if (stripe) out.push("STRIPE");
  } else if (currency === "GBP") {
    if (flutterwave) out.push("FLUTTERWAVE");
    if (stripe) out.push("STRIPE");
  }
  return out;
}

export async function getPublicPaymentConfig(): Promise<{
  bank: { bankName: string; accountNumber: string; accountName: string };
  gateways: Record<PaymentCurrency, PaymentGatewayType[]>;
  publicKeys: {
    paystack: string;
    flutterwave: string;
    stripe: string;
  };
}> {
  const [bank, ngn, usd, gbp, paystackPk, flutterwavePk, stripePk] = await Promise.all([
    getBankTransferDetails(),
    getSupportedGateways("NGN"),
    getSupportedGateways("USD"),
    getSupportedGateways("GBP"),
    getPaystackPublicKey(),
    getFlutterwavePublicKey(),
    getStripePublicKey(),
  ]);

  return {
    bank,
    gateways: { NGN: ngn, USD: usd, GBP: gbp },
    publicKeys: {
      paystack: paystackPk ?? "",
      flutterwave: flutterwavePk ?? "",
      stripe: stripePk ?? "",
    },
  };
}
