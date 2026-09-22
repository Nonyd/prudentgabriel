import type { Metadata } from "next";
import { absolutePublicUrl } from "@/lib/app-url";
import { cmsGet, getCMSContent } from "@/lib/cms";
import { getLogoSettingsSafe } from "@/lib/logos";
import { HOUSE_NAME, PAGE_SEO_CMS, PAGE_SEO_FALLBACKS, type PageSeoFallback } from "@/lib/seo-copy";
import { RTW_AISLE, RTW_EXCLUDE_CATEGORY_QUERY, SHOP_ACCESSORIES, SHOP_LISTING } from "@/lib/rtw-aisle";

export const NOINDEX: Metadata["robots"] = { index: false, follow: false };

/** Paths Google must not fetch. A prefix, so `/track` covers `/track` and `/track/…`. */
export const ROBOTS_DISALLOW = [
  "/admin",
  "/account",
  "/api",
  "/auth",
  "/staff",
  "/approve",
  // BA2: personal booking links on approved enquiries.
  "/consultation/book",
  "/receipt",
  "/invoice",
  "/track",
  "/quote",
  "/unsubscribe",
  // The whole checkout (cart hand-off, steps, restore links) — never a landing page.
  "/checkout",
] as const;

export function withHouse(title: string): string {
  const t = title.trim();
  if (!t) return HOUSE_NAME;
  if (/prudential atelier|prudent gabriel/i.test(t)) return t;
  return `${t} · ${HOUSE_NAME}`;
}

export function firstSentence(text: string, max = 70): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const cut = clean.split(/(?<=[.!?])\s/)[0] ?? clean;
  if (cut.length <= max) return cut.replace(/[.!?]$/, "");
  return `${cut.slice(0, max).trim()}…`;
}

export function productSeoTitle(input: {
  name: string;
  metaTitle?: string | null;
  description: string;
}): string {
  const custom = input.metaTitle?.trim();
  if (custom) return withHouse(custom);
  const gist = firstSentence(input.description, 72);
  if (gist && !gist.toLowerCase().startsWith(input.name.toLowerCase())) {
    return withHouse(`${input.name} — ${gist}`);
  }
  return withHouse(`${input.name}, made to order in Lagos`);
}

export function productSeoDescription(input: {
  metaDescription?: string | null;
  description: string;
}): string {
  const custom = input.metaDescription?.trim();
  if (custom) return custom;
  const body = input.description.replace(/\s+/g, " ").trim();
  const made = "Made to order in Lagos in 7–12 days.";
  if (!body) return `A piece from Prudential Atelier. ${made}`;
  if (body.length <= 140) {
    return body.endsWith(".") ? `${body} ${made}` : `${body}. ${made}`;
  }
  return `${body.slice(0, 140).trim()}… ${made}`;
}

export function flattenSearchParams(sp: Record<string, string | string[] | undefined>): URLSearchParams {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string" && v.length) u.set(k, v);
    else if (Array.isArray(v) && typeof v[0] === "string") u.set(k, v[0]);
  }
  return u;
}

/**
 * Filtered/sorted shop views collapse to the aisle. Pagination keeps its own URL,
 * without sort, so page 2 is not a duplicate of page 1.
 */
export function shopCanonicalPath(sp: URLSearchParams): string {
  const rawPage = Number.parseInt(sp.get("page") ?? "1", 10);
  const page = Number.isFinite(rawPage) && rawPage > 1 ? rawPage : 1;
  const cat = sp.get("category");
  const type = sp.get("type");
  const exclude = sp.get("excludeCategory");

  let aisle = SHOP_LISTING;
  if (cat === "BRIDAL") aisle = "/bridal";
  else if (cat === "KIDDIES") aisle = "/kids";
  else if (cat === "ACCESSORIES") aisle = SHOP_ACCESSORIES;
  else if (type === "BESPOKE") aisle = "/atelier";
  else if (type === "RTW" || exclude === RTW_EXCLUDE_CATEGORY_QUERY) aisle = RTW_AISLE;

  if (page <= 1) return aisle;

  const n = new URLSearchParams();
  if (cat) n.set("category", cat);
  if (type) n.set("type", type);
  if (exclude) n.set("excludeCategory", exclude);
  n.set("page", String(page));
  return `${SHOP_LISTING}?${n.toString()}`;
}

