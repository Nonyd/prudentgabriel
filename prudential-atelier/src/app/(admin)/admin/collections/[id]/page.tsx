import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  collectionListProductInclude,
  mapProductToListItemWithMeta,
  uniqueProductCountForCollection,
  type CollectionListProduct,
} from "@/lib/collection-products";
import type { Prisma } from "@prisma/client";
import { CollectionDetailAdmin } from "@/components/admin/CollectionDetailAdmin";

export default async function AdminCollectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const collection = await prisma.collection.findUnique({
    where: { id },
    include: {
      products: {
        orderBy: { sortOrder: "asc" },
        include: {
          product: { include: collectionListProductInclude },
        },
      },
    },
  });
  if (!collection) notFound();

  const manualIds = collection.products.map((p) => p.productId);
  const autoTagTrim = collection.autoTag?.trim();
  let autoProducts: CollectionListProduct[] = [];
  if (autoTagTrim) {
    const autoWhere: Prisma.ProductWhereInput = {
      isPublished: true,
      tags: { has: autoTagTrim },
    };
    if (manualIds.length > 0) {
      autoWhere.id = { notIn: manualIds };
    }
    autoProducts = await prisma.product.findMany({
      where: autoWhere,
      orderBy: { createdAt: "desc" },
      include: collectionListProductInclude,
    });
  }

  const totalUnique = await uniqueProductCountForCollection(collection.id, collection.autoTag);
  const publishedManual = collection.products.filter((cp) => cp.product.isPublished).length;
  const draftManual = collection.products.length - publishedManual;

  const manualRows = collection.products.map((cp) => ({
    id: cp.id,
    productId: cp.productId,
    sortOrder: cp.sortOrder,
    product: mapProductToListItemWithMeta(cp.product),
  }));

  const autoList = autoProducts.map(mapProductToListItemWithMeta);

  return (
    <CollectionDetailAdmin
      collection={{
        id: collection.id,
        name: collection.name,
        slug: collection.slug,
        excerpt: collection.excerpt,
        coverImage: collection.coverImage,
        autoTag: collection.autoTag,
        season: collection.season,
        year: collection.year,
        isFeatured: collection.isFeatured,
        isPublished: collection.isPublished,
        displayOrder: collection.displayOrder,
        createdAt: collection.createdAt.toISOString(),
        updatedAt: collection.updatedAt.toISOString(),
      }}
      manualRows={manualRows}
      autoProducts={autoList}
      totalUnique={totalUnique}
      publishedManual={publishedManual}
      draftManual={draftManual}
    />
  );
}
