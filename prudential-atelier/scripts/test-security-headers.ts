/**
 * Slice AZ4 security headers and CSP reporting.
 *
 *   pnpm test:security-headers                                          # no network
 *   BASE_URL=https://staging.prudentgabriel.com pnpm test:security-headers
 */
import nextConfig from "../next.config.mjs";
import { CSP_REPORT_ONLY, HSTS, TOKEN_ROUTE_SOURCES } from "../security-headers.mjs";
import { parseCspReports } from "../src/lib/csp-report";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

type Rule = { source: string; headers: { key: string; value: string }[] };

/** Last matching rule wins per key, as Next.js applies them. */
async function headersFor(path: string): Promise<Record<string, string>> {
  const rules = (await nextConfig.headers!()) as Rule[];
  const out: Record<string, string> = {};
  for (const r of rules) {
    const prefix = r.source.replace("/:path*", "");
    const matches = r.source === "/:path*" || path === prefix || path.startsWith(`${prefix}/`);
    if (!matches) continue;
    for (const h of r.headers) out[h.key.toLowerCase()] = h.value;
  }
  return out;
}

async function unit() {
  const home = await headersFor("/");
  assert(home["content-security-policy-report-only"] === CSP_REPORT_ONLY, "CSP is report-only");
  assert(home["content-security-policy"] === "frame-ancestors 'self'", "enforced CSP carries only frame-ancestors");
  assert(home["x-frame-options"] === "SAMEORIGIN", "X-Frame-Options SAMEORIGIN");
  assert(home["strict-transport-security"] === HSTS && !/preload/.test(HSTS), "HSTS without preload");
  assert(home["x-content-type-options"] === "nosniff", "nosniff");
  assert(home["referrer-policy"] === "strict-origin-when-cross-origin", "default referrer policy");
  assert(/camera=\(self\)/.test(home["permissions-policy"]) && /geolocation=\(\)/.test(home["permissions-policy"]), "permissions policy");
  assert(/report-uri \/api\/csp-report/.test(CSP_REPORT_ONLY), "violations are reported");
  for (const origin of ["https://js.stripe.com", "https://hooks.stripe.com", "https://maps.google.com"]) {
    assert(CSP_REPORT_ONLY.includes(origin), `CSP allows ${origin}`);
  }
  for (const p of ["/invoice/abc", "/approve/abc", "/quote/abc", "/receipt/abc", "/track/abc", "/api/invoice/abc/pdf"]) {
    assert((await headersFor(p))["referrer-policy"] === "no-referrer", `${p} is no-referrer`);
  }
  assert((await headersFor("/shop/x"))["referrer-policy"] === "strict-origin-when-cross-origin", "shop keeps default referrer");
  assert(TOKEN_ROUTE_SOURCES.length >= 6, "token routes listed");
  assert(nextConfig.poweredByHeader === false, "X-Powered-By off");

  // Reports keep no token and no full URL.
  const legacy = parseCspReports({
    "csp-report": {
      "document-uri": "https://staging.prudentgabriel.com/invoice/SECRETTOKEN123?x=1",
      "violated-directive": "script-src-elem 'self'",
      "effective-directive": "script-src-elem",
      "blocked-uri": "https://evil.example/path/x.js?q=1",
    },
  });
  assert(legacy.length === 1, "legacy report parsed");
  assert(legacy[0].documentPath === "/invoice", `document path redacted (${legacy[0].documentPath})`);
  assert(legacy[0].blockedOrigin === "https://evil.example", "blocked URL reduced to origin");
  assert(!JSON.stringify(legacy).includes("SECRETTOKEN123"), "no token stored");
  const modern = parseCspReports([
    { type: "csp-violation", body: { documentURL: "https://x/track/T0K3N", effectiveDirective: "img-src", blockedURL: "data" } },
    { type: "deprecation", body: {} },
  ]);
  assert(modern.length === 1 && modern[0].documentPath === "/track" && modern[0].blockedOrigin === "data:", "reports+json parsed");
  assert(parseCspReports("nonsense").length === 0 && parseCspReports(null).length === 0, "junk ignored");
  console.log("ok unit: headers and report parsing");
}

async function live(base: string) {
  const res = await fetch(`${base}/`, { redirect: "manual" });
  const h = res.headers;
  assert(h.get("content-security-policy-report-only"), "live: CSP report-only present");
  assert(h.get("content-security-policy") === "frame-ancestors 'self'", "live: enforced frame-ancestors");
  assert(h.get("strict-transport-security") === HSTS, "live: HSTS");
  assert(h.get("x-content-type-options") === "nosniff", "live: nosniff");
  assert(h.get("x-frame-options") === "SAMEORIGIN", "live: X-Frame-Options");
  assert(h.get("permissions-policy"), "live: Permissions-Policy");
  assert(!h.get("x-powered-by"), "live: no X-Powered-By");
  const tok = await fetch(`${base}/invoice/zz-missing-token`, { redirect: "manual" });
  assert(tok.headers.get("referrer-policy") === "no-referrer", "live: token route no-referrer");
  const rep = await fetch(`${base}/api/csp-report`, {
    method: "POST",
    headers: { "content-type": "application/csp-report" },
    body: JSON.stringify({ "csp-report": { "document-uri": `${base}/zz-test`, "effective-directive": "img-src", "blocked-uri": "https://zz-test.invalid/x.png" } }),
  });
  assert(rep.status === 204, `live: csp-report → ${rep.status}`);
  console.log(`ok live ${new URL(base).host}`);
}

async function main() {
  await unit();
  const base = process.env.BASE_URL?.replace(/\/$/, "");
  if (base) await live(base);
  else console.log("skip live checks: set BASE_URL");
  console.log("OK test-security-headers");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
