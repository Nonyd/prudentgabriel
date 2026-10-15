import type { MetadataRoute } from "next";
import { getPublicAppUrl } from "@/lib/app-url";
import { ROBOTS_DISALLOW } from "@/lib/seo";
import { isIndexableSiteUrl } from "../../search-indexing.mjs";

const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "meta-externalagent",
  "Amazonbot",
  "DuckAssistBot",
] as const;

export default function robots(): MetadataRoute.Robots {
  const base = getPublicAppUrl();
  // Staging, previews and localhost: disallow everything and advertise no sitemap.
  if (!isIndexableSiteUrl(base)) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: [...ROBOTS_DISALLOW] },
      // AI search and assistants, named so the welcome is explicit. Cloudflare's
      // "Block AI bots" switch overrides this and must stay off.
      { userAgent: [...AI_CRAWLERS], allow: ["/", "/llms.txt"], disallow: [...ROBOTS_DISALLOW] },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
