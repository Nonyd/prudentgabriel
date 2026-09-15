/**
 * Shop categories: add from the product form; delete moves pieces to Uncategorized.
 *
 *   pnpm test:shop-categories
 */
import "./preload-test-env";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ProductType } from "@prisma/client";
import { productAdminSchema } from "../src/validations/product";
import {
  createShopCategory,
  deleteShopCategory,
  ensureShopCategories,
  ShopCategoryError,
  slugFromCategoryLabel,
  UNCATEGORIZED_SLUG,
} from "../src/lib/shop-categories";
import { prisma } from "../src/lib/prisma";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (rel: string) => readFileSync(join(root, rel), "utf8");

async function main() {
  assert(slugFromCategoryLabel("Evening Wear") === "EVENING_WEAR", "spaces become underscores");
  assert(slugFromCategoryLabel("resort") === "RESORT", "labels upper-case");
  assert(slugFromCategoryLabel("  Resort 2027 ") === "RESORT_2027", "years stay in the slug");

  const parsed = productAdminSchema.safeParse({
    name: "Avril",
    category: "RESORT",
    type: "RTW",
  });
  assert(parsed.success, "a new category slug is a valid product draft");

  const schema = src("prisma/schema.prisma");
  assert(schema.includes("model ShopCategory"), "categories live in ShopCategory");
  assert(schema.includes("category       String"), "product category is no longer a closed enum column");
  assert(src("src/components/admin/ProductCategoryField.tsx").includes("Add a category"), "product form can add");
  assert(src("src/components/admin/ProductCategoryField.tsx").includes("Remove this category"), "product form can remove");
  assert(src("src/lib/shop-categories.ts").includes("UNCATEGORIZED"), "delete falls back to Uncategorized");
  assert(
    src("src/app/api/shop/categories/route.ts").includes('export const dynamic = "force-dynamic"'),
    "shop categories are not prerendered without a database",
  );

  await ensureShopCategories();
  const stamp = `cat-${Date.now()}`;
  const created = await createShopCategory(`Test ${stamp}`);
  const product = await prisma.product.create({
    data: {
      name: `Category test ${stamp}`,
      slug: `category-test-${stamp}`,
      description: "",
      category: created.slug,
      type: ProductType.RTW,
      priceNGN: 0,
      basePriceNGN: 0,
    },
  });
  try {
    let blocked = false;
    try {
      await deleteShopCategory(UNCATEGORIZED_SLUG);
    } catch (error) {
      blocked = error instanceof ShopCategoryError;
    }
    assert(blocked, "Uncategorized cannot be deleted");

    const result = await deleteShopCategory(created.slug);
    assert(result.moved === 1, "the test piece moved instead of being deleted");
    const moved = await prisma.product.findUnique({
      where: { id: product.id },
      select: { category: true },
    });
    assert(moved?.category === UNCATEGORIZED_SLUG, "the piece is now Uncategorized");
    const gone = await prisma.shopCategory.findUnique({ where: { slug: created.slug } });
    assert(!gone, "the aisle row is gone");
  } finally {
    await prisma.product.delete({ where: { id: product.id } }).catch(() => undefined);
    await prisma.shopCategory.delete({ where: { slug: created.slug } }).catch(() => undefined);
  }

  console.log("OK — shop-categories");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
