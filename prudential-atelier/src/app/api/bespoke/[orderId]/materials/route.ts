import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bespokeAllows, bespokeView, requireBespokeAccess } from "@/lib/atelier/bespoke-access";
import { addCommissionMaterial, materialView, parseMaterialInput } from "@/lib/atelier/commission-materials";

type Params = { params: Promise<{ orderId: string }> };

/**
 * BD3/BD4: beads, fabric and lining a commission needs. Reading the list is the
 * `spec` level (the house, the workroom on it, Maju's grant, the store); the
 * cost on each row only for `storeCost`. Saying what it needs is `specEdit`;
 * taking it out of the store is also the house's or the store's.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { orderId } = await params;
  const gate = await requireBespokeAccess("spec", { orderId });
  if (!gate.ok) return gate.response;
  const view = bespokeView(gate.facts);
  const rows = await prisma.material.findMany({ where: { orderId }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({
    items: rows.map((m) => materialView(m, view.materialCost)),
    canEdit: view.specEdit,
    costHidden: !view.materialCost,
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { orderId } = await params;
  const gate = await requireBespokeAccess("specEdit", { orderId });
  if (!gate.ok) return gate.response;
  const view = bespokeView(gate.facts);

  const parsed = parseMaterialInput(await req.json().catch(() => null), view.materialCost);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (parsed.input.storeItemId && !(gate.facts.house || bespokeAllows("storeCost", gate.facts))) {
    return NextResponse.json({ error: "Taking it out of the store is for Prudent Gabriel or the store." }, { status: 403 });
  }

  const result = await addCommissionMaterial(orderId, parsed.input, { id: gate.session.user.id! });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  const row = await prisma.material.findUniqueOrThrow({ where: { id: result.id } });
  return NextResponse.json({ item: materialView(row, view.materialCost) }, { status: 201 });
}
