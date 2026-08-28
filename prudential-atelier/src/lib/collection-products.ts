import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ProductListItem } from "@/types/product";
import { derivedCatalogMinNGN, minEffectiveNGN } from "@/lib/pricing";
import { mapListVariant } from "@/lib/map-product-list-item";

export const collectionListProductInclude = {
  images: { orderBy: { sortOrder: "asc" as const }, take: 2 },
  variants: {
    orderBy: { priceNGN: "asc" as const },
    select: {
      id: true,
      size: true,
      priceNGN: true,
      salePriceNGN: true,
      priceUSD: true,
      priceGBP: true,
      stock: true,
    },
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
    basePriceNGN: p.variants.length ? derivedCatalogMinNGN(p.variants, p.isOnSale) : p.basePriceNGN,
    priceUSD: p.priceUSD,
    priceGBP: p.priceGBP,
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
    variants: p.variants.map(mapListVariant),
    colors: p.colors,
    _count: p._count,
    createdAt: p.createdAt.toISOString(),
  };
}

export async function uniqueProductCountsForCollections(
  rows: { id: string; autoTag: string | null }[],
): Promise<number[]> {
  if (rows.length === 0) return [];

  const collectionIds = rows.map((r) => r.id);
  const manuals = await prisma.collectionProduct.findMany({
    where: { collectionId: { in: collectionIds } },
    select: { collectionId: true, productId: true },
  });

  const byCollection = new Map<string, Set<string>>();
  for (const id of collectionIds) byCollection.set(id, new Set());
  for (const row of manuals) {
    byCollection.get(row.collectionId)?.add(row.productId);
  }

  const tags = Array.from(
    new Set(rows.map((r) => r.autoTag?.trim()).filter((t): t is string => Boolean(t))),
  );
  if (tags.length > 0) {
    const autoRows = await prisma.product.findMany({
      where: { isPublished: true, tags: { hasSome: tags } },
      select: { id: true, tags: true },
    });
    for (const row of rows) {
      const tag = row.autoTag?.trim();
      if (!tag) continue;
      const set = byCollection.get(row.id);
      if (!set) continue;
      for (const product of autoRows) {
        if (product.tags.includes(tag)) set.add(product.id);
      }
    }
  }

  return rows.map((r) => byCollection.get(r.id)?.size ?? 0);
}

export async function uniqueProductCountForCollection(
  collectionId: string,
  autoTag: string | null | undefined,
): Promise<number> {
  const [count] = await uniqueProductCountsForCollections([
    { id: collectionId, autoTag: autoTag ?? null },
  ]);
  return count ?? 0;
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
      autoWhere.id = { notIn: Array.from(manualIds) };
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

/** Collection lookbook: include drafts so a drop email can go out at launch hour. */
export async function mergeCollectionProductsForCampaign(
  collectionId: string,
  autoTag: string | null | undefined,
  take = 8,
): Promise<CollectionProductWithMeta[]> {
  const manualRows = await prisma.collectionProduct.findMany({
    where: { collectionId },
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
    const autoWhere: Prisma.ProductWhereInput = { tags: { has: tag } };
    if (manualIds.size > 0) {
      autoWhere.id = { notIn: Array.from(manualIds) };
    }
    const autoRows = await prisma.product.findMany({
      where: autoWhere,
      orderBy: { createdAt: "desc" },
      take,
      include: collectionListProductInclude,
    });
    autoProducts = autoRows.map(mapProductToListItemWithMeta);
  }

  return [...manualProducts, ...autoProducts].slice(0, take);
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
      copy.sort((a, b) => minEffectiveNGN(a.variants, a.isOnSale) - minEffectiveNGN(b.variants, b.isOnSale));
      break;
    case "price-desc":
      copy.sort((a, b) => minEffectiveNGN(b.variants, b.isOnSale) - minEffectiveNGN(a.variants, a.isOnSale));
      break;
    case "newest":
      copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      break;
    default:
      break;
  }
  return copy;
}
