/**
 * Slice AR: legal pages from what the system actually does.
 *
 *   pnpm test:slice-ar
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_HOUSE_DOCUMENT_TERMS } from "../src/lib/invoice-terms";
import {
  COOKIE_MD,
  DEFAULT_LEGAL_UPDATED,
  LEGAL_COPY_REVISION,
  LEGAL_HTML,
  LEGAL_MARKDOWN,
  LEGAL_SEED_ENTRIES,
  PRIVACY_POLICY_MD,
  RETURNS_MD,
  SHIPPING_MD,
  TERMS_MD,
  extractLegalToc,
  legalMdToHtml,
} from "../src/lib/legal-copy";
import {
  CONSENT_KEY,
  COOKIE_BANNER_ACKNOWLEDGE,
  COOKIE_BANNER_NOTICE,
  CURRENT_CONSENT_VERSION,
  ESSENTIAL_CART_STORAGE_KEY,
  ESSENTIAL_CURRENCY_STORAGE_KEY,
  parseCookieConsent,
} from "../src/lib/cookie-consent";
import { fabricPolicyCopy, MADE_TO_MEASURE_REASON, STANDARD_SIZE_COPY } from "../src/lib/production-time";
import { DEFAULT_FABRIC_PROMISE_HOURS } from "../src/lib/fabric-unavailable";

const FABRIC_POLICY_COPY = fabricPolicyCopy(DEFAULT_FABRIC_PROMISE_HOURS);
import { sanitizeCmsHtml } from "../src/lib/sanitize-html";
import {
  applyLegalTokens,
  findUnknownLegalTokens,
  formatLagosLocationLine,
} from "../src/lib/legal-token-syntax";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (rel: string) => readFileSync(join(root, rel), "utf8");

const FIXTURE_TOKENS: Record<string, string> = {
  production_time: "7-12 days",
  custom_lead_time_days: "12",
  alteration_warranty_days: "30",
  fabric_promise_hours: "48",
  invoice_validity_days: "14",
  points_per_ten: "1",
  points_spend_unit: "10",
  points_rate: "1",
  points_referral: "12,500",
  points_expiry_months: "24",
  points_min_redemption: "5,000",
  house_term_delivery: DEFAULT_HOUSE_DOCUMENT_TERMS[0]!.body,
  house_term_changes: DEFAULT_HOUSE_DOCUMENT_TERMS[1]!.body,
  house_term_shipping: DEFAULT_HOUSE_DOCUMENT_TERMS[2]!.body,
  house_term_refunds: DEFAULT_HOUSE_DOCUMENT_TERMS[3]!.body,
  contact_email: "hello@prudentgabriel.com",
  contact_phone: "+234 000",
  contact_address: "No. 4 Akinwale Shitu Divine Homes, Thomas Estates\nAjah, Lagos, Nigeria",
  shipping_ddu:
    "International orders may attract import duties and taxes on arrival, payable by the recipient. These are set by your country's customs authority and are not included in the price.",
  shipping_uncollected_days: "7",
  shipping_lagos: "Ikeja: 2-4 business days; free above ₦50,000",
  shipping_methods: "Lagos courier, DHL, Collection",
  currencies_offered: "NGN, USD, GBP",
  receipt_link_days: "7",
  impersonation_minutes: "30",
  chat_retention_days: "90",
  cookie_banner_notice: COOKIE_BANNER_NOTICE,
  cookie_banner_acknowledge: COOKIE_BANNER_ACKNOWLEDGE,
  cookie_consent_key: CONSENT_KEY,
  cookie_consent_version: CURRENT_CONSENT_VERSION,
  cookie_cart_key: ESSENTIAL_CART_STORAGE_KEY,
  cookie_currency_key: ESSENTIAL_CURRENCY_STORAGE_KEY,
};

function resolved(md: string): string {
  return applyLegalTokens(legalMdToHtml(md), FIXTURE_TOKENS, "public").html;
}

function runConverter() {
  const html = legalMdToHtml("## Who we are\n\nHello **world** and [mail](mailto:hello@prudentgabriel.com).\n\n- one\n- two\n\n### Nested\n\n1. first\n2. second");
  assert(html.includes('<h2 id="who-we-are">Who we are</h2>'), "h2 gets a slug id");
  assert(html.includes("<strong>world</strong>"), "bold");
  assert(html.includes('href="mailto:hello@prudentgabriel.com"'), "mailto links");
  assert(html.includes("<ul><li>one</li>"), "bullets");
  assert(html.includes("<ol><li>first</li>"), "numbered list");
  const toc = extractLegalToc(html);
  assert(toc.length === 1 && toc[0]!.id === "who-we-are", "toc from h2");
  const clean = sanitizeCmsHtml(html);
  assert(clean.includes('id="who-we-are"'), "sanitizer keeps heading ids");
}

function runFacts() {
  assert(LEGAL_COPY_REVISION === "ba-3", "revision stamp");
  assert(DEFAULT_LEGAL_UPDATED.includes("September 2026"), "last-updated date is this slice");
  const byPage = Object.fromEntries(LEGAL_SEED_ENTRIES.map((e) => [e.page, e.revision]));
  // BA5/BA6: chat, enquiries and hosting in Germany republish privacy and cookie.
  assert(byPage.cookie === "ba-2" && byPage.privacy === "ba-3", "privacy republishes for the token sweep (no emailed passwords); cookie stays at BA5");
  assert(byPage.terms === "ar-5" && byPage.returns === "ar-5" && byPage.shipping === "ar-5", "other legal pages keep their lawyer revision");

  for (const term of DEFAULT_HOUSE_DOCUMENT_TERMS) {
    assert(TERMS_MD.includes(`{{house_term_${term.key}}}`), `terms tokenise invoice term: ${term.key}`);
    const html = resolved(TERMS_MD);
    assert(html.includes(term.body), `resolved terms include invoice term: ${term.key}`);
    if (term.key === "refunds") {
      assert(RETURNS_MD.includes("{{house_term_refunds}}"), "returns page uses the refunds house term token");
      assert(resolved(RETURNS_MD).includes(term.body), "resolved returns include the refunds house term");
    }
    if (term.key === "shipping") {
      assert(SHIPPING_MD.includes("{{house_term_shipping}}"), "shipping page uses the shipping house term token");
      assert(resolved(SHIPPING_MD).includes(term.body), "resolved shipping include the shipping house term");
    }
  }

  assert(RETURNS_MD.includes(STANDARD_SIZE_COPY), "returns uses AG standard-size copy");
  assert(RETURNS_MD.includes(MADE_TO_MEASURE_REASON), "returns uses AG made-to-measure reason");
  assert(RETURNS_MD.includes("{{fabric_promise_hours}}"), "returns uses fabric-hours token");
  assert(resolved(RETURNS_MD).includes(FABRIC_POLICY_COPY), "resolved returns match 48-hour fabric copy");
  assert(TERMS_MD.includes(STANDARD_SIZE_COPY), "terms agree with PDP on standard size");
  assert(TERMS_MD.includes(MADE_TO_MEASURE_REASON), "terms agree with PDP on made to measure");
  assert(resolved(TERMS_MD).includes(FABRIC_POLICY_COPY), "resolved terms agree on fabric");

  assert(TERMS_MD.includes("Nothing is held in stock"), "made to order");
  assert(TERMS_MD.includes("{{production_time}}"), "production window is a token");
  assert(TERMS_MD.includes("Shipping time is separate"), "shipping is extra");
  assert(!TERMS_MD.includes("70 percent") && !TERMS_MD.includes("70%"), "deposit is not a typed house-wide percent");
  assert(TERMS_MD.includes("agreed on that quotation"), "deposit is per quotation");
  assert(TERMS_MD.includes("thirteen stages"), "atelier stages");
  assert(TERMS_MD.includes("Design approval"), "approval gate");
  assert(TERMS_MD.includes("{{alteration_warranty_days}}"), "alteration window is a token");
  assert(TERMS_MD.includes("revalues every outstanding balance"), "points rate change");
  assert(TERMS_MD.includes("not returned for cash"), "points are not cash");
  assert(TERMS_MD.includes("{{points_expiry_months}}"), "points expiry is a token");
  assert(TERMS_MD.includes("DDU"), "DDU in terms");
  assert(TERMS_MD.includes("courts of Lagos State"), "governing law");
  assert(TERMS_MD.includes("Federal Competition and Consumer Protection Act 2018"), "FCCPA");

  assert(PRIVACY_POLICY_MD.includes("Nigeria Data Protection Act 2023"), "NDPA");
  assert(PRIVACY_POLICY_MD.includes("bust, waist, hip"), "measurements named");
  assert(PRIVACY_POLICY_MD.includes("cut your garment"), "measurements purpose");
  assert(PRIVACY_POLICY_MD.includes("private media"), "receipts are private");
  assert(PRIVACY_POLICY_MD.includes("{{receipt_link_days}}"), "signed receipt TTL is a token");
  assert(PRIVACY_POLICY_MD.includes("CV"), "careers files");
  assert(PRIVACY_POLICY_MD.includes("impersonate") || PRIVACY_POLICY_MD.includes("viewing the site as you"), "impersonation");
  assert(PRIVACY_POLICY_MD.includes("Paystack"), "Paystack named");
  assert(PRIVACY_POLICY_MD.includes("Open Exchange Rates"), "FX source named");
  assert(PRIVACY_POLICY_MD.includes("opens an account"), "guest onboarding");
  assert(PRIVACY_POLICY_MD.includes("{{contact_email}}"), "contact email is a token");
  assert(PRIVACY_POLICY_MD.includes("{{contact_address}}"), "contact address is a token");
  assert(resolved(PRIVACY_POLICY_MD).includes("hello@prudentgabriel.com"), "resolved privacy uses invoice email");
  assert(PRIVACY_POLICY_MD.includes("statutory period"), "financial retention is statutory, not invented");
  assert(!PRIVACY_POLICY_MD.includes("UK GDPR"), "do not claim UK GDPR as a done fact");
  assert(!PRIVACY_POLICY_MD.includes("Vercel"), "hosting claim matches current VPS, not old Vercel copy");

  assert(COOKIE_MD.includes("{{cookie_banner_notice}}"), "cookie policy uses the same banner sentence");
  assert(PRIVACY_POLICY_MD.includes("{{cookie_banner_notice}}"), "privacy cookie paragraph uses the banner sentence");
  assert(resolved(COOKIE_MD).includes(COOKIE_BANNER_NOTICE), "resolved cookie policy matches the banner");
  assert(resolved(COOKIE_MD).includes(ESSENTIAL_CART_STORAGE_KEY), "resolved cookie policy names the bag key");
  assert(resolved(COOKIE_MD).includes(ESSENTIAL_CURRENCY_STORAGE_KEY), "resolved cookie policy names the currency key");
  assert(COOKIE_MD.includes("{{cookie_cart_key}}"), "bag key is a token");
  assert(COOKIE_MD.includes("{{cookie_currency_key}}"), "currency key is a token");
  assert(COOKIE_MD.includes("{{cookie_consent_key}}"), "consent key is a token");
  assert(COOKIE_MD.includes("There is no Reject Non-Essential"), "policy records that the refuse button is gone");
  assert(COOKIE_MD.includes("does not load Google Analytics"), "analytics honesty");
  assert(COOKIE_MD.includes("pg_admin_impersonate"), "admin impersonation cookie");
  assert(COOKIE_MD.includes("Essential: without it the bag empties"), "bag is classified essential");
  assert(COOKIE_MD.includes("Essential: without it the price you saw"), "currency is classified essential");

  assert(SHIPPING_MD.includes("DDU"), "shipping DDU");
  assert(SHIPPING_MD.includes("GIG"), "GIG named");
  assert(!SHIPPING_MD.includes("500,000"), "do not invent free-shipping threshold");
  assert(!SHIPPING_MD.includes("1-3 business days"), "do not invent Lagos transit times");
  assert(!TERMS_MD.includes("50% deposit"), "old 50 percent deposit is gone");
  assert(!RETURNS_MD.includes("store credit is valid for 12 months"), "do not invent store-credit expiry");

  for (const [key, md] of Object.entries(LEGAL_MARKDOWN)) {
    const html = LEGAL_HTML[key as keyof typeof LEGAL_HTML];
    assert(html.length > 400, `${key} html is not empty`);
    assert(extractLegalToc(html).length >= 4, `${key} has a contents list`);
    assert(!md.includes("\u2014") && !md.includes("\u2013"), `${key} has no em/en dashes`);
    const publicHtml = applyLegalTokens(html, FIXTURE_TOKENS, "public").html;
    assert(!publicHtml.includes("{{"), `${key} public render never leaves braces`);
  }
}

function runCookieConsent() {
  // BA5 bumped 2.0 -> 2.1 so everyone sees the banner that now names the chat cookie.
  assert(CURRENT_CONSENT_VERSION === "2.1", "acknowledgement version bumps with the banner wording");
  assert(
    parseCookieConsent({
      version: "1.0",
      timestamp: "2026-01-01T00:00:00.000Z",
      necessary: true,
      functional: false,
      analytics: false,
      marketing: false,
    }) === null,
    "v1 category flags are not treated as an acknowledgement",
  );
  const ok = parseCookieConsent({
    version: "2.1",
    timestamp: "2026-09-14T00:00:00.000Z",
    acknowledged: true,
    analytics: true,
  });
  assert(ok?.acknowledged === true && ok.version === "2.1", "current acknowledgement is accepted");
  assert(ok && !("analytics" in ok) && !("marketing" in ok) && !("functional" in ok), "stored shape has no category flags");

  const consentSrc = src("src/lib/cookie-consent.ts");
  assert(!consentSrc.includes("acceptAllConsent"), "accept-all helper is gone");
  assert(!consentSrc.includes("rejectNonEssentialConsent"), "reject helper is gone");
  assert(!consentSrc.includes("functional:"), "no functional flag in consent module");
  assert(consentSrc.includes("ESSENTIAL_CART_STORAGE_KEY"), "bag key is classified essential in code");
  assert(consentSrc.includes("ESSENTIAL_CURRENCY_STORAGE_KEY"), "currency key is classified essential in code");

  const cart = src("src/store/cartStore.ts");
  const currency = src("src/store/currencyStore.ts");
  assert(cart.includes("ESSENTIAL_CART_STORAGE_KEY"), "cart persist uses the essential key");
  assert(currency.includes("ESSENTIAL_CURRENCY_STORAGE_KEY"), "currency persist uses the essential key");

  const banner = src("src/components/gdpr/CookieConsent.tsx");
  assert(banner.includes("COOKIE_BANNER_NOTICE"), "banner copy comes from the shared constant");
  assert(banner.includes("COOKIE_BANNER_ACKNOWLEDGE"), "one acknowledge button");
  assert(banner.includes("/cookie-policy"), "banner links the cookie policy");
  assert(!banner.includes("Reject Non-Essential"), "no reject button");
  assert(!banner.includes("Accept All"), "no accept-all button");
  assert(!banner.includes("Cookie Settings"), "no settings button");
  assert(!banner.includes("Analytics Cookies"), "no analytics toggle");
  assert(!banner.includes("Marketing Cookies"), "no marketing toggle");
  assert(!banner.includes("Functional Cookies"), "no functional toggle");
  assert(!banner.includes("cookieConsentStore"), "settings modal store is unused");
  assert(!banner.includes("@radix-ui/react-dialog"), "preferences dialog is gone");

  try {
    src("src/store/cookieConsentStore.ts");
    assert(false, "cookieConsentStore.ts should be deleted");
  } catch {
    // expected: file removed
  }
}

function runTokens() {
  const unknown = findUnknownLegalTokens("Hello {{not_a_real_token}} and {{production_time}}");
  assert(unknown.includes("not_a_real_token"), "unknown token is listed");
  assert(!unknown.includes("production_time"), "catalogued token is not unknown");

  const omitted = applyLegalTokens(
    "{{#shipping_lagos}}Lagos: {{shipping_lagos}}{{/shipping_lagos}} leftover",
    {},
    "public",
  ).html;
  assert(!omitted.includes("Lagos:"), "empty section is omitted");
  assert(!omitted.includes("{{"), "public mode strips leftover braces");
  assert(omitted.includes("leftover"), "surrounding copy remains");

  const line = formatLagosLocationLine({
    name: "Ikeja",
    etaText: "2-4 business days",
    price: 0,
    freeAboveNGN: 0,
  });
  assert(line === "Ikeja: 2-4 business days", "zero free-threshold is not published");
  assert(
    formatLagosLocationLine({ name: "VI", etaText: "", price: 0, freeAboveNGN: null }) === null,
    "a location with nothing to say is omitted",
  );

  const schema = src("prisma/schema.prisma");
  assert(schema.includes("legalTermsVersion"), "order and quotation store a terms version");
  assert(schema.includes("legalTermsSnapshot"), "order and quotation snapshot resolved tokens");
  assert(src("src/app/api/orders/create/route.ts").includes("legalTermsSnapshot"), "shop order snapshots at purchase");
  assert(src("src/app/api/quotations/[id]/send/route.ts").includes("legalTermsSnapshot"), "quotation snapshots at send");
  assert(
    src("src/lib/legal-tokens.ts").includes("Legally-significant setting changed"),
    "ActivityLog description names legally-significant settings",
  );
  assert(
    src("src/app/api/admin/settings/[group]/route.ts").includes("logLegallySignificantChange"),
    "settings PATCH logs legally-significant keys",
  );
}

function runPresentation() {
  const tpl = src("src/components/legal/LegalPageTemplate.tsx");
  assert(tpl.includes("glass-2"), "one glass-2 panel");
  assert(!tpl.includes("glass-2 glass-panel mx-auto max-w-[760px] px-8 py-10 text-center"), "title is not a second glass card");
  assert(tpl.includes("LegalToc"), "contents sit beside the article");
  assert(tpl.includes("legal-updated"), "last updated at the bottom");
  assert(tpl.includes("termsVersion"), "page shows the resolved terms version");

  const toc = src("src/components/legal/LegalToc.tsx");
  assert(toc.includes("legal-toc"), "contents list");
  assert(toc.includes("aria-current"), "active chapter is announced");

  const css = src("src/styles/globals.css");
  assert(css.includes("legal-shell--toc"), "sidebar layout");
  assert(css.includes("minmax(0, 68ch)"), "generous measure");

  const privacy = src("src/app/(storefront)/privacy-policy/page.tsx");
  assert(privacy.includes("loadLegalPage"), "privacy loads CMS + draft fallback");

  const redir = src("redirects.mjs");
  assert(redir.includes('source: "/legal/privacy"'), "old /legal/privacy is a 301");
  assert(redir.includes('destination: "/privacy-policy"'), "privacy 301 lands on the live policy");
  assert(redir.includes("permanent: true"), "moves are 301, not 307");

  const cms = src("src/lib/cms-config.ts");
  assert(cms.includes("legal_privacy_updated"), "last-updated is CMS-editable");

  const boot = src("src/lib/legal-bootstrap.ts");
  assert(boot.includes("LEGAL_COPY_REVISION"), "deploy can republish drafts");
  assert(boot.includes("legal_page_revision_"), "republish is per legal page");
  assert(boot.includes("alreadyPublishedAtThisRevision"), "matching revision does not overwrite lawyer edits");

  const welcome = src("src/emails/WelcomeCredentialsEmail.tsx");
  assert(welcome.includes("Paying an invoice"), "welcome email says paying opens the account");

  const pkg = src("package.json");
  assert(pkg.includes("test:slice-ar"), "package.json exposes the slice AR script");
}

function run() {
  runConverter();
  runFacts();
  runCookieConsent();
  runTokens();
  runPresentation();
  console.log("slice-ar: pass");
}

run();
