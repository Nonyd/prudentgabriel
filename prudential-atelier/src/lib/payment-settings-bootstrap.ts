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
  // Off until Paystack enables that currency on the live account; otherwise every charge fails "Currency not supported".
  { key: "paystack_usd_enabled", value: "false", label: "Paystack can charge US dollars (only once Paystack has enabled USD on the account)", type: SettingType.BOOLEAN, isPublic: false, sortOrder: 15 },
  { key: "paystack_gbp_enabled", value: "false", label: "Paystack can charge pounds (only once Paystack has enabled GBP on the account)", type: SettingType.BOOLEAN, isPublic: false, sortOrder: 16 },
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
  { key: "bespoke_deposit_percent", value: "70", label: "Default bespoke deposit %", type: SettingType.NUMBER, isPublic: false, sortOrder: 25 },
  { key: "alteration_warranty_days", value: "30", label: "Alteration warranty (days)", type: SettingType.NUMBER, isPublic: false, sortOrder: 26 },
  { key: "fabric_promise_hours", value: "48", label: "Fabric unavailable: offer alternative or refund within (hours)", type: SettingType.NUMBER, isPublic: false, sortOrder: 27 },
  { key: "post_delivery_fault_hours", value: "48", label: "Faulty or damaged piece: report within (hours of delivery)", type: SettingType.NUMBER, isPublic: false, sortOrder: 28 },
  // ND1: printed in the legal pages. The RC number shows only once entered.
  { key: "return_window_days", value: "7", label: "Standard-size returns: window (days from delivery)", type: SettingType.NUMBER, isPublic: false, sortOrder: 33 },
  { key: "legal_company_name", value: "Prudential Atelier Limited", label: "Registered company name (legal pages)", type: SettingType.TEXT, isPublic: false, sortOrder: 34 },
  { key: "legal_company_rc", value: "", label: "CAC RC number (legal pages; blank hides it)", type: SettingType.TEXT, isPublic: false, sortOrder: 35 },
  { key: "privacy_contact_email", value: "", label: "Data protection contact email (blank uses the invoice email)", type: SettingType.TEXT, isPublic: false, sortOrder: 36 },
  // BA3: consultation fees (₦), one per type. A booking freezes its fee; changing these never alters one made.
  { key: "consultation_fee_physical_prudent", value: "250000", label: "Consultation fee (₦): physical, with Mrs. Prudent", type: SettingType.NUMBER, isPublic: false, sortOrder: 20 },
  { key: "consultation_fee_physical_team", value: "200000", label: "Consultation fee (₦): physical, with the creative team", type: SettingType.NUMBER, isPublic: false, sortOrder: 21 },
  { key: "consultation_fee_virtual_prudent", value: "200000", label: "Consultation fee (₦): virtual, with Mrs. Prudent", type: SettingType.NUMBER, isPublic: false, sortOrder: 22 },
  { key: "consultation_fee_virtual_team", value: "180000", label: "Consultation fee (₦): virtual, with the creative team", type: SettingType.NUMBER, isPublic: false, sortOrder: 23 },
  { key: "consultation_short_notice_days", value: "30", label: "Consultation enquiry: flag for a call when the event is within (days)", type: SettingType.NUMBER, isPublic: false, sortOrder: 29 },
  // Off by default: the manual rates below stay in charge until the house switches to live.
  { key: "fx_use_live_rates", value: "false", label: "Use live exchange rates (Open Exchange Rates)", type: SettingType.BOOLEAN, isPublic: false, sortOrder: 37 },
  { key: "exchange_rate_usd", value: "0.00065", label: "USD Rate (per ₦1)", type: SettingType.NUMBER, isPublic: false, sortOrder: 30 },
  { key: "exchange_rate_gbp", value: "0.00052", label: "GBP Rate (per ₦1)", type: SettingType.NUMBER, isPublic: false, sortOrder: 31 },
  {
    key: "open_exchange_rates_app_id",
    value: "",
    label: "Open Exchange Rates app ID",
    type: SettingType.PASSWORD,
    isPublic: false,
    sortOrder: 32,
  },
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
