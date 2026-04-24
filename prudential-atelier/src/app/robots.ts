import type { MetadataRoute } from "next";
import { getPublicAppUrl } from "@/lib/app-url";

export default function robots(): MetadataRoute.Robots {
  const base = getPublicAppUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/account/", "/api/", "/auth/"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
