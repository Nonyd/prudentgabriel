import { NextRequest, NextResponse } from "next/server";
import { bespokeView, requireBespokeAccess } from "@/lib/atelier/bespoke-access";
import { commissionCost } from "@/lib/atelier/commission-cost";

type Params = { params: Promise<{ orderId: string }> };

/**
 * BD4: cost of production for one commission. The store sees its side
 * (materials); `production.cost` sees labour and the total; the price agreed
 * and the margin need money as well. Never reachable from the client's account.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { orderId } = await params;
  const gate = await requireBespokeAccess("storeCost", { orderId });
  if (!gate.ok) return gate.response;
  const cost = await commissionCost(orderId, bespokeView(gate.facts));
  if (!cost) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ item: cost });
}
