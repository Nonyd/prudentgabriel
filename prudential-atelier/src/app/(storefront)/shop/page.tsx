import { permanentRedirect } from "next/navigation";
import { shopListingRedirectPath } from "@/lib/rtw-aisle";

function flattenSearchParams(sp: Record<string, string | string[] | undefined>) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string" && v.length) u.set(k, v);
    else if (Array.isArray(v) && typeof v[0] === "string") u.set(k, v[0]);
  }
  return u;
}

/** /shop listing was a second RTW catalogue. Product URLs stay /shop/[slug]. */
export default function ShopPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  permanentRedirect(shopListingRedirectPath(flattenSearchParams(searchParams)));
}
