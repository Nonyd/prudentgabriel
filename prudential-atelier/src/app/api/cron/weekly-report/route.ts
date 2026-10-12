import { NextRequest, NextResponse } from "next/server";
import { PaymentStatus } from "@prisma/client";
import { validateCronSecret } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";
import { sendEmail } from "@/lib/email";
import { reportEmailHtml } from "@/lib/email-templates/reports";
import { getPublicAppUrl } from "@/lib/app-url";
import { STAGE_SHORT_LABELS } from "@/lib/bespoke-stages";
import { getSetting } from "@/lib/settings";
import { resolveAdminAlertEmail } from "@/lib/admin-alert-email";
import { takings } from "@/lib/finance/takings";

export async function POST(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const to = new Date();
    const from = new Date(to.getTime() - 7 * 86400000);
    const appUrl = getPublicAppUrl();

    const [rtwRev, activeOrders, overdue, newClients, consultBookings, topProduct] =
      await Promise.all([
        prisma.order.aggregate({
          where: { paymentStatus: PaymentStatus.PAID, createdAt: { gte: from, lte: to }, isBespoke: false },
          _sum: { total: true },
          _count: { id: true },
        }),
        prisma.bespokeOrder.findMany({
          where: { currentStage: { not: "DELIVERY" } },
          select: { orderRef: true, currentStage: true, deliveryDate: true, clientName: true },
          orderBy: { deliveryDate: "asc" },
          take: 30,
        }),
        prisma.bespokeOrder.findMany({
          where: {
            deliveryDate: { lt: new Date() },
            currentStage: { not: "DELIVERY" },
          },
          select: { orderRef: true, clientName: true, deliveryDate: true },
        }),
        prisma.clientProfile.count({ where: { createdAt: { gte: from, lte: to } } }),
        prisma.consultationBooking.findMany({
          where: { createdAt: { gte: from, lte: to }, paymentStatus: PaymentStatus.PAID },
          select: { feeNGN: true },
        }),
        prisma.orderItem.groupBy({
          by: ["productId"],
          where: { order: { createdAt: { gte: from, lte: to }, paymentStatus: PaymentStatus.PAID } },
          _sum: { quantity: true },
          orderBy: { _sum: { quantity: "desc" } },
          take: 1,
        }),
      ]);

    const consultRevenue = consultBookings.reduce((s, c) => s + c.feeNGN, 0);
    // Payments confirmed in the week, from the ledger — not the lifetime paid on commissions created this week.
    const taken = await takings(from, to);
    const totalRev = taken.totalNGN;

    let topProductName = "—";
    if (topProduct[0]) {
      const p = await prisma.product.findUnique({
        where: { id: topProduct[0].productId },
        select: { name: true },
      });
      topProductName = p?.name ?? "—";
    }

    const weekLabel = from.toLocaleDateString("en-GB");
    const html = reportEmailHtml(
      `Weekly Report — Week of ${weekLabel}`,
      [
        {
          heading: "Revenue This Week",
          html: `<p><strong>₦${Math.round(totalRev).toLocaleString("en-NG")}</strong><br/>RTW: ₦${Math.round(taken.rtwNGN).toLocaleString("en-NG")}<br/>Atelier: ₦${Math.round(taken.atelierNGN).toLocaleString("en-NG")}</p>`,
        },
        {
          heading: "Production Progress",
          html: `<ul>${activeOrders
            .slice(0, 10)
            .map(
              (o) =>
                `<li>${o.orderRef} — ${STAGE_SHORT_LABELS[o.currentStage]} (${o.deliveryDate?.toLocaleDateString("en-GB") ?? "TBD"})</li>`,
            )
            .join("")}</ul>`,
        },
        {
          heading: "Overdue Orders",
          html:
            overdue.length === 0
              ? "<p>None overdue.</p>"
              : `<ul style="color:#8B2942;">${overdue
                  .map((o) => `<li>${o.orderRef} — ${o.clientName}</li>`)
                  .join("")}</ul>`,
        },
        {
          heading: "New Clients",
          html: `<p><strong>${newClients}</strong> registered this week</p>`,
        },
        {
          heading: "Consultation Revenue",
          html: `<p><strong>${consultBookings.length}</strong> paid bookings · ₦${Math.round(consultRevenue).toLocaleString("en-NG")}</p>`,
        },
        {
          heading: "RTW Sales Summary",
          html: `<p><strong>${rtwRev._count.id}</strong> orders · Top product: ${topProductName}</p>`,
        },
      ],
      appUrl,
    );

    const operational = await resolveAdminAlertEmail(getSetting);
    const recipients = operational ? [operational] : [];

    for (const email of recipients) {
      await sendEmail({
        to: email,
        subject: `Weekly Report — Week of ${weekLabel} | Prudential Atelier`,
        html,
        template: "weekly-report",
        idempotencyKey: `weekly-report:${weekLabel}:${email}`,
      });
    }

    return NextResponse.json({ ok: true, totalRev, emailed: recipients.length });
  } catch (e) {
    await logError({
      severity: "CRITICAL",
      errorType: "CRON_WEEKLY_REPORT",
      message: e instanceof Error ? e.message : "Weekly report failed",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
