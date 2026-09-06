import { unstable_cache } from "next/cache";
import { getCMSContent } from "@/lib/cms";
import { isMaintenanceEnabled } from "@/lib/maintenance";

export const STOREFRONT_CACHE_TAGS = {
  cmsChrome: "cms-chrome",
  maintenance: "maintenance",
  navCollections: "nav-collections",
} as const;

export function getCachedCMSContent(keys: string[], tag: string) {
  return unstable_cache(
    async () => getCMSContent(keys),
    ["cms-content", tag, ...keys],
    { tags: [tag], revalidate: 60 },
  )();
}

export const getCachedMaintenanceEnabled = unstable_cache(
  async () => isMaintenanceEnabled(),
  ["maintenance-mode"],
  { tags: [STOREFRONT_CACHE_TAGS.maintenance], revalidate: 30 },
);

export const getNavCollections = unstable_cache(
  async () => {
    if (process.env.SKIP_DB_BUILD === "1") return [] as { name: string; slug: string }[];
    try {
      const { listLivePublishedCollections } = await import("@/lib/live-collections");
      const live = await listLivePublishedCollections();
      return live.map(({ collection }) => ({ name: collection.name, slug: collection.slug }));
    } catch {
      return [];
    }
  },
  ["nav-collections"],
  { tags: [STOREFRONT_CACHE_TAGS.navCollections], revalidate: 3600 },
);
