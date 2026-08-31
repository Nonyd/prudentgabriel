/**
 * Production-safe bootstrap seed.
 *
 * Upserts operational config only: SiteSettings, invoice/payment defaults,
 * email template keys, consultants, shipping zones, default collections,
 * Unsplash gallery placeholders, and the admin account.
 *
 * Never creates clients, orders, invoices, consultations, reviews, or
 * testimonials. Never deletes catalogue rows.
 *
 * Demo / fixture data lives in prisma/seed-fixtures.ts and scripts/seed-demo.ts
 * (both require ALLOW_FIXTURES=true and refuse staging/production hosts).
 */
import {
  PrismaClient,
  ConsultationSessionType,
  ConsultationDeliveryMode,
  SettingGroup,
  SettingType,
  GalleryCategory,
  ShippingMethodKind,
  ShippingMarkupKind,
} from "@prisma/client";
import { seedBootstrapAdmin } from "./bootstrap-admin";

const prisma = new PrismaClient();

async function upsertShippingZones() {
  const zones = [
    {
      name: "Lagos — Express",
      countries: ["NG"],
      states: ["Lagos"],
      flatRateNGN: 3500,
      perKgNGN: 400,
      freeAboveNGN: 250_000,
      estimatedDays: "2–4 business days",
      sortOrder: 0,
    },
    {
      name: "Nigeria — Standard",
      countries: ["NG"],
      states: [] as string[],
      flatRateNGN: 5500,
      perKgNGN: 600,
      freeAboveNGN: 400_000,
      estimatedDays: "4–7 business days",
      sortOrder: 1,
    },
    {
      name: "International",
      countries: ["*"],
      states: [] as string[],
      flatRateNGN: 45_000,
      perKgNGN: 2500,
      freeAboveNGN: null as number | null,
      estimatedDays: "10–14 business days",
      sortOrder: 2,
    },
  ];

  for (const z of zones) {
    const existing = await prisma.shippingZone.findFirst({ where: { name: z.name } });
    if (existing) {
      await prisma.shippingZone.update({
        where: { id: existing.id },
        data: {
          countries: z.countries,
          states: z.states,
          flatRateNGN: z.flatRateNGN,
          perKgNGN: z.perKgNGN,
          freeAboveNGN: z.freeAboveNGN,
          estimatedDays: z.estimatedDays,
          sortOrder: z.sortOrder,
        },
      });
    } else {
      await prisma.shippingZone.create({ data: z });
    }
  }
}

async function upsertShippingMethods() {
  const garmentBox = {
    name: "Garment box",
    weightKg: 0.8,
    lengthCm: 60,
    widthCm: 40,
    heightCm: 20,
    isDefault: true,
  };
  await prisma.packagingProfile.upsert({
    where: { id: "pkg-garment-box" },
    update: garmentBox,
    create: {
      id: "pkg-garment-box",
      ...garmentBox,
    },
  });

  await prisma.shippingMethod.upsert({
    where: { id: "ship-pickup" },
    update: {},
    create: {
      id: "ship-pickup",
      kind: ShippingMethodKind.PICKUP,
      name: "Collect from the atelier",
      description: "Collect in person. We will email you a collection code when the piece is ready.",
      isActive: true,
      sortOrder: 0,
    },
  });
  await prisma.shippingMethod.upsert({
    where: { id: "ship-lagos" },
    update: {},
    create: {
      id: "ship-lagos",
      kind: ShippingMethodKind.LOCAL_FLAT,
      name: "Lagos delivery",
      description: "Flat-rate delivery within Lagos. Add or edit locations under Shipping — no deploy needed.",
      isActive: true,
      sortOrder: 1,
    },
  });
  await prisma.shippingMethod.upsert({
    where: { id: "ship-gig" },
    update: {},
    create: {
      id: "ship-gig",
      kind: ShippingMethodKind.CARRIER_GIG,
      name: "GIG Logistics",
      description:
        "Nigeria outside Lagos. Live-rated when the corporate wallet is configured; otherwise we quote personally.",
      isActive: true,
      sortOrder: 2,
      markupKind: ShippingMarkupKind.PERCENT,
      markupValue: 10,
      defaultService: "standard",
    },
  });
  await prisma.shippingMethod.upsert({
    where: { id: "ship-dhl" },
    update: {},
    create: {
      id: "ship-dhl",
      kind: ShippingMethodKind.CARRIER_DHL,
      name: "DHL Express",
      description:
        "International. Live-rated when the DHL account is configured; otherwise we quote personally. DDU — duties are the recipient's.",
      isActive: true,
      sortOrder: 3,
      markupKind: ShippingMarkupKind.PERCENT,
      markupValue: 15,
      defaultService: "EXPRESS WORLDWIDE",
    },
  });

  await prisma.pickupLocation.upsert({
    where: { id: "pickup-surulere" },
    update: {},
    create: {
      id: "pickup-surulere",
      shippingMethodId: "ship-pickup",
      name: "Surulere atelier",
      address: "14 Bode Thomas Street, Surulere, Lagos, Nigeria",
      hours: "Monday–Friday 9:00–18:00, Saturday 10:00–16:00",
      instructions: "Bring your collection code and a matching ID. We hold pieces for 14 days.",
      isActive: true,
      sortOrder: 0,
    },
  });

  const lagosExpress = await prisma.shippingZone.findFirst({ where: { name: "Lagos — Express" } });
  await prisma.lagosLocation.upsert({
    where: { id: "lagos-from-express" },
    update: {},
    create: {
      id: "lagos-from-express",
      shippingMethodId: "ship-lagos",
      name: "Lagos — Express",
      price: lagosExpress?.flatRateNGN ?? 3500,
      freeAboveNGN: lagosExpress?.freeAboveNGN ?? 250_000,
      etaText: lagosExpress?.estimatedDays ?? "2–4 business days",
      isActive: true,
      sortOrder: 0,
    },
  });
}

