import { NextRequest, NextResponse } from "next/server";
import { clockOutStaff } from "@/lib/qr-attendance";
import { HR_ROLES, requireRoles, requireStaff } from "@/lib/api-auth";
import { logActivity, logError } from "@/lib/logger";

export async function POST(req: NextRequest) {
  let body: { userId?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const sessionGate = await requireStaff();
  if (!sessionGate.ok) return sessionGate.response;

  const sessionUserId = sessionGate.session.user.id;
  if (!sessionUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const targetUserId = body.userId?.trim() || sessionUserId;
  const isSelf = targetUserId === sessionUserId;

  if (!isSelf) {
    const hrGate = await requireRoles(HR_ROLES);
    if (!hrGate.ok) return hrGate.response;
  }

  try {
    const result = await clockOutStaff(targetUserId);

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    await logActivity({
      userId: sessionGate.session.user.id ?? undefined,
      userEmail: sessionGate.session.user.email ?? undefined,
      userRole: sessionGate.session.user.role ?? undefined,
      action: "STAFF_CLOCK_OUT",
      module: "attendance",
      description: `Staff clocked out${isSelf ? "" : ` (user ${targetUserId})`}`,
    });

    return NextResponse.json(result);
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "ATTENDANCE_CLOCK_OUT",
      message: e instanceof Error ? e.message : "Clock-out failed",
      userId: sessionGate.session.user.id ?? undefined,
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
