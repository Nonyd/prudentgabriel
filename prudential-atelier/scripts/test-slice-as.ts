/**
 * Slice AS — robots, sitemap, 301s, titles, structured data.
 *
 *   pnpm test:slice-as
 */
import "./preload-test-env";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ProductCategory, ProductType } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { ROBOTS_DISALLOW, shopCanonicalPath, tokenRouteMetadata, withHouse } from "../src/lib/seo";
import { PAGE_SEO_FALLBACKS, uniqueFallbackTitles } from "../src/lib/seo-copy";
import { buildSitemap, sitemapExcludesPath, SITEMAP_EXCLUDED_PATHS } from "../src/lib/sitemap-build";
import { productJsonLd, organizationJsonLd, articleJsonLd, breadcrumbJsonLd } from "../src/lib/seo-jsonld";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (rel: string) => readFileSync(join(root, rel), "utf8");
const stamp = `slice-as-${Date.now()}`;
const ids = { productIds: [] as string[] };

async function cleanup() {
  if (ids.productIds.length) {
    await prisma.product.deleteMany({ where: { id: { in: ids.productIds } } });
  }
}

function testSource() {
  const robots = src("src/app/robots.ts");
  assert(robots.includes("ROBOTS_DISALLOW"), "robots.txt uses the shared disallow list");

  for (const path of ["/staff", "/approve", "/receipt", "/invoice", "/track"] as const) {
    assert(ROBOTS_DISALLOW.includes(path), `robots disallow ${path}`);
  }

  const noindex = JSON.stringify(tokenRouteMetadata("Order tracking"));
  assert(noindex.includes('"index":false'), "token routes are noindex");
  assert(noindex.includes('"follow":false'), "token routes are nofollow");

  for (const rel of [
    "src/app/(storefront)/track/page.tsx",
    "src/app/(storefront)/track/[trackingToken]/page.tsx",
    "src/app/approve/[token]/page.tsx",
    "src/app/receipt/[token]/page.tsx",
    "src/app/invoice/[token]/page.tsx",
    "src/app/(staff)/layout.tsx",
  ]) {
    const body = src(rel);
    assert(
      body.includes("tokenRouteMetadata") || body.includes("NOINDEX"),
      `${rel} is noindex, nofollow`,
    );
  }

  const sitemap = src("src/lib/sitemap-build.ts");
  assert(sitemap.includes("isPublished: true"), "sitemap only lists published products");
  assert(sitemap.includes("BlogStatus.PUBLISHED"), "sitemap only lists published journal");
  assert(sitemap.includes("listLivePublishedCollections"), "sitemap only lists live collections");
  assert(sitemap.includes('path: "/journal"'), "sitemap includes the journal");
  assert(sitemap.includes('path: "/privacy-policy"'), "sitemap lists the live privacy policy");
  assert(!sitemap.includes('path: "/bespoke"'), "sitemap does not list /bespoke as a static URL");
  assert(!sitemap.includes('path: "/legal/privacy"'), "sitemap does not list old legal paths");

  for (const dead of ["/bespoke", "/legal/privacy", "/track", "/staff", "/approve"]) {
    assert(SITEMAP_EXCLUDED_PATHS.includes(dead), `excluded path ${dead}`);
    assert(sitemapExcludesPath(`https://staging.prudentgabriel.com${dead}/secret`), `excludes ${dead} subtree`);
  }

  const redirects = src("redirects.mjs");
  assert(redirects.includes('source: "/legal/privacy"'), "privacy 301");
  assert(redirects.includes('source: "/bespoke"'), "bespoke 301");
  assert(redirects.includes('source: "/rtw/:slug"'), "rtw slug 301");
  assert(redirects.includes("permanent: true"), "redirects are permanent");
  assert(src("next.config.mjs").includes("PERMANENT_REDIRECTS"), "next.config serves the 301 list");

  const rootLayout = src("src/app/layout.tsx");
  assert(rootLayout.includes('template: "%s"'), "root title template does not double the house name");

  const titles = uniqueFallbackTitles();
  const seen = new Set<string>();
  for (const title of titles) {
    const abs = withHouse(title);
    assert(!seen.has(abs), `unique title: ${abs}`);
    seen.add(abs);
  }

  const indexable = [
    ["src/app/(storefront)/about/page.tsx", "about"],
    ["src/app/(storefront)/contact/page.tsx", "contact"],
    ["src/app/(storefront)/journal/page.tsx", "journal"],
    ["src/app/(storefront)/our-story/page.tsx", "our-story"],
    ["src/app/(storefront)/press/page.tsx", "press"],
    ["src/app/(storefront)/size-guide/page.tsx", "size-guide"],
    ["src/app/(storefront)/careers/page.tsx", "careers"],
  ] as const;
  for (const [rel, id] of indexable) {
    assert(src(rel).includes(`cmsRouteMetadata("${id}"`), `${id} has its own title`);
  }

  const journalPost = src("src/app/(storefront)/journal/[slug]/page.tsx");
  assert(journalPost.includes("getPublishedJournalPost"), "journal posts render on the server");
  assert(!journalPost.includes("fetch(`/api/blog/public"), "journal posts are not client-fetched");

  const pdp = src("src/app/(storefront)/shop/[slug]/page.tsx");
  assert(pdp.includes("isPublished: true"), "unpublished PDPs are not loaded");
  assert(pdp.includes("notFound()"), "unpublished PDPs 404");
  assert(pdp.includes("productSeoTitle"), "PDP uses metaTitle with a generated fallback");
  assert(pdp.includes("productJsonLd"), "PDP emits Product JSON-LD");
  assert(pdp.includes("gallerySwipeAlt"), "every gallery frame has alt text");

  const gallery = src("src/components/product/ProductGallery.tsx");
  assert(gallery.includes("productName"), "gallery receives the product name for alts");

  const shop = src("src/lib/seo.ts");
  assert(shop.includes("alternates: { canonical: url }"), "indexable pages set a canonical");

  assert(shopCanonicalPath(new URLSearchParams("category=BRIDAL")) === "/bridal", "bridal filter canonicalises to the aisle");
  assert(shopCanonicalPath(new URLSearchParams("sort=price-asc")) === "/shop", "sort canonicalises to the clean shop URL");
  assert(
    shopCanonicalPath(new URLSearchParams("category=FORMAL&page=2")) === "/shop?category=FORMAL&page=2",
    "paginated shop keeps its own canonical",
  );
  assert(shopCanonicalPath(new URLSearchParams("type=RTW&page=2")) === "/shop?type=RTW&page=2", "paginated RTW filter keeps page");

  const productLd = productJsonLd({
    name: "Avril",
    description: "A dress.",
    images: ["https://example.com/a.jpg"],
    url: "https://staging.prudentgabriel.com/shop/avril",
    priceNGN: 120000,
  });
  assert(productLd["@type"] === "Product", "Product JSON-LD");
  assert((productLd.offers as { availability: string }).availability.includes("InStock"), "availability is InStock");

  const org = organizationJsonLd({});
  assert(org["@type"] === "Organization", "Organization JSON-LD");
  assert(JSON.stringify(org).includes("Ajah"), "Organization has the Lagos address");
  assert(JSON.stringify(org).includes("sameAs"), "Organization lists socials");

  const crumbs = breadcrumbJsonLd([{ name: "Shop", path: "/shop" }, { name: "Avril", path: "/shop/avril" }]);
  assert(crumbs["@type"] === "BreadcrumbList", "BreadcrumbList JSON-LD");

  const article = articleJsonLd({
    title: "Soft Shift",
    description: "A story.",
    url: "https://staging.prudentgabriel.com/journal/soft-shift",
  });
  assert(article["@type"] === "Article", "Article JSON-LD");

  assert(PAGE_SEO_FALLBACKS.home.title !== PAGE_SEO_FALLBACKS.about.title, "home and about titles differ");
  assert(src("src/lib/cms-config.ts").includes("Search and sharing"), "SEO fields live in the CMS");
}

