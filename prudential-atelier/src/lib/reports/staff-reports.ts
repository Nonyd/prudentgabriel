import { OrderStatus, PaymentGateway, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { financeRange } from "@/lib/finance/period";
import { FINANCE_TZ } from "@/lib/finance/aa0";
import { ledgerLines, sumTakings, takings, takingsIn, type Takings } from "@/lib/finance/takings";
import { STAGE_SHORT_LABELS } from "@/lib/bespoke-stages";
import { listRefundRequiredOrders } from "@/lib/oversell-report";
import { workroomDay } from "@/lib/atelier/work-log";
import {
  attention,
  change,
  dayColumns,
  join,
  naira,
  nairaShort,
  paragraph,
  reportEmail,
  shareBars,
  table,
  tiles,
  type AttentionItem,
  type ReportSection,
} from "@/lib/email-templates/reports";

/**
 * The daily and weekly reports. Both read Lagos calendar days and the payment
 * ledger (takings), the same as the finance pages.
 *
 * Daily: cron 23:00 UTC = 00:00 Lagos, reports the Lagos day just ended.
 * Weekly: cron Monday 07:00 UTC = 08:00 Lagos, reports Monday–Sunday just ended.
 */

const CLOSED: OrderStatus[] = [OrderStatus.DELIVERED, OrderStatus.ARCHIVED, OrderStatus.CANCELLED];
const DAY_MS = 86_400_000;

function lagosLabel(d: Date, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: FINANCE_TZ, ...opts }).format(d);
}
const longDate = (d: Date) => lagosLabel(d, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const shortDate = (d: Date) => lagosLabel(d, { day: "numeric", month: "short" });
const clock = (d: Date) => lagosLabel(d, { hour: "2-digit", minute: "2-digit", hour12: false });

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

function daysUntil(d: Date, now: Date): number {
  return Math.round((d.getTime() - now.getTime()) / DAY_MS);
}

/** What the team should act on, whatever the day. Shared by both reports. */
async function attentionItems(now: Date, extra: AttentionItem[] = []): Promise<AttentionItem[]> {
  const [receiptOrders, receiptBookings, ledgerPending, refunds, overdue] = await Promise.all([
    prisma.order.count({
      where: { paymentGateway: PaymentGateway.BANK_TRANSFER, paymentStatus: PaymentStatus.PENDING, paymentReceiptUrl: { not: null } },
    }),
    prisma.consultationBooking.count({
      where: { paymentGateway: PaymentGateway.BANK_TRANSFER, paymentStatus: PaymentStatus.PENDING, paymentReceiptUrl: { not: null } },
    }),
    prisma.payment.count({ where: { status: PaymentStatus.PENDING, method: "BANK_TRANSFER", bespokeOrderId: { not: null } } }),
    listRefundRequiredOrders(),
    prisma.bespokeOrder.findMany({
      where: { deliveryDate: { lt: now }, currentStage: { not: "DELIVERY" }, status: { notIn: CLOSED } },
      select: { orderRef: true, clientName: true, deliveryDate: true },
      orderBy: { deliveryDate: "asc" },
    }),
  ]);

  const items: AttentionItem[] = [];
  const receipts = receiptOrders + receiptBookings + ledgerPending;
  if (receipts > 0) {
    items.push({
      label: `${plural(receipts, "bank transfer")} to confirm`,
      detail: "Clients have uploaded receipts. Their orders wait until someone confirms the money arrived.",
      href: "/admin/payments",
    });
  }
  if (refunds.length > 0) {
    items.push({
      label: `${plural(refunds.length, "refund")} to record`,
      detail: `Paid but cancelled: ${refunds.map((r) => r.orderNumber).join(", ")}.`,
      href: "/admin/orders",
    });
  }
  if (overdue.length > 0) {
    items.push({
      label: `${plural(overdue.length, "commission")} past the delivery date`,
      detail: overdue
        .slice(0, 6)
        .map((o) => `${o.orderRef} (${o.clientName}, due ${o.deliveryDate ? shortDate(o.deliveryDate) : "?"})`)
        .join(", "),
      href: "/admin/bespoke",
    });
  }
  return [...items, ...extra];
}

async function upcomingDeliveries(now: Date, days: number) {
  const rows = await prisma.bespokeOrder.findMany({
    where: {
      deliveryDate: { gte: now, lte: new Date(now.getTime() + days * DAY_MS) },
      currentStage: { not: "DELIVERY" },
      status: { notIn: CLOSED },
    },
    select: { orderRef: true, clientName: true, deliveryDate: true, currentStage: true },
    orderBy: { deliveryDate: "asc" },
  });
  return rows.map((r) => ({
    orderRef: r.orderRef,
    clientName: r.clientName,
    date: r.deliveryDate!,
    daysLeft: daysUntil(r.deliveryDate!, now),
    stage: STAGE_SHORT_LABELS[r.currentStage],
  }));
}

/* ------------------------------------------------------------------ daily */

export type DailyReportData = {
  date: Date;
  takings: Takings;
  prevTakings: Takings;
  avg7NGN: number;
  rtwOrders: number;
  newCommissions: { orderRef: string; clientName: string; totalNGN: number }[];
  consultationsBooked: number;
  consultationsDone: { bookingNumber: string; clientName: string }[];
  attention: AttentionItem[];
  stages: { orderRef: string; stage: string }[];
  attendance: { name: string; clockIn: string | null; clockOut: string | null }[];
  workroom: Awaited<ReturnType<typeof workroomDay>>;
  deliveries: Awaited<ReturnType<typeof upcomingDeliveries>>;
};

export async function dailyReportData(now = new Date()): Promise<DailyReportData> {
  // Fired at 00:00 Lagos: the day being reported is the one that just ended.
  const day = financeRange("day", new Date(now.getTime() - 60 * 60 * 1000));
  const { from, to } = day;
  const weekFrom = new Date(from.getTime() - 7 * DAY_MS);
  const ymd = lagosLabel(from, { year: "numeric", month: "2-digit", day: "2-digit" }).split("/");
  const attendanceDay = new Date(Date.UTC(Number(ymd[2]), Number(ymd[1]) - 1, Number(ymd[0])));

  const [today, prev, week, rtwOrders, newCommissions, consultationsBooked, consultationsDone, stages, attendanceRows, workroom, deliveries] =
    await Promise.all([
      takings(from, to),
      takings(day.prevFrom, day.prevTo),
      takings(weekFrom, from),
      prisma.order.count({ where: { isBespoke: false, paidAt: { gte: from, lt: to } } }),
      prisma.bespokeOrder.findMany({
        where: { createdAt: { gte: from, lt: to } },
        select: { orderRef: true, clientName: true, totalAmount: true },
      }),
      prisma.consultationBooking.count({ where: { createdAt: { gte: from, lt: to } } }),
      prisma.consultationBooking.findMany({
        where: { confirmedDate: { gte: from, lt: to }, status: "COMPLETED" },
        select: { bookingNumber: true, clientName: true },
      }),
      prisma.stageUpdate.findMany({
        where: { completedAt: { gte: from, lt: to } },
        include: { order: { select: { orderRef: true } } },
        orderBy: { completedAt: "asc" },
      }),
      prisma.attendanceLog.findMany({
        where: { date: attendanceDay },
        include: { staff: { include: { user: { select: { name: true, email: true } } } } },
        orderBy: { clockIn: "asc" },
      }),
      workroomDay(new Date(to.getTime() - 60 * 1000)),
      upcomingDeliveries(to, 7),
    ]);

  const blocked = workroom.entries.filter((e) => e.blocker);
  const extra: AttentionItem[] = [];
  if (workroom.notFiled.length > 0) {
    extra.push({
      label: `${plural(workroom.notFiled.length, "person", "people")} did not file the day's work`,
      detail: workroom.notFiled.map((n) => `${n.who} (${n.orderRefs.join(", ")})`).join("; "),
      href: "/admin/bespoke",
    });
  }
  if (blocked.length > 0) {
    extra.push({
      label: `${plural(blocked.length, "piece")} blocked in the workroom`,
      detail: blocked.map((b) => `${b.orderRef}: ${b.blocker}`).join("; "),
      href: "/admin/bespoke",
    });
  }

  return {
    date: from,
    takings: today,
    prevTakings: prev,
    avg7NGN: week.totalNGN / 7,
    rtwOrders,
    newCommissions: newCommissions.map((c) => ({ orderRef: c.orderRef, clientName: c.clientName, totalNGN: c.totalAmount })),
    consultationsBooked,
    consultationsDone,
    attention: await attentionItems(to, extra),
    stages: stages.map((s) => ({ orderRef: s.order.orderRef, stage: STAGE_SHORT_LABELS[s.stage] })),
    attendance: attendanceRows.map((a) => ({
      name: a.staff.user.name ?? a.staff.user.email,
      clockIn: a.clockIn ? clock(a.clockIn) : null,
      clockOut: a.clockOut ? clock(a.clockOut) : null,
    })),
    workroom,
    deliveries,
  };
}

export function renderDailyReport(d: DailyReportData, appUrl: string): { subject: string; html: string } {
  const t = d.takings;
  const sections: ReportSection[] = [];
  const quiet: string[] = [];

  sections.push({
    heading: "The day in numbers",
    body: tiles([
      {
        label: "Taken",
        value: nairaShort(t.totalNGN),
        note: change(t.totalNGN, d.prevTakings.totalNGN, "on the day before"),
      },
      { label: "7-day average", value: nairaShort(d.avg7NGN), note: "Taken on a typical day this past week" },
      { label: "Shop orders paid", value: String(d.rtwOrders), note: t.rtwNGN > 0 ? `${naira(t.rtwNGN)} ready-to-wear` : null },
      {
        label: "New commissions",
        value: String(d.newCommissions.length),
        note: d.consultationsBooked > 0 ? `${plural(d.consultationsBooked, "consultation")} booked` : null,
      },
    ]),
  });

  if (t.totalNGN > 0) {
    sections.push({
      heading: "Where the money came from",
      body: shareBars([
        { label: "Commissions", value: t.commissionNGN, display: naira(t.commissionNGN) },
        { label: "Consultations", value: t.consultationNGN, display: naira(t.consultationNGN) },
        { label: "Ready-to-wear", value: t.rtwNGN, display: naira(t.rtwNGN) },
      ]),
      note: "Payments confirmed during the day, from the payment ledger.",
    });
  }

  sections.push({ heading: "Needs attention", body: attention(d.attention, appUrl) });

  if (d.workroom.entries.length > 0) {
    sections.push({
      heading: "Workroom",
      body: table(
        ["Piece", "Who", "Done today", "Progress"],
        d.workroom.entries.map((e) => [
          e.orderRef,
          e.who,
          e.done + (e.blocker ? ` · Blocked: ${e.blocker}` : ""),
          e.partDone ? "Part done" : `${e.progress}%`,
        ]),
        { numericFrom: 3 },
      ),
    });
  } else quiet.push("workroom entries");

  if (d.stages.length > 0) {
    sections.push({ heading: "Stages completed", body: table(["Piece", "Stage completed"], d.stages.map((s) => [s.orderRef, s.stage])) });
  } else quiet.push("stage advances");

  if (d.newCommissions.length > 0) {
    sections.push({
      heading: "New commissions",
      body: table(
        ["Reference", "Client", "Value"],
        d.newCommissions.map((c) => [c.orderRef, c.clientName, c.totalNGN > 0 ? naira(c.totalNGN) : "Not priced"]),
        { numericFrom: 2 },
      ),
    });
  }

  if (d.consultationsDone.length > 0) {
    sections.push({
      heading: "Consultations held",
      body: table(["Booking", "Client"], d.consultationsDone.map((c) => [c.bookingNumber, c.clientName])),
    });
  } else quiet.push("consultations held");

  if (d.attendance.length > 0) {
    sections.push({
      heading: "Attendance",
      body: table(
        ["Staff", "In", "Out"],
        d.attendance.map((a) => [a.name, a.clockIn ?? "Not in", a.clockOut ?? "—"]),
        { numericFrom: 1 },
      ),
    });
  } else quiet.push("clock-ins");

  sections.push({
    heading: "Deliveries in the next 7 days",
    body:
      d.deliveries.length > 0
        ? table(
            ["Piece", "Client", "Stage now", "Due"],
            d.deliveries.map((o) => [o.orderRef, o.clientName, o.stage, `${shortDate(o.date)} · ${o.daysLeft <= 0 ? "today" : `${o.daysLeft}d`}`]),
            { numericFrom: 3 },
          )
        : paragraph("None due.", true),
  });

  const dateText = longDate(d.date);
  const headline = t.totalNGN > 0 ? `${nairaShort(t.totalNGN)} taken` : "No payments";
  const flags = d.attention.length > 0 ? ` · ${plural(d.attention.length, "thing")} to act on` : "";
  return {
    subject: `Daily report · ${lagosLabel(d.date, { weekday: "short", day: "numeric", month: "short" })} · ${headline}${flags}`,
    html: reportEmail({
      kind: "Daily report",
      title: dateText,
      subtitle: "The Lagos day from midnight to midnight.",
      preheader: `${headline}${flags}. ${plural(d.rtwOrders, "shop order")}, ${plural(d.newCommissions.length, "new commission")}.`,
      sections,
      quiet,
      appUrl,
      ctaHref: "/admin/reports",
      ctaLabel: "Open reports",
      footer: "You receive this because you are named for daily and weekly reports in Admin → Who is told. It is sent every night at midnight, Lagos time.",
    }),
  };
}

/* ----------------------------------------------------------------- weekly */

export type WeeklyReportData = {
  from: Date;
  to: Date;
  takings: Takings;
  prevTakings: Takings;
  byDay: { label: string; value: number }[];
  rtwOrders: number;
  prevRtwOrders: number;
  topProducts: { name: string; qty: number }[];
  newCommissions: number;
  newCommissionValueNGN: number;
  newClients: number;
  consultationsBooked: number;
  consultationsDone: number;
  pipeline: { stage: string; count: number }[];
  workLogs: number;
  blockers: number;
  attention: AttentionItem[];
  deliveries: Awaited<ReturnType<typeof upcomingDeliveries>>;
};

export async function weeklyReportData(now = new Date()): Promise<WeeklyReportData> {
  // Fired Monday morning: report the Monday–Sunday that just ended.
  const week = financeRange("week", new Date(now.getTime() - DAY_MS));
  const { from, to } = week;

  const [lines, prevTakings, rtwOrders, prevRtwOrders, top, commissions, newClients, booked, done, active, workLogs, blockers, deliveries] =
    await Promise.all([
      ledgerLines(from, to),
      takings(week.prevFrom, week.prevTo),
      prisma.order.count({ where: { isBespoke: false, paidAt: { gte: from, lt: to } } }),
      prisma.order.count({ where: { isBespoke: false, paidAt: { gte: week.prevFrom, lt: week.prevTo } } }),
      prisma.orderItem.groupBy({
        by: ["productId"],
        where: { order: { isBespoke: false, paidAt: { gte: from, lt: to } } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 3,
      }),
      prisma.bespokeOrder.findMany({ where: { createdAt: { gte: from, lt: to } }, select: { totalAmount: true } }),
      prisma.clientProfile.count({ where: { createdAt: { gte: from, lt: to } } }),
      prisma.consultationBooking.count({ where: { createdAt: { gte: from, lt: to } } }),
      prisma.consultationBooking.count({ where: { confirmedDate: { gte: from, lt: to }, status: "COMPLETED" } }),
      prisma.bespokeOrder.groupBy({
        by: ["currentStage"],
        where: { status: { notIn: CLOSED }, currentStage: { not: "DELIVERY" } },
        _count: { _all: true },
      }),
      prisma.workLog.count({ where: { createdAt: { gte: from, lt: to } } }),
      prisma.workLog.count({ where: { createdAt: { gte: from, lt: to }, blocker: { not: null } } }),
      upcomingDeliveries(to, 14),
    ]);

  const names = top.length
    ? await prisma.product.findMany({ where: { id: { in: top.map((t) => t.productId) } }, select: { id: true, name: true } })
    : [];
  const byDay = Array.from({ length: 7 }, (_, i) => {
    const s = new Date(from.getTime() + i * DAY_MS);
    return { label: lagosLabel(s, { weekday: "short" }), value: takingsIn(lines, s, new Date(s.getTime() + DAY_MS)).totalNGN };
  });
  const order = Object.keys(STAGE_SHORT_LABELS);

  return {
    from,
    to,
    takings: sumTakings(lines),
    prevTakings,
    byDay,
    rtwOrders,
    prevRtwOrders,
    topProducts: top.map((t) => ({ name: names.find((n) => n.id === t.productId)?.name ?? "A product", qty: t._sum.quantity ?? 0 })),
    newCommissions: commissions.length,
    newCommissionValueNGN: commissions.reduce((s, c) => s + c.totalAmount, 0),
    newClients,
    consultationsBooked: booked,
    consultationsDone: done,
    pipeline: active
      .map((a) => ({ stage: STAGE_SHORT_LABELS[a.currentStage], count: a._count._all, i: order.indexOf(a.currentStage) }))
      .sort((a, b) => a.i - b.i)
      .map(({ stage, count }) => ({ stage, count })),
    workLogs,
    blockers,
    attention: await attentionItems(now),
    deliveries,
  };
}

export function renderWeeklyReport(d: WeeklyReportData, appUrl: string): { subject: string; html: string } {
  const t = d.takings;
  const lastDay = new Date(d.to.getTime() - DAY_MS);
  const range = `${shortDate(d.from)} – ${lagosLabel(lastDay, { day: "numeric", month: "short", year: "numeric" })}`;
  const sections: ReportSection[] = [];
  const quiet: string[] = [];
  const activeTotal = d.pipeline.reduce((s, p) => s + p.count, 0);

  sections.push({
    heading: "The week in numbers",
    body: tiles([
      { label: "Taken", value: nairaShort(t.totalNGN), note: change(t.totalNGN, d.prevTakings.totalNGN, "on the week before") },
      { label: "Shop orders paid", value: String(d.rtwOrders), note: change(d.rtwOrders, d.prevRtwOrders, "on the week before") },
      {
        label: "New commissions",
        value: String(d.newCommissions),
        note: d.newCommissionValueNGN > 0 ? `${naira(d.newCommissionValueNGN)} quoted value` : null,
      },
      { label: "New clients", value: String(d.newClients), note: `${plural(d.consultationsBooked, "consultation")} booked, ${d.consultationsDone} held` },
    ]),
  });

  sections.push({
    heading: "Takings by day",
    body: join(
      dayColumns(d.byDay),
      t.totalNGN > 0
        ? shareBars([
            { label: "Commissions", value: t.commissionNGN, display: naira(t.commissionNGN) },
            { label: "Consultations", value: t.consultationNGN, display: naira(t.consultationNGN) },
            { label: "Ready-to-wear", value: t.rtwNGN, display: naira(t.rtwNGN) },
          ])
        : null,
    ),
    note: "Payments confirmed during the week, from the payment ledger.",
  });

  sections.push({ heading: "Needs attention", body: attention(d.attention, appUrl) });

  sections.push({
    heading: "In production",
    body:
      activeTotal > 0
        ? join(
            shareBars(d.pipeline.map((p) => ({ label: p.stage, value: p.count, display: String(p.count) }))),
            paragraph(
              `${plural(activeTotal, "commission")} in progress. ${plural(d.workLogs, "workroom entry", "workroom entries")} filed this week${d.blockers ? `, ${plural(d.blockers, "blocker")} raised` : ""}.`,
              true,
            ),
          )
        : paragraph("No commissions in progress.", true),
  });

  sections.push({
    heading: "Deliveries in the next 14 days",
    body:
      d.deliveries.length > 0
        ? table(
            ["Piece", "Client", "Stage now", "Due"],
            d.deliveries.map((o) => [o.orderRef, o.clientName, o.stage, `${shortDate(o.date)} · ${o.daysLeft}d`]),
            { numericFrom: 3 },
          )
        : paragraph("None due.", true),
  });

  if (d.topProducts.length > 0) {
    sections.push({
      heading: "Best-selling ready-to-wear",
      body: table(["Piece", "Sold"], d.topProducts.map((p) => [p.name, String(p.qty)]), { numericFrom: 1 }),
    });
  } else quiet.push("ready-to-wear sales");

  const headline = t.totalNGN > 0 ? `${nairaShort(t.totalNGN)} taken` : "No payments";
  const pct =
    d.prevTakings.totalNGN > 0 ? ` (${t.totalNGN >= d.prevTakings.totalNGN ? "+" : ""}${Math.round(((t.totalNGN - d.prevTakings.totalNGN) / d.prevTakings.totalNGN) * 100)}%)` : "";
  return {
    subject: `Weekly report · ${range} · ${headline}${pct}`,
    html: reportEmail({
      kind: "Weekly report",
      title: `Week of ${lagosLabel(d.from, { day: "numeric", month: "long" })}`,
      subtitle: `${range}, Monday to Sunday.`,
      preheader: `${headline}${pct}. ${plural(d.rtwOrders, "shop order")}, ${plural(d.newCommissions, "new commission")}, ${plural(d.attention.length, "thing")} to act on.`,
      sections,
      quiet,
      appUrl,
      ctaHref: "/admin/reports",
      ctaLabel: "Open reports",
      footer: "You receive this because you are named for daily and weekly reports in Admin → Who is told. It is sent every Monday at 8am, Lagos time.",
    }),
  };
}
