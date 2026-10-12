import { NextRequest, NextResponse } from "next/server";
import { requireBespokeAccess } from "@/lib/atelier/bespoke-access";
import { previewCommissionCascade } from "@/lib/commission-cascade-delete";
import { ProductCascadeError } from "@/lib/product-cascade-delete";

type Params = { params: Promise<{ orderId: string }> };

/** What deleting this commission would take with it — shown before anything happens. */
export async function GET(_req: NextRequest, { params }: Params) {
  const { orderId } = await params;
  const gate = await requireBespokeAccess("admin", { orderId });
  if (!gate.ok) return gate.response;
  try {
    return NextResponse.json(await previewCommissionCascade(orderId));
  } catch (e) {
    if (e instanceof ProductCascadeError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Could not check what is attached" }, { status: 500 });
  }
}
