import type { Metadata } from "next";
import { auth } from "@/auth";
import { queryProductList } from "@/lib/products-list-query";
import { getContent, getContentSettings } from "@/lib/settings";
import { RTWPageClient } from "@/components/rtw/RTWPageClient";

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
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "SUPER_ADMIN";
  const u = flattenSearchParams(searchParams);
  u.set("type", "RTW");
  u.set("excludeCategory", "BRIDAL");
  if (!u.get("limit")) u.set("limit", "40");
  if (u.get("category") === "BRIDAL") u.delete("category");

  const { products, total, page, hasNext } = await queryProductList(u, { isAdmin });

  let heroLabel = "PRUDENT GABRIEL";
  let heroTitle = "Ready to Wear.";
  try {
    const c = await getContentSettings();
    heroLabel = getContent(c, "content_rtw_label", heroLabel);
    heroTitle = getContent(c, "content_rtw_headline", heroTitle);
  } catch {
    /* defaults */
  }

  return (
    <RTWPageClient
      initialProducts={products}
      total={total}
      page={page}
      hasNext={hasNext}
      heroLabel={heroLabel}
      heroTitle={heroTitle}
    />
  );
}
