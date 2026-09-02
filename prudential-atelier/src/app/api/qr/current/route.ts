import { NextResponse } from "next/server";
import { generateDailyQR, getActiveQRCode } from "@/lib/qr-attendance";
import { requireAdminApi } from "@/lib/admin-auth";
import { logError } from "@/lib/logger";

export async function GET() {
  const gate = await requireAdminApi("attendance");
  if (!gate.ok) return gate.response;

  try {
    let active = await getActiveQRCode();
    if (!active) {
      const code = await generateDailyQR();
      active = await getActiveQRCode();
      if (!active) {
        return NextResponse.json({ code, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() });
      }
    }
    return NextResponse.json({ code: active.code, expiresAt: active.expiresAt.toISOString() });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "QR_CURRENT",
      message: e instanceof Error ? e.message : "Failed to fetch QR code",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
