/**
 * Security headers (Slice AZ4). Plain ESM so next.config.mjs and tests share it.
 *
 * CSP ships REPORT-ONLY: Stripe loads its own scripts and frames, Paystack /
 * Flutterwave / Monnify redirect to hosted pages, and the contact page embeds
 * Google Maps. Violations land in /api/csp-report (aggregated by directive and
 * blocked origin in CspViolation). Enforce only once those reports show every
 * origin the site needs.
 *
 * frame-ancestors is ignored inside a report-only policy, so it is sent in a
 * separate, enforced CSP. It is 'self', not 'none': the admin frames our own
 * receipt files (AdminBankTransferProof), which 'none' would break.
 */

export const CSP_REPORT_PATH = "/api/csp-report";

/** Only Stripe injects third-party script and frames; the other gateways redirect. */
const STRIPE = ["https://js.stripe.com", "https://*.js.stripe.com"];

export const CSP_REPORT_ONLY = [
  "default-src 'self'",
  // Next.js App Router hydrates with inline scripts; nonces are a later step.
  `script-src 'self' 'unsafe-inline' ${STRIPE.join(" ")}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "media-src 'self' blob: data:",
  "connect-src 'self' https://api.stripe.com https://maps.googleapis.com",
  `frame-src 'self' ${STRIPE.join(" ")} https://hooks.stripe.com https://maps.google.com https://www.google.com`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
  "frame-ancestors 'self'",
  `report-uri ${CSP_REPORT_PATH}`,
].join("; ");

/** Enforced today: only what cannot break a page. */
export const CSP_ENFORCED = "frame-ancestors 'self'";

export const PERMISSIONS_POLICY = [
  "camera=(self)", // staff QR clock-in (QRScanner)
  "microphone=()",
  "geolocation=()",
  'payment=(self "https://js.stripe.com")', // Stripe wallets
  "usb=()",
  "browsing-topics=()",
].join(", ");

/** One year, no preload, no includeSubDomains (not every subdomain is known to be HTTPS). */
export const HSTS = "max-age=31536000";

/** Routes whose URL is a capability: the token must never leave in a Referer. */
export const TOKEN_ROUTE_SOURCES = [
  "/invoice/:path*",
  "/approve/:path*",
  "/quote/:path*",
  "/receipt/:path*",
  "/track/:path*",
  "/unsubscribe/:path*",
  "/checkout/restore/:path*",
  "/api/invoice/:path*",
  "/api/approve/:path*",
  "/api/quote/:path*",
  "/api/receipt/:path*",
  "/api/track/:path*",
  "/api/unsubscribe/:path*",
];

/** @returns {{ source: string; headers: { key: string; value: string }[] }[]} */
export function securityHeaderRules() {
  return [
    {
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy-Report-Only", value: CSP_REPORT_ONLY },
        { key: "Content-Security-Policy", value: CSP_ENFORCED },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "Strict-Transport-Security", value: HSTS },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
      ],
    },
    // Later rules win for the same key (Next.js headers()), so this overrides the global Referrer-Policy.
    ...TOKEN_ROUTE_SOURCES.map((source) => ({
      source,
      headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
    })),
  ];
}
