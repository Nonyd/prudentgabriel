import { prisma } from "@/lib/prisma";
import {
  AnalyticsDashboard,
  type BespokeAlertRow,
  type CouponExpiringRow,
  type DailyRevenuePoint,
  type OosRow,
  type RecentOrderRow,
} from "@/components/admin/AnalyticsDashboard";

function buildChartData(
  thirtyDaysAgo: Date,
  orders: { total: number; createdAt: Date }[],
  dayCount: number,
): DailyRevenuePoint[] {
  const map = new Map<string, number>();
  for (const o of orders) {
    const key = o.createdAt.toISOString().slice(0, 10);
    map.set(key, (map.get(key) ?? 0) + o.total);
  }
  const out: DailyRevenuePoint[] = [];
  const start = new Date(thirtyDaysAgo);
  start.setHours(0, 0, 0, 0);
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    out.push({
      date: key,
      label: d.toLocaleDateString("en-GB", { month: "short", day: "numeric" }),
      amount: map.get(key) ?? 0,
    });
  }
  return out;
}

export default async function AdminDashboardPage() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    agg30,
    aggPrev30,
    newCustomers,
    newCustomersReferral,
    ordersPendingPayment,
    pendingBespoke,
    pendingReviews,
    pendingOrdersFulfilment,
    paidOrders30,
    recentOrdersRaw,
    oosRaw,
    bespokePendingListRaw,
    expiringCouponsRaw,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: { paymentStatus: "PAID", createdAt: { gte: thirtyDaysAgo } },
      _sum: { total: true },
      _count: { id: true },
    }),
    prisma.order.aggregate({
      where: {
        paymentStatus: "PAID",
        createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
      },
      _sum: { total: true },
    }),
    prisma.user.count({
      where: { role: "CUSTOMER", createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.user.count({
      where: {
        role: "CUSTOMER",
        createdAt: { gte: thirtyDaysAgo },
        referredById: { not: null },
      },
    }),
    prisma.order.count({ where: { paymentStatus: "PENDING" } }),
    prisma.bespokeRequest.count({ where: { status: "PENDING" } }),
    prisma.review.count({ where: { isApproved: false } }),
    prisma.order.count({ where: { status: "PENDING", paymentStatus: "PAID" } }),
    prisma.order.findMany({
      where: { paymentStatus: "PAID", createdAt: { gte: thirtyDaysAgo } },
      select: { total: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        user: { select: { name: true, email: true } },
        items: {
          take: 1,
          include: { product: { select: { name: true } } },
        },
        _count: { select: { items: true } },
      },
    }),
    prisma.productVariant.findMany({
      where: { stock: 0 },
      take: 5,
      include: { product: { select: { name: true, slug: true, id: true } } },
    }),
    prisma.bespokeRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        requestNumber: true,
        name: true,
        occasion: true,
        createdAt: true,
      },
    }),
    prisma.coupon.findMany({
      where: {
        isActive: true,
        expiresAt: { gte: now, lte: sevenDays },
      },
      take: 8,
      orderBy: { expiresAt: "asc" },
    }),
  ]);

  const revenue30 = agg30._sum.total ?? 0;
  const revenuePrev30 = aggPrev30._sum.total ?? 0;
  const chartData = buildChartData(thirtyDaysAgo, paidOrders30, 30);

  const recentOrders: RecentOrderRow[] = recentOrdersRaw.map((o) => {
    const guest = !o.user;
    const email = o.user?.email ?? o.guestEmail ?? "";
    const name = o.user?.name ?? o.guestName ?? "";
    const customerLabel = guest && !o.user ? `Guest · ${email}` : `${name || "Customer"} · ${email}`;
    const first = o.items[0]?.product?.name ?? "—";
    const itemSummary =
      o._count.items > 1 ? `${first} +${o._count.items - 1}` : first;
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      customerLabel,
      itemSummary,
      total: o.total,
      gateway: o.paymentGateway,
      paymentStatus: o.paymentStatus,
      status: o.status,
      createdAt: o.createdAt.toISOString(),
    };
  });

  const oosVariants: OosRow[] = oosRaw.map((v) => ({
    productId: v.product.id,
    productName: v.product.name,
    slug: v.product.slug,
    size: v.size,
  }));

  const bespokePendingList: BespokeAlertRow[] = bespokePendingListRaw.map((b) => ({
    id: b.id,
    requestNumber: b.requestNumber,
    name: b.name,
    occasion: b.occasion,
    createdAt: b.createdAt.toISOString(),
  }));

  const expiringCoupons: CouponExpiringRow[] = expiringCouponsRaw.map((c) => ({
    id: c.id,
    code: c.code,
    expiresAt: (c.expiresAt ?? now).toISOString(),
    remainingUses:
      c.maxUsesTotal != null ? `${Math.max(0, c.maxUsesTotal - c.usedCount)} left` : "∞ uses",
  }));

  return (
    <AnalyticsDashboard
      revenue30={revenue30}
      revenuePrev30={revenuePrev30}
      orders30Count={agg30._count.id}
      ordersPendingPayment={ordersPendingPayment}
      newCustomers30={newCustomers}
      newCustomersReferral30={newCustomersReferral}
      pendingBespoke={pendingBespoke}
      pendingReviews={pendingReviews}
      pendingOrdersFulfilment={pendingOrdersFulfilment}
      chartData={chartData}
      recentOrders={recentOrders}
      oosVariants={oosVariants}
      bespokePendingList={bespokePendingList}
      expiringCoupons={expiringCoupons}
    />
  );
}
