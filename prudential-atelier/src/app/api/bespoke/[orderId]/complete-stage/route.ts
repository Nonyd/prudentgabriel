import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BESPOKE_STAFF_ROLES, requireRoles } from "@/lib/api-auth";
import { actorFromSession, completeOrderStage } from "@/lib/atelier/stage-actions";
import { stageGateInclude } from "@/lib/atelier/can-complete-stage";

type Params = { params: Promise<{ orderId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const gate = await requireRoles(BESPOKE_STAFF_ROLES);
  if (!gate.ok) return gate.response;

  const actor = actorFromSession(gate.session);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId } = await params;
  let body: { notes?: string; images?: string[]; videos?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = await completeOrderStage({
    orderId,
    actor,
    notes: body.notes,
    images: Array.isArray(body.images) ? body.images : [],
    videos: Array.isArray(body.videos) ? body.videos : [],
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.failures[0]?.message ?? "Cannot complete stage", failures: result.failures },
      { status: result.status },
    );
  }

  const updated = await prisma.bespokeOrder.findUnique({
    where: { id: orderId },
    include: {
      stageHistory: { orderBy: { completedAt: "desc" } },
      assignments: {
        include: { staffProfile: { include: { user: { select: { id: true, name: true, email: true } } } } },
      },
      materials: { orderBy: { createdAt: "asc" } },
      clientProfile: { include: { measurements: true, moodboards: true } },
      quotation: true,
      payments: {
        orderBy: { createdAt: "desc" },
        include: { confirmedBy: { select: { id: true, name: true, email: true } } },
      },
      ...stageGateInclude(),
    },
  });

  return NextResponse.json({ item: updated });
}
