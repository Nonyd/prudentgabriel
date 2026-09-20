import type { MetadataRoute } from "next";
import { BlogStatus } from "@prisma/client";
import { absolutePublicUrl, getPublicAppUrl } from "@/lib/app-url";
import { listLivePublishedCollections } from "@/lib/live-collections";
import { prisma } from "@/lib/prisma";
import { isSkipDbBuild } from "@/lib/skip-db-build";

const STATIC_PATHS: {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[0]["changeFrequency"];
  priority: number;
}[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/shop", changeFrequency: "daily", priority: 0.9 },
  { path: "/rtw", changeFrequency: "daily", priority: 0.9 },
  { path: "/collections", changeFrequency: "weekly", priority: 0.8 },
  { path: "/atelier", changeFrequency: "weekly", priority: 0.8 },
  { path: "/bridal", changeFrequency: "weekly", priority: 0.8 },
  { path: "/kids", changeFrequency: "weekly", priority: 0.7 },
  { path: "/consultation", changeFrequency: "weekly", priority: 0.85 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.7 },
  { path: "/about", changeFrequency: "monthly", priority: 0.75 },
  { path: "/journal", changeFrequency: "weekly", priority: 0.7 },
  { path: "/size-guide", changeFrequency: "monthly", priority: 0.65 },
  { path: "/our-story", changeFrequency: "monthly", priority: 0.7 },
  { path: "/press", changeFrequency: "monthly", priority: 0.6 },
  { path: "/careers", changeFrequency: "monthly", priority: 0.5 },
  { path: "/privacy-policy", changeFrequency: "yearly", priority: 0.4 },
  { path: "/terms-and-conditions", changeFrequency: "yearly", priority: 0.4 },
  { path: "/returns-policy", changeFrequency: "yearly", priority: 0.4 },
  { path: "/cookie-policy", changeFrequency: "yearly", priority: 0.4 },
  { path: "/shipping-policy", changeFrequency: "yearly", priority: 0.4 },
];

export const SITEMAP_EXCLUDED_PATHS = [
  "/bespoke",
  "/legal/privacy",
  "/legal/terms",
  "/legal/returns",
  "/approve",
  "/receipt",
  "/invoice",
  "/track",
  "/staff",
  "/admin",
  "/quote",
  "/unsubscribe",
];

export function sitemapExcludesPath(url: string): boolean {
  try {
    const path = new URL(url).pathname;
    return SITEMAP_EXCLUDED_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
  } catch {
    return true;
  }
}

export async function buildSitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getPublicAppUrl();
  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map(({ path, changeFrequency, priority }) => ({
    url: `${base}${path === "/" ? "/" : path}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));

  if (isSkipDbBuild()) return staticEntries;

  let products: MetadataRoute.Sitemap = [];
  let collections: MetadataRoute.Sitemap = [];
  let posts: MetadataRoute.Sitemap = [];

  try {
    const rows = await prisma.product.findMany({
      where: { isPublished: true },
      select: {
        slug: true,
        updatedAt: true,
        publishedAt: true,
        images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
      },
    });
    products = rows.map((p) => ({
      url: `${base}/shop/${p.slug}`,
      lastModified: p.updatedAt ?? p.publishedAt ?? new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
      images: p.images[0]?.url ? [absolutePublicUrl(p.images[0].url)] : undefined,
    }));
  } catch {
    products = [];
  }

  try {
    const live = await listLivePublishedCollections();
    collections = live.map(({ collection: c }) => ({
      url: `${base}/collections/${c.slug}`,
      lastModified: c.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
  } catch {
    collections = [];
  }

  try {
    const journal = await prisma.blogPost.findMany({
      where: { status: BlogStatus.PUBLISHED, publishedAt: { lte: new Date() } },
      select: { slug: true, updatedAt: true, publishedAt: true },
    });
    posts = journal.map((p) => ({
      url: `${base}/journal/${p.slug}`,
      lastModified: p.updatedAt ?? p.publishedAt ?? new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }));
  } catch {
    posts = [];
  }

  return [...staticEntries, ...products, ...collections, ...posts];
}
