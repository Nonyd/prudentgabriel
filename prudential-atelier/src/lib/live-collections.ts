import { prisma } from "@/lib/prisma";
import { uniqueProductCountsForCollections } from "@/lib/collection-products";

export async function listLivePublishedCollections(opts?: {
  excludeSlug?: string;
  take?: number;
}) {
  const rows = await prisma.collection.findMany({
    where: {
      isPublished: true,
      ...(opts?.excludeSlug ? { slug: { not: opts.excludeSlug } } : {}),
    },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
  });

  const counts = await uniqueProductCountsForCollections(
    rows.map((c) => ({ id: c.id, autoTag: c.autoTag })),
  );

  const live = rows
    .map((c, i) => ({ collection: c, productCount: counts[i] ?? 0 }))
    .filter((row) => row.productCount > 0);

  return typeof opts?.take === "number" ? live.slice(0, opts.take) : live;
}

export async function findLivePublishedCollection(slug: string) {
  const collection = await prisma.collection.findFirst({
    where: { slug, isPublished: true },
  });
  if (!collection) return null;
  const [count] = await uniqueProductCountsForCollections([
    { id: collection.id, autoTag: collection.autoTag },
  ]);
  if ((count ?? 0) < 1) return null;
  return collection;
}
