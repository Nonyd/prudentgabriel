import type { Metadata } from "next";
import { listLivePublishedCollections } from "@/lib/live-collections";
import { CollectionsPage } from "@/components/collections/CollectionsPage";
import { isSkipDbBuild } from "@/lib/skip-db-build";
import { cmsRouteMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return cmsRouteMetadata("collections", "/collections");
}

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
