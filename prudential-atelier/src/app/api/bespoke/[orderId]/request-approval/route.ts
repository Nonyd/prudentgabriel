import { NextRequest, NextResponse } from "next/server";
import { BESPOKE_STAFF_ROLES, requireRoles } from "@/lib/api-auth";
import { actorFromSession, requestStageApproval } from "@/lib/atelier/stage-actions";

type Params = { params: Promise<{ orderId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const gate = await requireRoles(BESPOKE_STAFF_ROLES);
  if (!gate.ok) return gate.response;
  const actor = actorFromSession(gate.session);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId } = await params;
  let body: { notes?: string; images?: string[]; videos?: string[] } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const result = await requestStageApproval({
    orderId,
    actor,
    notes: body.notes,
    images: Array.isArray(body.images) ? body.images : [],
    videos: Array.isArray(body.videos) ? body.videos : [],
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.failures[0]?.message ?? "Cannot request approval", failures: result.failures },
      { status: result.status },
    );
  }

  return NextResponse.json({ approvalId: result.approvalId });
}
