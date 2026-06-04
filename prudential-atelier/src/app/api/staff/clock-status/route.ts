import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getStaffClockStatus } from "@/lib/qr-attendance";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await getStaffClockStatus(session.user.id);
  if (!status) {
    return NextResponse.json({ error: "Staff profile not found" }, { status: 404 });
  }

  return NextResponse.json({
    isClockedIn: status.isClockedIn,
    employmentType: status.staff.employmentType,
    log: status.log
      ? {
          clockIn: status.log.clockIn?.toISOString() ?? null,
          clockOut: status.log.clockOut?.toISOString() ?? null,
          totalHours: status.log.totalHours,
        }
      : null,
  });
}

export async function POST() {
  return GET();
}
