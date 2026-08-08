import { NextRequest, NextResponse } from "next/server";
import { StageMediaKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BESPOKE_STAFF_ROLES, requireRoles } from "@/lib/api-auth";
import { actorFromSession, addStageMedia } from "@/lib/atelier/stage-actions";

type Params = { params: Promise<{ orderId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const gate = await requireRoles(BESPOKE_STAFF_ROLES);
  if (!gate.ok) return gate.response;
  const actor = actorFromSession(gate.session);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId } = await params;
  let body: { urls?: string[]; kind?: string };
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

  const urls = Array.isArray(body.urls) ? body.urls : [];
  const kind = body.kind === "VIDEO" ? StageMediaKind.VIDEO : StageMediaKind.IMAGE;
  await addStageMedia({
    orderId: order.id,
    stage: order.currentStage,
    urls,
    kind,
    uploadedById: actor.id,
  });

  const media = await prisma.orderStageMedia.findMany({
    where: { orderId: order.id, stage: order.currentStage },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ items: media });
}
