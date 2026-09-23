/**
 * Public capability-token routes and pages are rate limited per IP.
 * No database.
 *
 *   pnpm test:token-rate-limits
 */
import fs from "node:fs";
import path from "node:path";
import { checkRateLimit, rateLimitOr429 } from "../src/lib/rate-limit";
import { prisma } from "../src/lib/prisma";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const root = path.join(__dirname, "..");
const src = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

/** Every exported handler in these files must call the limiter before doing work. */
const API_ROUTES = [
  "src/app/api/invoice/[token]/route.ts",
  "src/app/api/invoice/[token]/pay/route.ts",
  "src/app/api/invoice/[token]/pdf/route.ts",
  "src/app/api/invoice/[token]/bank-transfer/route.ts",
  "src/app/api/invoice/[token]/email-copy/route.ts",
  "src/app/api/invoice/[token]/receipt/route.ts",
  "src/app/api/approve/[token]/route.ts",
  "src/app/api/receipt/[token]/confirm/route.ts",
  "src/app/api/receipt/[token]/alterations/route.ts",
  "src/app/api/quote/[token]/pdf/route.ts",
  "src/app/api/quotations/[id]/approve/route.ts",
  "src/app/api/track/[token]/route.ts",
  "src/app/api/unsubscribe/[token]/route.ts",
  // Token sweep.
  "src/app/api/checkout/restore/[token]/route.ts",
  "src/app/api/auth/accept-invite/route.ts",
  "src/app/api/track/lookup/route.ts",
];

const PAGES = [
  "src/app/invoice/[token]/page.tsx",
  "src/app/approve/[token]/page.tsx",
  "src/app/quote/[approvalToken]/page.tsx",
  "src/app/receipt/[token]/page.tsx",
  "src/app/(storefront)/track/[trackingToken]/page.tsx",
  // Token sweep.
  "src/app/unsubscribe/[token]/page.tsx",
  "src/app/accept-invite/page.tsx",
];

function handlerBodies(code: string): { method: string; body: string }[] {
  const out: { method: string; body: string }[] = [];
  const re = /export async function (GET|POST|PUT|PATCH|DELETE)\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    const start = code.indexOf("{", code.indexOf(")", m.index + m[0].length));
    out.push({ method: m[1], body: code.slice(start, start + 400) });
  }
  return out;
}

async function main() {
  for (const rel of API_ROUTES) {
    const handlers = handlerBodies(src(rel));
    assert(handlers.length > 0, `${rel} has handlers`);
    for (const h of handlers) {
      // unsubscribe GET only redirects to the page; it never looks the token up.
      if (rel.includes("unsubscribe") && h.method === "GET") continue;
      assert(/rateLimitOr429\(/.test(h.body), `${rel} ${h.method} is rate limited`);
    }
  }

  for (const rel of PAGES) {
    const code = src(rel);
    const fn = code.slice(code.indexOf("export default async function"));
    const limitAt = fn.indexOf("tokenPageRateLimited(");
    const lookupAt = fn.search(/find\w+By\w+Token\(|loadPublic\w+\(/);
    assert(limitAt >= 0, `${rel} is rate limited`);
    assert(lookupAt < 0 || limitAt < lookupAt, `${rel} limits before the token lookup`);
  }

  // Limiter behaviour: blocks at the limit, separates buckets and IPs.
  // With DATABASE_URL unreachable (CI) this exercises the per-process fallback;
  // against a database it exercises RateLimitBucket.
  const key = `test:${Date.now()}:${Math.random()}`;
  for (let i = 0; i < 3; i++) assert((await checkRateLimit(key, 3, 60_000)).ok, `request ${i + 1} allowed`);
  const blocked = await checkRateLimit(key, 3, 60_000);
  assert(!blocked.ok && blocked.retryAfterSec > 0, "4th request blocked with Retry-After");

  const req = (ip: string) => new Request("http://x/api", { headers: { "x-real-ip": ip } });
  const bucket = `test-bucket-${Date.now()}-${Math.random()}`;
  assert((await rateLimitOr429(req("1.1.1.1"), bucket, 1, 60_000)) === null, "first request passes");
  const res = await rateLimitOr429(req("1.1.1.1"), bucket, 1, 60_000);
  assert(res?.status === 429 && res.headers.get("Retry-After"), "second request is 429 with Retry-After");
  assert((await rateLimitOr429(req("2.2.2.2"), bucket, 1, 60_000)) === null, "another IP has its own budget");

  console.log("OK test-token-rate-limits");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
