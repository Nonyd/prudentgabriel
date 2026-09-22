/**
 * isPublished is a rule, not a display filter: nothing outside the admin shows,
 * links, sells, emails or accepts an unpublished piece.
 *
 *   pnpm test:product-visibility                                  # static + DB
 *   BASE_URL=http://localhost:3000 pnpm test:product-visibility   # + real routes
 *
 * Live checks create a short-lived BundleItem and wishlist row in the local
 * database and remove them. Never point BASE_URL at production.
 */
import "./preload-test-env";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Role } from "@prisma/client";
import { encode } from "next-auth/jwt";
import { prisma } from "../src/lib/prisma";
import { publishedProductIds } from "../src/lib/product-visibility";
import { looksLikeProductionDatabase, looksLikeStagingDatabase } from "./fixture-guard";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const root = path.join(__dirname, "..");
const src = (rel: string) => readFileSync(path.join(root, rel), "utf8");

/** Every customer-facing read found in the 2026-09-22 sweep keeps its guard. */
function staticGuard() {
  const guarded: [string, RegExp, string][] = [
    ["src/app/(storefront)/shop/[slug]/page.tsx", /bundleItems: \{\s*where: \{ targetProduct: PUBLIC_PRODUCT_WHERE \}/, "Complete the Look (page)"],
    ["src/app/api/products/[slug]/route.ts", /bundleItems: \{\s*where: \{ targetProduct: PUBLIC_PRODUCT_WHERE \}/, "Complete the Look (API)"],
    ["src/app/api/products/[slug]/route.ts", /product\.isPublished\s*\?\s*"public[^"]*"\s*:\s*"private, no-store"/, "unpublished admin view is never publicly cached"],
    ["src/app/api/wishlist/route.ts", /PUBLIC_PRODUCT_WHERE/, "wishlist add (heart)"],
    ["src/app/api/account/wishlist/route.ts", /product: PUBLIC_PRODUCT_WHERE/, "wishlist list (API)"],
    ["src/app/api/account/wishlist/route.ts", /id: parsed\.data\.productId, \.\.\.PUBLIC_PRODUCT_WHERE/, "wishlist add (account)"],
    ["src/app/(account)/account/wishlist/page.tsx", /product: PUBLIC_PRODUCT_WHERE/, "wishlist page"],
    ["src/app/(storefront)/collections/[slug]/page.tsx", /r\.product\?\.isPublished \? r\.product\.slug : null/, "collection reel link"],
    ["src/app/api/products/[slug]/reviews/route.ts", /!product\.isPublished/, "reviews by slug"],
    ["src/lib/custom-availability.ts", /!product\.isPublished/, "custom-measurement gate"],
    ["src/lib/cron/jobs/abandoned-cart.ts", /product: PUBLIC_PRODUCT_WHERE/, "abandoned-cart email"],
    ["src/lib/checkout-session.tsx", /publishedProductIds\(/, "abandoned-checkout email"],
    ["src/lib/products-list-query.ts", /isPublished/, "catalogue list / search / recently viewed"],
    ["src/lib/sitemap-build.ts", /isPublished: true/, "sitemap"],
  ];
  for (const [rel, re, what] of guarded) assert(re.test(src(rel)), `${what}: ${rel}`);
  assert(!/include: \{ product: true \}/.test(src("src/app/api/account/wishlist/route.ts")), "wishlist never returns the whole product row");
  console.log(`ok static: ${guarded.length} customer-facing reads guarded`);
}

async function reachable() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function live(base?: string) {
  assert(!looksLikeProductionDatabase() && !looksLikeStagingDatabase(), "never against production or staging data");
  const pub = await prisma.product.findFirst({ where: { isPublished: true }, select: { id: true, slug: true } });
  const unpub = await prisma.product.findFirst({ where: { isPublished: false }, select: { id: true, slug: true } });
  assert(pub && unpub, "local database has a published and an unpublished piece");
  const ids = await publishedProductIds([pub.id, unpub.id]);
  assert(ids.has(pub.id) && !ids.has(unpub.id), "publishedProductIds keeps only the published piece");
  console.log("ok database helper");

  if (!base) return;
  const host = new URL(base).hostname;
  if (host !== "localhost" && host !== "127.0.0.1") return console.log("skip live routes: localhost only");

  const bundle = await prisma.bundleItem.upsert({
    where: { sourceProductId_targetProductId: { sourceProductId: pub.id, targetProductId: unpub.id } },
    update: {},
    create: { sourceProductId: pub.id, targetProductId: unpub.id, sortOrder: 0 },
  });
  const email = `vis-${Date.now()}@example.test`;
  const user = await prisma.user.create({ data: { email, name: "Vis Test", role: Role.CUSTOMER, password: "x" } });
  try {
    // Complete the Look never offers the unpublished piece.
    const api = (await (await fetch(`${base}/api/products/${pub.slug}`)).json()) as {
      product: { bundleItems: { targetProductId: string }[] };
    };
    assert(!api.product.bundleItems.some((b) => b.targetProductId === unpub.id), "API bundle omits the unpublished piece");
    const pdp = await (await fetch(`${base}/shop/${pub.slug}`)).text();
    assert(!pdp.includes(`/shop/${unpub.slug}"`), "product page does not link the unpublished piece");

    // Reads by slug.
    assert((await fetch(`${base}/api/products/${unpub.slug}`)).status === 404, "product API 404s an unpublished slug");
    assert((await fetch(`${base}/api/products/${unpub.slug}/reviews`)).status === 404, "reviews API 404s an unpublished slug");

    // Wishlist add, signed in as a customer.
    const name = "authjs.session-token";
    const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
    assert(secret, "AUTH_SECRET set");
    const cookie = `${name}=${await encode({ token: { id: user.id, sub: user.id, email }, secret, salt: name })}`;
    const add = (productId: string) =>
      fetch(`${base}/api/wishlist`, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ productId }) });
    assert((await add(unpub.id)).status === 404, "wishlist refuses an unpublished piece");
    assert((await add(pub.id)).status === 200, "wishlist accepts a published piece");
    console.log("ok live: bundle, product API, reviews API and wishlist all refuse the unpublished piece");
  } finally {
    await prisma.wishlistItem.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.bundleItem.delete({ where: { id: bundle.id } });
  }
}

async function main() {
  staticGuard();
  if (await reachable()) await live(process.env.BASE_URL?.replace(/\/$/, ""));
  else console.log("skip database checks: unreachable");
  console.log("OK test-product-visibility");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
