import type { MetadataRoute } from "next";
import { getPublicAppUrl } from "@/lib/app-url";

const PATHS: { path: string; changeFrequency: MetadataRoute.Sitemap[0]["changeFrequency"]; priority: number }[] = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  { path: "/shop", changeFrequency: "daily", priority: 0.9 },
  { path: "/bespoke", changeFrequency: "monthly", priority: 0.8 },
  { path: "/consultation", changeFrequency: "weekly", priority: 0.85 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.7 },
  { path: "/our-story", changeFrequency: "monthly", priority: 0.7 },
  { path: "/press", changeFrequency: "monthly", priority: 0.6 },
  { path: "/legal/privacy", changeFrequency: "yearly", priority: 0.4 },
  { path: "/legal/terms", changeFrequency: "yearly", priority: 0.4 },
  { path: "/legal/returns", changeFrequency: "yearly", priority: 0.4 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getPublicAppUrl();
  const lastModified = new Date();
  return PATHS.map(({ path, changeFrequency, priority }) => ({
    url: `${base}${path || "/"}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
