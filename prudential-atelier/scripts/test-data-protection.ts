/**
 * NDPA 2023 / GDPR: cookie choice, token-free error logs, data retention.
 *
 *   pnpm test:data-protection      # unit (CI, no database)
 */
import "./preload-test-env";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  COOKIE_ACCEPT_ALL_LABEL,
  COOKIE_BANNER_NOTICE,
  COOKIE_ESSENTIAL_ONLY_LABEL,
  CURRENT_CONSENT_VERSION,
  hasAnalyticsConsent,
  parseCookieConsent,
} from "../src/lib/cookie-consent";
import { isOutsideNoise, isStaleChunkError, redactErrorUrl, redactTokensInText } from "../src/lib/report-client-error";
import {
  AUDIT_ACTIVITY_ACTIONS,
  CHECKOUT_SESSION_RETENTION_DAYS,
  ERROR_LOG_RETENTION_DAYS,
  FINANCIAL_EMAIL_TYPES,
  retentionCutoffs,
  retentionWhere,
} from "../src/lib/cron/jobs/data-retention";
import { CRON_CATALOG } from "../src/lib/cron/catalog";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const root = join(__dirname, "..");
const src = (rel: string) => readFileSync(join(root, rel), "utf8");

function cookieChoice() {
  assert(CURRENT_CONSENT_VERSION === "3.0", "banner with a real choice is version 3.0");
  assert(
    parseCookieConsent({ version: "2.1", timestamp: "2026-09-14T00:00:00.000Z", acknowledged: true }) === null,
    "a 2.x acknowledgement is not an analytics choice: banner shows again",
  );
  assert(
    parseCookieConsent({ version: "3.0", timestamp: "2026-10-15T00:00:00.000Z" }) === null,
    "no analytics flag, no choice",
  );
  const yes = parseCookieConsent({ version: "3.0", timestamp: "2026-10-15T00:00:00.000Z", analytics: true });
  const no = parseCookieConsent({ version: "3.0", timestamp: "2026-10-15T00:00:00.000Z", analytics: false });
  assert(yes?.analytics === true && no?.analytics === false, "both choices parse");
  assert(hasAnalyticsConsent() === false, "no window: no consent");
  assert(/No advertising trackers\.$/.test(COOKIE_BANNER_NOTICE), "banner says no advertising trackers");
  assert(COOKIE_ACCEPT_ALL_LABEL === "Accept all" && COOKIE_ESSENTIAL_ONLY_LABEL === "Essential only", "two choices");

  const banner = src("src/components/gdpr/CookieConsent.tsx");
  assert(banner.includes("COOKIE_ACCEPT_ALL_LABEL") && banner.includes("COOKIE_ESSENTIAL_ONLY_LABEL"), "banner offers both");
  assert(banner.includes("OPEN_COOKIE_SETTINGS_EVENT"), "banner can be reopened");
  assert(banner.includes("/cookie-policy"), "banner links the cookie policy");

  const beacon = src("src/components/analytics/PageBeacon.tsx");
  assert(beacon.includes("hasAnalyticsConsent()"), "beacon checks consent before posting");
  assert(beacon.includes("onConsentChange"), "beacon reacts to a change without reload");
  const attribution = src("src/lib/analytics/attribution.ts");
  assert(/holdAttribution[\s\S]*?hasAnalyticsConsent\(\)/.test(attribution), "visit tags are written only with consent");

  const contact = src("src/app/(storefront)/contact/page.tsx");
  assert(!contact.includes("<iframe"), "contact page does not load Google Maps by itself");
  assert(src("src/components/contact/ContactMap.tsx").includes("Open in Google Maps"), "plain map link offered");
}

function errorUrls() {
  const cases: [string, string][] = [
    ["https://prudentgabriel.com/invoice/abc123?pay=1#top", "https://prudentgabriel.com/invoice/:token"],
    ["https://prudentgabriel.com/track/tok/extra", "https://prudentgabriel.com/track/:token/extra"],
    ["https://prudentgabriel.com/auth/reset-password/tok", "https://prudentgabriel.com/auth/reset-password/:token"],
    ["https://prudentgabriel.com/auth/verify-email/tok", "https://prudentgabriel.com/auth/verify-email/:token"],
    ["https://prudentgabriel.com/checkout/restore/tok", "https://prudentgabriel.com/checkout/restore/:token"],
    ["https://prudentgabriel.com/consultation/book/tok", "https://prudentgabriel.com/consultation/book/:token"],
    ["https://prudentgabriel.com/api/quote/tok", "https://prudentgabriel.com/api/quote/:token"],
    ["/receipt/tok", "/receipt/:token"],
    ["/approve/tok", "/approve/:token"],
    ["/unsubscribe/tok", "/unsubscribe/:token"],
    ["https://prudentgabriel.com/accept-invite?token=secret", "https://prudentgabriel.com/accept-invite"],
    ["https://prudentgabriel.com/shop/invoice-dress", "https://prudentgabriel.com/shop/invoice-dress"],
    ["https://prudentgabriel.com/consultation/PG-123", "https://prudentgabriel.com/consultation/PG-123"],
  ];
  for (const [input, want] of cases) {
    const got = redactErrorUrl(input);
    assert(got === want, `redact ${input}: got ${got}, want ${want}`);
  }
  assert(
    redactTokensInText("Error at https://x.com/invoice/abc123 (page)") === "Error at https://x.com/invoice/:token (page)",
    "tokens quoted in a message are redacted",
  );
  assert(src("src/app/api/logs/client/route.ts").includes("redactErrorUrl"), "server redacts too");
  assert(src("src/app/api/logs/client/route.ts").includes("checkRateLimit"), "rate limit kept");
}