async function upsertConsultants() {
  await prisma.consultant.upsert({
    where: { id: "consultant-prudent" },
    update: {},
    create: {
      id: "consultant-prudent",
      name: "Mrs. Prudent Gabriel-Okopi",
      title: "Founder & Creative Director",
      bio: "The visionary behind Prudential Atelier. Her consultations are rare, intimate, and transformative.",
      image: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400",
      isActive: true,
      isFlagship: true,
      displayOrder: 0,
      offerings: {
        create: [
          {
            sessionType: ConsultationSessionType.BESPOKE_DESIGN,
            deliveryMode: ConsultationDeliveryMode.VIRTUAL_WITH_PRUDENT,
            durationMinutes: 60,
            feeNGN: 50000,
            feeUSD: 33,
            feeGBP: 26,
            description: "Private virtual design session with Mrs. Gabriel-Okopi.",
            isActive: true,
          },
          {
            sessionType: ConsultationSessionType.BRIDAL_CONSULTATION,
            deliveryMode: ConsultationDeliveryMode.INPERSON_ATELIER_PRUDENT,
            durationMinutes: 120,
            feeNGN: 100000,
            feeUSD: 65,
            feeGBP: 51,
            description: "Full bridal experience at our Lagos atelier.",
            isActive: true,
          },
        ],
      },
    },
  });

  await prisma.consultant.upsert({
    where: { id: "consultant-senior" },
    update: {},
    create: {
      id: "consultant-senior",
      name: "Senior Design Team",
      title: "Senior Designer · Prudential Atelier",
      bio: "Expert guidance for bespoke pieces and corporate wardrobes.",
      image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400",
      isActive: true,
      isFlagship: false,
      displayOrder: 1,
      offerings: {
        create: [
          {
            sessionType: ConsultationSessionType.BESPOKE_DESIGN,
            deliveryMode: ConsultationDeliveryMode.VIRTUAL_STANDARD,
            durationMinutes: 60,
            feeNGN: 20000,
            feeUSD: 13,
            feeGBP: 10,
            isActive: true,
          },
          {
            sessionType: ConsultationSessionType.BRIDAL_CONSULTATION,
            deliveryMode: ConsultationDeliveryMode.INPERSON_ATELIER,
            durationMinutes: 90,
            feeNGN: 35000,
            feeUSD: 23,
            feeGBP: 18,
            isActive: true,
          },
        ],
      },
      availability: {
        create: [
          { dayOfWeek: 1, startTime: "09:00", endTime: "17:00", isActive: true },
          { dayOfWeek: 2, startTime: "09:00", endTime: "17:00", isActive: true },
          { dayOfWeek: 3, startTime: "09:00", endTime: "17:00", isActive: true },
          { dayOfWeek: 4, startTime: "09:00", endTime: "17:00", isActive: true },
          { dayOfWeek: 5, startTime: "09:00", endTime: "14:00", isActive: true },
        ],
      },
    },
  });

  await prisma.consultant.upsert({
    where: { id: "consultant-team" },
    update: {},
    create: {
      id: "consultant-team",
      name: "Design Team",
      title: "Collective Session · Prudential Atelier",
      bio: "Collaborative group sessions for bridal parties and teams.",
      image: "https://images.unsplash.com/photo-1556761175-b413da4baf72?w=400",
      isActive: true,
      isFlagship: false,
      displayOrder: 2,
      offerings: {
        create: [
          {
            sessionType: ConsultationSessionType.GROUP_SESSION,
            deliveryMode: ConsultationDeliveryMode.VIRTUAL_WITH_TEAM,
            durationMinutes: 90,
            feeNGN: 35000,
            feeUSD: 23,
            feeGBP: 18,
            isActive: true,
          },
        ],
      },
      availability: {
        create: [
          { dayOfWeek: 2, startTime: "10:00", endTime: "16:00", isActive: true },
          { dayOfWeek: 4, startTime: "10:00", endTime: "16:00", isActive: true },
        ],
      },
    },
  });

  await prisma.consultant.upsert({
    where: { id: "consultant-style" },
    update: {},
    create: {
      id: "consultant-style",
      name: "Style Consultant",
      title: "Fabric & Style Advisor",
      bio: "Fabric selection, colour theory, and personal style direction.",
      image: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400",
      isActive: true,
      isFlagship: false,
      displayOrder: 3,
      offerings: {
        create: [
          {
            sessionType: ConsultationSessionType.STYLING_SESSION,
            deliveryMode: ConsultationDeliveryMode.VIRTUAL_STANDARD,
            durationMinutes: 30,
            feeNGN: 10000,
            feeUSD: 7,
            feeGBP: 5,
            isActive: true,
          },
          {
            sessionType: ConsultationSessionType.DISCOVERY_CALL,
            deliveryMode: ConsultationDeliveryMode.PHONE_CALL,
            durationMinutes: 20,
            feeNGN: 5000,
            feeUSD: 4,
            feeGBP: 3,
            isActive: true,
          },
        ],
      },
      availability: {
        create: [
          { dayOfWeek: 1, startTime: "09:00", endTime: "18:00", isActive: true },
          { dayOfWeek: 2, startTime: "09:00", endTime: "18:00", isActive: true },
          { dayOfWeek: 3, startTime: "09:00", endTime: "18:00", isActive: true },
        ],
      },
    },
  });
}

