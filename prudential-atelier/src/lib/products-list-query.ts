import { Prisma, ProductCategory, ProductType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ProductListItem } from "@/types/product";

const CATEGORIES = new Set(Object.values(ProductCategory));
const TYPES = new Set(["RTW", "BESPOKE"] as const);

export function parseIntParam(v: string | null, def: number, max?: number): number {
  const n = v ? parseInt(v, 10) : def;
  if (!Number.isFinite(n) || n < 1) return def;
  if (max !== undefined) return Math.min(n, max);
  return n;
}

export async function queryProductList(
  searchParams: URLSearchParams,
  options: { isAdmin: boolean },
): Promise<{
  products: ProductListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}> {
  const categoryParam = searchParams.get("category");
  const typeParam = searchParams.get("type");
  const tagsParam = searchParams.get("tags");
  const sortParam = searchParams.get("sort") ?? "newest";
  const page = parseIntParam(searchParams.get("page"), 1);
  const limit = parseIntParam(searchParams.get("limit"), 24, 48);
  const search = searchParams.get("search")?.trim();
  const newArrival =
    searchParams.get("newArrival") === "true" || searchParams.get("isNewArrival") === "true";
  const featured = searchParams.get("featured") === "true";
  const sale = searchParams.get("sale") === "true";
  const idsParam = searchParams.get("ids");
  const sizesParam = searchParams.get("sizes");
  const isPublishedParam = searchParams.get("isPublished");

  const showUnpublished = options.isAdmin && isPublishedParam === "false";

  const where: Prisma.ProductWhereInput = {};

  if (!showUnpublished) {
    where.isPublished = true;
  }

  if (categoryParam && CATEGORIES.has(categoryParam as ProductCategory)) {
    where.category = categoryParam as ProductCategory;
  }

  if (typeParam && TYPES.has(typeParam as "RTW" | "BESPOKE")) {
    where.type = typeParam as ProductType;
  }

  if (newArrival) where.isNewArrival = true;
  if (featured) where.isFeatured = true;
  if (sale) where.isOnSale = true;

  if (tagsParam) {
    const tags = tagsParam
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (tags.length) {
      where.AND = tags.map((tag) => ({ tags: { has: tag } }));
    }
  }

  const sizesList = sizesParam
    ? sizesParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  if (idsParam) {
    const ids = idsParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length) {
      where.id = { in: ids };
    }
  }

  if (search && search.length >= 1) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  const minRaw = searchParams.get("minPriceNGN") ?? searchParams.get("minPrice");
  const maxRaw = searchParams.get("maxPriceNGN") ?? searchParams.get("maxPrice");
  const minP = minRaw ? parseFloat(minRaw) : NaN;
  const maxP = maxRaw ? parseFloat(maxRaw) : NaN;
  if (Number.isFinite(minP) || Number.isFinite(maxP)) {
    where.basePriceNGN = {};
    if (Number.isFinite(minP)) where.basePriceNGN.gte = minP;
    if (Number.isFinite(maxP)) where.basePriceNGN.lte = maxP;
  }

  const inStockOnly = searchParams.get("inStock") !== "false";
  const variantSome: Prisma.ProductVariantWhereInput = {};
  if (sizesList.length) variantSome.size = { in: sizesList };
  if (inStockOnly) variantSome.stock = { gt: 0 };
  if (Object.keys(variantSome).length) {
    where.variants = { some: variantSome };
  }

  let orderBy: Prisma.ProductOrderByWithRelationInput[] | Prisma.ProductOrderByWithRelationInput = {
    createdAt: "desc",
  };

  switch (sortParam) {
    case "price-asc":
      orderBy = { basePriceNGN: "asc" };
      break;
    case "price-desc":
      orderBy = { basePriceNGN: "desc" };
      break;
    case "featured":
      orderBy = [{ isFeatured: "desc" }, { createdAt: "desc" }];
      break;
    case "newest":
    default:
      orderBy = { createdAt: "desc" };
  }

  const skip = (page - 1) * limit;

  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        images: {
          orderBy: { sortOrder: "asc" },
          take: 2,
        },
        variants: {
          orderBy: { priceNGN: "asc" },
          select: { id: true, size: true, priceNGN: true, salePriceNGN: true, stock: true },
        },
        colors: { select: { id: true, name: true, hex: true, imageUrl: true } },
        _count: { select: { reviews: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  const products: ProductListItem[] = rows.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    category: p.category,
    type: p.type,
    basePriceNGN: p.basePriceNGN,
    isOnSale: p.isOnSale,
    isNewArrival: p.isNewArrival,
    isBespokeAvail: p.isBespokeAvail,
    isFeatured: p.isFeatured,
    tags: p.tags,
    images: p.images.map((im) => ({
      url: im.url,
      alt: im.alt,
      isPrimary: im.isPrimary,
    })),
    variants: p.variants.map((v) => ({
      id: v.id,
      size: v.size,
      priceNGN: v.priceNGN,
      salePriceNGN: v.salePriceNGN,
      stock: v.stock,
    })),
    colors: p.colors,
    _count: p._count,
  }));

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return {
    products,
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}
