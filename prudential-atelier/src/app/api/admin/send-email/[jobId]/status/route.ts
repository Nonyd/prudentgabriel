import { NextRequest, NextResponse } from "next/server";
import { requireGeneralAdminApi } from "@/lib/admin-auth";
import { getEmailSendJobStatus } from "@/lib/send-email-jobs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;

  const { jobId } = await params;
  const status = await getEmailSendJobStatus(jobId);

  if (!status) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json(status);
}
