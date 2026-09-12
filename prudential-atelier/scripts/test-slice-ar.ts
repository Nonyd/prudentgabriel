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
  PRIVACY_POLICY_MD,
  RETURNS_MD,
  SHIPPING_MD,
  TERMS_MD,
  extractLegalToc,
  legalMdToHtml,
} from "../src/lib/legal-copy";
import { FABRIC_POLICY_COPY, MADE_TO_MEASURE_REASON, STANDARD_SIZE_COPY } from "../src/lib/production-time";
import { sanitizeCmsHtml } from "../src/lib/sanitize-html";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (rel: string) => readFileSync(join(root, rel), "utf8");

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
  assert(LEGAL_COPY_REVISION === "ar-3", "revision stamp");
  assert(DEFAULT_LEGAL_UPDATED.includes("September 2026"), "last-updated date is this slice");

  for (const term of DEFAULT_HOUSE_DOCUMENT_TERMS) {
    assert(TERMS_MD.includes(term.body), `terms include invoice term: ${term.key}`);
    if (term.key === "refunds") {
      assert(RETURNS_MD.includes(term.body), "returns page includes the refunds house term");
    }
    if (term.key === "shipping") {
      assert(SHIPPING_MD.includes(term.body), "shipping page includes the shipping house term");
    }
  }

  assert(RETURNS_MD.includes(STANDARD_SIZE_COPY), "returns uses AG standard-size copy");
  assert(RETURNS_MD.includes(MADE_TO_MEASURE_REASON), "returns uses AG made-to-measure reason");
  assert(RETURNS_MD.includes(FABRIC_POLICY_COPY), "returns uses 48-hour fabric copy");
  assert(TERMS_MD.includes(STANDARD_SIZE_COPY), "terms agree with PDP on standard size");
  assert(TERMS_MD.includes(MADE_TO_MEASURE_REASON), "terms agree with PDP on made to measure");
  assert(TERMS_MD.includes(FABRIC_POLICY_COPY), "terms agree on fabric");

  assert(TERMS_MD.includes("Nothing is held in stock"), "made to order");
  assert(TERMS_MD.includes("7-12 days"), "production window");
  assert(TERMS_MD.includes("Shipping time is separate"), "shipping is extra");
  assert(TERMS_MD.includes("70 percent"), "deposit default matches CMS");
  assert(TERMS_MD.includes("thirteen stages"), "atelier stages");
  assert(TERMS_MD.includes("Design approval"), "approval gate");
  assert(TERMS_MD.includes("30-day alteration"), "alteration window");
  assert(TERMS_MD.includes("revalues every outstanding balance"), "points rate change");
  assert(TERMS_MD.includes("not returned for cash"), "points are not cash");
  assert(TERMS_MD.includes("two years"), "points expiry");
  assert(TERMS_MD.includes("DDU"), "DDU in terms");
  assert(TERMS_MD.includes("courts of Lagos State"), "governing law");
  assert(TERMS_MD.includes("Federal Competition and Consumer Protection Act 2018"), "FCCPA");

  assert(PRIVACY_POLICY_MD.includes("Nigeria Data Protection Act 2023"), "NDPA");
  assert(PRIVACY_POLICY_MD.includes("bust, waist, hip"), "measurements named");
  assert(PRIVACY_POLICY_MD.includes("cut your garment"), "measurements purpose");
  assert(PRIVACY_POLICY_MD.includes("private media"), "receipts are private");
  assert(PRIVACY_POLICY_MD.includes("seven days"), "signed receipt TTL");
  assert(PRIVACY_POLICY_MD.includes("CV"), "careers files");
  assert(PRIVACY_POLICY_MD.includes("impersonate") || PRIVACY_POLICY_MD.includes("viewing the site as you"), "impersonation");
  assert(PRIVACY_POLICY_MD.includes("Paystack"), "Paystack named");
  assert(PRIVACY_POLICY_MD.includes("Open Exchange Rates"), "FX source named");
  assert(PRIVACY_POLICY_MD.includes("opens an account"), "guest onboarding");
  assert(PRIVACY_POLICY_MD.includes("hello@prudentgabriel.com"), "real email");
  assert(PRIVACY_POLICY_MD.includes("Akinwale Shitu"), "real Lagos address");
  assert(PRIVACY_POLICY_MD.includes("statutory period"), "financial retention is statutory, not invented");
  assert(!PRIVACY_POLICY_MD.includes("UK GDPR"), "do not claim UK GDPR as a done fact");
  assert(!PRIVACY_POLICY_MD.includes("Vercel"), "hosting claim matches current VPS, not old Vercel copy");

  assert(COOKIE_MD.includes("Reject Non-Essential"), "banner wording");
  assert(COOKIE_MD.includes("pa-cart"), "cart storage named");
  assert(COOKIE_MD.includes("pa-currency"), "currency storage named");
  assert(COOKIE_MD.includes("pg_cookie_consent"), "consent key named");
  assert(COOKIE_MD.includes("does not currently load Google Analytics"), "analytics honesty");
  assert(COOKIE_MD.includes("pg_admin_impersonate"), "admin impersonation cookie");

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
  }
}

function runPresentation() {
  const tpl = src("src/components/legal/LegalPageTemplate.tsx");
  assert(tpl.includes("glass-2"), "one glass-2 panel");
  assert(!tpl.includes("glass-2 glass-panel mx-auto max-w-[760px] px-8 py-10 text-center"), "title is not a second glass card");
  assert(tpl.includes("legal-toc"), "contents list");
  assert(tpl.includes("legal-updated"), "last updated at the bottom");
  assert(tpl.includes("max-w-[68ch]"), "generous measure");

  const privacy = src("src/app/(storefront)/privacy-policy/page.tsx");
  assert(privacy.includes("loadLegalPage"), "privacy loads CMS + draft fallback");

  const redir = src("src/app/(storefront)/legal/privacy/page.tsx");
  assert(redir.includes('redirect("/privacy-policy")'), "old /legal/privacy redirects");

  const cms = src("src/lib/cms-config.ts");
  assert(cms.includes("legal_privacy_updated"), "last-updated is CMS-editable");

  const boot = src("src/lib/legal-bootstrap.ts");
  assert(boot.includes("LEGAL_COPY_REVISION"), "deploy can republish drafts");

  const welcome = src("src/emails/WelcomeCredentialsEmail.tsx");
  assert(welcome.includes("Paying an invoice"), "welcome email says paying opens the account");

  const pkg = src("package.json");
  assert(pkg.includes("test:slice-ar"), "package.json exposes the slice AR script");
}

function run() {
  runConverter();
  runFacts();
  runPresentation();
  console.log("slice-ar: pass");
}

run();
