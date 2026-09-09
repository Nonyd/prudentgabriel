import { NextRequest, NextResponse } from "next/server";
import { respondToStageApprovalByToken } from "@/lib/atelier/stage-actions";
import {
  loadPublicStageApproval,
  publicStageApprovalOmitsClientRecord,
} from "@/lib/public-stage-approval-payload";

type Params = { params: Promise<{ token: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params;
  const payload = await loadPublicStageApproval(token);
  if (!payload) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = payload as unknown as Record<string, unknown>;
  if (!publicStageApprovalOmitsClientRecord(body)) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  return NextResponse.json(payload);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params;
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

  const result = await respondToStageApprovalByToken({
    publicToken: token,
    decision,
    comment: body.comment,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
