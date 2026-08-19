import { NextRequest, NextResponse } from "next/server";
import { EmploymentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { validateCronSecret } from "@/lib/api-auth";
import { logError } from "@/lib/logger";
import { sendEmail } from "@/lib/email";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function POST(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const today = startOfToday();
    const resumptionSetting = await prisma.siteSetting.findUnique({
      where: { key: "hr_resumption_time" },
    });
    const resumptionTime = resumptionSetting?.value ?? process.env.RESUMPTION_TIME ?? "09:00";
    const hrEmail = process.env.HR_MANAGER_EMAIL ?? "hr@prudentgabriel.com";

    const staff = await prisma.staffProfile.findMany({
      where: { isActive: true, employmentType: EmploymentType.EMPLOYEE },
      include: {
        user: { select: { name: true, email: true } },
        attendanceLogs: {
          where: { date: today, clockIn: { not: null } },
          take: 1,
        },
      },
    });

    const absent = staff.filter((s) => s.attendanceLogs.length === 0);
    if (absent.length === 0) {
      return NextResponse.json({
        ok: true,
        resumptionTime,
        absentCount: 0,
        notified: false,
      });
    }

    const listHtml = absent
      .map(
        (s) =>
          `<li>${s.user.name ?? s.user.email} — ${s.department.replace(/_/g, " ")}</li>`,
      )
      .join("");

    await sendEmail({
      to: hrEmail,
      subject: `[Prudential Atelier] Late resumption alert — ${absent.length} staff not clocked in`,
      html: `
        <p>The following staff members have not clocked in by ${resumptionTime} today:</p>
        <ul>${listHtml}</ul>
        <p>Date: ${today.toLocaleDateString("en-GB")}</p>
      `,
      template: "late-alert",
      idempotencyKey: `late-alert:${today.toISOString().slice(0, 10)}`,
    });

    return NextResponse.json({
      ok: true,
      resumptionTime,
      absentCount: absent.length,
      notified: true,
      absent: absent.map((s) => ({
        staffId: s.id,
        name: s.user.name ?? s.user.email,
        department: s.department,
      })),
    });
  } catch (e) {
    await logError({
      severity: "CRITICAL",
      errorType: "CRON_LATE_ALERT",
      message: e instanceof Error ? e.message : "Late alert cron failed",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