function errorNoise() {
  // Not the site: in-app browsers, extensions, dropped connections.
  assert(isOutsideNoise({ message: "Uncaught Error: Error invoking postMessage: Java object is gone" }), "Instagram/Facebook Android noise dropped");
  assert(isOutsideNoise({ message: "TypeError: undefined is not an object (evaluating 'window.webkit.messageHandlers')" }), "iOS in-app noise dropped");
  assert(isOutsideNoise({ message: "Uncaught TypeError: Cannot redefine property: ethereum" }), "wallet extension dropped");
  assert(isOutsideNoise({ message: "x", stack: "at chrome-extension://abc/inpage.js:1:1" }), "extension stack dropped");
  assert(isOutsideNoise({ message: "Failed to fetch" }) && isOutsideNoise({ message: "Load failed" }), "dropped connections dropped");
  // The site's own errors still reach the log.
  assert(!isOutsideNoise({ message: "Cannot read properties of undefined (reading 'price')", stack: "at https://prudentgabriel.com/_next/static/chunks/app.js:1:1" }), "real errors kept");
  assert(!isOutsideNoise({ message: "Minified React error #418" }), "React errors kept");
  assert(isStaleChunkError("Loading chunk 46338 failed.") && isStaleChunkError("ChunkLoadError") && !isStaleChunkError("Failed to fetch"), "stale chunks recognised");
  assert(src("src/app/api/logs/client/route.ts").includes("isOutsideNoise"), "server drops noise too");
}

function retention() {
  const now = new Date("2026-10-15T12:00:00.000Z");
  const c = retentionCutoffs(now);
  assert(c.enquiry.toISOString() === "2025-10-15T12:00:00.000Z", "enquiries: 12 months");
  assert(c.contactMessage.toISOString() === "2024-10-15T12:00:00.000Z", "contact messages: 24 months");
  assert(c.activityLogAudit.toISOString() === "2020-10-15T12:00:00.000Z", "audit activity: 6 years");
  assert(now.getTime() - c.errorLog.getTime() === ERROR_LOG_RETENTION_DAYS * 86_400_000, "error logs: 90 days");
  assert(now.getTime() - c.checkoutSession.getTime() === CHECKOUT_SESSION_RETENTION_DAYS * 86_400_000, "checkouts: 90 days");

  const w = retentionWhere(now);
  const json = JSON.stringify(w.enquiry);
  assert(json.includes('"DECLINED"') && !json.includes('"BOOKED"') && !json.includes('"PENDING"'), "only decided, unbooked enquiries");
  assert(w.enquiry.bookingId === null, "an enquiry with a booking is never deleted");
  assert(!JSON.stringify(w.jobApplication).includes("HIRED"), "hired applications are kept");
  assert(w.checkoutSession.orderId === null && w.checkoutSession.recoveredAt === null, "checkouts that became orders are kept");
  for (const t of ["Order", "Invoice", "Payment"]) assert(FINANCIAL_EMAIL_TYPES.includes(t), `${t} emails are kept`);
  assert(JSON.stringify(w.emailMessage).includes('"SENT"') && !JSON.stringify(w.emailMessage).includes("QUEUED"), "queued mail is never deleted");
  for (const a of ["DELETE", "LOGIN", "PAYMENT_CONFIRM"] as const) {
    assert(AUDIT_ACTIVITY_ACTIONS.includes(a), `${a} activity kept for the audit period`);
  }
  assert(w.customerNotification.isRead === true && w.staffNotification.isRead === true, "only read notifications go");

  const job = CRON_CATALOG.find((j) => j.name === "data-retention");
  assert(job?.migrated === true, "data-retention is a registered, migrated job");
  const source = src("src/lib/cron/jobs/data-retention.ts");
  for (const forbidden of ["prisma.order.", "prisma.payment.", "prisma.invoice.", "prisma.user.", "prisma.chatConversation.", "prisma.bespokeOrder."]) {
    assert(!source.includes(forbidden), `retention never touches ${forbidden}`);
  }
}

cookieChoice();
errorUrls();
errorNoise();
retention();
console.log("OK — cookie choice gates analytics, error URLs carry no tokens, retention rules hold");
