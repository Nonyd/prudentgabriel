/**
 * Staging and every non-production deployment are noindex; production is not.
 * Decided by the deployment's own public URL (search-indexing.mjs), not a flag.
 *
 *   pnpm test:search-indexing                                         # no network
 *   BASE_URL=https://staging.prudentgabriel.com pnpm test:search-indexing
 */
import {
  INDEXABLE_HOSTS,
  NOINDEX_HEADER_VALUE,
  isIndexableSiteUrl,
  searchIndexingAllowed,
} from "../search-indexing.mjs";
import nextConfig from "../next.config.mjs";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

type HeaderRule = { source: string; headers: { key: string; value: string }[] };

async function robotsHeaderFor(appUrl: string): Promise<HeaderRule | undefined> {
  const saved = process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXT_PUBLIC_APP_URL = appUrl;
  try {
    const rules = (await nextConfig.headers!()) as HeaderRule[];
    return rules.find((r) => r.headers.some((h) => h.key.toLowerCase() === "x-robots-tag"));
  } finally {
    process.env.NEXT_PUBLIC_APP_URL = saved;
  }
}

async function unit() {
  assert(isIndexableSiteUrl("https://prudentgabriel.com"), "production URL is indexable");
  assert(isIndexableSiteUrl("prudentgabriel.com"), "bare production host is indexable");
  assert(isIndexableSiteUrl("https://www.prudentgabriel.com/"), "www production host is indexable");
  for (const u of [
    "https://staging.prudentgabriel.com",
    "http://localhost:3000",
    "https://prudentgabriel.com.evil.example",
    "https://pr-12.vercel.app",
    "",
  ]) {
    assert(!isIndexableSiteUrl(u), `${u || "(empty)"} is not indexable`);
  }
  assert(!searchIndexingAllowed({}), "no URL configured → noindex (default deny)");
  assert(INDEXABLE_HOSTS.every((h) => h.endsWith("prudentgabriel.com")), "only production hosts are indexable");

  // Production must NOT send the header; staging must, on every path.
  assert(!(await robotsHeaderFor("https://prudentgabriel.com")), "production sends no X-Robots-Tag");
  const staging = await robotsHeaderFor("https://staging.prudentgabriel.com");
  assert(staging, "staging sends X-Robots-Tag");
  assert(staging.source === "/:path*", "staging header covers every path");
  assert(
    staging.headers.find((h) => h.key === "X-Robots-Tag")?.value === NOINDEX_HEADER_VALUE,
    "staging header is noindex, nofollow",
  );
  console.log("ok unit: production indexable, everything else noindex");
}

async function live(base: string) {
  const host = new URL(base).hostname;
  assert(!isIndexableSiteUrl(base), `BASE_URL ${host} must be a non-production deployment`);
  for (const p of ["/", "/shop", "/api/products?limit=1", "/robots.txt", "/sitemap.xml", "/favicon.ico"]) {
    const res = await fetch(base + p, { redirect: "manual" });
    const tag = res.headers.get("x-robots-tag");
    assert(tag === NOINDEX_HEADER_VALUE, `${p} → X-Robots-Tag ${JSON.stringify(tag)}`);
    await res.arrayBuffer();
  }
  const robots = await (await fetch(`${base}/robots.txt`)).text();
  assert(/Disallow: \/\s*$/m.test(robots), "robots.txt disallows everything");
  assert(!/^Allow:/im.test(robots), "robots.txt allows nothing");
  assert(!/Sitemap:/i.test(robots), "robots.txt advertises no sitemap");
  console.log(`ok live ${host}: noindex on every response, robots.txt disallows all`);
}

async function main() {
  await unit();
  const base = process.env.BASE_URL?.replace(/\/$/, "");
  if (base) await live(base);
  else console.log("skip live checks: set BASE_URL to a non-production deployment");
  console.log("OK test-search-indexing");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
