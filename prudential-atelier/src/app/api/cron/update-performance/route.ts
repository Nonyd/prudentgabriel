import { NextRequest, NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cron/verify";
import { executeCronJob } from "@/lib/cron/runner";

async function handle(req: NextRequest) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { result, runId, status } = await executeCronJob("update-performance");
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

export const GET = handle;
export const POST = handle;
