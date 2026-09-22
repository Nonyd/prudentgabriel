/**
 * Slice AZ6: a spoofed IP header does not buy a fresh rate-limit budget.
 *
 *   pnpm test:client-ip                                              # no network
 *   BASE_URL=https://staging.prudentgabriel.com pnpm test:client-ip  # live spoof burst
 */
import { clientIpFromHeaders, ipInCidr, isCloudflareIp } from "../src/lib/http/client-ip";
import { rateLimitOr429 } from "../src/lib/rate-limit";
import { prisma } from "../src/lib/prisma";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const hdrs = (h: Record<string, string>) => new Headers(h);

function unit() {
  // CIDR maths.
  assert(ipInCidr("104.16.0.1", "104.16.0.0/13") && !ipInCidr("104.24.0.1", "104.16.0.0/13"), "IPv4 CIDR");
  assert(ipInCidr("2606:4700:10::6816:1", "2606:4700::/32") && !ipInCidr("2607:4700::1", "2606:4700::/32"), "IPv6 CIDR");
  assert(ipInCidr("2a06:98c7::1", "2a06:98c0::/29") && !ipInCidr("2a06:98c8::1", "2a06:98c0::/29"), "IPv6 /29 boundary");
  assert(isCloudflareIp("172.64.1.1") && !isCloudflareIp("198.51.100.9"), "Cloudflare range check");

  // The client writes the LEFT of X-Forwarded-For; Traefik appends the peer on the right.
  assert(clientIpFromHeaders(hdrs({ "x-forwarded-for": "203.0.113.7, 198.51.100.9" })) === "198.51.100.9", "leftmost XFF ignored");
  // Came through Cloudflare: trust CF-Connecting-IP.
  assert(
    clientIpFromHeaders(hdrs({ "x-forwarded-for": "172.64.1.1", "cf-connecting-ip": "198.51.100.20" })) === "198.51.100.20",
    "Cloudflare peer → CF-Connecting-IP",
  );
  assert(
    clientIpFromHeaders(hdrs({ "x-forwarded-for": "2606:4700::1", "cf-connecting-ip": "2001:db8::5" })) === "2001:db8::5",
    "Cloudflare IPv6 peer → CF-Connecting-IP",
  );
  // Direct hit on the origin, forging Cloudflare's header: ignored.
  assert(
    clientIpFromHeaders(hdrs({ "x-forwarded-for": "198.51.100.9", "cf-connecting-ip": "1.2.3.4" })) === "198.51.100.9",
    "forged CF-Connecting-IP from a non-Cloudflare peer is ignored",
  );
  assert(clientIpFromHeaders(hdrs({ "x-real-ip": "198.51.100.3" })) === "198.51.100.3", "X-Real-IP fallback");
  assert(clientIpFromHeaders(hdrs({ "x-forwarded-for": "198.51.100.9:4431" })) === "198.51.100.9", "port stripped");
  assert(clientIpFromHeaders(hdrs({ "x-forwarded-for": "not-an-ip" })) === "unknown", "junk → unknown");
  console.log("ok unit: client IP resolution");
}

async function spoofDoesNotBypass() {
  const bucket = `spoof-test-${Date.now()}-${Math.random()}`;
  const peer = "198.51.100.77";
  const results: (number | null)[] = [];
  for (let i = 0; i < 3; i++) {
    const req = new Request("http://x/api", {
      headers: { "x-forwarded-for": `203.0.113.${i + 1}, ${peer}`, "cf-connecting-ip": `192.0.2.${i + 1}` },
    });
    const r = await rateLimitOr429(req, bucket, 2, 60_000);
    results.push(r ? r.status : null);
  }
  assert(results[0] === null && results[1] === null && results[2] === 429, `third spoofed request is limited (${JSON.stringify(results)})`);
  console.log("ok spoofed X-Forwarded-For / CF-Connecting-IP share the real peer's budget");
}

async function live(base: string) {
  // Only meaningful behind the real proxy: Traefik replaces X-Forwarded-For.
  // A bare local server has no proxy, so the header is exactly what we send.
  const host = new URL(base).hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    console.log("skip live spoof burst: needs a deployment behind Traefik (e.g. staging)");
    return;
  }
  // /api/invoice/<token> allows 60 per 15 min per client. Rotate spoofed headers on every request.
  const url = `${base}/api/invoice/zz-spoof-${Date.now()}`;
  let last = 0;
  for (let i = 0; i < 61; i++) {
    const res = await fetch(url, {
      headers: { "x-forwarded-for": `203.0.113.${(i % 250) + 1}`, "cf-connecting-ip": `192.0.2.${(i % 250) + 1}` },
    });
    last = res.status;
    await res.arrayBuffer();
  }
  assert(last === 429, `live: 61st request with rotating spoofed headers → ${last}, expected 429`);
  console.log(`ok live ${new URL(base).host}: rotating spoofed headers still hit 429`);
}

async function main() {
  unit();
  await spoofDoesNotBypass();
  const base = process.env.BASE_URL?.replace(/\/$/, "");
  if (base) await live(base);
  else console.log("skip live checks: set BASE_URL");
  console.log("OK test-client-ip");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
