import { SettingGroup, SettingType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const PAYMENT_SETTING_DEFS: {
  key: string;
  value: string;
  label: string;
  type: SettingType;
  isPublic: boolean;
  sortOrder: number;
}[] = [
  { key: "paystack_enabled", value: "true", label: "Paystack Enabled", type: SettingType.BOOLEAN, isPublic: false, sortOrder: 0 },
  { key: "paystack_public_key", value: "", label: "Paystack Public Key", type: SettingType.TEXT, isPublic: true, sortOrder: 1 },
  { key: "paystack_secret_key", value: "", label: "Paystack Secret Key", type: SettingType.PASSWORD, isPublic: false, sortOrder: 2 },
  { key: "flutterwave_enabled", value: "true", label: "Flutterwave Enabled", type: SettingType.BOOLEAN, isPublic: false, sortOrder: 3 },
  { key: "flutterwave_public_key", value: "", label: "Flutterwave Public Key", type: SettingType.TEXT, isPublic: true, sortOrder: 4 },
  { key: "flutterwave_secret_key", value: "", label: "Flutterwave Secret Key", type: SettingType.PASSWORD, isPublic: false, sortOrder: 5 },
  { key: "stripe_enabled", value: "true", label: "Stripe Enabled", type: SettingType.BOOLEAN, isPublic: false, sortOrder: 6 },
  { key: "stripe_public_key", value: "", label: "Stripe Public Key", type: SettingType.TEXT, isPublic: true, sortOrder: 7 },
  { key: "stripe_secret_key", value: "", label: "Stripe Secret Key", type: SettingType.PASSWORD, isPublic: false, sortOrder: 8 },
  { key: "stripe_webhook_secret", value: "", label: "Stripe Webhook Secret", type: SettingType.PASSWORD, isPublic: false, sortOrder: 9 },
  { key: "monnify_enabled", value: "true", label: "Monnify Enabled", type: SettingType.BOOLEAN, isPublic: false, sortOrder: 10 },
  { key: "monnify_api_key", value: "", label: "Monnify API Key", type: SettingType.PASSWORD, isPublic: false, sortOrder: 11 },
  { key: "monnify_secret_key", value: "", label: "Monnify Secret Key", type: SettingType.PASSWORD, isPublic: false, sortOrder: 12 },
  { key: "monnify_contract_code", value: "", label: "Monnify Contract Code", type: SettingType.TEXT, isPublic: false, sortOrder: 13 },
  { key: "monnify_environment", value: "sandbox", label: "Monnify Environment", type: SettingType.SELECT, isPublic: false, sortOrder: 14 },
  { key: "bank_name", value: "", label: "Bank Transfer — Bank Name", type: SettingType.TEXT, isPublic: true, sortOrder: 20 },
  { key: "bank_account_number", value: "", label: "Bank Transfer — Account Number", type: SettingType.TEXT, isPublic: true, sortOrder: 21 },
  { key: "bank_account_name", value: "", label: "Bank Transfer — Account Name", type: SettingType.TEXT, isPublic: true, sortOrder: 22 },
  { key: "bespoke_deposit_percent", value: "70", label: "Bespoke Deposit %", type: SettingType.NUMBER, isPublic: false, sortOrder: 25 },
  { key: "exchange_rate_usd", value: "0.00065", label: "USD Rate (per ₦1)", type: SettingType.NUMBER, isPublic: false, sortOrder: 30 },
  { key: "exchange_rate_gbp", value: "0.00052", label: "GBP Rate (per ₦1)", type: SettingType.NUMBER, isPublic: false, sortOrder: 31 },
];

/** Idempotent — creates missing PAYMENTS SiteSetting rows (safe on every admin load). */
export async function ensurePaymentSettingKeys(): Promise<void> {
  for (const def of PAYMENT_SETTING_DEFS) {
    await prisma.siteSetting.upsert({
      where: { key: def.key },
      create: {
        key: def.key,
        value: def.value,
        group: SettingGroup.PAYMENTS,
        label: def.label,
        type: def.type,
        isPublic: def.isPublic,
        sortOrder: def.sortOrder,
      },
      update: {},
    });
  }
}
