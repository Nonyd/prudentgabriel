import { auth } from "@/auth";
import { queryProductList } from "@/lib/products-list-query";
import { ShopBrowse } from "@/components/shop/ShopBrowse";

export const revalidate = 300;

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
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "SUPER_ADMIN";
  const u = flattenSearchParams(searchParams);
  if (!u.get("limit")) u.set("limit", "20");

  const { products, total, page, totalPages, hasNext, hasPrev } = await queryProductList(u, { isAdmin });

  return (
    <ShopBrowse
      products={products}
      total={total}
      page={page}
      totalPages={totalPages}
      hasNext={hasNext}
      hasPrev={hasPrev}
    />
  );
}