export function rtwCanonicalPath(sp: URLSearchParams): string {
  const rawPage = Number.parseInt(sp.get("page") ?? "1", 10);
  const page = Number.isFinite(rawPage) && rawPage > 1 ? rawPage : 1;
  return page > 1 ? `${RTW_AISLE}?page=${page}` : RTW_AISLE;
}

function toOgImages(image: string | null | undefined, alt: string): { url: string; alt: string }[] | undefined {
  const raw = image?.trim();
  if (!raw) return undefined;
  return [{ url: absolutePublicUrl(raw), alt }];
}

export function pageMetadata(opts: {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  imageAlt?: string;
  noindex?: boolean;
  type?: "website" | "article";
}): Metadata {
  const title = withHouse(opts.title);
  const url = absolutePublicUrl(opts.path.startsWith("/") || opts.path.startsWith("http") ? opts.path : `/${opts.path}`);
  const images = toOgImages(opts.image, opts.imageAlt ?? title);
  return {
    title: { absolute: title },
    description: opts.description,
    alternates: { canonical: url },
    robots: opts.noindex ? NOINDEX : { index: true, follow: true },
    openGraph: {
      type: opts.type === "article" ? "article" : "website",
      locale: "en_NG",
      url,
      siteName: HOUSE_NAME,
      title,
      description: opts.description,
      ...(images ? { images } : {}),
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title,
      description: opts.description,
      ...(images ? { images: images.map((i) => i.url) } : {}),
    },
  };
}

export async function houseShareImage(): Promise<string | undefined> {
  const cms = await getCMSContent(["home_seo_image", "home_hero_image"]);
  const fromCms = cmsGet(cms, "home_seo_image", "") || cmsGet(cms, "home_hero_image", "");
  if (fromCms.trim()) return fromCms.trim();
  try {
    const logos = await getLogoSettingsSafe();
    return logos.logoDark || logos.logoWhite || undefined;
  } catch {
    return undefined;
  }
}

export async function cmsRouteMetadata(
  cmsPageId: keyof typeof PAGE_SEO_CMS,
  path: string,
  extra?: { image?: string | null },
): Promise<Metadata> {
  const def = PAGE_SEO_CMS[cmsPageId];
  const fallback = PAGE_SEO_FALLBACKS[def.prefix] ?? {
    title: def.title,
    description: def.description,
  };
  return routeMetadata(def.prefix, path, fallback, extra);
}

export async function routeMetadata(
  prefix: string,
  path: string,
  fallback: PageSeoFallback,
  extra?: { image?: string | null },
): Promise<Metadata> {
  const cms = await getCMSContent([`${prefix}_seo_title`, `${prefix}_seo_description`, `${prefix}_seo_image`]);
  const title = cmsGet(cms, `${prefix}_seo_title`, "") || fallback.title;
  const description = cmsGet(cms, `${prefix}_seo_description`, "") || fallback.description;
  const image = extra?.image || cmsGet(cms, `${prefix}_seo_image`, "") || (await houseShareImage());
  return pageMetadata({ title, description, path, image });
}

export function tokenRouteMetadata(title: string): Metadata {
  return {
    title: { absolute: withHouse(title) },
    robots: NOINDEX,
  };
}

const LEGAL_SEO_ROUTES = {
  privacy: "/privacy-policy",
  terms: "/terms-and-conditions",
  cookie: "/cookie-policy",
  returns: "/returns-policy",
  shipping: "/shipping-policy",
} as const;

export async function legalRouteMetadata(kind: keyof typeof LEGAL_SEO_ROUTES): Promise<Metadata> {
  return routeMetadata(kind, LEGAL_SEO_ROUTES[kind], PAGE_SEO_FALLBACKS[kind]);
}
