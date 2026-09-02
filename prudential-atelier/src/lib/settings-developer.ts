import { hasPermission } from "@/lib/roles";
import { EMAIL_TEMPLATE_FIELD_SUFFIXES } from "@/lib/admin-email-catalog";

/**
 * Secrets and technical credentials. Writable only with `settings.developer`.
 * Commercial flags (`*_enabled`, deposit %, currencies) are not in this set.
 */
export const DEVELOPER_SETTING_KEYS = new Set<string>([
  "paystack_public_key",
  "paystack_secret_key",
  "flutterwave_public_key",
  "flutterwave_secret_key",
  "flutterwave_secret_hash",
  "stripe_public_key",
  "stripe_secret_key",
  "stripe_webhook_secret",
  "monnify_api_key",
  "monnify_secret_key",
  "monnify_contract_code",
  "monnify_environment",
  "resend_api_key",
  "brevo_api_key",
  "smtp_password",
  "smtp_host",
  "smtp_port",
  "smtp_username",
  "smtp_use_ssl",
  "email_provider",
  "email_provider_order",
  "sms_api_key",
  "slack_webhook_url",
  "gig_api_key",
  "gig_wallet_id",
  "dhl_site_id",
  "dhl_password",
  "dhl_account_number",
]);

export const COMMERCIAL_PAYMENTS_KEYS = new Set<string>([
  "paystack_enabled",
  "flutterwave_enabled",
  "stripe_enabled",
  "monnify_enabled",
  "bespoke_deposit_percent",
  "alteration_warranty_days",
  "exchange_rate_usd",
  "exchange_rate_gbp",
]);

export function isDeveloperSettingKey(key: string): boolean {
  return DEVELOPER_SETTING_KEYS.has(key);
}

/** Copy owned by Content → Email templates, not Settings → Email. */
export function isEmailTemplateSettingKey(key: string): boolean {
  if (key.startsWith("email_tpl_")) return true;
  if (!key.startsWith("email_")) return false;
  for (const suffix of EMAIL_TEMPLATE_FIELD_SUFFIXES) {
    if (key.endsWith(`_${suffix}`)) return true;
  }
  return false;
}

export function canWriteSettingKey(role: string | undefined | null, key: string): boolean {
  if (isEmailTemplateSettingKey(key)) return false;
  if (isDeveloperSettingKey(key)) return hasPermission(role, "settings.developer");
  return hasPermission(role, "settings") || hasPermission(role, "content") || hasPermission(role, "content.pages");
}

/** First key that this role must not write, if any. */
export function deniedDeveloperWriteKey(
  role: string | undefined | null,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    if (isEmailTemplateSettingKey(key)) return key;
    if (isDeveloperSettingKey(key) && !hasPermission(role, "settings.developer")) return key;
  }
  return null;
}

export function redactSettingsForRole<T extends { key: string }>(
  role: string | undefined | null,
  rows: T[],
): T[] {
  const seeSecrets = hasPermission(role, "settings.developer");
  return rows.filter((r) => {
    if (isEmailTemplateSettingKey(r.key)) return false;
    if (isDeveloperSettingKey(r.key) && !seeSecrets) return false;
    return true;
  });
}

export type GatewayAdminStatus = {
  id: "paystack" | "flutterwave" | "stripe" | "monnify";
  label: string;
  enabled: boolean;
  configured: boolean;
  missing: string[];
};

export async function getGatewayAdminStatus(): Promise<GatewayAdminStatus[]> {
  const {
    isUsableCredential,
    getPaystackSecret,
    getPaystackPublicKey,
    getFlutterwaveSecret,
    getFlutterwavePublicKey,
    getStripeSecret,
    getStripePublicKey,
    getStripeWebhookSecret,
    getMonnifyApiKey,
    getMonnifySecret,
    getMonnifyContractCode,
  } = await import("@/lib/payments/config");
  const { getSetting } = await import("@/lib/settings");

  const enabled = async (key: string) => {
    const v = await getSetting(key);
    if (v === "false") return false;
    return true;
  };

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
    stripeWh,
    monnifyKey,
    monnifySecret,
    monnifyContract,
  ] = await Promise.all([
    enabled("paystack_enabled"),
    enabled("flutterwave_enabled"),
    enabled("stripe_enabled"),
    enabled("monnify_enabled"),
    getPaystackSecret(),
    getPaystackPublicKey(),
    getFlutterwaveSecret(),
    getFlutterwavePublicKey(),
    getStripeSecret(),
    getStripePublicKey(),
    getStripeWebhookSecret(),
    getMonnifyApiKey(),
    getMonnifySecret(),
    getMonnifyContractCode(),
  ]);

  const row = (
    id: GatewayAdminStatus["id"],
    label: string,
    on: boolean,
    parts: { label: string; ok: boolean }[],
  ): GatewayAdminStatus => {
    const missing = parts.filter((p) => !p.ok).map((p) => p.label);
    return { id, label, enabled: on, configured: missing.length === 0, missing };
  };

  return [
    row("paystack", "Paystack", paystackOn, [
      { label: "public key", ok: isUsableCredential(paystackPk) },
      { label: "secret key", ok: isUsableCredential(paystackSecret) },
    ]),
    row("flutterwave", "Flutterwave", flutterwaveOn, [
      { label: "public key", ok: isUsableCredential(flutterwavePk) },
      { label: "secret key", ok: isUsableCredential(flutterwaveSecret) },
    ]),
    row("stripe", "Stripe", stripeOn, [
      { label: "publishable key", ok: isUsableCredential(stripePk) },
      { label: "secret key", ok: isUsableCredential(stripeSecret) },
      { label: "webhook secret", ok: isUsableCredential(stripeWh) },
    ]),
    row("monnify", "Monnify", monnifyOn, [
      { label: "API key", ok: isUsableCredential(monnifyKey) },
      { label: "secret key", ok: isUsableCredential(monnifySecret) },
      { label: "contract code", ok: isUsableCredential(monnifyContract) },
    ]),
  ];
}

export function developerEnvStatus(): {
  openExchangeRates: boolean;
  cloudinary: boolean;
  cronSecret: boolean;
  settingsEncryption: boolean;
} {
  return {
    openExchangeRates: Boolean(process.env.OPEN_EXCHANGE_RATES_APP_ID?.trim()),
    cloudinary: Boolean(
      process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
        process.env.CLOUDINARY_API_KEY?.trim() &&
        process.env.CLOUDINARY_API_SECRET?.trim(),
    ),
    cronSecret: Boolean(process.env.CRON_SECRET?.trim()),
    settingsEncryption: Boolean(process.env.SETTINGS_ENCRYPTION_KEY?.trim()),
  };
}
