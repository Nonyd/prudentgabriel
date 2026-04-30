import type { MetadataRoute } from "next";
import { getPublicAppUrl } from "@/lib/app-url";
import { prisma } from "@/lib/prisma";

const STATIC_PATHS: {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[0]["changeFrequency"];
  priority: number;
}[] = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  { path: "/shop", changeFrequency: "daily", priority: 0.9 },
  { path: "/rtw", changeFrequency: "daily", priority: 0.9 },
  { path: "/collections", changeFrequency: "weekly", priority: 0.8 },
  { path: "/atelier", changeFrequency: "weekly", priority: 0.8 },
  { path: "/bridal", changeFrequency: "weekly", priority: 0.8 },
  { path: "/kids", changeFrequency: "weekly", priority: 0.7 },
  { path: "/bespoke", changeFrequency: "monthly", priority: 0.8 },
  { path: "/consultation", changeFrequency: "weekly", priority: 0.85 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.7 },
  { path: "/our-story", changeFrequency: "monthly", priority: 0.7 },
  { path: "/press", changeFrequency: "monthly", priority: 0.6 },
  { path: "/legal/privacy", changeFrequency: "yearly", priority: 0.4 },
  { path: "/legal/terms", changeFrequency: "yearly", priority: 0.4 },
  { path: "/legal/returns", changeFrequency: "yearly", priority: 0.4 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getPublicAppUrl();
  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map(({ path, changeFrequency, priority }) => ({
    url: `${base}${path || "/"}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));

  let collectionEntries: MetadataRoute.Sitemap = [];
  try {
    const collections = await prisma.collection.findMany({
      where: { isPublished: true },
      select: { slug: true, updatedAt: true },
    });
    collectionEntries = collections.map((c) => ({
      url: `${base}/collections/${c.slug}`,
      lastModified: c.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
  } catch {
    collectionEntries = [];
  }

  return [...staticEntries, ...collectionEntries];
}
