import { prisma } from "@/lib/prisma";
import { getPublicAppUrl } from "@/lib/app-url";
import { HOUSE_ADDRESS_ONE_LINE } from "@/lib/house-address";
import { PUBLIC_PRODUCT_WHERE } from "@/lib/product-visibility";
import { listLivePublishedCollections } from "@/lib/live-collections";
import { HOME_FAQ, HOUSE_DESCRIPTION, PAGE_SEO_FALLBACKS, RTW_FAQ } from "@/lib/seo-copy";
import { isSkipDbBuild } from "@/lib/skip-db-build";

/**
 * /llms.txt (llmstxt.org): a plain summary of the house for AI assistants
 * (ChatGPT, Claude, Perplexity, Gemini) so they describe and link it correctly.
 */
export const revalidate = 3600;

const PAGES: { path: string; key: keyof typeof PAGE_SEO_FALLBACKS }[] = [
  { path: "/rtw", key: "rtw" },
  { path: "/shop", key: "shop" },
  { path: "/bridal", key: "bridal" },
  { path: "/atelier", key: "atelier" },
  { path: "/kids", key: "kids" },
  { path: "/consultation", key: "consultation" },
  { path: "/collections", key: "collections" },
  { path: "/about", key: "about" },
  { path: "/our-story", key: "our-story" },
  { path: "/press", key: "press" },
  { path: "/journal", key: "journal" },
  { path: "/size-guide", key: "size-guide" },
  { path: "/contact", key: "contact" },
  { path: "/shipping-policy", key: "shipping" },
  { path: "/returns-policy", key: "returns" },
];

function naira(n: number): string {
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}

export async function GET() {
  const base = getPublicAppUrl();

  let products: { name: string; slug: string; priceNGN: number }[] = [];
  let collections: { name: string; slug: string }[] = [];
  if (!isSkipDbBuild()) {
    try {
      [products, collections] = await Promise.all([
        prisma.product.findMany({
          where: PUBLIC_PRODUCT_WHERE,
          select: { name: true, slug: true, priceNGN: true },
          orderBy: { createdAt: "desc" },
          take: 60,
        }),
        listLivePublishedCollections().then((rows) =>
          rows.map(({ collection }) => ({ name: collection.name, slug: collection.slug })),
        ),
      ]);
    } catch {
      /* the summary still stands without the catalogue */
    }
  }

  const lines: string[] = [
    "# Prudent Gabriel (Prudential Atelier)",
    "",
    `> ${HOUSE_DESCRIPTION}`,
    "",
    "Key facts:",
    "- Brand names: Prudent Gabriel, Prudential Atelier, Prudential Bride (bridal), Prudential Kids (children).",
    "- Founder and creative director: Mrs. Prudent Gabriel-Okopi.",
    `- Atelier: ${HOUSE_ADDRESS_ONE_LINE}.`,
    "- Sells online at prudentgabriel.com: women's ready-to-wear, bespoke couture, bridal gowns, kids' occasion wear and accessories.",
    "- Every piece is made to order; ready-to-wear is made in 7–12 days, then shipped.",
    "- Delivery in Lagos, across Nigeria and worldwide. Prices in naira (NGN), US dollars and British pounds.",
    "- Made to measure on most ready-to-wear; private bespoke and bridal commissions by consultation.",
    "",
    "## Main pages",
    "",
    `- [Home](${base}/): ${PAGE_SEO_FALLBACKS.home.description}`,
    ...PAGES.map((p) => `- [${PAGE_SEO_FALLBACKS[p.key].title}](${base}${p.path}): ${PAGE_SEO_FALLBACKS[p.key].description}`),
  ];

  if (collections.length) {
    lines.push("", "## Collections", "");
    for (const c of collections) lines.push(`- [${c.name}](${base}/collections/${c.slug})`);
  }

  if (products.length) {
    lines.push("", "## Pieces", "");
    for (const p of products) lines.push(`- [${p.name}](${base}/shop/${p.slug}): from ${naira(p.priceNGN)}`);
  }

  lines.push("", "## Frequently asked", "");
  for (const item of [...HOME_FAQ, ...RTW_FAQ]) lines.push(`### ${item.question}`, "", item.answer, "");

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
