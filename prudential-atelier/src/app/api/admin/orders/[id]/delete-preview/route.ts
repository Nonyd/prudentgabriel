import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, requireSuperAdminApi } from "@/lib/admin-auth";
import { ProductCascadeError } from "@/lib/product-cascade-delete";
import { loadOrderPlan, toOrderPreview } from "@/lib/order-cascade-delete";

/** What deleting this order would remove, and whether the viewer may do it. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi("shop.orders");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  try {
    const plan = await loadOrderPlan(id);
    const superGate = plan.loud ? await requireSuperAdminApi() : null;
    return NextResponse.json(toOrderPreview(plan, Boolean(superGate?.ok)));
  } catch (e) {
    if (e instanceof ProductCascadeError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Could not check what is attached" }, { status: 500 });
  }
}
