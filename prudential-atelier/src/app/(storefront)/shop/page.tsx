import type { Metadata } from "next";
import { queryProductList } from "@/lib/products-list-query";
import { ShopBrowse } from "@/components/shop/ShopBrowse";
import { cmsGet, getCMSContent } from "@/lib/cms";
import { CATALOG_PAGE_SIZE, shopHeroCopy } from "@/lib/rtw-aisle";
import { cmsRouteMetadata, flattenSearchParams, shopCanonicalPath } from "@/lib/seo";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const path = shopCanonicalPath(flattenSearchParams(searchParams));
  return cmsRouteMetadata("shop", path);
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const u = flattenSearchParams(searchParams);
  u.set("limit", String(CATALOG_PAGE_SIZE));

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
