import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { queryProductList } from "@/lib/products-list-query";
import { RTWPageClient } from "@/components/rtw/RTWPageClient";
import { cmsGet, getCMSContent } from "@/lib/cms";
import { listLivePublishedCollections } from "@/lib/live-collections";
import { RTW_EXCLUDE_CATEGORY_QUERY, SHOP_ACCESSORIES, SHOP_LISTING } from "@/lib/rtw-aisle";

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
  if (!u.get("limit")) u.set("limit", "40");
  if (!u.get("sort")) u.set("sort", "featured");

  const [{ products, total, page, hasNext }, cms, live] = await Promise.all([
    queryProductList(u, { isAdmin: false }),
    getCMSContent(["rtw_page_eyebrow", "rtw_page_title", "rtw_page_subtitle"]),
    listLivePublishedCollections(),
  ]);

  return (
    <RTWPageClient
      initialProducts={products}
      total={total}
      page={page}
      hasNext={hasNext}
      collections={live.map(({ collection }) => ({ name: collection.name, slug: collection.slug }))}
      heroLabel={cmsGet(cms, "rtw_page_eyebrow", "THE COLLECTION")}
      heroTitle={cmsGet(cms, "rtw_page_title", "Ready-to-Wear")}
      heroSubtitle={cmsGet(cms, "rtw_page_subtitle", "")}
    />
  );
}
