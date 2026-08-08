import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { respondToStageApproval } from "@/lib/atelier/stage-actions";

type Params = { params: Promise<{ orderId: string; approvalId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  const { orderId, approvalId } = await params;
  let body: { decision?: string; comment?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const decision =
    body.decision === "APPROVED" || body.decision === "CHANGES_REQUESTED" ? body.decision : null;
  if (!decision) {
    return NextResponse.json({ error: "decision must be APPROVED or CHANGES_REQUESTED" }, { status: 400 });
  }

  const result = await respondToStageApproval({
    orderId,
    approvalId,
    clientUserId: gate.session.user.id!,
    clientEmail: gate.session.user.email ?? "",
    decision,
    comment: body.comment,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