async function upsertSiteSettings() {
  const defaultSettings: {
    key: string;
    value: string;
    group: SettingGroup;
    label: string;
    type: SettingType;
    isPublic: boolean;
    sortOrder: number;
  }[] = [
    { key: "store_name", value: "Prudent Gabriel", group: SettingGroup.STORE, label: "Store Name", type: SettingType.TEXT, isPublic: true, sortOrder: 1 },
    { key: "store_tagline", value: "Luxury Nigerian Fashion", group: SettingGroup.STORE, label: "Tagline", type: SettingType.TEXT, isPublic: true, sortOrder: 2 },
    { key: "store_email", value: "hello@prudentgabriel.com", group: SettingGroup.STORE, label: "Contact Email", type: SettingType.TEXT, isPublic: true, sortOrder: 3 },
    { key: "store_phone", value: "+234 000 000 0000", group: SettingGroup.STORE, label: "Phone Number", type: SettingType.TEXT, isPublic: true, sortOrder: 4 },
    { key: "store_address", value: "Lagos, Nigeria", group: SettingGroup.STORE, label: "Address", type: SettingType.TEXTAREA, isPublic: true, sortOrder: 5 },
    { key: "store_currency_default", value: "NGN", group: SettingGroup.STORE, label: "Default Currency", type: SettingType.SELECT, isPublic: true, sortOrder: 6 },
    { key: "free_shipping_lagos", value: "150000", group: SettingGroup.STORE, label: "Free Shipping Threshold — Lagos (₦)", type: SettingType.NUMBER, isPublic: false, sortOrder: 7 },
    { key: "free_shipping_nigeria", value: "250000", group: SettingGroup.STORE, label: "Free Shipping Threshold — Nigeria (₦)", type: SettingType.NUMBER, isPublic: false, sortOrder: 8 },
    { key: "atelier_bookings_enabled", value: "false", group: SettingGroup.STORE, label: "Atelier bookings enabled", type: SettingType.BOOLEAN, isPublic: false, sortOrder: 9 },
    { key: "bespoke_from_markup", value: "1.3", group: SettingGroup.STORE, label: "Bespoke “from” markup (× cheapest RTW ₦)", type: SettingType.NUMBER, isPublic: false, sortOrder: 10 },
    { key: "paystack_enabled", value: "true", group: SettingGroup.PAYMENTS, label: "Paystack Enabled", type: SettingType.BOOLEAN, isPublic: false, sortOrder: 0 },
    { key: "paystack_public_key", value: "", group: SettingGroup.PAYMENTS, label: "Paystack Public Key", type: SettingType.TEXT, isPublic: true, sortOrder: 1 },
    { key: "paystack_secret_key", value: "", group: SettingGroup.PAYMENTS, label: "Paystack Secret Key", type: SettingType.PASSWORD, isPublic: false, sortOrder: 2 },
    { key: "flutterwave_enabled", value: "true", group: SettingGroup.PAYMENTS, label: "Flutterwave Enabled", type: SettingType.BOOLEAN, isPublic: false, sortOrder: 3 },
    { key: "flutterwave_public_key", value: "", group: SettingGroup.PAYMENTS, label: "Flutterwave Public Key", type: SettingType.TEXT, isPublic: true, sortOrder: 4 },
    { key: "flutterwave_secret_key", value: "", group: SettingGroup.PAYMENTS, label: "Flutterwave Secret Key", type: SettingType.PASSWORD, isPublic: false, sortOrder: 5 },
    { key: "stripe_enabled", value: "true", group: SettingGroup.PAYMENTS, label: "Stripe Enabled", type: SettingType.BOOLEAN, isPublic: false, sortOrder: 6 },
    { key: "stripe_public_key", value: "", group: SettingGroup.PAYMENTS, label: "Stripe Public Key", type: SettingType.TEXT, isPublic: true, sortOrder: 7 },
    { key: "stripe_secret_key", value: "", group: SettingGroup.PAYMENTS, label: "Stripe Secret Key", type: SettingType.PASSWORD, isPublic: false, sortOrder: 8 },
    { key: "stripe_webhook_secret", value: "", group: SettingGroup.PAYMENTS, label: "Stripe Webhook Secret", type: SettingType.PASSWORD, isPublic: false, sortOrder: 9 },
    { key: "monnify_enabled", value: "true", group: SettingGroup.PAYMENTS, label: "Monnify Enabled", type: SettingType.BOOLEAN, isPublic: false, sortOrder: 10 },
    { key: "monnify_api_key", value: "", group: SettingGroup.PAYMENTS, label: "Monnify API Key", type: SettingType.PASSWORD, isPublic: false, sortOrder: 11 },
    { key: "monnify_secret_key", value: "", group: SettingGroup.PAYMENTS, label: "Monnify Secret Key", type: SettingType.PASSWORD, isPublic: false, sortOrder: 12 },
    { key: "monnify_contract_code", value: "", group: SettingGroup.PAYMENTS, label: "Monnify Contract Code", type: SettingType.TEXT, isPublic: false, sortOrder: 13 },
    { key: "monnify_environment", value: "sandbox", group: SettingGroup.PAYMENTS, label: "Monnify Environment", type: SettingType.SELECT, isPublic: false, sortOrder: 14 },
    { key: "bespoke_deposit_percent", value: "70", group: SettingGroup.PAYMENTS, label: "Bespoke Deposit %", type: SettingType.NUMBER, isPublic: false, sortOrder: 25 },
    { key: "alteration_warranty_days", value: "30", group: SettingGroup.PAYMENTS, label: "Alteration warranty (days)", type: SettingType.NUMBER, isPublic: false, sortOrder: 26 },
    { key: "exchange_rate_usd", value: "0.00065", group: SettingGroup.PAYMENTS, label: "USD Rate (per ₦1)", type: SettingType.NUMBER, isPublic: false, sortOrder: 30 },
    { key: "exchange_rate_gbp", value: "0.00052", group: SettingGroup.PAYMENTS, label: "GBP Rate (per ₦1)", type: SettingType.NUMBER, isPublic: false, sortOrder: 31 },
    {
      key: "shipping_mode_nigeria",
      value: "MANUAL",
      group: SettingGroup.SHIPPING,
      label: "Nigeria (GIG) — MANUAL until the wallet exists, then LIVE",
      type: SettingType.SELECT,
      isPublic: false,
      sortOrder: 0,
    },
    {
      key: "shipping_mode_international",
      value: "MANUAL",
      group: SettingGroup.SHIPPING,
      label: "International (DHL) — MANUAL until the account exists, then LIVE",
      type: SettingType.SELECT,
      isPublic: false,
      sortOrder: 1,
    },
    {
      key: "shipping_quote_manual_consent",
      value:
        "We arrange delivery personally. Once your piece is ready, a member of the house will contact you to confirm the courier and cost before it ships.",
      group: SettingGroup.SHIPPING,
      label: "Manual mode — consent wording",
      type: SettingType.TEXTAREA,
      isPublic: true,
      sortOrder: 2,
    },
    {
      key: "shipping_quote_pending_consent",
      value:
        "We'll confirm your shipping personally. Rates to your destination aren't available automatically right now — a representative will contact you within one business day to confirm the cost and method before we dispatch.",
      group: SettingGroup.SHIPPING,
      label: "LIVE mode — when rates are unavailable",
      type: SettingType.TEXTAREA,
      isPublic: true,
      sortOrder: 3,
    },
    {
      key: "shipping_ddu_disclosure",
      value:
        "International orders may attract import duties and taxes on arrival, payable by the recipient. These are set by your country's customs authority and are not included in the price.",
      group: SettingGroup.SHIPPING,
      label: "International duties (DDU) disclosure",
      type: SettingType.TEXTAREA,
      isPublic: true,
      sortOrder: 4,
    },
    { key: "shipping_uncollected_days", value: "7", group: SettingGroup.SHIPPING, label: "Uncollected pickup reminder (days)", type: SettingType.NUMBER, isPublic: false, sortOrder: 5 },
    { key: "gig_api_key", value: "", group: SettingGroup.SHIPPING, label: "GIG API key", type: SettingType.PASSWORD, isPublic: false, sortOrder: 10 },
    { key: "gig_wallet_id", value: "", group: SettingGroup.SHIPPING, label: "GIG wallet ID", type: SettingType.TEXT, isPublic: false, sortOrder: 11 },
    { key: "dhl_site_id", value: "", group: SettingGroup.SHIPPING, label: "DHL site ID", type: SettingType.TEXT, isPublic: false, sortOrder: 20 },
    { key: "dhl_password", value: "", group: SettingGroup.SHIPPING, label: "DHL password", type: SettingType.PASSWORD, isPublic: false, sortOrder: 21 },
    { key: "dhl_account_number", value: "", group: SettingGroup.SHIPPING, label: "DHL account number", type: SettingType.TEXT, isPublic: false, sortOrder: 22 },
    { key: "email_from_name", value: "Prudential Atelier", group: SettingGroup.EMAIL, label: "From Name", type: SettingType.TEXT, isPublic: false, sortOrder: 1 },
    { key: "email_from_address", value: "noreply@prudentgabriel.com", group: SettingGroup.EMAIL, label: "From Email", type: SettingType.TEXT, isPublic: false, sortOrder: 2 },
    { key: "email_reply_to", value: "hello@prudentgabriel.com", group: SettingGroup.EMAIL, label: "Reply-To", type: SettingType.TEXT, isPublic: false, sortOrder: 3 },
    { key: "email_provider_order", value: "resend,brevo,smtp", group: SettingGroup.EMAIL, label: "Provider order", type: SettingType.TEXT, isPublic: false, sortOrder: 4 },
    { key: "email_provider", value: "resend", group: SettingGroup.EMAIL, label: "Email Provider", type: SettingType.SELECT, isPublic: false, sortOrder: 5 },
    { key: "brevo_api_key", value: "", group: SettingGroup.EMAIL, label: "Brevo API Key", type: SettingType.PASSWORD, isPublic: false, sortOrder: 6 },
    { key: "resend_api_key", value: "", group: SettingGroup.EMAIL, label: "Resend API Key", type: SettingType.PASSWORD, isPublic: false, sortOrder: 7 },
    { key: "smtp_host", value: "", group: SettingGroup.EMAIL, label: "SMTP Host", type: SettingType.TEXT, isPublic: false, sortOrder: 8 },
    { key: "smtp_port", value: "587", group: SettingGroup.EMAIL, label: "SMTP Port", type: SettingType.NUMBER, isPublic: false, sortOrder: 9 },
    { key: "smtp_username", value: "", group: SettingGroup.EMAIL, label: "SMTP Username", type: SettingType.TEXT, isPublic: false, sortOrder: 10 },
    { key: "smtp_password", value: "", group: SettingGroup.EMAIL, label: "SMTP Password", type: SettingType.PASSWORD, isPublic: false, sortOrder: 11 },
    { key: "smtp_use_ssl", value: "true", group: SettingGroup.EMAIL, label: "SMTP Use TLS/SSL", type: SettingType.BOOLEAN, isPublic: false, sortOrder: 12 },
    { key: "admin_notification_email", value: "hello@prudentgabriel.com", group: SettingGroup.EMAIL, label: "Admin Notification Email", type: SettingType.TEXT, isPublic: false, sortOrder: 13 },
    { key: "sms_provider", value: "termii", group: SettingGroup.SMS, label: "SMS Provider", type: SettingType.SELECT, isPublic: false, sortOrder: 1 },
    { key: "sms_api_key", value: "", group: SettingGroup.SMS, label: "SMS API Key", type: SettingType.PASSWORD, isPublic: false, sortOrder: 2 },
    { key: "sms_sender_id", value: "PrudentGab", group: SettingGroup.SMS, label: "SMS Sender ID", type: SettingType.TEXT, isPublic: false, sortOrder: 3 },
    { key: "sms_order_confirmed", value: "true", group: SettingGroup.SMS, label: "Send SMS on Order Confirmed", type: SettingType.BOOLEAN, isPublic: false, sortOrder: 4 },
    { key: "sms_order_shipped", value: "true", group: SettingGroup.SMS, label: "Send SMS on Order Shipped", type: SettingType.BOOLEAN, isPublic: false, sortOrder: 5 },
    { key: "sms_consultation_confirmed", value: "true", group: SettingGroup.SMS, label: "Send SMS on Consultation Confirmed", type: SettingType.BOOLEAN, isPublic: false, sortOrder: 6 },
    { key: "logo_dark", value: "", group: SettingGroup.APPEARANCE, label: "Main — Logo (Light theme)", type: SettingType.IMAGE, isPublic: true, sortOrder: 0 },
    { key: "logo_white", value: "", group: SettingGroup.APPEARANCE, label: "Main — Logo (Dark theme)", type: SettingType.IMAGE, isPublic: true, sortOrder: 1 },
    { key: "logo_atelier_dark", value: "", group: SettingGroup.APPEARANCE, label: "Atelier — Logo (Light theme)", type: SettingType.IMAGE, isPublic: true, sortOrder: 2 },
    { key: "logo_atelier_white", value: "", group: SettingGroup.APPEARANCE, label: "Atelier — Logo (Dark theme)", type: SettingType.IMAGE, isPublic: true, sortOrder: 3 },
    { key: "logo_bridal_dark", value: "", group: SettingGroup.APPEARANCE, label: "Bridal — Logo (Light theme)", type: SettingType.IMAGE, isPublic: true, sortOrder: 4 },
    { key: "logo_bridal_white", value: "", group: SettingGroup.APPEARANCE, label: "Bridal — Logo (Dark theme)", type: SettingType.IMAGE, isPublic: true, sortOrder: 5 },
    { key: "logo_kids_dark", value: "", group: SettingGroup.APPEARANCE, label: "Kids — Logo (Light theme)", type: SettingType.IMAGE, isPublic: true, sortOrder: 6 },
    { key: "logo_kids_white", value: "", group: SettingGroup.APPEARANCE, label: "Kids — Logo (Dark theme)", type: SettingType.IMAGE, isPublic: true, sortOrder: 7 },
    { key: "img_hero", value: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1600", group: SettingGroup.APPEARANCE, label: "Homepage Hero Image", type: SettingType.IMAGE, isPublic: true, sortOrder: 1 },
    { key: "img_bride_hero", value: "https://images.unsplash.com/photo-1594463750939-ebb28c3f7f75?w=1600", group: SettingGroup.APPEARANCE, label: "Prudential Bride Hero Image", type: SettingType.IMAGE, isPublic: true, sortOrder: 2 },
    { key: "img_bride_portrait", value: "https://images.unsplash.com/photo-1519741347686-c1e331ec5e96?w=800", group: SettingGroup.APPEARANCE, label: "Prudential Bride Portrait", type: SettingType.IMAGE, isPublic: true, sortOrder: 3 },
    { key: "img_bespoke", value: "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=800", group: SettingGroup.APPEARANCE, label: "Bespoke Section Image", type: SettingType.IMAGE, isPublic: true, sortOrder: 4 },
    { key: "img_atelier_wide", value: "https://images.unsplash.com/photo-1556761175-b413da4baf72?w=1200", group: SettingGroup.APPEARANCE, label: "Atelier Story Wide Image", type: SettingType.IMAGE, isPublic: true, sortOrder: 5 },
    { key: "img_atelier_portrait", value: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800", group: SettingGroup.APPEARANCE, label: "Atelier Story Portrait Image", type: SettingType.IMAGE, isPublic: true, sortOrder: 6 },
    { key: "img_consultation_hero", value: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1600", group: SettingGroup.APPEARANCE, label: "Consultation Page Hero", type: SettingType.IMAGE, isPublic: true, sortOrder: 7 },
    { key: "img_bespoke_hero", value: "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=1600", group: SettingGroup.APPEARANCE, label: "Bespoke Page Hero", type: SettingType.IMAGE, isPublic: true, sortOrder: 8 },
    { key: "img_collection_bridal", value: "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=800", group: SettingGroup.APPEARANCE, label: "Collections Grid — Bridal", type: SettingType.IMAGE, isPublic: true, sortOrder: 9 },
    { key: "img_collection_evening", value: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800", group: SettingGroup.APPEARANCE, label: "Collections Grid — Evening", type: SettingType.IMAGE, isPublic: true, sortOrder: 10 },
    { key: "img_collection_formal", value: "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=800", group: SettingGroup.APPEARANCE, label: "Collections Grid — Formal", type: SettingType.IMAGE, isPublic: true, sortOrder: 11 },
    { key: "img_collection_rtw", value: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800", group: SettingGroup.APPEARANCE, label: "Collections Grid — RTW", type: SettingType.IMAGE, isPublic: true, sortOrder: 12 },
    { key: "img_our_story_hero", value: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=1400", group: SettingGroup.APPEARANCE, label: "Our Story Hero", type: SettingType.IMAGE, isPublic: true, sortOrder: 13 },
    { key: "favicon_url", value: "/images/logo.svg", group: SettingGroup.APPEARANCE, label: "Favicon URL", type: SettingType.IMAGE, isPublic: true, sortOrder: 14 },
    { key: "img_logo_atelier", value: "", group: SettingGroup.APPEARANCE, label: "Atelier Page — Sub-brand Logo", type: SettingType.IMAGE, isPublic: true, sortOrder: 20 },
    { key: "img_logo_bridal", value: "", group: SettingGroup.APPEARANCE, label: "Bridal Page — Sub-brand Logo", type: SettingType.IMAGE, isPublic: true, sortOrder: 21 },
    { key: "img_logo_kids", value: "", group: SettingGroup.APPEARANCE, label: "Kids Page — Sub-brand Logo", type: SettingType.IMAGE, isPublic: true, sortOrder: 22 },
    { key: "social_instagram", value: "@the_prudentgabriel", group: SettingGroup.SOCIAL, label: "Instagram Handle", type: SettingType.TEXT, isPublic: true, sortOrder: 1 },
    { key: "social_tiktok", value: "@prudentgabriel", group: SettingGroup.SOCIAL, label: "TikTok Handle", type: SettingType.TEXT, isPublic: true, sortOrder: 2 },
    { key: "social_facebook", value: "prudentgabriel", group: SettingGroup.SOCIAL, label: "Facebook Page", type: SettingType.TEXT, isPublic: true, sortOrder: 3 },
    { key: "social_youtube", value: "", group: SettingGroup.SOCIAL, label: "YouTube Channel", type: SettingType.TEXT, isPublic: true, sortOrder: 4 },
    { key: "social_whatsapp", value: "", group: SettingGroup.SOCIAL, label: "WhatsApp Business Number", type: SettingType.TEXT, isPublic: true, sortOrder: 5 },
    { key: "points_per_100_naira", value: "1", group: SettingGroup.LOYALTY, label: "Points per ₦100 spent", type: SettingType.NUMBER, isPublic: false, sortOrder: 1 },
    { key: "points_referral_referrer", value: "250", group: SettingGroup.LOYALTY, label: "Points for referrer on signup", type: SettingType.NUMBER, isPublic: false, sortOrder: 2 },
    { key: "points_referral_new_user", value: "500", group: SettingGroup.LOYALTY, label: "Points for new referred user", type: SettingType.NUMBER, isPublic: false, sortOrder: 3 },
    { key: "points_review", value: "50", group: SettingGroup.LOYALTY, label: "Points for leaving a review", type: SettingType.NUMBER, isPublic: false, sortOrder: 4 },
    { key: "seo_title_template", value: "%s | Prudent Gabriel", group: SettingGroup.SEO, label: "Page Title Template (%s = page name)", type: SettingType.TEXT, isPublic: true, sortOrder: 1 },
    { key: "seo_default_description", value: "Luxury Nigerian fashion — bespoke couture and ready-to-wear by Mrs. Prudent Gabriel-Okopi. Ships worldwide.", group: SettingGroup.SEO, label: "Default Meta Description", type: SettingType.TEXTAREA, isPublic: true, sortOrder: 2 },
    { key: "seo_og_image", value: "", group: SettingGroup.SEO, label: "Default OG Share Image", type: SettingType.IMAGE, isPublic: true, sortOrder: 3 },
    { key: "notify_new_order", value: "true", group: SettingGroup.NOTIFICATIONS, label: "Email on new order", type: SettingType.BOOLEAN, isPublic: false, sortOrder: 1 },
    { key: "notify_new_bespoke", value: "true", group: SettingGroup.NOTIFICATIONS, label: "Email on new bespoke request", type: SettingType.BOOLEAN, isPublic: false, sortOrder: 2 },
    { key: "notify_new_consultation", value: "true", group: SettingGroup.NOTIFICATIONS, label: "Email on new consultation booking", type: SettingType.BOOLEAN, isPublic: false, sortOrder: 3 },
    { key: "notify_low_stock", value: "true", group: SettingGroup.NOTIFICATIONS, label: "Email when variant stock ≤ lowStockAt", type: SettingType.BOOLEAN, isPublic: false, sortOrder: 4 },
    { key: "slack_webhook_url", value: "", group: SettingGroup.NOTIFICATIONS, label: "Slack Webhook URL (for alerts)", type: SettingType.PASSWORD, isPublic: false, sortOrder: 5 },
  ];

  for (const setting of defaultSettings) {
    await prisma.siteSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }

  const invoiceSettings = [
    { key: "invoice_company_name", value: "Prudential Atelier", group: SettingGroup.INVOICE, label: "Company Name", type: SettingType.TEXT, isPublic: false, sortOrder: 1 },
    { key: "invoice_address", value: "Lagos, Nigeria", group: SettingGroup.INVOICE, label: "Studio Address", type: SettingType.TEXTAREA, isPublic: false, sortOrder: 2 },
    { key: "invoice_phone", value: "", group: SettingGroup.INVOICE, label: "Invoice Phone", type: SettingType.TEXT, isPublic: false, sortOrder: 3 },
    { key: "invoice_email", value: "hello@prudentgabriel.com", group: SettingGroup.INVOICE, label: "Invoice Email", type: SettingType.TEXT, isPublic: false, sortOrder: 4 },
    { key: "invoice_website", value: "https://prudentgabriel.com", group: SettingGroup.INVOICE, label: "Website", type: SettingType.TEXT, isPublic: false, sortOrder: 5 },
    { key: "invoice_default_vat", value: "0", group: SettingGroup.INVOICE, label: "Default VAT % (0 = no VAT)", type: SettingType.NUMBER, isPublic: false, sortOrder: 40 },
    { key: "invoice_default_due_days", value: "7", group: SettingGroup.INVOICE, label: "Default Payment Due (days)", type: SettingType.NUMBER, isPublic: false, sortOrder: 41 },
    { key: "invoice_default_currency", value: "NGN", group: SettingGroup.INVOICE, label: "Default Invoice Currency", type: SettingType.SELECT, isPublic: false, sortOrder: 42 },
    { key: "invoice_footer_note", value: "Thank you for choosing Prudential Atelier. We look forward to creating something extraordinary for you.", group: SettingGroup.INVOICE, label: "Invoice Footer Note", type: SettingType.TEXTAREA, isPublic: false, sortOrder: 43 },
    { key: "invoice_deposit_terms", value: "70% deposit required to commence. Balance due before delivery.", group: SettingGroup.INVOICE, label: "Default Payment Terms", type: SettingType.TEXTAREA, isPublic: false, sortOrder: 44 },
    { key: "bespoke_deposit_percent", value: "70", group: SettingGroup.PAYMENTS, label: "Bespoke Deposit %", type: SettingType.NUMBER, isPublic: false, sortOrder: 25 },
    { key: "alteration_warranty_days", value: "30", group: SettingGroup.PAYMENTS, label: "Alteration warranty (days)", type: SettingType.NUMBER, isPublic: false, sortOrder: 26 },
    { key: "invoice_logo_url", value: "/images/atelier-logo.png", group: SettingGroup.INVOICE, label: "Invoice Logo URL", type: SettingType.IMAGE, isPublic: false, sortOrder: 45 },
    { key: "invoice_prefix", value: "PA-INV", group: SettingGroup.INVOICE, label: "Invoice Number Prefix", type: SettingType.TEXT, isPublic: false, sortOrder: 46 },
  ];
  for (const s of invoiceSettings) {
    await prisma.siteSetting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }

  const extraSocial = [
    { key: "social_instagram_atelier", value: "@prudential_atelier", group: SettingGroup.SOCIAL, label: "Instagram — Atelier", type: SettingType.TEXT, isPublic: true, sortOrder: 6 },
    { key: "social_instagram_bridal", value: "@prudential_bridal", group: SettingGroup.SOCIAL, label: "Instagram — Bridal", type: SettingType.TEXT, isPublic: true, sortOrder: 7 },
    { key: "social_instagram_kids", value: "@prudential_kids", group: SettingGroup.SOCIAL, label: "Instagram — Kids", type: SettingType.TEXT, isPublic: true, sortOrder: 8 },
  ];
  for (const setting of extraSocial) {
    await prisma.siteSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }

  const contentSettings: {
    key: string;
    value: string;
    group: SettingGroup;
    label: string;
    type: SettingType;
    isPublic: boolean;
    sortOrder: number;
  }[] = [
    { key: "content_hero_label", value: "SS 2025 COLLECTION", group: SettingGroup.CONTENT, label: "Hero — Label", type: SettingType.TEXT, isPublic: true, sortOrder: 1 },
    { key: "content_hero_headline", value: "The New\nEdit.", group: SettingGroup.CONTENT, label: "Hero — Headline (use \\n for line break)", type: SettingType.TEXTAREA, isPublic: true, sortOrder: 2 },
    { key: "content_hero_subtext", value: "Designed for the woman who commands every room she enters.", group: SettingGroup.CONTENT, label: "Hero — Subtext", type: SettingType.TEXTAREA, isPublic: true, sortOrder: 3 },
    { key: "content_hero_cta1", value: "SHOP THE COLLECTION", group: SettingGroup.CONTENT, label: "Hero — Button 1 Text", type: SettingType.TEXT, isPublic: true, sortOrder: 4 },
    { key: "content_hero_cta2", value: "BOOK BESPOKE", group: SettingGroup.CONTENT, label: "Hero — Button 2 Text", type: SettingType.TEXT, isPublic: true, sortOrder: 5 },
    { key: "content_rtw_label", value: "READY TO WEAR", group: SettingGroup.CONTENT, label: "RTW Section — Label", type: SettingType.TEXT, isPublic: true, sortOrder: 10 },
    { key: "content_rtw_headline", value: "New Collections", group: SettingGroup.CONTENT, label: "RTW Section — Headline", type: SettingType.TEXT, isPublic: true, sortOrder: 11 },
    { key: "content_bride_label", value: "PRUDENTIAL BRIDE", group: SettingGroup.CONTENT, label: "Bride Section — Label", type: SettingType.TEXT, isPublic: true, sortOrder: 20 },
    { key: "content_bride_headline", value: "For the Bride\nWho Dares to\nBe Remembered.", group: SettingGroup.CONTENT, label: "Bride Section — Headline", type: SettingType.TEXTAREA, isPublic: true, sortOrder: 21 },
    { key: "content_bride_body", value: "Prudential Bride is our most intimate offering. Each gown is a singular creation — hand-crafted in our Lagos atelier, built around your story.", group: SettingGroup.CONTENT, label: "Bride Section — Body Text", type: SettingType.TEXTAREA, isPublic: true, sortOrder: 22 },
    { key: "content_bride_cta1", value: "EXPLORE BRIDAL COLLECTION", group: SettingGroup.CONTENT, label: "Bride Section — Button 1", type: SettingType.TEXT, isPublic: true, sortOrder: 23 },
    { key: "content_bride_cta2", value: "BOOK BRIDAL CONSULTATION", group: SettingGroup.CONTENT, label: "Bride Section — Button 2", type: SettingType.TEXT, isPublic: true, sortOrder: 24 },
    { key: "content_bespoke_label", value: "BESPOKE COUTURE", group: SettingGroup.CONTENT, label: "Bespoke Section — Label", type: SettingType.TEXT, isPublic: true, sortOrder: 30 },
    { key: "content_bespoke_headline", value: "One Piece.\nOne Story.\nYours.", group: SettingGroup.CONTENT, label: "Bespoke Section — Headline", type: SettingType.TEXTAREA, isPublic: true, sortOrder: 31 },
    { key: "content_bespoke_body", value: "From the first sketch to the final stitch — every bespoke piece is conceived, designed, and hand-crafted exclusively for you.", group: SettingGroup.CONTENT, label: "Bespoke Section — Body", type: SettingType.TEXTAREA, isPublic: true, sortOrder: 32 },
    { key: "content_atelier_label", value: "THE ATELIER", group: SettingGroup.CONTENT, label: "Atelier Section — Label", type: SettingType.TEXT, isPublic: true, sortOrder: 40 },
    { key: "content_atelier_headline", value: "Built in Lagos.\nWorn Worldwide.", group: SettingGroup.CONTENT, label: "Atelier Section — Headline", type: SettingType.TEXTAREA, isPublic: true, sortOrder: 41 },
    { key: "content_atelier_body", value: "Prudent Gabriel began as a single vision in Lagos, Nigeria. Today, our pieces are worn at weddings, galas, and boardrooms across four continents.", group: SettingGroup.CONTENT, label: "Atelier Section — Body", type: SettingType.TEXTAREA, isPublic: true, sortOrder: 42 },
    { key: "content_newsletter_headline", value: "Join the Inner Circle.", group: SettingGroup.CONTENT, label: "Newsletter — Headline", type: SettingType.TEXT, isPublic: true, sortOrder: 50 },
    { key: "content_newsletter_subtext", value: "New collections, exclusive access, and stories from the atelier.", group: SettingGroup.CONTENT, label: "Newsletter — Subtext", type: SettingType.TEXT, isPublic: true, sortOrder: 51 },
    { key: "content_shop_headline", value: "The Edit.", group: SettingGroup.CONTENT, label: "Shop — Headline", type: SettingType.TEXT, isPublic: true, sortOrder: 60 },
    { key: "content_shop_subtext", value: "Ready-to-Wear · Bespoke · Bridal", group: SettingGroup.CONTENT, label: "Shop — Subtext", type: SettingType.TEXT, isPublic: true, sortOrder: 61 },
    { key: "content_consult_label", value: "BOOK A CONSULTATION", group: SettingGroup.CONTENT, label: "Consultation — Label", type: SettingType.TEXT, isPublic: true, sortOrder: 70 },
    { key: "content_consult_headline", value: "Your Vision,\nOur Craft.", group: SettingGroup.CONTENT, label: "Consultation — Headline", type: SettingType.TEXTAREA, isPublic: true, sortOrder: 71 },
    { key: "content_consult_subtext", value: "Choose your consultant. Select your session. Begin the journey.", group: SettingGroup.CONTENT, label: "Consultation — Subtext", type: SettingType.TEXT, isPublic: true, sortOrder: 72 },
    { key: "content_bespoke_page_headline", value: "Your Vision,\nOur Craft.", group: SettingGroup.CONTENT, label: "Bespoke Page — Headline", type: SettingType.TEXTAREA, isPublic: true, sortOrder: 80 },
    { key: "content_pfa_label", value: "PRUDENTIAL FASHION ACADEMY", group: SettingGroup.CONTENT, label: "PFA Banner — Label", type: SettingType.TEXT, isPublic: true, sortOrder: 90 },
    { key: "content_pfa_text", value: "Over 5,000 designers trained. The school behind the brand.", group: SettingGroup.CONTENT, label: "PFA Banner — Text", type: SettingType.TEXT, isPublic: true, sortOrder: 91 },
    { key: "content_pfa_cta", value: "EXPLORE PFA →", group: SettingGroup.CONTENT, label: "PFA Banner — Button Text", type: SettingType.TEXT, isPublic: true, sortOrder: 92 },
    { key: "content_announce_1", value: "FREE SHIPPING ON ORDERS OVER ₦150,000 WITHIN LAGOS", group: SettingGroup.CONTENT, label: "Announcement Bar — Message 1", type: SettingType.TEXT, isPublic: true, sortOrder: 100 },
    { key: "content_announce_2", value: "NEW COLLECTION — THE EDIT IS NOW LIVE", group: SettingGroup.CONTENT, label: "Announcement Bar — Message 2", type: SettingType.TEXT, isPublic: true, sortOrder: 101 },
    { key: "content_announce_3", value: "BOOK YOUR BESPOKE CONSULTATION TODAY", group: SettingGroup.CONTENT, label: "Announcement Bar — Message 3", type: SettingType.TEXT, isPublic: true, sortOrder: 102 },
    { key: "content_footer_tagline", value: "Lagos, Nigeria", group: SettingGroup.CONTENT, label: "Footer — Tagline below logo", type: SettingType.TEXT, isPublic: true, sortOrder: 110 },
    { key: "content_footer_copyright", value: "© 2025 Prudent Gabriel. All Rights Reserved.", group: SettingGroup.CONTENT, label: "Footer — Copyright text", type: SettingType.TEXT, isPublic: true, sortOrder: 111 },
  ];

  for (const s of contentSettings) {
    await prisma.siteSetting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }
}

async function upsertGalleryPlaceholders() {
  const atelierGallerySeed: { url: string; alt: string; caption?: string }[] = [
    { url: "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=800", alt: "Atelier workspace", caption: "The workshop where every piece begins" },
    { url: "https://images.unsplash.com/photo-1556761175-b413da4baf72?w=600", alt: "Design team at work", caption: "Our team in Lagos" },
    { url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800", alt: "Fabric selection" },
    { url: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600", alt: "Editorial fashion shot" },
    { url: "https://images.unsplash.com/photo-1594463750939-ebb28c3f7f75?w=800", alt: "Bridal gown detail" },
    { url: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600", alt: "Fashion editorial" },
    { url: "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=800", alt: "Formal wear" },
    { url: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600", alt: "Ready to wear" },
    { url: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800", alt: "Wardrobe curation" },
    { url: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=600", alt: "Style consultation" },
    { url: "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=800", alt: "Bridal collection" },
    { url: "https://images.unsplash.com/photo-1529636798458-92182e662485?w=600", alt: "Wedding preparation" },
  ];

  const bridalGallerySeed: { url: string; alt: string; caption?: string }[] = [
    { url: "https://images.unsplash.com/photo-1594463750939-ebb28c3f7f75?w=800", alt: "Prudential Bride gown", caption: "Amore Collection 2024" },
    { url: "https://images.unsplash.com/photo-1519741347686-c1e331ec5e96?w=600", alt: "Bride portrait" },
    { url: "https://images.unsplash.com/photo-1529636798458-92182e662485?w=800", alt: "Bridal gown detail" },
    { url: "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=600", alt: "Wedding collection" },
    { url: "https://images.unsplash.com/photo-1560180474-e8563fd75bab?w=800", alt: "Bride silhouette" },
    { url: "https://images.unsplash.com/photo-1585241645927-c7a8e5840c42?w=600", alt: "Bridal accessories" },
    { url: "https://images.unsplash.com/photo-1594463750939-ebb28c3f7f75?w=700", alt: "Traditional bridal" },
    { url: "https://images.unsplash.com/photo-1519741347686-c1e331ec5e96?w=800", alt: "White wedding gown" },
  ];

  const kidsGallerySeed: { url: string; alt: string; caption?: string }[] = [
    { url: "https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=800", alt: "Little princess gown", caption: "Prudential Kids — Flower Girl Collection" },
    { url: "https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?w=800", alt: "Kids fashion editorial" },
    { url: "https://images.unsplash.com/photo-1472162072942-cd5147eb3902?w=600", alt: "Children's traditional wear" },
    { url: "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=800", alt: "Kids party dress", caption: "Birthday Collection" },
    { url: "https://images.unsplash.com/photo-1519689680058-324335c77eba?w=600", alt: "Little gentleman suit" },
    { url: "https://images.unsplash.com/photo-1476234251651-f353703a034d?w=800", alt: "Flower girl dress" },
    { url: "https://images.unsplash.com/photo-1502781252888-9143ba7f074e?w=600", alt: "Kids trad wear", caption: "Traditional Collection" },
    { url: "https://images.unsplash.com/photo-1488716820095-cbe80883c496?w=800", alt: "Children editorial" },
  ];

  for (let i = 0; i < atelierGallerySeed.length; i++) {
    const img = atelierGallerySeed[i]!;
    await prisma.galleryImage.upsert({
      where: { publicId: `seed-atelier-${i}` },
      update: {},
      create: {
        url: img.url,
        publicId: `seed-atelier-${i}`,
        alt: img.alt,
        caption: img.caption ?? null,
        category: GalleryCategory.ATELIER,
        sortOrder: i,
        isPublished: true,
      },
    });
  }
  for (let i = 0; i < bridalGallerySeed.length; i++) {
    const img = bridalGallerySeed[i]!;
    await prisma.galleryImage.upsert({
      where: { publicId: `seed-bridal-${i}` },
      update: {},
      create: {
        url: img.url,
        publicId: `seed-bridal-${i}`,
        alt: img.alt,
        caption: img.caption ?? null,
        category: GalleryCategory.BRIDAL,
        sortOrder: i,
        isPublished: true,
      },
    });
  }
  for (let i = 0; i < kidsGallerySeed.length; i++) {
    const img = kidsGallerySeed[i]!;
    await prisma.galleryImage.upsert({
      where: { publicId: `seed-kids-${i}` },
      update: {},
      create: {
        url: img.url,
        publicId: `seed-kids-${i}`,
        alt: img.alt,
        caption: img.caption ?? null,
        category: GalleryCategory.KIDS,
        sortOrder: i,
        isPublished: true,
      },
    });
  }
}

async function upsertCollections() {
  const defaultCollections = [
    {
      name: "Rich & Regal",
      slug: "rich-regal",
      excerpt: "Where opulence meets everyday elegance.",
      description:
        "The Rich & Regal collection reimagines luxury for the modern Nigerian woman. Each piece commands attention with rich fabrics, bold silhouettes, and intricate detailing.",
      autoTag: "rich-regal",
      coverImage: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1200",
      isFeatured: true,
      isPublished: true,
      displayOrder: 0,
    },
    {
      name: "Church Girl Collection",
      slug: "church-girl",
      excerpt: "Modest, beautiful, and unmistakably Prudent Gabriel.",
      description:
        "Grace and modesty elevated to high fashion. The Church Girl Collection celebrates covered elegance — long sleeves, flowing silhouettes, and refined details for the woman who dresses with intention.",
      autoTag: "church-girl",
      coverImage: "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=1200",
      isFeatured: true,
      isPublished: true,
      displayOrder: 1,
    },
    {
      name: "La Femme",
      slug: "la-femme",
      excerpt: "For the woman who defines her own standard.",
      description:
        "La Femme is our most editorial collection — dramatic cuts, unexpected fabrics, and a silhouette that turns every room into a runway.",
      autoTag: "la-femme",
      coverImage: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1200",
      isFeatured: false,
      isPublished: true,
      displayOrder: 2,
    },
  ];

  for (const col of defaultCollections) {
    await prisma.collection.upsert({
      where: { slug: col.slug },
      update: {},
      create: col,
    });
  }
}

async function main() {
  console.log("Bootstrap seed (production-safe) — settings, consultants, shipping, collections, gallery, admin.");

  await seedBootstrapAdmin(prisma);

  await upsertShippingZones();
  await upsertShippingMethods();
  await upsertConsultants();
  await upsertSiteSettings();

  const emailTemplates: { key: string; label: string; sortOrder: number }[] = [
    { key: "email_tpl_welcome", label: "Welcome Email", sortOrder: 100 },
    { key: "email_tpl_order_confirmation", label: "Order Confirmation", sortOrder: 101 },
    { key: "email_tpl_order_shipped", label: "Order Shipped", sortOrder: 102 },
    { key: "email_tpl_bespoke_confirmation", label: "Bespoke Confirmation", sortOrder: 103 },
    { key: "email_tpl_password_reset", label: "Password Reset", sortOrder: 104 },
    { key: "email_tpl_referral_success", label: "Referral Success", sortOrder: 105 },
    { key: "email_tpl_back_in_stock", label: "Back In Stock", sortOrder: 106 },
    { key: "email_tpl_consultation_pending", label: "Consultation Pending", sortOrder: 107 },
    { key: "email_tpl_consultation_confirmed", label: "Consultation Confirmed", sortOrder: 108 },
    { key: "email_tpl_consultation_cancelled", label: "Consultation Cancelled", sortOrder: 109 },
  ];
  const tplDefault = JSON.stringify({ subject: "", body: "" });
  for (const t of emailTemplates) {
    await prisma.siteSetting.upsert({
      where: { key: t.key },
      update: {},
      create: {
        key: t.key,
        value: tplDefault,
        group: SettingGroup.EMAIL,
        label: t.label,
        type: SettingType.JSON,
        isPublic: false,
        sortOrder: t.sortOrder,
      },
    });
  }
  console.log("  email template keys upserted (full bodies: pnpm seed:email-templates)");

  await upsertGalleryPlaceholders();
  await upsertCollections();

  const [settings, consultants, products, orders, invoices, bookings] = await Promise.all([
    prisma.siteSetting.count(),
    prisma.consultant.count(),
    prisma.product.count(),
    prisma.order.count(),
    prisma.invoice.count(),
    prisma.consultationBooking.count(),
  ]);
  console.log(
    `Bootstrap complete. settings=${settings} consultants=${consultants} products=${products} (untouched) orders=${orders} invoices=${invoices} consultations=${bookings}`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
