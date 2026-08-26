import { NextRequest, NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cron/verify";
import { executeCronJob } from "@/lib/cron/runner";

export async function POST(req: NextRequest) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { result, runId, status } = await executeCronJob("abandoned-checkout");
    return NextResponse.json({
      ok: true,
      runId,
      status,
      processed: result.processed,
      failed: result.failed,
      hasMore: result.hasMore ?? false,
      ...result.detail,
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
