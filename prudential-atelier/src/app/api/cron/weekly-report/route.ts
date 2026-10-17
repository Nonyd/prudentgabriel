import { NextRequest, NextResponse } from "next/server";
import { validateCronSecret } from "@/lib/api-auth";
import { logError } from "@/lib/logger";
import { sendEmail } from "@/lib/email";
import { getPublicAppUrl } from "@/lib/app-url";
import { alertEmailTargets } from "@/lib/admin-alerts";
import { renderWeeklyReport, weeklyReportData } from "@/lib/reports/staff-reports";

/** Fires Monday 07:00 UTC (08:00 Lagos). Reports Monday–Sunday just ended to the "reports" recipients. */
export async function POST(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await weeklyReportData();
    const { subject, html } = renderWeeklyReport(data, getPublicAppUrl());
    const week = data.from.toISOString().slice(0, 10);
    const recipients = (await alertEmailTargets("reports")).map((t) => t.to);

    for (const email of recipients) {
      await sendEmail({
        to: email,
        subject,
        html,
        template: "weekly-report",
        idempotencyKey: `weekly-report:${week}:${email}`,
      });
    }

    return NextResponse.json({ ok: true, takenNGN: data.takings.totalNGN, attention: data.attention.length, emailed: recipients.length });
  } catch (e) {
    await logError({
      severity: "CRITICAL",
      errorType: "CRON_WEEKLY_REPORT",
      message: e instanceof Error ? e.message : "Weekly report failed",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
