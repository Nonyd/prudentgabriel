import { prisma } from "@/lib/prisma";
import { uniqueProductCountForCollection } from "@/lib/collection-products";
import { CollectionsClient } from "@/components/admin/CollectionsClient";

export default async function AdminCollectionsPage() {
  const rows = await prisma.collection.findMany({
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
  });
  const counts = await Promise.all(rows.map((c) => uniqueProductCountForCollection(c.id, c.autoTag)));

  const collections = rows.map((c, i) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    excerpt: c.excerpt,
    coverImage: c.coverImage,
    autoTag: c.autoTag,
    season: c.season,
    year: c.year,
    isFeatured: c.isFeatured,
    isPublished: c.isPublished,
    displayOrder: c.displayOrder,
    productCount: counts[i] ?? 0,
  }));

  return (
    <div>
      <h1 className="admin-heading-pill glass-1 glass-pill font-display text-2xl text-ink">Collections</h1>
      <CollectionsClient collections={collections} />
    </div>
  );
}
