import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { deleteShopCategory, ShopCategoryError } from "@/lib/shop-categories";

export async function DELETE(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const gate = await requireAdminApi("shop.products");
  if (!gate.ok) return gate.response;
  const { slug } = await ctx.params;
  try {
    const result = await deleteShopCategory(decodeURIComponent(slug));
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof ShopCategoryError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
