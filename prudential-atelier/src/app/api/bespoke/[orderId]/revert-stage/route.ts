import { NextRequest, NextResponse } from "next/server";
import { BespokeStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireBespokeAccess } from "@/lib/atelier/bespoke-access";
import { actorFromSession, revertOrderStage } from "@/lib/atelier/stage-actions";
import { builtInStepId } from "@/lib/atelier/pipeline-db";
import { bespokeAdminDetailInclude } from "@/lib/atelier/can-complete-stage";

type Params = { params: Promise<{ orderId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const gate = await requireBespokeAccess("admin", { orderId: (await params).orderId });
  if (!gate.ok) return gate.response;
  const actor = actorFromSession(gate.session);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId } = await params;
  let body: { orderStageId?: string; targetStage?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // The done step to reopen: by id, or (older callers) a built-in stage.
  const targetStage = body.targetStage as BespokeStage | undefined;
  const orderStageId =
    typeof body.orderStageId === "string" && body.orderStageId
      ? body.orderStageId
      : targetStage && (Object.values(BespokeStage) as string[]).includes(targetStage)
        ? await builtInStepId(prisma, orderId, targetStage)
        : null;
  if (!orderStageId) {
    return NextResponse.json({ error: "orderStageId is required" }, { status: 400 });
  }

  const result = await revertOrderStage({
    orderId,
    orderStageId,
    reason: body.reason ?? "",
    actor,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.failures[0]?.message ?? "Cannot revert stage", failures: result.failures },
      { status: result.status },
    );
  }

  const item = await prisma.bespokeOrder.findUnique({
    where: { id: orderId },
    include: bespokeAdminDetailInclude(),
  });

  return NextResponse.json({ ok: true, item });
}
