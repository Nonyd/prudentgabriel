/**
 * Missing things return a real HTTP 404 with a single `noindex` — not a 200
 * rendering the not-found UI (the soft 404 found in docs/VERIFICATION_2026-09.md).
 *
 *   pnpm test:not-found-status                              # static guard only
 *   BASE_URL=http://localhost:3000 pnpm test:not-found-status
 *   BASE_URL=https://staging.prudentgabriel.com pnpm test:not-found-status
 *
 * Against localhost it also checks an unpublished product and an expired
 * tracking token, using a short-lived fixture in the local DATABASE_URL.
 * Never point BASE_URL at production.
 */
import "./preload-test-env";
import { readFileSync } from "node:fs";
import path from "node:path";
import { BespokeStage, OrderStatus, Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { generateCapabilityToken } from "../src/lib/capability-token";
import { generateBespokeOrderRef } from "../src/lib/bespoke-stages";
import { looksLikeProductionDatabase } from "./fixture-guard";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const root = path.join(__dirname, "..");
const src = (rel: string) => readFileSync(path.join(root, rel), "utf8");

/** The regression: a client component wrapping the page tree in the root layout. */
function staticGuard() {
  const layout = src("src/app/layout.tsx");
  assert(!/<SmoothScroll>/.test(layout), "root layout renders <SmoothScroll /> beside children, not around them");
  assert(!/robots:\s*\{\s*index:\s*true/.test(layout), "root metadata sets no robots directive");
  for (const dir of [
    "src/app/invoice/[token]",
    "src/app/approve/[token]",
    "src/app/quote/[approvalToken]",
    "src/app/receipt/[token]",
    "src/app/(storefront)/track/[trackingToken]",
  ]) {
    const page = src(`${dir}/page.tsx`);
    assert(!page.includes("CapabilityExpiredPage"), `${dir} does not render the expired page with a 200`);
    assert(src(`${dir}/not-found.tsx`).length > 0, `${dir} has its own not-found.tsx`);
  }
  console.log("ok static guard");
}

async function fetchStatus(base: string, p: string) {
  const res = await fetch(base + p, { redirect: "manual" });
  const html = await res.text();
  const robots = Array.from(html.matchAll(/<meta name="robots" content="([^"]*)"/g), (m) => m[1]);
  const canonical = /<link rel="canonical"/.test(html);
  return { status: res.status, robots, canonical };
}

async function expect404(base: string, p: string) {
  const r = await fetchStatus(base, p);
  assert(r.status === 404, `${p} → ${r.status}, expected 404`);
  assert(r.robots.length === 1 && r.robots[0] === "noindex", `${p} has one robots tag, noindex (got ${JSON.stringify(r.robots)})`);
  assert(!r.canonical, `${p} carries no canonical`);
  console.log(`ok 404 ${p}`);
}

async function http(base: string) {
  const host = new URL(base).hostname;
  assert(host !== "prudentgabriel.com" && host !== "www.prudentgabriel.com", "BASE_URL must not be production");

  const missing = `zz-missing-${Date.now()}`;
  await expect404(base, `/shop/${missing}`);
  await expect404(base, `/collections/${missing}`);
  await expect404(base, `/journal/${missing}`);
  for (const route of ["invoice", "approve", "quote", "receipt", "track"]) {
    await expect404(base, `/${route}/${missing}`);
  }

  const home = await fetchStatus(base, "/");
  assert(home.status === 200, `/ → ${home.status}, expected 200`);

  const list = (await (await fetch(`${base}/api/products?limit=1`)).json()) as { products?: { slug: string }[] };
  const live = list.products?.[0]?.slug;
  assert(live, "a published product exists to compare against");
  const pdp = await fetchStatus(base, `/shop/${live}`);
  assert(pdp.status === 200, `/shop/${live} → ${pdp.status}, expected 200`);
  console.log(`ok 200 / and /shop/${live}`);

  if (!["localhost", "127.0.0.1"].includes(host)) {
    console.log("skip unpublished / expired-token checks: they need the server's own database (localhost only)");
    return;
  }
  assert(!looksLikeProductionDatabase(), "DATABASE_URL must not be production");

  const unpublished = await prisma.product.findFirst({ where: { isPublished: false }, select: { slug: true } });
  assert(unpublished, "local database has an unpublished product");
  await expect404(base, `/shop/${unpublished.slug}`);

  const email = `nf-status-${Date.now()}@example.com`;
  const user = await prisma.user.create({ data: { email, name: "NF Status", role: Role.CUSTOMER, password: "x" } });
  const profile = await prisma.clientProfile.create({ data: { userId: user.id } });
  const token = generateCapabilityToken();
  const order = await prisma.bespokeOrder.create({
    data: {
      orderRef: generateBespokeOrderRef(),
      clientProfileId: profile.id,
      clientName: "NF Status",
      clientEmail: email,
      currentStage: BespokeStage.FINAL_FITTING,
      status: OrderStatus.PROCESSING,
      totalAmount: 100_000,
      balance: 0,
      trackingToken: token.hash,
      trackingTokenEnc: token.enc,
      trackingTokenExpiresAt: new Date(Date.now() - 60_000),
    },
  });
  try {
    await expect404(base, `/track/${token.raw}`);
  } finally {
    await prisma.bespokeOrder.delete({ where: { id: order.id } });
    await prisma.clientProfile.delete({ where: { id: profile.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
}

async function main() {
  staticGuard();
  const base = process.env.BASE_URL?.replace(/\/$/, "");
  if (base) await http(base);
  else console.log("skip HTTP checks: set BASE_URL");
  console.log("OK test-not-found-status");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
