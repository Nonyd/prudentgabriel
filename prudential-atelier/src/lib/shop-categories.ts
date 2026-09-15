import { prisma } from "@/lib/prisma";
import { revalidateStorefront } from "@/lib/revalidate";
import { isSkipDbBuild } from "@/lib/skip-db-build";
import {
  SEED_SHOP_CATEGORIES,
  ShopCategoryError,
  slugFromCategoryLabel,
  UNCATEGORIZED_SLUG,
} from "@/lib/shop-category-slug";

export {
  SEED_SHOP_CATEGORIES,
  ShopCategoryError,
  slugFromCategoryLabel,
  UNCATEGORIZED_SLUG,
} from "@/lib/shop-category-slug";

export type ShopCategoryRow = {
  slug: string;
  label: string;
  sortOrder: number;
  locked: boolean;
  productCount: number;
};

function seedRowsForBuild(): ShopCategoryRow[] {
  return SEED_SHOP_CATEGORIES.map((row) => ({ ...row, productCount: 0 }));
}

export async function ensureShopCategories(): Promise<void> {
  if (isSkipDbBuild()) return;
  for (const seed of SEED_SHOP_CATEGORIES) {
    await prisma.shopCategory.upsert({
      where: { slug: seed.slug },
      create: {
        slug: seed.slug,
        label: seed.label,
        sortOrder: seed.sortOrder,
        locked: seed.locked,
      },
      update: { locked: seed.locked },
    });
  }
}

async function withCounts(
  rows: Array<{ slug: string; label: string; sortOrder: number; locked: boolean }>,
  publishedOnly = false,
): Promise<ShopCategoryRow[]> {
  const grouped = await prisma.product.groupBy({
    by: ["category"],
    _count: { _all: true },
    ...(publishedOnly ? { where: { isPublished: true } } : {}),
  });
  const counts = new Map(grouped.map((g) => [g.category, g._count._all]));
  return rows.map((row) => ({
    ...row,
    productCount: counts.get(row.slug) ?? 0,
  }));
}

export async function listShopCategories(): Promise<ShopCategoryRow[]> {
  if (isSkipDbBuild()) return seedRowsForBuild();
  await ensureShopCategories();
  const rows = await prisma.shopCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    select: { slug: true, label: true, sortOrder: true, locked: true },
  });
  return withCounts(rows);
}

export async function listStorefrontCategories(): Promise<ShopCategoryRow[]> {
  if (isSkipDbBuild()) {
    return seedRowsForBuild().filter((row) => row.slug !== UNCATEGORIZED_SLUG);
  }
  await ensureShopCategories();
  const rows = await prisma.shopCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    select: { slug: true, label: true, sortOrder: true, locked: true },
  });
  const counted = await withCounts(rows, true);
  const seedUnlocked = new Set(
    SEED_SHOP_CATEGORIES.filter((item) => !item.locked).map((item) => item.slug),
  );
  return counted.filter((row) => {
    if (row.slug === UNCATEGORIZED_SLUG) return row.productCount > 0;
    if (seedUnlocked.has(row.slug)) return true;
    return row.productCount > 0;
  });
}

export async function assertShopCategoryExists(slug: string): Promise<string> {
  await ensureShopCategories();
  const row = await prisma.shopCategory.findUnique({
    where: { slug },
    select: { slug: true },
  });
  if (!row) {
    throw new ShopCategoryError("Unknown category.", 400);
  }
  return row.slug;
}

export async function createShopCategory(rawLabel: string): Promise<ShopCategoryRow> {
  await ensureShopCategories();
  const label = rawLabel.trim().replace(/\s+/g, " ");
  if (label.length < 2) {
    throw new ShopCategoryError("Give the category a name.", 400);
  }
  if (label.length > 40) {
    throw new ShopCategoryError("Category names stay under 40 letters.", 400);
  }
  const slug = slugFromCategoryLabel(label);
  if (!slug || slug.length > 40) {
    throw new ShopCategoryError("That name does not make a usable category.", 400);
  }
  if (slug === UNCATEGORIZED_SLUG) {
    throw new ShopCategoryError("Uncategorized is reserved.", 400);
  }
  const existing = await prisma.shopCategory.findUnique({ where: { slug } });
  if (existing) {
    throw new ShopCategoryError("That category already exists.", 409);
  }
  const last = await prisma.shopCategory.aggregate({
    _max: { sortOrder: true },
    where: { locked: false },
  });
  const sortOrder = Math.min(998, (last._max.sortOrder ?? 60) + 10);
  const row = await prisma.shopCategory.create({
    data: { slug, label, sortOrder, locked: false },
  });
  try {
    await revalidateStorefront(["/shop", "/rtw"]);
  } catch {
    /* scripts and tests run outside a Next request */
  }
  return { ...row, productCount: 0 };
}

export async function deleteShopCategory(slug: string): Promise<{ moved: number }> {
  await ensureShopCategories();
  const row = await prisma.shopCategory.findUnique({ where: { slug } });
  if (!row) {
    throw new ShopCategoryError("Category not found.", 404);
  }
  if (row.locked || slug === UNCATEGORIZED_SLUG) {
    throw new ShopCategoryError("Uncategorized cannot be removed.", 400);
  }
  const result = await prisma.$transaction(async (tx) => {
    const moved = await tx.product.updateMany({
      where: { category: slug },
      data: { category: UNCATEGORIZED_SLUG },
    });
    const coupons = await tx.coupon.findMany({
      where: { categoryScope: { has: slug } },
      select: { id: true, categoryScope: true },
    });
    for (const coupon of coupons) {
      await tx.coupon.update({
        where: { id: coupon.id },
        data: { categoryScope: coupon.categoryScope.filter((item) => item !== slug) },
      });
    }
    await tx.shopCategory.delete({ where: { slug } });
    return { moved: moved.count };
  });
  try {
    await revalidateStorefront(["/shop", "/rtw"]);
  } catch {
    /* scripts and tests run outside a Next request */
  }
  return result;
}
