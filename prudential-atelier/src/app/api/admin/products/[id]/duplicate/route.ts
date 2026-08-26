import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { duplicateProduct } from "@/lib/duplicate-product";
import { logActivity } from "@/lib/logger";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi("shop.products");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  const copy = await duplicateProduct(id);
  if (!copy) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  await logActivity({
    userId: gate.session.user!.id!,
    userEmail: gate.session.user!.email ?? undefined,
    userRole: gate.session.user!.role,
    action: "CREATE",
    module: "products",
    description: `Duplicated product to ${copy.slug}`,
    recordId: copy.id,
    recordType: "Product",
  });

  return NextResponse.json(copy);
}
