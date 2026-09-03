import { NextRequest, NextResponse } from "next/server";
import { PaymentStatus } from "@prisma/client";
import { validateCronSecret } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";
import { sendEmail } from "@/lib/email";
import { reportEmailHtml } from "@/lib/email-templates/reports";
import { getPublicAppUrl } from "@/lib/app-url";
import { STAGE_SHORT_LABELS } from "@/lib/bespoke-stages";
import { listRefundRequiredOrders, listTodayOversellNotifications, oversellReportHtml } from "@/lib/oversell-report";
import { getSetting } from "@/lib/settings";
import { resolveAdminAlertEmail } from "@/lib/admin-alert-email";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday() {
  const d = startOfToday();
  d.setHours(23, 59, 59, 999);
  return d;
}

export async function POST(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const from = startOfToday();
    const to = endOfToday();
    const appUrl = getPublicAppUrl();

    const [rtwRev, stageUpdates, staffToday, consultations, upcoming, pendingPayments, refundRequired, oversellNotices] =
      await Promise.all([
        prisma.order.aggregate({
          where: { paymentStatus: PaymentStatus.PAID, createdAt: { gte: from, lte: to }, isBespoke: false },
          _sum: { total: true },
        }),
        prisma.stageUpdate.findMany({
          where: { completedAt: { gte: from, lte: to } },
          include: { order: { select: { orderRef: true } } },
          orderBy: { completedAt: "desc" },
        }),
        prisma.attendanceLog.findMany({
          where: { date: from },
          include: { staff: { include: { user: { select: { name: true } } } } },
        }),
        prisma.consultationBooking.findMany({
          where: { confirmedDate: { gte: from, lte: to }, status: "COMPLETED" },
          select: { bookingNumber: true, clientName: true },
        }),
        prisma.bespokeOrder.findMany({
          where: {
            deliveryDate: { gte: new Date(), lte: new Date(Date.now() + 7 * 86400000) },
            currentStage: { not: "DELIVERY" },
          },
          select: { orderRef: true, deliveryDate: true, clientName: true },
        }),
        prisma.order.count({
          where: { paymentStatus: PaymentStatus.PENDING, createdAt: { gte: from, lte: to } },
        }),
        listRefundRequiredOrders(),
        listTodayOversellNotifications(from, to),
      ]);

    const bespokePaid = await prisma.bespokeOrder.aggregate({
      where: { updatedAt: { gte: from, lte: to } },
      _sum: { amountPaid: true },
    });
    const revenue = (rtwRev._sum.total ?? 0) + (bespokePaid._sum.amountPaid ?? 0);

    const oversellHtml = oversellReportHtml(refundRequired, oversellNotices);

    const dateLabel = from.toLocaleDateString("en-GB");
    const html = reportEmailHtml(
      `Daily Report — ${dateLabel}`,
      [
        {
          heading: "Revenue Today",
          html: `<p><strong>₦${Math.round(revenue).toLocaleString("en-NG")}</strong> total payments confirmed</p>`,
        },
        {
          heading: "Stages Completed",
          html:
            stageUpdates.length === 0
              ? "<p>No stage advances today.</p>"
              : `<ul>${stageUpdates
                  .map(
                    (s) =>
                      `<li>${s.order.orderRef} — ${STAGE_SHORT_LABELS[s.stage]}</li>`,
                  )
                  .join("")}</ul>`,
        },
        {
          heading: "Staff Attendance",
          html:
            staffToday.length === 0
              ? "<p>No clock-ins recorded.</p>"
              : `<ul>${staffToday
                  .map(
                    (a) =>
                      `<li>${a.staff.user.name ?? "Staff"} — ${a.clockIn ? "Clocked in" : "Absent"}</li>`,
                  )
                  .join("")}</ul>`,
        },
        {
          heading: "Consultations Today",
          html:
            consultations.length === 0
              ? "<p>No completed consultations.</p>"
              : `<ul>${consultations.map((c) => `<li>${c.bookingNumber} — ${c.clientName}</li>`).join("")}</ul>`,
        },
        {
          heading: "Upcoming Deliveries (7 days)",
          html:
            upcoming.length === 0
              ? "<p>None due within 7 days.</p>"
              : `<ul>${upcoming
                  .map(
                    (o) =>
                      `<li>${o.orderRef} — ${o.clientName} (${o.deliveryDate?.toLocaleDateString("en-GB")})</li>`,
                  )
                  .join("")}</ul>`,
        },
        {
          heading: "Payments Pending",
          html: `<p><strong>${pendingPayments}</strong> bank transfer receipts awaiting confirmation</p>`,
        },
        {
          heading: "RTW oversell — refund required",
          html: oversellHtml,
        },
      ],
      appUrl,
    );

    const operational = await resolveAdminAlertEmail(getSetting);
    const recipients = operational ? [operational] : [];

    for (const to of recipients) {
      await sendEmail({
        to,
        subject: `Daily Report — ${dateLabel} | Prudential Atelier`,
        html,
        template: "daily-report",
        idempotencyKey: `daily-report:${dateLabel}:${to}`,
      });
    }

    return NextResponse.json({ ok: true, revenue, stageUpdates: stageUpdates.length, emailed: recipients.length });
  } catch (e) {
    await logError({
      severity: "CRITICAL",
      errorType: "CRON_DAILY_REPORT",
      message: e instanceof Error ? e.message : "Daily report failed",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
