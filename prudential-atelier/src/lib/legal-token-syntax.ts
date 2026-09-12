/** Pure legal-token helpers. Safe to import from the CMS editor (no Prisma). */

export const LEGAL_TOKEN_NAMES = [
  "production_time",
  "custom_lead_time_days",
  "alteration_warranty_days",
  "fabric_promise_hours",
  "invoice_validity_days",
  "points_per_ten",
  "points_spend_unit",
  "points_rate",
  "points_referral",
  "points_expiry_months",
  "points_min_redemption",
  "house_term_delivery",
  "house_term_changes",
  "house_term_shipping",
  "house_term_refunds",
  "contact_email",
  "contact_phone",
  "contact_address",
  "shipping_ddu",
  "shipping_uncollected_days",
  "shipping_lagos",
  "shipping_methods",
  "currencies_offered",
  "receipt_link_days",
  "impersonation_minutes",
] as const;

export type LegalTokenName = (typeof LEGAL_TOKEN_NAMES)[number];

export const LEGAL_TOKEN_SET = new Set<string>(LEGAL_TOKEN_NAMES);

export const LEGAL_CONTENT_SETTING_KEYS = [
  "legal_privacy_policy",
  "legal_terms",
  "legal_cookie_policy",
  "legal_returns_policy",
  "legal_shipping_policy",
] as const;

export type LegalContentSettingKey = (typeof LEGAL_CONTENT_SETTING_KEYS)[number];

export const LEGAL_CONTENT_SETTING_KEY_SET = new Set<string>(LEGAL_CONTENT_SETTING_KEYS);

export const LEGAL_SIGNIFICANT_SETTING_KEYS = new Set<string>([
  ...LEGAL_CONTENT_SETTING_KEYS,
  "legal_privacy_updated",
  "legal_terms_updated",
  "legal_cookie_updated",
  "legal_returns_updated",
  "legal_shipping_updated",
  "legal_copy_revision",
  "rtw_production_copy",
  "custom_lead_time_days",
  "alteration_warranty_days",
  "invoice_default_validity_days",
  "invoice_term_delivery",
  "invoice_term_changes",
  "invoice_term_shipping",
  "invoice_term_refunds",
  "invoice_email",
  "invoice_phone",
  "invoice_address",
  "invoice_address_line1",
  "invoice_address_line2",
  "invoice_city",
  "invoice_business_name",
  "prudent_points_rate_ngn",
  "prudent_points_expiry_months",
  "prudent_points_min_redemption",
  "loyalty_point_rate_ngn",
  "loyalty_min_redemption_points",
  "shipping_ddu_disclosure",
  "shipping_uncollected_days",
  "shipping_quote_pending_consent",
  "shipping_quote_manual_consent",
  "bespoke_deposit_percent",
]);

export const LEGAL_PUBLIC_PATHS = [
  "/privacy-policy",
  "/terms-and-conditions",
  "/cookie-policy",
  "/returns-policy",
  "/shipping-policy",
] as const;

const TOKEN_RE = /\{\{\s*([#/]?[a-zA-Z0-9_]+)\s*\}\}/g;
const SECTION_RE = /\{\{#([a-zA-Z0-9_]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
const SIMPLE_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
const LEFTOVER_RE = /\{\{[^}]*\}\}/g;

export function isLegalContentSettingKey(key: string): key is LegalContentSettingKey {
  return LEGAL_CONTENT_SETTING_KEY_SET.has(key);
}

export function isLegalTokenName(name: string): name is LegalTokenName {
  return LEGAL_TOKEN_SET.has(name);
}

export function findUnknownLegalTokens(html: string): string[] {
  const found = new Set<string>();
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(html))) {
    const raw = m[1] ?? "";
    const name = raw.replace(/^[#/]/, "");
    if (!name || !isLegalTokenName(name)) found.add(name || raw);
  }
  return Array.from(found).sort();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function tokenValueHtml(raw: string): string {
  return escapeHtml(raw).replace(/\r\n|\n|\r/g, "<br />");
}

function isPresent(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

/**
 * `{{token}}` → live value.
 * `{{#token}}…{{/token}}` → omitted when the value is empty.
 * Public mode never leaves `{{` on the page.
 */
export function applyLegalTokens(
  html: string,
  tokens: Record<string, string>,
  mode: "public" | "editor",
): { html: string; unknown: string[] } {
  const unknown = findUnknownLegalTokens(html);
  let out = html.replace(SECTION_RE, (_all, name: string, inner: string) =>
    isPresent(tokens[name]) ? inner : "",
  );
  out = out.replace(SIMPLE_RE, (_all, name: string) => {
    if (!isLegalTokenName(name)) return mode === "public" ? "" : _all;
    return isPresent(tokens[name]) ? tokenValueHtml(tokens[name]!) : "";
  });
  if (mode === "public") {
    out = out.replace(LEFTOVER_RE, "");
  }
  return { html: out.replace(/\n{3,}/g, "\n\n"), unknown };
}

export function formatNairaLegal(n: number): string {
  return `₦${n.toLocaleString("en-NG")}`;
}

export function formatCountLegal(n: number): string {
  return n.toLocaleString("en-NG");
}

/** Omit a location with nothing to say. Never "free over ₦0". */
export function formatLagosLocationLine(loc: {
  name: string;
  etaText: string;
  price: number;
  freeAboveNGN: number | null;
}): string | null {
  const name = loc.name.trim();
  if (!name) return null;
  const bits: string[] = [];
  const eta = loc.etaText.trim();
  if (eta) bits.push(eta);
  if (Number.isFinite(loc.price) && loc.price > 0) bits.push(formatNairaLegal(loc.price));
  if (loc.freeAboveNGN != null && loc.freeAboveNGN > 0) {
    bits.push(`free above ${formatNairaLegal(loc.freeAboveNGN)}`);
  }
  if (!bits.length) return null;
  return `${name}: ${bits.join("; ")}`;
}
