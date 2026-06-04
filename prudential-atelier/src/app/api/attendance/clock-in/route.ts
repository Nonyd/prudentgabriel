import { NextRequest, NextResponse } from "next/server";
import { processQRScan } from "@/lib/qr-attendance";
import { requireStaff } from "@/lib/api-auth";
import { logActivity, logError } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const gate = await requireStaff();
  if (!gate.ok) return gate.response;

  let body: { qrCode?: string; taskNote?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const qrCode = body.qrCode?.trim();
  if (!qrCode) {
    return NextResponse.json({ error: "qrCode is required" }, { status: 400 });
  }

  try {
    const userId = gate.session.user.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await processQRScan(qrCode, userId, body.taskNote ?? "");

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    if (!result.alreadyClockedIn) {
      await logActivity({
        userId: gate.session.user.id ?? undefined,
        userEmail: gate.session.user.email ?? undefined,
        userRole: gate.session.user.role ?? undefined,
        action: "STAFF_CLOCK_IN",
        module: "attendance",
        description: `Staff clocked in: ${gate.session.user.name ?? gate.session.user.email}`,
      });
    }

    return NextResponse.json(result);
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "ATTENDANCE_CLOCK_IN",
      message: e instanceof Error ? e.message : "Clock-in failed",
      userId: gate.session.user.id ?? undefined,
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
