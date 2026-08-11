import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  mergePublishedCollectionProducts,
  sortCollectionProducts,
  uniqueProductCountForCollection,
} from "@/lib/collection-products";
import { CollectionDetailPage } from "@/components/collections/CollectionDetailPage";
import { optimizeImageUrl } from "@/lib/utils";

export const revalidate = 300;

const PAGE_LIMIT = 24;

export async function generateStaticParams() {
  if (process.env.SKIP_DB_BUILD === "1" || !process.env.DATABASE_URL?.trim()) return [];
  try {
    const rows = await prisma.collection.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { slug: true },
    });
    return rows.map((r) => ({ slug: r.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const c = await prisma.collection.findFirst({
    where: { slug, isPublished: true },
  });
  if (!c) return { title: "Collection | Prudent Gabriel" };
  const title = c.metaTitle?.trim() || `${c.name} | Prudent Gabriel`;
  const description = c.metaDescription?.trim() || c.excerpt || c.description || undefined;
  const images = c.coverImage
    ? [{ url: optimizeImageUrl(c.coverImage, 1200), alt: c.coverImageAlt || c.name }]
    : undefined;
  return { title, description, openGraph: { title, description, images } };
}

export default async function CollectionSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const collection = await prisma.collection.findFirst({
    where: { slug, isPublished: true },
  });
  if (!collection) notFound();

  const merged = await mergePublishedCollectionProducts(collection.id, collection.autoTag);
  const sorted = sortCollectionProducts(merged, "");
  const total = sorted.length;
  const slice = sorted.slice(0, PAGE_LIMIT);
  const hasNext = PAGE_LIMIT < total;

  const others = await prisma.collection.findMany({
    where: { isPublished: true, slug: { not: slug } },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
    take: 3,
  });
  const otherCounts = await Promise.all(others.map((o) => uniqueProductCountForCollection(o.id, o.autoTag)));
  const otherCollections = others.map((o, i) => ({
    slug: o.slug,
    name: o.name,
    coverImage: o.coverImage,
    excerpt: o.excerpt,
    productCount: otherCounts[i] ?? 0,
  }));

  const hero = {
    id: collection.id,
    name: collection.name,
    slug: collection.slug,
    description: collection.description,
    excerpt: collection.excerpt,
    coverImage: collection.coverImage,
    coverImageAlt: collection.coverImageAlt,
    autoTag: collection.autoTag,
    season: collection.season,
    year: collection.year,
  };

  return (
    <CollectionDetailPage
      collection={hero}
      initialProducts={slice}
      total={total}
      initialPage={1}
      initialHasNext={hasNext}
      otherCollections={otherCollections}
    />
  );
}
