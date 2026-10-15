import type { MetadataRoute } from "next";
import { getPublicAppUrl } from "@/lib/app-url";
import { buildSitemap } from "@/lib/sitemap-build";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = await buildSitemap();
  const faqs = `${getPublicAppUrl()}/faqs`;
  if (entries.some((e) => e.url === faqs)) return entries;
  // Beside /size-guide, with the other client pages.
  const entry: MetadataRoute.Sitemap[number] = {
    url: faqs,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.65,
  };
  const at = entries.findIndex((e) => e.url.endsWith("/size-guide"));
  return at >= 0 ? [...entries.slice(0, at + 1), entry, ...entries.slice(at + 1)] : [...entries, entry];
}
