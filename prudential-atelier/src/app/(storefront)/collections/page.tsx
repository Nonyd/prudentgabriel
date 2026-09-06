import type { Metadata } from "next";
import { listLivePublishedCollections } from "@/lib/live-collections";
import { CollectionsPage } from "@/components/collections/CollectionsPage";
import { isSkipDbBuild } from "@/lib/skip-db-build";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Ready-to-Wear Collections | Prudent Gabriel",
  description:
    "Explore curated ready-to-wear collections from Prudential Atelier — house edits with their own mood, silhouette, and story.",
};

export default async function CollectionsListingPage() {
  if (isSkipDbBuild()) {
    return <CollectionsPage collections={[]} />;
  }
  const live = await listLivePublishedCollections();

  const collections = live.map(({ collection: c, productCount }) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    excerpt: c.excerpt,
    coverImage: c.coverImage,
    coverImageAlt: c.coverImageAlt,
    season: c.season,
    year: c.year,
    productCount,
  }));

  return <CollectionsPage collections={collections} />;
}
