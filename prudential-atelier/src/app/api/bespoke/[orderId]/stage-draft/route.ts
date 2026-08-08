import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BESPOKE_STAFF_ROLES, requireRoles } from "@/lib/api-auth";
import { actorFromSession, saveStageDraft } from "@/lib/atelier/stage-actions";

type Params = { params: Promise<{ orderId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const gate = await requireRoles(BESPOKE_STAFF_ROLES);
  if (!gate.ok) return gate.response;
  const actor = actorFromSession(gate.session);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId } = await params;
  let body: { notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const order = await prisma.bespokeOrder.findUnique({
    where: { id: orderId },
    select: { id: true, currentStage: true },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await saveStageDraft({
    orderId: order.id,
    stage: order.currentStage,
    notes: typeof body.notes === "string" ? body.notes : "",
    actorId: actor.id,
  });

  return NextResponse.json({ ok: true });
}
