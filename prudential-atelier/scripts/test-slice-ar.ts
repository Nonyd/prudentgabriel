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
  COOKIE_ACCEPT_ALL_LABEL,
  COOKIE_ESSENTIAL_ONLY_LABEL,
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
  points_atelier_per_hundred: "2",
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
  company_name: "Prudential Atelier Limited",
  company_rc: "1234567",
  privacy_email: "privacy@prudentgabriel.com",
  return_window_days: "7",
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
  // ND-1: every page was rewritten for NDPA 2023 + GDPR. ND-2: the cookie list
  // gained the stale-page reload marker. ND-3: privacy and cookie name the site-traffic
  // counts (country, device, return visits). The copy stamp is the newest page stamp.
  assert(LEGAL_COPY_REVISION === "nd-3", "revision stamp");
  assert(DEFAULT_LEGAL_UPDATED.includes("October 2026"), "last-updated date is this slice");
  const byPage = Object.fromEntries(LEGAL_SEED_ENTRIES.map((e) => [e.page, e.revision]));
  assert(
    (["terms", "returns", "shipping"] as const).every((p) => byPage[p] === "nd-1") &&
      byPage.privacy === "nd-3" &&
      byPage.cookie === "nd-3",
    "every legal page carries the ND rewrite; privacy and cookie are at nd-3",
  );

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

  // ND-1 words the legal pages in full sentences rather than pasting the PDP lines, so check
  // they make the same promise as the PDP (STANDARD_SIZE_COPY / MADE_TO_MEASURE_REASON / fabric).
  assert(STANDARD_SIZE_COPY.includes("another woman can wear a standard size"), "PDP standard-size reason is unchanged");
  assert(MADE_TO_MEASURE_REASON.includes("cannot be returned for a change of mind"), "PDP made-to-measure reason is unchanged");
  assert(
    /standard-size ready-to-wear piece within \*\*\{\{return_window_days\}\} days\*\* of delivery/.test(RETURNS_MD),
    "returns agree with PDP: a standard size is returnable (window is a token)",
  );
  assert(
    /made to your measurements[^]*cannot be worn by anyone else[^]*cannot be returned for a change of mind/.test(RETURNS_MD),
    "returns agree with PDP: made to measure is not returnable for a change of mind, for the same reason",
  );
  assert(RETURNS_MD.includes("{{fabric_promise_hours}}"), "returns uses fabric-hours token");
  const fabricPromise = /fabric for your piece becomes unavailable[^.]*offer an alternative or a full refund within 48 hours/;
  assert(fabricPromise.test(resolved(RETURNS_MD)), "resolved returns match 48-hour fabric copy");
  assert(FABRIC_POLICY_COPY.includes("alternative or a refund within 48 hours"), "PDP fabric copy makes the same promise");
  assert(
    TERMS_MD.includes("size chart") && TERMS_MD.includes("Because another woman can wear a standard size, it can be returned"),
    "terms agree with PDP on standard size",
  );
  assert(
    /Cut to the measurements you give us[^]*cannot be worn by anyone else, so it cannot be returned for a change of mind/.test(TERMS_MD),
    "terms agree with PDP on made to measure",
  );
  assert(fabricPromise.test(resolved(TERMS_MD)), "resolved terms agree on fabric");

  assert(TERMS_MD.includes("We do not hold finished stock") && TERMS_MD.includes("cut and made after you order it"), "made to order");
  assert(TERMS_MD.includes("{{production_time}}"), "production window is a token");
  assert(TERMS_MD.includes("Delivery time is in addition to that"), "shipping is extra");
  assert(!TERMS_MD.includes("70 percent") && !TERMS_MD.includes("70%"), "deposit is not a typed house-wide percent");
  assert(TERMS_MD.includes("the deposit stated on your quotation"), "deposit is per quotation");
  assert(TERMS_MD.includes("thirteen stages"), "atelier stages");
  assert(
    TERMS_MD.includes("design approval") && TERMS_MD.includes("we do not move past those stages until you have"),
    "approval gate",
  );
  assert(TERMS_MD.includes("{{alteration_warranty_days}}"), "alteration window is a token");
  assert(
    TERMS_MD.includes("including the value of a point") && TERMS_MD.includes("Points already used on an order keep the value they had then"),
    "points rate change: the value of a point can change; points already spent keep their locked value",
  );
  assert(
    TERMS_MD.includes("are not refunded as money") && TERMS_MD.includes("the points go back to your balance"),
    "points are not cash",
  );
  assert(TERMS_MD.includes("{{points_expiry_months}}"), "points expiry is a token");
  assert(
    TERMS_MD.includes("International orders are sent duties unpaid") && TERMS_MD.includes("payable by the recipient"),
    "DDU in terms",
  );
  assert(TERMS_MD.includes("courts of Lagos State"), "governing law");
  assert(TERMS_MD.includes("Federal Competition and Consumer Protection Act 2018"), "FCCPA");

  assert(PRIVACY_POLICY_MD.includes("Nigeria Data Protection Act 2023"), "NDPA");
  assert(PRIVACY_POLICY_MD.includes("bust, waist, hip"), "measurements named");
  assert(PRIVACY_POLICY_MD.includes("use your measurements only to cut and make your pieces"), "measurements purpose");
  assert(PRIVACY_POLICY_MD.includes("not used for marketing and are never shown on the public site"), "measurements are not marketing or public");
  assert(
    PRIVACY_POLICY_MD.includes("private files (receipts") && PRIVACY_POLICY_MD.includes("refused on any public address"),
    "receipts are private",
  );
  assert(PRIVACY_POLICY_MD.includes("{{receipt_link_days}}"), "signed receipt TTL is a token");
  assert(PRIVACY_POLICY_MD.includes("CV"), "careers files");
  assert(
    PRIVACY_POLICY_MD.includes("viewing the site as you") && PRIVACY_POLICY_MD.includes("every such visit is logged"),
    "impersonation is disclosed and logged",
  );
  // FX: Open Exchange Rates receives no personal data, so ND-1 rightly leaves it out of
  // "Who we share it with". What the policy must name is every provider that does receive it.
  for (const provider of ["Paystack", "Flutterwave", "Monnify", "Stripe", "Resend", "Brevo", "Contabo", "Cloudflare", "Google", "GIG", "DHL"]) {
    assert(PRIVACY_POLICY_MD.includes(provider), `${provider} named`);
  }
  assert(
    PRIVACY_POLICY_MD.includes("without an account, we open an account for that email address"),
    "guest onboarding",
  );
  assert(PRIVACY_POLICY_MD.includes("[{{privacy_email}}](mailto:{{privacy_email}})"), "data protection contact email is a token");
  assert(PRIVACY_POLICY_MD.includes("{{contact_address}}"), "contact address is a token");
  assert(PRIVACY_POLICY_MD.includes("{{company_name}}"), "controller name is a token");
  assert(resolved(PRIVACY_POLICY_MD).includes(FIXTURE_TOKENS.privacy_email!), "resolved privacy uses the privacy contact email");
  assert(
    PRIVACY_POLICY_MD.includes("six years after the end of the financial year") &&
      PRIVACY_POLICY_MD.includes("as Nigerian tax and company law requires"),
    "financial retention is statutory, not invented",
  );
  // UK GDPR may be named only as a condition (customers there), never as a blanket claim.
  assert(
    PRIVACY_POLICY_MD.includes("Where you are in the European Union or the United Kingdom and we sell to you there, we also follow"),
    "UK/EU GDPR is claimed only for customers there",
  );
  assert(!/(compliant|certified) (with|under) (the )?(UK )?GDPR/i.test(PRIVACY_POLICY_MD), "no blanket GDPR compliance claim");
  assert(!PRIVACY_POLICY_MD.includes("Vercel"), "hosting claim matches current VPS, not old Vercel copy");

  assert(COOKIE_MD.includes("{{cookie_banner_notice}}"), "cookie policy uses the same banner sentence");
  // ND-1: privacy links the cookie policy and describes analytics as consent-only, matching the banner.
  assert(PRIVACY_POLICY_MD.includes("[Cookie Policy](/cookie-policy)"), "privacy points to the cookie policy");
  assert(
    PRIVACY_POLICY_MD.includes("If you accept analytics, we count page visits in aggregate") &&
      PRIVACY_POLICY_MD.includes("we do not use advertising trackers"),
    "privacy cookie paragraph agrees with the banner (analytics only with consent, no advertising trackers)",
  );
  assert(resolved(COOKIE_MD).includes(COOKIE_BANNER_NOTICE), "resolved cookie policy matches the banner");
  assert(resolved(COOKIE_MD).includes(ESSENTIAL_CART_STORAGE_KEY), "resolved cookie policy names the bag key");
  assert(resolved(COOKIE_MD).includes(ESSENTIAL_CURRENCY_STORAGE_KEY), "resolved cookie policy names the currency key");
  assert(COOKIE_MD.includes("{{cookie_cart_key}}"), "bag key is a token");
  assert(COOKIE_MD.includes("{{cookie_currency_key}}"), "currency key is a token");
  assert(COOKIE_MD.includes("{{cookie_consent_key}}"), "consent key is a token");
  assert(
    COOKIE_MD.includes("**Essential only**") && COOKIE_MD.includes("**Accept all**") && COOKIE_MD.includes("**Cookie settings**"),
    "policy describes both banner choices and how to change them",
  );
  assert(COOKIE_MD.includes("no Google Analytics, no Meta Pixel"), "analytics honesty");
  assert(COOKIE_MD.includes("pg_admin_impersonate"), "admin impersonation cookie");
  const essentialSection = COOKIE_MD.slice(COOKIE_MD.indexOf("## Essential"), COOKIE_MD.indexOf("## Analytics"));
  assert(essentialSection.includes("**Your bag** (**{{cookie_cart_key}}**"), "bag is classified essential");
  assert(essentialSection.includes("**Your currency** (**{{cookie_currency_key}}**"), "currency is classified essential");
  assert(essentialSection.includes("the price you see is the price at checkout"), "currency says why it is essential");

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
  // ND-1 bumped 2.1 -> 3.0: the banner is now a real choice (Accept all / Essential only).
  assert(CURRENT_CONSENT_VERSION === "3.0", "consent version bumps with the banner wording");
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
  assert(
    parseCookieConsent({ version: "2.1", timestamp: "2026-09-14T00:00:00.000Z", acknowledged: true }) === null,
    "a 2.x notice-only acknowledgement carries no analytics choice, so the banner shows again",
  );
  const ok = parseCookieConsent({ version: "3.0", timestamp: "2026-10-15T00:00:00.000Z", analytics: true });
  assert(ok?.version === "3.0" && ok.analytics === true, "current choice (Accept all) is accepted");
  const essentialOnly = parseCookieConsent({ version: "3.0", timestamp: "2026-10-15T00:00:00.000Z", analytics: false });
  assert(essentialOnly?.analytics === false, "Essential only is a stored choice, not a missing one");
  assert(
    parseCookieConsent({ version: "3.0", timestamp: "2026-10-15T00:00:00.000Z" }) === null &&
      parseCookieConsent({ version: "3.0", timestamp: "2026-10-15T00:00:00.000Z", analytics: "yes" }) === null,
    "a record without a boolean analytics choice is not a choice",
  );
  assert(
    ok !== null && Object.keys(ok).sort().join(",") === "analytics,timestamp,version",
    "stored shape is exactly {version, timestamp, analytics}: no marketing or functional flags",
  );

  const consentSrc = src("src/lib/cookie-consent.ts");
  assert(!consentSrc.includes("acceptAllConsent"), "old accept-all helper is gone (saveCookieConsent records both choices)");
  assert(!consentSrc.includes("rejectNonEssentialConsent"), "old reject helper is gone");
  assert(consentSrc.includes("export function saveCookieConsent(analytics: boolean)"), "one helper saves either choice");
  assert(consentSrc.includes("export function hasAnalyticsConsent"), "analytics code asks one helper for consent");
  assert(consentSrc.includes("export function openCookieSettings"), "the choice can be reopened");
  assert(COOKIE_ACCEPT_ALL_LABEL === "Accept all" && COOKIE_ESSENTIAL_ONLY_LABEL === "Essential only", "banner choice labels");
  const footer = src("src/components/public/Footer.tsx");
  assert(footer.includes("onClick={openCookieSettings}"), "footer Cookie settings link reopens the choice");
  assert(!consentSrc.includes("functional:"), "no functional flag in consent module");
  assert(consentSrc.includes("ESSENTIAL_CART_STORAGE_KEY"), "bag key is classified essential in code");
  assert(consentSrc.includes("ESSENTIAL_CURRENCY_STORAGE_KEY"), "currency key is classified essential in code");

  const cart = src("src/store/cartStore.ts");
  const currency = src("src/store/currencyStore.ts");
  assert(cart.includes("ESSENTIAL_CART_STORAGE_KEY"), "cart persist uses the essential key");
  assert(currency.includes("ESSENTIAL_CURRENCY_STORAGE_KEY"), "currency persist uses the essential key");

  const banner = src("src/components/gdpr/CookieConsent.tsx");
  assert(banner.includes("COOKIE_BANNER_NOTICE"), "banner copy comes from the shared constant");
  assert(
    /onClick=\{\(\) => choose\(false\)\}[^]*?\{COOKIE_ESSENTIAL_ONLY_LABEL\}/.test(banner) &&
      /onClick=\{\(\) => choose\(true\)\}[^]*?\{COOKIE_ACCEPT_ALL_LABEL\}/.test(banner),
    "two choices: Essential only and Accept all",
  );
  assert(banner.includes("saveCookieConsent(analytics)"), "the banner stores the choice");
  assert(banner.includes("/cookie-policy"), "banner links the cookie policy");
  assert(!banner.includes("Reject Non-Essential"), "no old reject button");
  assert(!banner.includes("Accept All"), "no old accept-all wording");
  assert(!banner.includes("Cookie Settings"), "no settings panel button on the banner (the footer link reopens the banner)");
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
  assert(/opens when you pay\s+an invoice/.test(welcome), "welcome email says paying opens the account");

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
