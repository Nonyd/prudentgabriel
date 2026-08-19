import { NextRequest, NextResponse } from "next/server";
import { BespokeStage, PaymentStatus } from "@prisma/client";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";
import { STAGE_SHORT_LABELS } from "@/lib/bespoke-stages";

function parseRange(req: NextRequest): { from: Date; to: Date; prevFrom: Date; prevTo: Date } {
  const preset = req.nextUrl.searchParams.get("preset") ?? "this_month";
  const fromParam = req.nextUrl.searchParams.get("from");
  const toParam = req.nextUrl.searchParams.get("to");

  const now = new Date();
  let from = new Date(now.getFullYear(), now.getMonth(), 1);
  let to = new Date(now);

  if (fromParam && toParam) {
    from = new Date(fromParam);
    to = new Date(toParam);
  } else if (preset === "today") {
    from = new Date(now);
    from.setHours(0, 0, 0, 0);
    to = new Date(from);
    to.setHours(23, 59, 59, 999);
  } else if (preset === "yesterday") {
    from = new Date(now);
    from.setDate(from.getDate() - 1);
    from.setHours(0, 0, 0, 0);
    to = new Date(from);
    to.setHours(23, 59, 59, 999);
  } else if (preset === "this_week") {
    from = new Date(now);
    from.setDate(from.getDate() - from.getDay());
    from.setHours(0, 0, 0, 0);
  } else if (preset === "last_month") {
    from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  }

  const span = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - span);

  return { from, to, prevFrom, prevTo };
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export async function GET(req: NextRequest) {
  const gate = await requireAdminApi("reports");
  if (!gate.ok) return gate.response;

  const { from, to, prevFrom, prevTo } = parseRange(req);

  try {
    const [
      rtwPaid,
      rtwPaidPrev,
      bespokePaid,
      bespokePaidPrev,
      newClients,
      newClientsPrev,
      ordersCompleted,
      ordersCompletedPrev,
      consultations,
      consultationsPrev,
      consultSummary,
      pipeline,
      topClients,
      staffLogs,
    ] = await Promise.all([
      prisma.order.aggregate({
        where: { paymentStatus: PaymentStatus.PAID, createdAt: { gte: from, lte: to }, isBespoke: false },
        _sum: { total: true },
      }),
      prisma.order.aggregate({
        where: {
          paymentStatus: PaymentStatus.PAID,
          createdAt: { gte: prevFrom, lte: prevTo },
          isBespoke: false,
        },
        _sum: { total: true },
      }),
      prisma.bespokeOrder.aggregate({
        where: { createdAt: { gte: from, lte: to } },
        _sum: { amountPaid: true },
      }),
      prisma.bespokeOrder.aggregate({
        where: { createdAt: { gte: prevFrom, lte: prevTo } },
        _sum: { amountPaid: true },
      }),
      prisma.clientProfile.count({ where: { createdAt: { gte: from, lte: to } } }),
      prisma.clientProfile.count({ where: { createdAt: { gte: prevFrom, lte: prevTo } } }),
      prisma.order.count({
        where: { status: "DELIVERED", updatedAt: { gte: from, lte: to } },
      }),
      prisma.order.count({
        where: { status: "DELIVERED", updatedAt: { gte: prevFrom, lte: prevTo } },
      }),
      prisma.consultationBooking.count({ where: { createdAt: { gte: from, lte: to } } }),
      prisma.consultationBooking.count({ where: { createdAt: { gte: prevFrom, lte: prevTo } } }),
      prisma.consultationBooking.groupBy({
        by: ["status"],
        where: { createdAt: { gte: from, lte: to } },
        _count: { id: true },
        _sum: { feeNGN: true },
      }),
      prisma.bespokeOrder.groupBy({
        by: ["currentStage"],
        _count: { id: true },
        where: { currentStage: { not: "DELIVERY" } },
      }),
      prisma.clientProfile.findMany({
        take: 5,
        orderBy: { totalSpend: "desc" },
        include: { user: { select: { name: true, email: true } } },
      }),
      prisma.attendanceLog.findMany({
        where: { date: { gte: from, lte: to }, clockIn: { not: null } },
        include: {
          staff: {
            include: { user: { select: { name: true } } },
          },
        },
      }),
    ]);

    const rtwRev = rtwPaid._sum.total ?? 0;
    const rtwRevPrev = rtwPaidPrev._sum.total ?? 0;
    const bespokeRev = bespokePaid._sum.amountPaid ?? 0;
    const bespokeRevPrev = bespokePaidPrev._sum.amountPaid ?? 0;
    const totalRev = rtwRev + bespokeRev;
    const totalRevPrev = rtwRevPrev + bespokeRevPrev;

    const dailyMap = new Map<string, { date: string; bespoke: number; rtw: number }>();
    const cursor = new Date(from);
    while (cursor <= to) {
      const key = cursor.toISOString().slice(0, 10);
      dailyMap.set(key, { date: key, bespoke: 0, rtw: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    const [rtwDaily, bespokeDaily] = await Promise.all([
      prisma.order.findMany({
        where: { paymentStatus: PaymentStatus.PAID, createdAt: { gte: from, lte: to }, isBespoke: false },
        select: { total: true, createdAt: true },
      }),
      prisma.bespokeOrder.findMany({
        where: { createdAt: { gte: from, lte: to } },
        select: { amountPaid: true, createdAt: true },
      }),
    ]);

    rtwDaily.forEach((o) => {
      const key = o.createdAt.toISOString().slice(0, 10);
      const row = dailyMap.get(key);
      if (row) row.rtw += o.total;
    });
    bespokeDaily.forEach((o) => {
      const key = o.createdAt.toISOString().slice(0, 10);
      const row = dailyMap.get(key);
      if (row) row.bespoke += o.amountPaid;
    });

    const staffSummary = new Map<string, { name: string; days: number; late: number }>();
    staffLogs.forEach((log) => {
      const id = log.staffId;
      const cur = staffSummary.get(id) ?? {
        name: log.staff.user.name ?? "Staff",
        days: 0,
        late: 0,
      };
      cur.days += 1;
      staffSummary.set(id, cur);
    });

    const [inventory, activeProduction, productivity] = await Promise.all([
      prisma.productVariant.findMany({
        take: 50,
        orderBy: { stock: "asc" },
        include: { product: { select: { name: true, category: true } } },
      }),
      prisma.bespokeOrder.findMany({
        where: { status: { notIn: ["DELIVERED", "CANCELLED"] } },
        orderBy: { deliveryDate: "asc" },
        take: 30,
        include: {
          assignments: {
            take: 1,
            include: {
              staffProfile: { include: { user: { select: { name: true } } } },
            },
          },
        },
      }),
      prisma.orderAssignment.findMany({
        where: { completedAt: { gte: from, lte: to } },
        include: {
          staffProfile: { include: { user: { select: { name: true } } } },
        },
      }),
    ]);

    const productivityMap = new Map<string, { name: string; completed: number }>();
    productivity.forEach((a) => {
      const key = a.staffProfileId;
      const cur = productivityMap.get(key) ?? {
        name: a.staffProfile.user.name ?? "Staff",
        completed: 0,
      };
      cur.completed += 1;
      productivityMap.set(key, cur);
    });

    const now = new Date();

    return NextResponse.json({
      range: { from: from.toISOString(), to: to.toISOString() },
      kpis: {
        totalRevenue: { value: totalRev, change: pctChange(totalRev, totalRevPrev) },
        bespokeRevenue: { value: bespokeRev, change: pctChange(bespokeRev, bespokeRevPrev) },
        rtwRevenue: { value: rtwRev, change: pctChange(rtwRev, rtwRevPrev) },
        newClients: { value: newClients, change: pctChange(newClients, newClientsPrev) },
        ordersCompleted: { value: ordersCompleted, change: pctChange(ordersCompleted, ordersCompletedPrev) },
        consultations: { value: consultations, change: pctChange(consultations, consultationsPrev) },
      },
      revenueChart: Array.from(dailyMap.values()),
      pipeline: pipeline.map((p) => ({
        stage: STAGE_SHORT_LABELS[p.currentStage as BespokeStage],
        count: p._count.id,
      })),
      topClients: topClients.map((c) => ({
        name: c.user.name ?? c.user.email,
        totalSpend: c.totalSpend,
        tier: c.loyaltyTier,
      })),
      staffAttendance: Array.from(staffSummary.values()),
      consultationsSummary: {
        total: consultations,
        byStatus: consultSummary.map((c) => ({
          status: c.status,
          count: c._count.id,
          revenue: c._sum.feeNGN ?? 0,
        })),
      },
      inventory: inventory.map((v) => ({
        product: v.product.name,
        category: v.product.category,
        size: v.size,
        stock: v.stock,
        status: v.stock <= 0 ? "out" : v.stock <= 3 ? "low" : "ok",
      })),
      production: activeProduction.map((o) => ({
        orderRef: o.orderRef,
        clientName: o.clientName,
        stage: STAGE_SHORT_LABELS[o.currentStage as BespokeStage],
        tailor: o.assignments[0]?.staffProfile.user.name ?? "—",
        deliveryDate: o.deliveryDate?.toISOString() ?? null,
        overdue: o.deliveryDate != null && o.deliveryDate < now,
      })),
      staffProductivity: Array.from(productivityMap.values()).sort(
        (a, b) => b.completed - a.completed,
      ),
    });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "ADMIN_REPORTS",
      message: e instanceof Error ? e.message : "Reports failed",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
