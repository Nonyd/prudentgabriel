import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { uniqueProductCountForCollection } from "@/lib/collection-products";
import { CollectionsPage } from "@/components/collections/CollectionsPage";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Collections | Prudent Gabriel",
  description: "Curated fashion collections from Prudent Gabriel — discover the edit.",
};

export default async function CollectionsListingPage() {
  const rows = await prisma.collection.findMany({
    where: { isPublished: true },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
  });

  const counts = await Promise.all(rows.map((c) => uniqueProductCountForCollection(c.id, c.autoTag)));

  const collections = rows.map((c, i) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    excerpt: c.excerpt,
    coverImage: c.coverImage,
    coverImageAlt: c.coverImageAlt,
    season: c.season,
    year: c.year,
    productCount: counts[i] ?? 0,
  }));

  return <CollectionsPage collections={collections} />;
}
