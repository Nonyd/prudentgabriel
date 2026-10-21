import { NextRequest, NextResponse } from "next/server";
import { StageMediaKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireBespokeAccess } from "@/lib/atelier/bespoke-access";
import { actorFromSession, addStageMedia } from "@/lib/atelier/stage-actions";
import { resolveStep } from "@/lib/atelier/pipeline-db";

type Params = { params: Promise<{ orderId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const gate = await requireBespokeAccess("work", { orderId: (await params).orderId });
  if (!gate.ok) return gate.response;
  const actor = actorFromSession(gate.session);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId } = await params;
  let body: { urls?: string[]; kind?: string; orderStageId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const order = await prisma.bespokeOrder.findUnique({
    where: { id: orderId },
    select: { id: true },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // The step the photos are for; none named = the lead step.
  const step = await resolveStep(prisma, order.id, body.orderStageId);
  if (!step) return NextResponse.json({ error: "Step not found" }, { status: 404 });

  const urls = Array.isArray(body.urls) ? body.urls : [];
  const kind = body.kind === "VIDEO" ? StageMediaKind.VIDEO : StageMediaKind.IMAGE;
  await addStageMedia({
    orderId: order.id,
    step,
    urls,
    kind,
    uploadedById: actor.id,
  });

  const media = await prisma.orderStageMedia.findMany({
    where: { orderStageId: step.id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ items: media });
}
