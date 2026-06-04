import { NextResponse } from "next/server";
import { EmploymentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HR_ROLES, requireRoles } from "@/lib/api-auth";
import { logError } from "@/lib/logger";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET() {
  const gate = await requireRoles(HR_ROLES);
  if (!gate.ok) return gate.response;

  try {
    const today = startOfToday();

    const staff = await prisma.staffProfile.findMany({
      where: { isActive: true },
      include: {
        user: { select: { id: true, name: true, email: true } },
        attendanceLogs: {
          where: { date: today },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    const resumptionSetting = await prisma.siteSetting.findUnique({
      where: { key: "hr_resumption_time" },
    });
    const resumptionTime = resumptionSetting?.value ?? process.env.RESUMPTION_TIME ?? "09:00";
    const [resHour, resMin] = resumptionTime.split(":").map((n) => Number.parseInt(n, 10));
    const resumptionDate = new Date(today);
    resumptionDate.setHours(resHour ?? 9, resMin ?? 0, 0, 0);
    const now = new Date();

    let clockedIn = 0;
    let late = 0;
    let absent = 0;
    let freelancers = 0;

    const grid = staff.map((member) => {
      if (member.employmentType === EmploymentType.FREELANCER) {
        freelancers += 1;
        return {
          staffId: member.id,
          userId: member.userId,
          name: member.user.name ?? member.user.email,
          department: member.department,
          employmentType: member.employmentType,
          status: "freelancer" as const,
          log: member.attendanceLogs[0] ?? null,
        };
      }

      const log = member.attendanceLogs[0];
      const isClockedIn = Boolean(log?.clockIn && !log?.clockOut);
      let status: "clocked_in" | "clocked_out" | "late" | "absent";

      if (isClockedIn) {
        clockedIn += 1;
        status =
          log!.clockIn! > resumptionDate && now >= resumptionDate ? "late" : "clocked_in";
        if (status === "late") late += 1;
      } else if (log?.clockOut) {
        status = "clocked_out";
        clockedIn += 1;
      } else if (now >= resumptionDate) {
        absent += 1;
        status = "absent";
      } else {
        status = "absent";
      }

      return {
        staffId: member.id,
        userId: member.userId,
        name: member.user.name ?? member.user.email,
        department: member.department,
        employmentType: member.employmentType,
        status,
        log: log ?? null,
      };
    });

    return NextResponse.json({
      date: today.toISOString(),
      resumptionTime,
      summary: { clockedIn, late, absent, freelancers },
      staff: grid,
    });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "ATTENDANCE_TODAY",
      message: e instanceof Error ? e.message : "Failed to fetch today attendance",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
