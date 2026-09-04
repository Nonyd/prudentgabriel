/**
 * Slice Y: unique stock codes, duplicate regeneration, hand-edit survives rename.
 *
 *   pnpm test:slice-y
 */
import "./preload-test-env";
import { ProductCategory, ProductType } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { duplicateProduct } from "../src/lib/duplicate-product";
import {
  buildDefaultProductSku,
  isGeneratedProductSku,
  resolvePreferredSku,
  uniqueSkuFromTaken,
  variantTableColumns,
} from "../src/lib/product-sku";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const stamp = `slice-y-${Date.now()}`;
const ids = { productIds: [] as string[] };

async function cleanup() {
  if (ids.productIds.length) {
    await prisma.product.deleteMany({ where: { id: { in: ids.productIds } } });
  }
}

async function testPureSku() {
  assert(buildDefaultProductSku("Delphinium", "10") === "PA-DELPH-10", "Delphinium 10");
  assert(buildDefaultProductSku("Elise (copy)", "12") === "PA-ELISE-12", "copy suffix is stripped");
  assert(buildDefaultProductSku("elise-copy", "8") === "PA-ELISE-8", "slug-copy is stripped");
  assert(buildDefaultProductSku("The Avril Gown", "14") === "PA-AVRIL-14", "leading The is stripped");
  assert(isGeneratedProductSku("PA-DELPH-10", "Delphinium", "10"), "exact generated");
  assert(isGeneratedProductSku("PA-DELPH-10-2", "Delphinium", "10"), "collision suffix still generated");
  assert(!isGeneratedProductSku("PA-ELISEC-1", "Delphinium", "10"), "foreign stem is not generated");

  const taken = new Set<string>();
  const a = uniqueSkuFromTaken("PA-DELPH-10", taken);
  const b = uniqueSkuFromTaken("PA-DELPH-10", taken);
  const c = uniqueSkuFromTaken("PA-DELPH-10", taken);
  assert(a === "PA-DELPH-10", "first claim keeps the base");
  assert(b === "PA-DELPH-10-2", "first collision suffixes 2");
  assert(c === "PA-DELPH-10-3", "second collision suffixes 3");
}

async function testResolveRenameAndHandEdit() {
  const generated = resolvePreferredSku({
    name: "Beta",
    size: "10",
    existing: { sku: "PA-ALPHA-10", skuManual: false, size: "10" },
    oldName: "Alpha",
    nameChanged: true,
  });
  assert(generated.sku === "PA-BETA-10", "generated code follows a rename");
  assert(!generated.skuManual, "still generated after rename");

  const kept = resolvePreferredSku({
    name: "Beta",
    size: "10",
    submittedSku: "WAREHOUSE-99",
    skuManual: true,
    existing: { sku: "WAREHOUSE-99", skuManual: true, size: "10" },
    oldName: "Alpha",
    nameChanged: true,
  });
  assert(kept.sku === "WAREHOUSE-99", "hand-edited code survives a rename");
  assert(kept.skuManual, "stays marked manual");

  const copied = resolvePreferredSku({
    name: "Delphinium",
    size: "10",
    existing: { sku: "PA-ELISEC-1", skuManual: false, size: "10" },
    oldName: "Delphinium",
    nameChanged: false,
  });
  assert(copied.sku === "PA-ELISEC-1", "existing foreign stem is not rewritten on save");
}

async function testSaleColumnsHidden() {
  const rest = variantTableColumns({ onSale: false, advanced: false });
  assert(rest.sale === false, "sale column hidden until on sale");
  assert(rest.sku === false, "stock code hidden until advanced");
  const sale = variantTableColumns({ onSale: true, advanced: false });
  assert(sale.sale === true, "sale column appears when on sale");
  assert(sale.size && sale.price && sale.stock, "core columns stay visible");
}

async function testDuplicateGetsFreshUniqueSkus() {
  const product = await prisma.product.create({
    data: {
      name: `${stamp} Delphinium`,
      slug: `${stamp}-delph`,
      description: "src",
      category: ProductCategory.CASUAL,
      type: ProductType.RTW,
      priceNGN: 200_000,
      basePriceNGN: 200_000,
      variants: {
        create: [
          { size: "10", priceNGN: 200_000, stock: 4, sku: `${stamp}-10` },
          { size: "12", priceNGN: 200_000, stock: 2, sku: `${stamp}-12` },
        ],
      },
    },
  });
  ids.productIds.push(product.id);

  const first = await duplicateProduct(product.id);
  assert(first, "first duplicate returns");
  ids.productIds.push(first!.id);
  const firstRows = await prisma.productVariant.findMany({
    where: { productId: first!.id },
    orderBy: { size: "asc" },
  });
  const sourceRows = await prisma.productVariant.findMany({
    where: { productId: product.id },
    orderBy: { size: "asc" },
  });
  const sourceSkus = new Set(sourceRows.map((v) => v.sku));
  assert(firstRows.length === 2, "sizes copied");
  assert(
    firstRows.every((v) => v.sku && !sourceSkus.has(v.sku)),
    `duplicate SKUs must be fresh, got ${firstRows.map((v) => v.sku).join(",")}`,
  );
  assert(
    firstRows.every((v) => v.sku !== "PA-ELISEC-1"),
    "must not keep a source garment stem",
  );
  assert(new Set(firstRows.map((v) => v.sku)).size === firstRows.length, "copy SKUs unique to each other");

  const second = await duplicateProduct(product.id);
  assert(second, "second duplicate returns");
  ids.productIds.push(second!.id);
  const secondRows = await prisma.productVariant.findMany({ where: { productId: second!.id } });
  const all = [...firstRows, ...secondRows, ...sourceRows].map((v) => v.sku).filter(Boolean);
  assert(new Set(all).size === all.length, "duplicating twice does not share a stock code");
}

async function testRenameDoesNotTouchManualSku() {
  const product = await prisma.product.create({
    data: {
      name: `${stamp} Alpha`,
      slug: `${stamp}-alpha`,
      description: "a",
      category: ProductCategory.FORMAL,
      type: ProductType.RTW,
      priceNGN: 10_000,
      basePriceNGN: 10_000,
      variants: {
        create: [{ size: "10", priceNGN: 10_000, stock: 0, sku: "WAREHOUSE-99", skuManual: true }],
      },
    },
  });
  ids.productIds.push(product.id);
  const decided = resolvePreferredSku({
    name: `${stamp} Beta`,
    size: "10",
    skuManual: true,
    submittedSku: "WAREHOUSE-99",
    existing: { sku: "WAREHOUSE-99", skuManual: true, size: "10" },
    oldName: `${stamp} Alpha`,
    nameChanged: true,
  });
  assert(decided.sku === "WAREHOUSE-99", "DB-backed hand edit survives rename");
}

async function run() {
  try {
    await testPureSku();
    await testResolveRenameAndHandEdit();
    await testSaleColumnsHidden();
    await testDuplicateGetsFreshUniqueSkus();
    await testRenameDoesNotTouchManualSku();
    console.log("slice-y: all assertions passed");
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

run().catch((e) => {
  console.error(e);
  cleanup()
    .catch(() => undefined)
    .finally(() => process.exit(1));
});
