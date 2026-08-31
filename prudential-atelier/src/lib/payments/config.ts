import { getSetting } from "@/lib/settings";
import type { PaymentCurrency, PaymentGatewayType } from "@/lib/payments/index";
import {
  bankTransferAvailable,
  resolvePublicBankAccount,
  type BusinessLineCode,
  type PublicBankAccount,
} from "@/lib/payments/bank-account";

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
  const app =
    (process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
  const base = app || "https://prudentgabriel.com";
  return `${base}/api/payment/${gateway}/webhook`;
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

/** Dashboard `verif-hash` secret. Falls back to the API secret if no dedicated hash is set. */
export async function getFlutterwaveWebhookHash(): Promise<string | null> {
  return (
    (await settingOrEnv("flutterwave_secret_hash", "FLUTTERWAVE_SECRET_HASH")) ??
    (await getFlutterwaveSecret())
  );
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

export type BankAccountDetails = PublicBankAccount;

export async function getBankTransferDetails(
  currency: string,
  businessLine: BusinessLineCode = "RTW",
): Promise<PublicBankAccount | null> {
  return resolvePublicBankAccount(currency, businessLine);
}

function isUsableCredential(value: string | null | undefined): boolean {
  const v = value?.trim() ?? "";
  if (!v) return false;
  const lower = v.toLowerCase();
  if (lower.includes("your_key") || lower.includes("changeme") || lower.includes("placeholder")) return false;
  if (lower.endsWith("_here") || lower === "test") return false;
  return true;
}

export async function getSupportedGateways(
  currency: PaymentCurrency,
  businessLine: BusinessLineCode = "RTW",
): Promise<PaymentGatewayType[]> {
  const [
    paystackOn,
    flutterwaveOn,
    stripeOn,
    monnifyOn,
    paystackSecret,
    paystackPk,
    flutterwaveSecret,
    flutterwavePk,
    stripeSecret,
    stripePk,
    monnifyKey,
    monnifySecret,
    monnifyContract,
    bankReady,
  ] = await Promise.all([
    isEnabled("paystack_enabled"),
    isEnabled("flutterwave_enabled"),
    isEnabled("stripe_enabled"),
    isEnabled("monnify_enabled"),
    getPaystackSecret(),
    getPaystackPublicKey(),
    getFlutterwaveSecret(),
    getFlutterwavePublicKey(),
    getStripeSecret(),
    getStripePublicKey(),
    getMonnifyApiKey(),
    getMonnifySecret(),
    getMonnifyContractCode(),
    bankTransferAvailable(currency, businessLine),
  ]);

  const paystackReady = paystackOn && isUsableCredential(paystackSecret) && isUsableCredential(paystackPk);
  const flutterwaveReady =
    flutterwaveOn && isUsableCredential(flutterwaveSecret) && isUsableCredential(flutterwavePk);
  const stripeReady = stripeOn && isUsableCredential(stripeSecret) && isUsableCredential(stripePk);
  const monnifyReady =
    monnifyOn &&
    isUsableCredential(monnifyKey) &&
    isUsableCredential(monnifySecret) &&
    isUsableCredential(monnifyContract);

  const out: PaymentGatewayType[] = [];
  if (currency === "NGN") {
    if (paystackReady) out.push("PAYSTACK");
    if (flutterwaveReady) out.push("FLUTTERWAVE");
    if (monnifyReady) out.push("MONNIFY");
    if (bankReady) out.push("BANK_TRANSFER");
  } else if (currency === "USD") {
    if (flutterwaveReady) out.push("FLUTTERWAVE");
    if (stripeReady) out.push("STRIPE");
    if (bankReady) out.push("BANK_TRANSFER");
  } else if (currency === "GBP") {
    if (flutterwaveReady) out.push("FLUTTERWAVE");
    if (stripeReady) out.push("STRIPE");
    if (bankReady) out.push("BANK_TRANSFER");
  }
  return out;
}

export async function getPublicPaymentConfig(businessLine: BusinessLineCode = "RTW"): Promise<{
  line: BusinessLineCode;
  bank: PublicBankAccount | null;
  accounts: Partial<Record<PaymentCurrency, PublicBankAccount>>;
  gateways: Record<PaymentCurrency, PaymentGatewayType[]>;
  publicKeys: {
    paystack: string;
    flutterwave: string;
    stripe: string;
  };
}> {
  const [bankNgn, bankUsd, bankGbp, ngn, usd, gbp, paystackPk, flutterwavePk, stripePk] = await Promise.all([
    resolvePublicBankAccount("NGN", businessLine),
    resolvePublicBankAccount("USD", businessLine),
    resolvePublicBankAccount("GBP", businessLine),
    getSupportedGateways("NGN", businessLine),
    getSupportedGateways("USD", businessLine),
    getSupportedGateways("GBP", businessLine),
    getPaystackPublicKey(),
    getFlutterwavePublicKey(),
    getStripePublicKey(),
  ]);

  const accounts: Partial<Record<PaymentCurrency, PublicBankAccount>> = {};
  if (bankNgn) accounts.NGN = bankNgn;
  if (bankUsd) accounts.USD = bankUsd;
  if (bankGbp) accounts.GBP = bankGbp;

  return {
    line: businessLine,
    bank: bankNgn,
    accounts,
    gateways: { NGN: ngn, USD: usd, GBP: gbp },
    publicKeys: {
      paystack: isUsableCredential(paystackPk) ? paystackPk! : "",
      flutterwave: isUsableCredential(flutterwavePk) ? flutterwavePk! : "",
      stripe: isUsableCredential(stripePk) ? stripePk! : "",
    },
  };
}