async function testSitemapDb() {
  const live = await prisma.product.create({
    data: {
      name: `${stamp} Live`,
      slug: `${stamp}-live`,
      description: "A live piece.",
      category: ProductCategory.FORMAL,
      type: ProductType.RTW,
      priceNGN: 50_000,
      basePriceNGN: 50_000,
      isPublished: true,
    },
  });
  ids.productIds.push(live.id);

  const hidden = await prisma.product.create({
    data: {
      name: `${stamp} Hidden`,
      slug: `${stamp}-hidden`,
      description: "Not for Google.",
      category: ProductCategory.FORMAL,
      type: ProductType.RTW,
      priceNGN: 50_000,
      basePriceNGN: 50_000,
      isPublished: false,
    },
  });
  ids.productIds.push(hidden.id);

  const map = await buildSitemap();
  const urls = map.map((row) => row.url);

  assert(
    urls.some((u) => u.endsWith(`/shop/${live.slug}`)),
    "sitemap includes every live product",
  );
  assert(
    !urls.some((u) => u.endsWith(`/shop/${hidden.slug}`)),
    "sitemap excludes unpublished products",
  );

  const published = await prisma.product.findMany({
    where: { isPublished: true },
    select: { slug: true },
  });
  for (const p of published) {
    assert(
      urls.some((u) => u.endsWith(`/shop/${p.slug}`)),
      `live product ${p.slug} is in the sitemap`,
    );
  }

  assert(
    urls.every((u) => !sitemapExcludesPath(u)),
    "sitemap has no token-gated or retired paths",
  );
}

async function run() {
  testSource();
  try {
    await testSitemapDb();
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
  console.log("slice-as: ok");
}

run().catch(async (err) => {
  await cleanup().catch(() => undefined);
  await prisma.$disconnect().catch(() => undefined);
  console.error(err);
  process.exit(1);
});
