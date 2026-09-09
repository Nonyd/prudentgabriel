import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { queryProductList } from "@/lib/products-list-query";
import { RTWPageClient } from "@/components/rtw/RTWPageClient";
import { cmsGet, getCMSContent } from "@/lib/cms";
import { resolveHeroCarouselItems } from "@/lib/hero-carousel";
import { listLivePublishedCollections } from "@/lib/live-collections";
import { prisma } from "@/lib/prisma";
import { CATALOG_PAGE_SIZE, RTW_EXCLUDE_CATEGORY_QUERY, SHOP_ACCESSORIES, SHOP_LISTING } from "@/lib/rtw-aisle";
import { rtwHeroCopy, rtwHeroLooks, rtwHeroSideLooks } from "@/lib/rtw-hero";
import { isSkipDbBuild } from "@/lib/skip-db-build";
import { warmHeroWebmMp4 } from "@/lib/transcode-webm-mp4";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Ready to Wear | Prudent Gabriel",
  description:
    "Shop the latest ready-to-wear collection from Prudent Gabriel — evening, formal, casual, and more, crafted in Lagos.",
};

function flattenSearchParams(sp: Record<string, string | string[] | undefined>) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string" && v.length) u.set(k, v);
    else if (Array.isArray(v) && typeof v[0] === "string") u.set(k, v[0]);
  }
  return u;
}

const RTW_CMS_KEYS = [
  "rtw_hero_carousel",
  "rtw_hero_look_top",
  "rtw_hero_look_bottom",
  "rtw_hero_headline",
  "rtw_hero_subline",
  "rtw_hero_cta_label",
  "rtw_promise_band",
  "rtw_page_title",
  "rtw_page_subtitle",
] as const;

export default async function RTWPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const u = flattenSearchParams(searchParams);
  const category = u.get("category");
  if (category === "ACCESSORIES") redirect(SHOP_ACCESSORIES);
  if (category === "KIDDIES") redirect(`${SHOP_LISTING}?category=KIDDIES`);
  if (category === "BRIDAL") u.delete("category");

  u.set("type", "RTW");
  u.set("excludeCategory", RTW_EXCLUDE_CATEGORY_QUERY);
  u.set("limit", String(CATALOG_PAGE_SIZE));
  if (!u.get("sort")) u.set("sort", "featured");

  let products: Awaited<ReturnType<typeof queryProductList>>["products"] = [];
  let total = 0;
  let page = 1;
  let totalPages = 1;
  let hasNext = false;
  let cms: Record<string, string> = {};
  let collections: { name: string; slug: string }[] = [];
  let carouselRaw: string | undefined;

  try {
    const listed = await queryProductList(u, { isAdmin: false });
    products = listed.products;
    total = listed.total;
    page = listed.page;
    totalPages = listed.totalPages;
    hasNext = listed.hasNext;
  } catch {
    /* catalogue empty; hero still renders */
  }

  try {
    cms = await getCMSContent([...RTW_CMS_KEYS]);
  } catch {
    cms = {};
  }

  try {
    const live = await listLivePublishedCollections();
    collections = live.map(({ collection }) => ({ name: collection.name, slug: collection.slug }));
  } catch {
    collections = [];
  }

  if (!isSkipDbBuild()) {
    try {
      const row = await prisma.siteSetting.findUnique({ where: { key: "rtw_hero_carousel" } });
      carouselRaw = row?.value ?? cms.rtw_hero_carousel;
    } catch {
      carouselRaw = cms.rtw_hero_carousel;
    }
  }

  const copy = rtwHeroCopy({
    headline: cmsGet(cms, "rtw_hero_headline", ""),
    legacyTitle: cmsGet(cms, "rtw_page_title", ""),
    subline: cmsGet(cms, "rtw_hero_subline", ""),
    legacySubtitle: cmsGet(cms, "rtw_page_subtitle", ""),
    cta: cmsGet(cms, "rtw_hero_cta_label", ""),
    promise: cmsGet(cms, "rtw_promise_band", ""),
  });
  const heroLooks = rtwHeroLooks(products);
  const heroSideLooks = rtwHeroSideLooks({
    top: cmsGet(cms, "rtw_hero_look_top", ""),
    bottom: cmsGet(cms, "rtw_hero_look_bottom", ""),
    fallback: heroLooks,
  });

  const heroItems = resolveHeroCarouselItems(carouselRaw);
  for (const item of heroItems) {
    if (item.type === "video") warmHeroWebmMp4(item.url);
  }

  return (
    <RTWPageClient
      initialProducts={products}
      total={total}
      page={page}
      totalPages={totalPages}
      hasNext={hasNext}
      collections={collections}
      heroItems={heroItems}
      heroLooks={heroLooks}
      heroSideLooks={heroSideLooks}
      heroHeadline={copy.headline}
      heroSubline={copy.subline}
      heroCta={copy.cta}
      promiseBand={copy.promise}
    />
  );
}
