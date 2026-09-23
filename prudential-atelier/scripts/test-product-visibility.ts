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
import { queryProductList } from "../src/lib/products-list-query";
import { buildSitemap } from "../src/lib/sitemap-build";
import { mergeCollectionProductsForCampaign } from "../src/lib/collection-products";
import { listCartLines } from "../src/lib/cart-service";
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
  const shopper = await behaviour(pub, unpub);
  try {
    if (shopper) {
      const badge = await prisma.wishlistItem.count({ where: { userId: shopper.id, product: { isPublished: true } } });
      assert(badge === 1, "the account badge counts published pieces (the layout's own where)");
    }
    if (base && shopper && (new URL(base).hostname === "localhost" || new URL(base).hostname === "127.0.0.1")) {
      const name = "authjs.session-token";
      const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
      assert(secret, "AUTH_SECRET set");
      const cookie = `${name}=${await encode({ token: { id: shopper.id, sub: shopper.id, email: shopper.email }, secret, salt: name })}`;
      const res = await fetch(`${base}/api/wishlist`, { headers: { cookie } });
      const { ids } = (await res.json()) as { ids: string[] };
      assert(res.status === 200 && ids.includes(pub.id) && !ids.includes(unpub.id), "wishlist ids leave out the withdrawn piece");
    }
  } finally {
    if (shopper) {
      await prisma.wishlistItem.deleteMany({ where: { userId: shopper.id } });
      await prisma.user.delete({ where: { id: shopper.id } });
    }
  }
  console.log("ok behaviour: list, search, sitemap, campaign, restore link, bag and wishlist leave out the unpublished piece");

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

/**
 * Behaviour, not text: each check calls the real code and would fail if its
 * isPublished filter were deleted. (The two guards these replace only looked
 * for the word in a file, the weakness that let Slice AS pass for four weeks.)
 */
async function behaviour(pub: { id: string; slug: string }, unpub: { id: string; slug: string }) {
  const unpubRow = await prisma.product.findUniqueOrThrow({ where: { id: unpub.id }, select: { name: true } });

  // Catalogue list, search and recently viewed (/api/products).
  const list = (params: Record<string, string>, isAdmin = false) =>
    queryProductList(new URLSearchParams(params), { isAdmin }).then((r) => r.products.map((x) => x.id));
  const byIds = await list({ ids: `${pub.id},${unpub.id}`, limit: "48" });
  assert(byIds.includes(pub.id) && !byIds.includes(unpub.id), "recently viewed by id: published only");
  assert(!(await list({ ids: unpub.id, isPublished: "false" })).includes(unpub.id), "a customer asking for isPublished=false still gets nothing");
  assert(!(await list({ search: unpubRow.name, limit: "48" })).includes(unpub.id), "search never finds the unpublished piece");
  assert((await list({ ids: unpub.id, isPublished: "false" }, true)).includes(unpub.id), "an admin does see it (so this test can see a leak)");

  // Sitemap.
  const urls = (await buildSitemap()).map((e) => e.url);
  assert(urls.some((u) => u.endsWith(`/shop/${pub.slug}`)), "the sitemap lists a published piece");
  assert(!urls.some((u) => u.endsWith(`/shop/${unpub.slug}`)), "and never the unpublished one");

  // Collection campaign email (decided 23 Sep: published pieces only).
  const tag = `vis-${Date.now()}`;
  const collection = await prisma.collection.create({
    data: { name: "Visibility fixture", slug: tag, autoTag: tag, products: { create: [{ productId: unpub.id, sortOrder: 0 }, { productId: pub.id, sortOrder: 1 }] } },
  });
  const tagged = await prisma.product.findMany({ where: { id: { in: [pub.id, unpub.id] } }, select: { id: true, tags: true } });
  await Promise.all(tagged.map((t) => prisma.product.update({ where: { id: t.id }, data: { tags: { set: [...t.tags, tag] } } })));
  try {
    const campaign = (await mergeCollectionProductsForCampaign(collection.id, tag, 8)).map((x) => x.id);
    assert(campaign.includes(pub.id), "the campaign carries the published piece");
    assert(!campaign.includes(unpub.id), "and no unpublished piece, by hand or by tag");
  } finally {
    await Promise.all(tagged.map((t) => prisma.product.update({ where: { id: t.id }, data: { tags: { set: t.tags } } })));
    await prisma.collection.delete({ where: { id: collection.id } });
  }

  // Abandoned-checkout restore link and the signed-in bag.
  // Each piece needs a size to sit in a bag; add a temporary one where missing (removed below).
  const tempVariants: string[] = [];
  const variantFor = async (productId: string) => {
    const found = await prisma.productVariant.findFirst({ where: { productId }, select: { id: true } });
    if (found) return found;
    const made = await prisma.productVariant.create({ data: { productId, size: "VIS", priceNGN: 1000 }, select: { id: true } });
    tempVariants.push(made.id);
    return made;
  };
  const pubVariant = await variantFor(pub.id);
  const unpubVariant = await variantFor(unpub.id);
  {
    const line = (productId: string, variantId: string) => ({ productId, variantId, productName: productId, quantity: 1, priceNGN: 1000 });
    const checkout = await prisma.checkoutSession.create({
      data: { email: `vis-restore-${Date.now()}@example.test`, cartSnapshot: { lines: [line(pub.id, pubVariant.id), line(unpub.id, unpubVariant.id)], subtotalNGN: 2000 } },
    });
    const shopper = await prisma.user.create({ data: { email: `vis-bag-${Date.now()}@example.test`, name: "Bag", role: Role.CUSTOMER, password: "x" } });
    try {
      const { GET } = await import("../src/app/api/checkout/restore/[token]/route");
      const res = await GET(new Request("http://localhost/x"), { params: Promise.resolve({ token: checkout.restoreToken }) });
      const restored = (await res.json()) as { lines: { productId: string }[]; subtotalNGN: number; withdrawn: number };
      assert(res.status === 200 && restored.lines.length === 1 && restored.lines[0].productId === pub.id, "the restore link brings back only the published piece");
      assert(restored.subtotalNGN === 1000 && restored.withdrawn === 1, "and says one was withdrawn");

      await prisma.cartItem.createMany({
        data: [
          { userId: shopper.id, productId: pub.id, variantId: pubVariant.id, quantity: 1, lineKey: `vis-${pubVariant.id}` },
          { userId: shopper.id, productId: unpub.id, variantId: unpubVariant.id, quantity: 1, lineKey: `vis-${unpubVariant.id}` },
        ],
      });
      const bag = await listCartLines(shopper.id);
      assert(bag.items.length === 1 && bag.items[0].productId === pub.id, "the signed-in bag holds only the published piece");
      assert(bag.removed.length === 1 && bag.removed[0] === unpubRow.name, "and names the one it took out");
      assert((await prisma.cartItem.count({ where: { userId: shopper.id, productId: unpub.id } })) === 0, "so checkout is not blocked by a line she cannot see");

      await prisma.wishlistItem.createMany({ data: [{ userId: shopper.id, productId: pub.id }, { userId: shopper.id, productId: unpub.id }] });
    } finally {
      await prisma.checkoutSession.delete({ where: { id: checkout.id } });
      await prisma.cartItem.deleteMany({ where: { userId: shopper.id } });
      await prisma.productVariant.deleteMany({ where: { id: { in: tempVariants } } });
    }
    return shopper;
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
