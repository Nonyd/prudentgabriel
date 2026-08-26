import { prisma } from "@/lib/prisma";
import { revalidateProduct } from "@/lib/revalidate";
import type { UnpublishImpact, UnpublishImpactProduct } from "@/lib/collection-unpublish-impact";

export type { UnpublishImpact, UnpublishImpactProduct };

async function collectionProductIds(collectionId: string): Promise<string[]> {
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: { autoTag: true },
  });
  if (!collection) return [];

  const manuals = await prisma.collectionProduct.findMany({
    where: { collectionId },
    select: { productId: true },
  });
  const ids = new Set(manuals.map((m) => m.productId));

  const tag = collection.autoTag?.trim();
  if (tag) {
    const tagged = await prisma.product.findMany({
      where: { tags: { has: tag } },
      select: { id: true },
    });
    for (const p of tagged) ids.add(p.id);
  }

  return Array.from(ids);
}

/**
 * Published products that would go dark if this collection is unpublished,
 * including auto-tag matches. Shared membership is listed, not skipped.
 */
export async function previewUnpublishImpact(collectionId: string): Promise<UnpublishImpact> {
  const idList = await collectionProductIds(collectionId);
  if (idList.length === 0) return { products: [] };

  const products = await prisma.product.findMany({
    where: { id: { in: idList }, isPublished: true },
    select: { id: true, name: true, tags: true },
  });
  if (products.length === 0) return { products: [] };

  const manualsElsewhere = await prisma.collectionProduct.findMany({
    where: {
      productId: { in: products.map((p) => p.id) },
      collectionId: { not: collectionId },
      collection: { isPublished: true },
    },
    select: {
      productId: true,
      collection: { select: { name: true } },
    },
  });

  const tagSet = new Set(products.flatMap((p) => p.tags.map((t) => t.trim()).filter(Boolean)));
  const autoElsewhere =
    tagSet.size === 0
      ? []
      : await prisma.collection.findMany({
          where: {
            id: { not: collectionId },
            isPublished: true,
            autoTag: { in: Array.from(tagSet) },
          },
          select: { name: true, autoTag: true },
        });

  const byProduct = new Map<string, UnpublishImpactProduct>();
  for (const p of products) {
    byProduct.set(p.id, { id: p.id, name: p.name, otherCollectionNames: [] });
  }

  for (const row of manualsElsewhere) {
    const entry = byProduct.get(row.productId);
    if (!entry) continue;
    if (!entry.otherCollectionNames.includes(row.collection.name)) {
      entry.otherCollectionNames.push(row.collection.name);
    }
  }

  for (const p of products) {
    const entry = byProduct.get(p.id);
    if (!entry) continue;
    for (const col of autoElsewhere) {
      const tag = col.autoTag?.trim();
      if (!tag || !p.tags.includes(tag)) continue;
      if (!entry.otherCollectionNames.includes(col.name)) {
        entry.otherCollectionNames.push(col.name);
      }
    }
  }

  return { products: Array.from(byProduct.values()) };
}

/** Unpublish every product on this collection (manual + auto-tag). Call only after confirm. */
export async function unpublishCollectionProducts(collectionId: string): Promise<string[]> {
  const idList = await collectionProductIds(collectionId);
  if (idList.length === 0) return [];

  const products = await prisma.product.findMany({
    where: { id: { in: idList } },
    select: { slug: true },
  });

  await prisma.product.updateMany({
    where: { id: { in: idList } },
    data: { isPublished: false },
  });

  const slugs = products.map((p) => p.slug);
  try {
    await Promise.all(slugs.map((slug) => revalidateProduct(slug)));
  } catch {
    // Scripts and tests have no Next static-generation store.
  }
  return slugs;
}
