import type { MetadataRoute } from "next";
import { getPublicAppUrl } from "@/lib/app-url";
import { ROBOTS_DISALLOW } from "@/lib/seo";
import { isIndexableSiteUrl } from "../../search-indexing.mjs";

export default function robots(): MetadataRoute.Robots {
  const base = getPublicAppUrl();
  // Staging, previews and localhost: disallow everything and advertise no sitemap.
  if (!isIndexableSiteUrl(base)) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...ROBOTS_DISALLOW],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
