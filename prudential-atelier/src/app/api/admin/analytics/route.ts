import { NextRequest, NextResponse } from "next/server";
import { OrderStatus, PaymentStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

export async function GET(req: NextRequest) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") ?? "30d";
  const days = period === "7d" ? 7 : period === "90d" ? 90 : period === "1y" ? 365 : 30;
  const start = daysAgo(days);
  const prevStart = daysAgo(days * 2);

  const [paidOrders, prevPaid, byStatus, customers, newCustomers, topLines, pendingOrders, pendingBespoke, pendingReviews] =
    await Promise.all([
      prisma.order.findMany({
        where: { paymentStatus: PaymentStatus.PAID, createdAt: { gte: start } },
        select: { total: true, createdAt: true },
      }),
      prisma.order.findMany({
        where: {
          paymentStatus: PaymentStatus.PAID,
          createdAt: { gte: prevStart, lt: start },
        },
        select: { total: true },
      }),
      prisma.order.groupBy({ by: ["status"], _count: { id: true } }),
      prisma.user.count({ where: { role: Role.CUSTOMER } }),
      prisma.user.count({ where: { role: Role.CUSTOMER, createdAt: { gte: start } } }),
      prisma.orderItem.groupBy({
        by: ["productId"],
        where: { order: { paymentStatus: PaymentStatus.PAID, createdAt: { gte: start } } },
        _sum: { lineTotal: true },
        _count: { id: true },
        orderBy: { _sum: { lineTotal: "desc" } },
        take: 8,
      }),
      prisma.order.count({ where: { status: OrderStatus.PENDING } }),
      prisma.bespokeRequest.count({ where: { status: "PENDING" } }),
      prisma.review.count({ where: { isApproved: false } }),
    ]);

  const revenue = paidOrders.reduce((s, o) => s + o.total, 0);
  const prevRev = prevPaid.reduce((s, o) => s + o.total, 0);
  const revenueGrowth = prevRev > 0 ? ((revenue - prevRev) / prevRev) * 100 : revenue > 0 ? 100 : 0;

  const byDayMap = new Map<string, number>();
  for (const o of paidOrders) {
    const k = o.createdAt.toISOString().slice(0, 10);
    byDayMap.set(k, (byDayMap.get(k) ?? 0) + o.total);
  }
  const byDay: { date: string; amount: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const k = d.toISOString().slice(0, 10);
    byDay.push({ date: k, amount: byDayMap.get(k) ?? 0 });
  }

  const ordersByStatus = Object.fromEntries(
    byStatus.map((g) => [g.status, g._count.id]),
  ) as Record<OrderStatus, number>;

  const productIds = topLines.map((t) => t.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true },
  });
  const nameById = new Map(products.map((p) => [p.id, p.name]));

  const topProducts = topLines.map((t) => ({
    productId: t.productId,
    name: nameById.get(t.productId) ?? "—",
    revenue: t._sum.lineTotal ?? 0,
    orderCount: t._count.id,
  }));

  return NextResponse.json({
    revenue: { total: revenue, byDay },
    orders: {
      total: paidOrders.length,
      byStatus: ordersByStatus,
    },
    customers: {
      total: customers,
      new: newCustomers,
      withOrders: await prisma.user.count({
        where: { role: Role.CUSTOMER, orders: { some: {} } },
      }),
    },
    topProducts,
    pendingActions: { orders: pendingOrders, bespoke: pendingBespoke, reviews: pendingReviews },
    revenueGrowth,
  });
}
