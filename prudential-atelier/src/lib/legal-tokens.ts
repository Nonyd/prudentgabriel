import { createHash } from "node:crypto";
import { LEGAL_COPY_REVISION } from "@/lib/legal-copy";
import { getHouseDocumentTerms } from "@/lib/invoice-terms";
import { getInvoiceDefaultValidityDays, getInvoiceSettings } from "@/lib/invoice";
import { getSetting } from "@/lib/settings";
import { getProductionCopy } from "@/lib/production-time";
import { CUSTOM_SETTING_KEYS } from "@/lib/custom-settings";
import { getAlterationWarrantyDays } from "@/lib/alterations/policy";
import { FABRIC_PROMISE_HOURS } from "@/lib/fabric-unavailable";
import { getExpiryMonths, getMinRedemptionPoints, getPointRateNGN } from "@/lib/points";
import { getLoyaltyRulePoints } from "@/lib/loyalty";
import { LOYALTY_ACTIONS, NGN_PER_EARN_UNIT } from "@/lib/points-value";
import { getShippingCopy } from "@/lib/shipping/copy";
import { prisma } from "@/lib/prisma";
import { isUsableBankAccount } from "@/lib/payments/bank-account";
import { IMPERSONATE_TTL_MS } from "@/lib/admin-impersonate";
import { RECEIPT_EMAIL_TTL_SEC } from "@/lib/media/receipt-src";
import { logActivity } from "@/lib/logger";
import {
  applyLegalTokens,
  formatCountLegal,
  formatLagosLocationLine,
  LEGAL_TOKEN_NAMES,
  type LegalTokenName,
} from "@/lib/legal-token-syntax";

export type LegalTokenMap = Record<LegalTokenName, string>;

export type LegalTermsSnapshot = {
  version: string;
  copyRevision: string;
  resolvedAt: string;
  tokens: LegalTokenMap;
};

function asToken(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  return String(Math.round(n) === n ? n : n);
}

function joinAddress(parts: Array<string | undefined>): string {
  return parts
    .map((p) => p?.replace(/\s+/g, " ").trim() ?? "")
    .filter(Boolean)
    .join("\n");
}

