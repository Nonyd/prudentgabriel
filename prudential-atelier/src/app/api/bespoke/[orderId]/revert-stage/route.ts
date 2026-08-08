import { NextRequest, NextResponse } from "next/server";
import { BespokeStage } from "@prisma/client";
import { BESPOKE_ADMIN_ROLES, requireRoles } from "@/lib/api-auth";
import { actorFromSession, revertOrderStage } from "@/lib/atelier/stage-actions";

type Params = { params: Promise<{ orderId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const gate = await requireRoles(BESPOKE_ADMIN_ROLES);
  if (!gate.ok) return gate.response;
  const actor = actorFromSession(gate.session);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId } = await params;
  let body: { targetStage?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const targetStage = body.targetStage as BespokeStage | undefined;
  if (!targetStage || !(Object.values(BespokeStage) as string[]).includes(targetStage)) {
    return NextResponse.json({ error: "targetStage is required" }, { status: 400 });
  }

  const result = await revertOrderStage({
    orderId,
    targetStage,
    reason: body.reason ?? "",
    actor,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.failures[0]?.message ?? "Cannot revert stage", failures: result.failures },
      { status: result.status },
    );
  }

  return NextResponse.json({ ok: true });
}
