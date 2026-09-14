import type { MetadataRoute } from "next";
import { getPublicAppUrl } from "@/lib/app-url";
import { ROBOTS_DISALLOW } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const base = getPublicAppUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...ROBOTS_DISALLOW],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