export async function resolveLegalTokens(): Promise<LegalTokenMap> {
  const empty = Object.fromEntries(LEGAL_TOKEN_NAMES.map((k) => [k, ""])) as LegalTokenMap;

  const [
    production,
    customLeadRaw,
    alterationDays,
    validityDays,
    houseTerms,
    invoice,
    studioAddress,
    pointRate,
    expiryMonths,
    minRedemption,
    pointsPerTen,
    referralPoints,
    shippingCopy,
    lagos,
    methods,
    banks,
  ] = await Promise.all([
    getProductionCopy(),
    getSetting(CUSTOM_SETTING_KEYS.leadTimeDays),
    getAlterationWarrantyDays(),
    getInvoiceDefaultValidityDays(),
    getHouseDocumentTerms(),
    getInvoiceSettings(),
    getSetting("invoice_address"),
    getPointRateNGN(),
    getExpiryMonths(),
    getMinRedemptionPoints(),
    getLoyaltyRulePoints(LOYALTY_ACTIONS.PURCHASE_PER_10),
    getLoyaltyRulePoints(LOYALTY_ACTIONS.REFERRAL_FIRST_ORDER),
    getShippingCopy(),
    prisma.lagosLocation.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { name: true, etaText: true, price: true, freeAboveNGN: true },
    }),
    prisma.shippingMethod.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { name: true },
    }),
    prisma.bankAccount.findMany({
      select: { currency: true, accountNumber: true, bankName: true, accountName: true, isActive: true },
    }),
  ]);

  const customLead = Number(customLeadRaw);
  const term = (key: "delivery" | "changes" | "shipping" | "refunds") =>
    houseTerms.find((t) => t.key === key)?.body.trim() ?? "";

  const address = joinAddress([
    invoice.businessName,
    invoice.addressLine1,
    invoice.addressLine2,
    invoice.city,
  ]);
  const addressOrStudio = address || studioAddress?.trim() || "";

  const lagosLines = lagos
    .map((row) =>
      formatLagosLocationLine({
        name: row.name,
        etaText: row.etaText,
        price: row.price,
        freeAboveNGN: row.freeAboveNGN,
      }),
    )
    .filter((line): line is string => Boolean(line));

  const currencies = Array.from(
    new Set(banks.filter((row) => isUsableBankAccount(row)).map((row) => row.currency)),
  ).sort();

  const tokens: LegalTokenMap = {
    ...empty,
    production_time: production.trim(),
    custom_lead_time_days: Number.isFinite(customLead) && customLead > 0 ? String(Math.round(customLead)) : "",
    alteration_warranty_days: asToken(alterationDays),
    fabric_promise_hours: asToken(FABRIC_PROMISE_HOURS),
    invoice_validity_days: asToken(validityDays),
    points_per_ten: asToken(pointsPerTen),
    points_spend_unit: asToken(NGN_PER_EARN_UNIT),
    points_rate: pointRate > 0 ? String(pointRate) : "",
    points_referral: referralPoints > 0 ? formatCountLegal(referralPoints) : "",
    points_expiry_months: asToken(expiryMonths),
    points_min_redemption: minRedemption > 0 ? formatCountLegal(minRedemption) : "",
    house_term_delivery: term("delivery"),
    house_term_changes: term("changes"),
    house_term_shipping: term("shipping"),
    house_term_refunds: term("refunds"),
    contact_email: invoice.email.trim(),
    contact_phone: invoice.phone.trim(),
    contact_address: addressOrStudio,
    shipping_ddu: shippingCopy.dduDisclosure.trim(),
    shipping_uncollected_days: asToken(shippingCopy.uncollectedDays),
    shipping_lagos: lagosLines.join(". "),
    shipping_methods: methods.map((m) => m.name.trim()).filter(Boolean).join(", "),
    currencies_offered: currencies.join(", "),
    receipt_link_days: asToken(RECEIPT_EMAIL_TTL_SEC / 86400),
    impersonation_minutes: asToken(IMPERSONATE_TTL_MS / 60000),
  };

  return tokens;
}

export function hashLegalTermsVersion(copyRevision: string, tokens: LegalTokenMap): string {
  const stable = Object.fromEntries(
    Object.entries(tokens).sort(([a], [b]) => a.localeCompare(b)),
  );
  const digest = createHash("sha256")
    .update(JSON.stringify({ copyRevision, tokens: stable }))
    .digest("hex")
    .slice(0, 12);
  return `${copyRevision}:${digest}`;
}

export async function createLegalTermsSnapshot(): Promise<LegalTermsSnapshot> {
  const tokens = await resolveLegalTokens();
  return {
    version: hashLegalTermsVersion(LEGAL_COPY_REVISION, tokens),
    copyRevision: LEGAL_COPY_REVISION,
    resolvedAt: new Date().toISOString(),
    tokens,
  };
}

export function renderLegalHtml(html: string, tokens: Record<string, string>, mode: "public" | "editor" = "public"): string {
  return applyLegalTokens(html, tokens, mode).html;
}

export async function logLegallySignificantChange(params: {
  userId?: string;
  userEmail?: string;
  userRole?: string;
  key: string;
  previous?: string;
  next?: string;
  redactValues?: boolean;
  recordType?: string;
}): Promise<void> {
  await logActivity({
    userId: params.userId,
    userEmail: params.userEmail,
    userRole: params.userRole,
    action: "UPDATE",
    module: "settings",
    description: `Legally-significant setting changed: ${params.key}`,
    recordId: params.key,
    recordType: params.recordType ?? "SiteSetting",
    snapshot: params.redactValues
      ? { key: params.key }
      : { key: params.key, previous: params.previous ?? "", next: params.next ?? "" },
  });
}
