import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  mergePublishedCollectionProducts,
  sortCollectionProducts,
} from "@/lib/collection-products";
import { findLivePublishedCollection, listLivePublishedCollections } from "@/lib/live-collections";
import { CollectionDetailPage } from "@/components/collections/CollectionDetailPage";
import { optimizeImageUrl } from "@/lib/utils";
import type { CollectionReelRecord } from "@/lib/collection-gallery";

export const revalidate = 300;

const PAGE_LIMIT = 24;

export async function generateStaticParams() {
  if (process.env.SKIP_DB_BUILD === "1" || !process.env.DATABASE_URL?.trim()) return [];
  try {
    const live = await listLivePublishedCollections();
    return live.map(({ collection }) => ({ slug: collection.slug }));
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
  const c = await findLivePublishedCollection(slug);
  if (!c) return { title: "Collection | Prudent Gabriel" };
  const title = c.metaTitle?.trim() || `${c.name} | Prudent Gabriel`;
  const description = c.metaDescription?.trim() || c.excerpt || c.description || undefined;
  const images = c.coverImage
    ? [{ url: optimizeImageUrl(c.coverImage, 1200), alt: c.coverImageAlt || c.name }]
    : undefined;
  return { title, description, openGraph: { title, description, images } };
}

async function loadActiveReels(collectionId: string): Promise<CollectionReelRecord[]> {
  const rows = await prisma.collectionReel.findMany({
    where: { collectionId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { position: "asc" }],
    include: { product: { select: { name: true, slug: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    position: r.position,
    sortOrder: r.sortOrder,
    isActive: r.isActive,
    videoKey: r.videoKey,
    posterKey: r.posterKey,
    productId: r.productId,
    productName: r.product?.name ?? null,
    productSlug: r.product?.slug ?? null,
  }));
}

export default async function CollectionSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const collection = await findLivePublishedCollection(slug);
  if (!collection) notFound();

  const merged = await mergePublishedCollectionProducts(collection.id, collection.autoTag);
  const sorted = sortCollectionProducts(merged, "");
  const total = sorted.length;
  if (total < 1) notFound();
  const slice = sorted.slice(0, PAGE_LIMIT);
  const hasNext = PAGE_LIMIT < total;

  const [others, reels] = await Promise.all([
    listLivePublishedCollections({ excludeSlug: slug, take: 3 }),
    loadActiveReels(collection.id),
  ]);
  const otherCollections = others.map(({ collection: o, productCount }) => ({
    slug: o.slug,
    name: o.name,
    coverImage: o.coverImage,
    excerpt: o.excerpt,
    productCount,
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
      reels={reels}
    />
  );
}
