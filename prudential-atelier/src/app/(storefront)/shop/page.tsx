import type { Metadata } from "next";
import { queryProductList } from "@/lib/products-list-query";
import { ShopBrowse } from "@/components/shop/ShopBrowse";
import { cmsGet, getCMSContent } from "@/lib/cms";
import { shopHeroCopy } from "@/lib/rtw-aisle";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Shop | Prudent Gabriel",
  description: "Everything the house sells — ready-to-wear, bridal, kids, and accessories.",
};

function flattenSearchParams(sp: Record<string, string | string[] | undefined>) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string" && v.length) u.set(k, v);
    else if (Array.isArray(v) && typeof v[0] === "string") u.set(k, v[0]);
  }
  return u;
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const u = flattenSearchParams(searchParams);
  if (!u.get("limit")) u.set("limit", "20");

  const { products, total, page, totalPages, hasNext, hasPrev } = await queryProductList(u, {
    isAdmin: false,
  });
  const cms = await getCMSContent(["shop_page_eyebrow", "shop_page_title", "shop_page_subtitle"]);
  const hero = shopHeroCopy({
    eyebrow: cmsGet(cms, "shop_page_eyebrow", ""),
    title: cmsGet(cms, "shop_page_title", ""),
    subtitle: cmsGet(cms, "shop_page_subtitle", ""),
  });

  return (
    <ShopBrowse
      products={products}
      total={total}
      page={page}
      totalPages={totalPages}
      hasNext={hasNext}
      hasPrev={hasPrev}
      heroEyebrow={hero.eyebrow}
      heroHeadline={hero.title}
      heroSubtext={hero.subtitle}
    />
  );
}
