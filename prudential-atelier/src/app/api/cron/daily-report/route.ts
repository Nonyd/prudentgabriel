import { NextRequest, NextResponse } from "next/server";
import { validateCronSecret } from "@/lib/api-auth";
import { logError } from "@/lib/logger";
import { sendEmail } from "@/lib/email";
import { getPublicAppUrl } from "@/lib/app-url";
import { alertEmailTargets } from "@/lib/admin-alerts";
import { dailyReportData, renderDailyReport } from "@/lib/reports/staff-reports";

/** Fires 23:00 UTC (00:00 Lagos). Reports the Lagos day just ended to the "reports" recipients. */
export async function POST(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await dailyReportData();
    const { subject, html } = renderDailyReport(data, getPublicAppUrl());
    const day = data.date.toISOString().slice(0, 10);
    const recipients = (await alertEmailTargets("reports")).map((t) => t.to);

    for (const to of recipients) {
      await sendEmail({
        to,
        subject,
        html,
        template: "daily-report",
        idempotencyKey: `daily-report:${day}:${to}`,
      });
    }

    return NextResponse.json({ ok: true, takenNGN: data.takings.totalNGN, attention: data.attention.length, emailed: recipients.length });
  } catch (e) {
    await logError({
      severity: "CRITICAL",
      errorType: "CRON_DAILY_REPORT",
      message: e instanceof Error ? e.message : "Daily report failed",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
