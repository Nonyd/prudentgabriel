/**
 * A piece is orderable when it is published and has something to order
 * (a standard size, or made-to-measure offered). That one rule sets the
 * product JSON-LD availability and is enforced by the cart and checkout.
 *
 *   pnpm test:orderability                                  # rules + DB check
 *   BASE_URL=http://localhost:3000 pnpm test:orderability   # + real checkout refusal
 *
 * The live checkout calls stop before an order is created (no address given).
 */
import "./preload-test-env";
import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";
import { isProductOrderable, schemaAvailability, whyUnorderable } from "../src/lib/product-orderability";
import { firstUnorderableProduct } from "../src/lib/product-orderability-db";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

function rules() {
  const std = [{ size: "M" }];
  const customOnly = [{ size: "Custom" }];
  assert(isProductOrderable({ isPublished: true, customOffered: false, variants: std }), "standard size → orderable");
  assert(isProductOrderable({ isPublished: true, customOffered: true, variants: [] }), "made-to-measure only → orderable");
  assert(whyUnorderable({ isPublished: false, customOffered: true, variants: std }) === "UNPUBLISHED", "unpublished → not orderable");
  assert(whyUnorderable({ isPublished: true, customOffered: false, variants: customOnly }) === "NO_SIZE", "nothing to order → not orderable");
  assert(schemaAvailability({ isPublished: true, customOffered: false, variants: std }) === "https://schema.org/InStock", "InStock");
  assert(schemaAvailability({ isPublished: true, customOffered: false, variants: [] }) === "https://schema.org/OutOfStock", "OutOfStock");
  const root = path.join(__dirname, "..");
  assert(readFileSync(path.join(root, "src/app/api/orders/create/route.ts"), "utf8").includes("firstUnorderableProduct("), "checkout enforces it");
  assert(readFileSync(path.join(root, "src/lib/cart-service.ts"), "utf8").includes("firstUnorderableProduct("), "cart enforces it");
  assert(!readFileSync(path.join(root, "src/lib/seo-jsonld.ts"), "utf8").includes('"https://schema.org/InStock"'), "JSON-LD availability is no longer hardcoded");
  console.log("ok rules");
}

async function reachable() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function database(base?: string) {
  const unpublished = await prisma.product.findFirst({
    where: { isPublished: false, variants: { some: { NOT: { size: { equals: "custom", mode: "insensitive" } } } }, optionGroup: null },
    select: { id: true, name: true, variants: { select: { id: true, size: true } } },
  });
  const published = await prisma.product.findFirst({
    where: { isPublished: true, variants: { some: { NOT: { size: { equals: "custom", mode: "insensitive" } } } }, optionGroup: null },
    select: { id: true, variants: { select: { id: true, size: true } } },
  });
  assert(unpublished && published, "dev database has a published and an unpublished piece to compare");
  const refused = await firstUnorderableProduct([unpublished.id]);
  assert(refused && /no longer available/.test(refused.error), "unpublished piece refused");
  assert((await firstUnorderableProduct([published.id])) === null, "published piece allowed");
  console.log("ok database check");

  if (!base) return;
  const host = new URL(base).hostname;
  if (host !== "localhost" && host !== "127.0.0.1") return console.log("skip live checkout: localhost only");
  const body = (p: { id: string; variants: { id: string; size: string }[] }) =>
    JSON.stringify({
      shippingOptionId: "zz-test",
      currency: "NGN",
      guestEmail: "orderability-test@example.test",
      cartLines: [{ productId: p.id, variantId: p.variants.find((v) => v.size.toLowerCase() !== "custom")!.id, quantity: 1 }],
    });
  const post = (b: string) => fetch(`${base}/api/orders/create`, { method: "POST", headers: { "content-type": "application/json" }, body: b });
  const bad = await post(body(unpublished));
  const badBody = (await bad.json()) as { error?: string };
  assert(bad.status === 409 && /no longer available/.test(String(badBody.error)), `checkout refuses an unpublished piece (${bad.status} ${JSON.stringify(badBody)})`);
  const ok = await post(body(published));
  assert(ok.status !== 409, "checkout does not refuse a published piece on availability");
  console.log(`ok live: checkout refused the unpublished piece (409); published passed that check (${ok.status}, stops later without an address)`);
}

async function main() {
  rules();
  if (await reachable()) await database(process.env.BASE_URL?.replace(/\/$/, ""));
  else console.log("skip database check: unreachable");
  console.log("OK test-orderability");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
