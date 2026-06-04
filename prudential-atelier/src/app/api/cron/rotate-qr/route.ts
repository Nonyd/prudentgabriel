import { NextRequest, NextResponse } from "next/server";
import { rotateDailyQR } from "@/lib/qr-attendance";
import { validateCronSecret } from "@/lib/api-auth";
import { logError } from "@/lib/logger";

export async function POST(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const code = await rotateDailyQR();
    return NextResponse.json({ ok: true, code, rotatedAt: new Date().toISOString() });
  } catch (e) {
    await logError({
      severity: "CRITICAL",
      errorType: "CRON_ROTATE_QR",
      message: e instanceof Error ? e.message : "QR rotation failed",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
