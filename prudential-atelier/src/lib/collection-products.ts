import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ProductListItem } from "@/types/product";

export const collectionListProductInclude = {
  images: { orderBy: { sortOrder: "asc" as const }, take: 2 },
  variants: {
    orderBy: { priceNGN: "asc" as const },
    select: { id: true, size: true, priceNGN: true, salePriceNGN: true, stock: true },
  },
  colors: { select: { id: true, name: true, hex: true, imageUrl: true } },
  _count: { select: { reviews: true } },
} satisfies Prisma.ProductInclude;

export type CollectionListProduct = Prisma.ProductGetPayload<{
  include: typeof collectionListProductInclude;
}>;

export type CollectionProductWithMeta = ProductListItem & { createdAt: string };

export function mapProductToListItemWithMeta(p: CollectionListProduct): CollectionProductWithMeta {
  return {
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
    createdAt: p.createdAt.toISOString(),
  };
}

export async function uniqueProductCountForCollection(
  collectionId: string,
  autoTag: string | null | undefined,
): Promise<number> {
  const manual = await prisma.collectionProduct.findMany({
    where: { collectionId },
    select: { productId: true },
  });
  const ids = new Set(manual.map((m) => m.productId));
  const tag = autoTag?.trim();
  if (tag) {
    const extraWhere: Prisma.ProductWhereInput = {
      isPublished: true,
      tags: { has: tag },
    };
    if (ids.size > 0) {
      extraWhere.id = { notIn: [...ids] };
    }
    const autoRows = await prisma.product.findMany({
      where: extraWhere,
      select: { id: true },
    });
    for (const r of autoRows) ids.add(r.id);
  }
  return ids.size;
}

export async function mergePublishedCollectionProducts(
  collectionId: string,
  autoTag: string | null | undefined,
): Promise<CollectionProductWithMeta[]> {
  const manualRows = await prisma.collectionProduct.findMany({
    where: { collectionId, product: { isPublished: true } },
    orderBy: { sortOrder: "asc" },
    include: {
      product: { include: collectionListProductInclude },
    },
  });
  const manualProducts = manualRows.map((r) => mapProductToListItemWithMeta(r.product));
  const manualIds = new Set(manualProducts.map((p) => p.id));

  const tag = autoTag?.trim();
  let autoProducts: CollectionProductWithMeta[] = [];
  if (tag) {
    const autoWhere: Prisma.ProductWhereInput = {
      isPublished: true,
      tags: { has: tag },
    };
    if (manualIds.size > 0) {
      autoWhere.id = { notIn: [...manualIds] };
    }
    const autoRows = await prisma.product.findMany({
      where: autoWhere,
      orderBy: { createdAt: "desc" },
      include: collectionListProductInclude,
    });
    autoProducts = autoRows.map(mapProductToListItemWithMeta);
  }

  return [...manualProducts, ...autoProducts];
}

export function sortCollectionProducts(
  products: CollectionProductWithMeta[],
  sort: string,
): CollectionProductWithMeta[] {
  if (!sort || sort === "curated" || sort === "default") {
    return products;
  }
  const copy = [...products];
  switch (sort) {
    case "price-asc":
      copy.sort((a, b) => a.basePriceNGN - b.basePriceNGN);
      break;
    case "price-desc":
      copy.sort((a, b) => b.basePriceNGN - a.basePriceNGN);
      break;
    case "newest":
      copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      break;
    default:
      break;
  }
  return copy;
}
