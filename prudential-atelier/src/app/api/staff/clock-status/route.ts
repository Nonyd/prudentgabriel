import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getStaffClockStatus } from "@/lib/qr-attendance";
import { resolveStaffPortalUser } from "@/lib/staff-view-as";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const viewer = (await resolveStaffPortalUser(session))!;

  const status = await getStaffClockStatus(viewer.id);
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
