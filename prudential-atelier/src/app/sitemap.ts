import type { MetadataRoute } from "next";
import { buildSitemap } from "@/lib/sitemap-build";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return buildSitemap();
}
