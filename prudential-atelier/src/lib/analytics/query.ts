import { OrderStatus, PaymentStatus, PointsType, QuoteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { snapshotValueNGN } from "@/lib/checkout-session";
import { outstandingPointsTotal } from "@/lib/points";
import { getSetting } from "@/lib/settings";
import { attributionLabel, FUNNEL_ADD_TO_BAG, GLORY_UTM_NOTE } from "@/lib/analytics/attribution";
import {
  ANALYTICS_DAILY_RETENTION_DEFAULT,
  ANALYTICS_DAILY_RETENTION_KEY,
  isAtelierPath,
  isConsultationPagePath,
  isRtwAislePath,
} from "@/lib/analytics/paths";
import { analyticsDayUtc } from "@/lib/analytics/record";
import type { FunnelStep, HouseNumbers, LookedRow, RisingRow, TrafficRow } from "@/lib/analytics/view";

export type { FunnelStep, HouseNumbers, LookedRow, RisingRow, TrafficRow } from "@/lib/analytics/view";

function sumCounts(rows: { count: number }[]): number {
  return rows.reduce((s, r) => s + r.count, 0);
}

const EARNED_TYPES: PointsType[] = [
  PointsType.EARNED_PURCHASE,
  PointsType.EARNED_REFERRAL,
  PointsType.EARNED_SIGNUP,
  PointsType.EARNED_REVIEW,
  PointsType.EARNED_NEWSLETTER,
  PointsType.EARNED_BIRTHDAY,
  PointsType.EARNED_PROFILE,
];

async function pageCounts(from: Date, to: Date) {
  const dayFrom = analyticsDayUtc(from);
  const dayTo = analyticsDayUtc(new Date(to.getTime() - 1));
  const daily = await prisma.analyticsPageDaily.findMany({
    where: { day: { gte: dayFrom, lte: dayTo } },
    select: { path: true, count: true, day: true },
  });
  const months: string[] = [];
  const cursor = new Date(Date.UTC(dayFrom.getUTCFullYear(), dayFrom.getUTCMonth(), 1));
  const endMonth = new Date(Date.UTC(dayTo.getUTCFullYear(), dayTo.getUTCMonth(), 1));
  while (cursor <= endMonth) {
    months.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  const monthly =
    months.length === 0
      ? []
      : await prisma.analyticsPageMonthly.findMany({
          where: { yearMonth: { in: months } },
          select: { path: true, count: true, yearMonth: true },
        });
  const dailyDays = new Set(daily.map((r) => r.day.toISOString().slice(0, 10)));
  const monthlyUsable = monthly.filter((row) => {
    const covered = Array.from(dailyDays).some((d) => d.startsWith(row.yearMonth));
    return !covered;
  });
  return { daily, monthly: monthlyUsable };
}

async function eventCount(from: Date, to: Date, name: string): Promise<number> {
  const dayFrom = analyticsDayUtc(from);
  const dayTo = analyticsDayUtc(new Date(to.getTime() - 1));
  const daily = await prisma.analyticsEventDaily.aggregate({
    where: { name, day: { gte: dayFrom, lte: dayTo } },
    _sum: { count: true },
  });
  return daily._sum.count ?? 0;
}

async function productViews(from: Date, to: Date): Promise<Map<string, number>> {
  const dayFrom = analyticsDayUtc(from);
  const dayTo = analyticsDayUtc(new Date(to.getTime() - 1));
  const rows = await prisma.analyticsProductDaily.findMany({
    where: { day: { gte: dayFrom, lte: dayTo } },
    select: { productId: true, count: true },
  });
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.productId, (map.get(row.productId) ?? 0) + row.count);
  }
  return map;
}

export async function buildHouseNumbers(
  from: Date,
  to: Date,
  prevFrom: Date,
  prevTo: Date,
  revenueNGN: number,
  revenuePrev: number,
): Promise<HouseNumbers> {
  const retentionRaw = await getSetting(ANALYTICS_DAILY_RETENTION_KEY);
  const retentionDays = Math.max(30, Math.min(730, Number(retentionRaw) || ANALYTICS_DAILY_RETENTION_DEFAULT));

  const [{ daily, monthly }, prevPages, addBag, addBagPrev, views, viewsPrev] = await Promise.all([
    pageCounts(from, to),
    pageCounts(prevFrom, prevTo),
    eventCount(from, to, FUNNEL_ADD_TO_BAG),
    eventCount(prevFrom, prevTo, FUNNEL_ADD_TO_BAG),
    productViews(from, to),
    productViews(prevFrom, prevTo),
  ]);
  const pages = [...daily, ...monthly];
  const prevPageRows = [...prevPages.daily, ...prevPages.monthly];

  const visits = sumCounts(pages);
  const visitsPrev = sumCounts(prevPageRows);
  const aisle = sumCounts(pages.filter((r) => isRtwAislePath(r.path)));
  const aislePrev = sumCounts(prevPageRows.filter((r) => isRtwAislePath(r.path)));
  const productViewCount = Array.from(views.values()).reduce((s, n) => s + n, 0);
  const productViewPrev = Array.from(viewsPrev.values()).reduce((s, n) => s + n, 0);
  const atelierViews = sumCounts(pages.filter((r) => isAtelierPath(r.path)));
  const atelierViewsPrev = sumCounts(prevPageRows.filter((r) => isAtelierPath(r.path)));
  const consultViews = sumCounts(pages.filter((r) => isConsultationPagePath(r.path)));
  const consultViewsPrev = sumCounts(prevPageRows.filter((r) => isConsultationPagePath(r.path)));

  const [
    paidOrders,
    paidOrdersPrev,
    checkouts,
    checkoutsPrev,
    bookings,
    bookingsPrev,
    bookingsPaid,
    bookingsPaidPrev,
    quotesSent,
    quotesSentPrev,
    commissions,
    commissionsPrev,
    abandonedRows,
    emailGroups,
    pointsIssued,
    pointsRedeemed,
    pointsOutstanding,
    liveCommissions,
    referralRows,
    attributedOrders,
  ] = await Promise.all([
    prisma.order.count({ where: { paidAt: { gte: from, lt: to }, paymentStatus: PaymentStatus.PAID } }),
    prisma.order.count({ where: { paidAt: { gte: prevFrom, lt: prevTo }, paymentStatus: PaymentStatus.PAID } }),
    prisma.checkoutSession.count({ where: { createdAt: { gte: from, lt: to } } }),
    prisma.checkoutSession.count({ where: { createdAt: { gte: prevFrom, lt: prevTo } } }),
    prisma.consultationBooking.count({ where: { createdAt: { gte: from, lt: to } } }),
    prisma.consultationBooking.count({ where: { createdAt: { gte: prevFrom, lt: prevTo } } }),
    prisma.consultationBooking.count({
      where: { paidAt: { gte: from, lt: to }, paymentStatus: { in: [PaymentStatus.PAID, PaymentStatus.CONFIRMED] } },
    }),
    prisma.consultationBooking.count({
      where: { paidAt: { gte: prevFrom, lt: prevTo }, paymentStatus: { in: [PaymentStatus.PAID, PaymentStatus.CONFIRMED] } },
    }),
    prisma.quotation.count({ where: { sentAt: { gte: from, lt: to }, status: { not: QuoteStatus.DRAFT } } }),
    prisma.quotation.count({ where: { sentAt: { gte: prevFrom, lt: prevTo }, status: { not: QuoteStatus.DRAFT } } }),
    prisma.bespokeOrder.count({ where: { createdAt: { gte: from, lt: to } } }),
    prisma.bespokeOrder.count({ where: { createdAt: { gte: prevFrom, lt: prevTo } } }),
    prisma.checkoutSession.findMany({
      where: { recoveredAt: null, createdAt: { gte: from, lt: to } },
      select: { cartSnapshot: true },
    }),
    prisma.emailMessage.groupBy({
      by: ["status"],
      where: { createdAt: { gte: from, lt: to } },
      _count: { _all: true },
    }),
    prisma.pointsTransaction.aggregate({
      where: { createdAt: { gte: from, lt: to }, type: { in: EARNED_TYPES } },
      _sum: { amount: true },
    }),
    prisma.pointsTransaction.aggregate({
      where: { createdAt: { gte: from, lt: to }, type: "REDEEMED" },
      _sum: { amount: true },
    }),
    outstandingPointsTotal(),
    prisma.bespokeOrder.findMany({
      where: { archivedAt: null, status: { not: OrderStatus.CANCELLED } },
      select: {
        currentStage: true,
        createdAt: true,
        stageCompletions: {
          where: { revertedAt: null },
          orderBy: { completedAt: "desc" },
          take: 1,
          select: { completedAt: true },
        },
      },
    }),
    prisma.analyticsReferralDaily.findMany({
      where: { day: { gte: analyticsDayUtc(from), lte: analyticsDayUtc(new Date(to.getTime() - 1)) } },
    }),
    prisma.order.findMany({
      where: { paidAt: { gte: from, lt: to }, paymentStatus: PaymentStatus.PAID },
      select: { attribution: true, total: true, shippingAmount: true },
    }),
  ]);

  const rtwFunnel: FunnelStep[] = [
    { id: "aisle", label: "Aisle viewed", count: aisle, prevCount: aislePrev },
    { id: "product", label: "Product viewed", count: productViewCount, prevCount: productViewPrev },
    { id: "bag", label: "Added to bag", count: addBag, prevCount: addBagPrev },
    { id: "checkout", label: "Checkout started", count: checkouts, prevCount: checkoutsPrev },
    { id: "paid", label: "Paid", count: paidOrders, prevCount: paidOrdersPrev },
  ];

  const atelierFunnel: FunnelStep[] = [
    { id: "atelier", label: "Atelier page", count: atelierViews, prevCount: atelierViewsPrev },
    { id: "consultation", label: "Consultation page", count: consultViews, prevCount: consultViewsPrev },
    { id: "booking", label: "Booking started", count: bookings, prevCount: bookingsPrev },
    { id: "bookingPaid", label: "Booking paid", count: bookingsPaid, prevCount: bookingsPaidPrev },
    { id: "quote", label: "Quotation sent", count: quotesSent, prevCount: quotesSentPrev },
    { id: "commission", label: "Commission started", count: commissions, prevCount: commissionsPrev },
  ];

  const orderByKey = new Map<string, { orders: number; revenueNGN: number }>();
  for (const order of attributedOrders) {
    const attr = (order.attribution ?? {}) as { source?: string; campaign?: string; content?: string; medium?: string };
    const key = `${attr.source ?? "(direct)"}|${attr.medium ?? ""}|${attr.campaign ?? ""}|${attr.content ?? ""}`;
    const sales = Math.max(0, (order.total ?? 0) - (order.shippingAmount ?? 0));
    const prev = orderByKey.get(key) ?? { orders: 0, revenueNGN: 0 };
    orderByKey.set(key, { orders: prev.orders + 1, revenueNGN: prev.revenueNGN + sales });
  }

  const trafficMap = new Map<string, TrafficRow>();
  for (const row of referralRows) {
    const key = `${row.source}|${row.medium}|${row.campaign}|${row.content}`;
    const sales = orderByKey.get(key);
    const existing = trafficMap.get(key);
    if (existing) {
      existing.landings += row.count;
    } else {
      trafficMap.set(key, {
        label: attributionLabel(row),
        source: row.source,
        campaign: row.campaign,
        content: row.content,
        medium: row.medium,
        landings: row.count,
        orders: sales?.orders ?? 0,
        revenueNGN: sales?.revenueNGN ?? 0,
      });
    }
  }
  for (const [key, sales] of Array.from(orderByKey.entries())) {
    if (trafficMap.has(key)) continue;
    const [source, medium, campaign, content] = key.split("|");
    trafficMap.set(key, {
      label: attributionLabel({ source: source ?? "(direct)", medium, campaign, content }),
      source: source ?? "(direct)",
      campaign: campaign ?? "",
      content: content ?? "",
      medium: medium ?? "",
      landings: 0,
      orders: sales.orders,
      revenueNGN: sales.revenueNGN,
    });
  }
  const traffic = Array.from(trafficMap.values()).sort((a, b) => b.orders - a.orders || b.landings - a.landings).slice(0, 12);

  const soldIds = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: { order: { paidAt: { gte: from, lt: to }, paymentStatus: PaymentStatus.PAID } },
    _sum: { quantity: true },
  });
  const soldMap = new Map(soldIds.map((r) => [r.productId, r._sum.quantity ?? 0]));
  const lookedEntries = Array.from(views.entries())
    .map(([productId, viewCount]) => ({
      productId,
      views: viewCount,
      unitsSold: soldMap.get(productId) ?? 0,
    }))
    .filter((r) => r.views > 0 && r.unitsSold === 0)
    .sort((a, b) => b.views - a.views)
    .slice(0, 12);
  const products =
    lookedEntries.length === 0
      ? []
      : await prisma.product.findMany({
          where: { id: { in: lookedEntries.map((r) => r.productId) } },
          select: { id: true, name: true },
        });
  const nameById = new Map(products.map((p) => [p.id, p.name]));
  const lookedNotBought: LookedRow[] = lookedEntries.map((r) => ({
    productId: r.productId,
    name: nameById.get(r.productId) ?? "Removed piece",
    views: r.views,
    unitsSold: r.unitsSold,
  }));

  const soldPrevIds = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: { order: { paidAt: { gte: prevFrom, lt: prevTo }, paymentStatus: PaymentStatus.PAID } },
    _sum: { quantity: true },
  });
  const soldPrevMap = new Map(soldPrevIds.map((r) => [r.productId, r._sum.quantity ?? 0]));
  const risingIds = new Set<string>([
    ...Array.from(views.keys()),
    ...Array.from(viewsPrev.keys()),
    ...Array.from(soldMap.keys()),
    ...Array.from(soldPrevMap.keys()),
  ]);
  const risingCandidates = Array.from(risingIds).map((productId) => {
    const viewNow = views.get(productId) ?? 0;
    const viewWas = viewsPrev.get(productId) ?? 0;
    const orderNow = soldMap.get(productId) ?? 0;
    const orderWas = soldPrevMap.get(productId) ?? 0;
    const viewRise = viewNow - viewWas;
    const orderRise = orderNow - orderWas;
    const useOrders = orderRise >= viewRise;
    const rise = useOrders ? orderRise : viewRise;
    return {
      productId,
      views: viewNow,
      viewsPrev: viewWas,
      orders: orderNow,
      ordersPrev: orderWas,
      rise,
      riseKind: (useOrders ? "orders" : "views") as "orders" | "views",
    };
  }).filter((r) => r.rise > 0);
  risingCandidates.sort((a, b) => b.rise - a.rise || b.orders - a.orders || b.views - a.views);
  const risingTop = risingCandidates.slice(0, 12);
  const risingProducts =
    risingTop.length === 0
      ? []
      : await prisma.product.findMany({
          where: { id: { in: risingTop.map((r) => r.productId) } },
          select: { id: true, name: true },
        });
  const risingNameById = new Map(risingProducts.map((p) => [p.id, p.name]));
  const rising: RisingRow[] = risingTop.map((r) => ({
    ...r,
    name: risingNameById.get(r.productId) ?? nameById.get(r.productId) ?? "Removed piece",
  }));

  const abandonedValue = abandonedRows.reduce((s, row) => s + snapshotValueNGN(row.cartSnapshot), 0);
  const emailCount = (status: string) => emailGroups.find((g) => g.status === status)?._count._all ?? 0;

  const now = Date.now();
  const stageMap = new Map<string, { count: number; days: number }>();
  for (const order of liveCommissions) {
    const entered = order.stageCompletions[0]?.completedAt ?? order.createdAt;
    const days = Math.max(0, (now - entered.getTime()) / (24 * 60 * 60 * 1000));
    const prev = stageMap.get(order.currentStage) ?? { count: 0, days: 0 };
    stageMap.set(order.currentStage, { count: prev.count + 1, days: prev.days + days });
  }
  const atelierStages = Array.from(stageMap.entries())
    .map(([stage, v]) => ({
      stage: stage.replace(/_/g, " ").toLowerCase(),
      count: v.count,
      avgDays: v.count ? Math.round((v.days / v.count) * 10) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const conversion = visits > 0 ? paidOrders / visits : 0;
  const conversionPrev = visitsPrev > 0 ? paidOrdersPrev / visitsPrev : 0;

  return {
    visits,
    visitsPrev,
    orders: paidOrders,
    ordersPrev: paidOrdersPrev,
    conversion,
    conversionPrev,
    revenueNGN,
    revenuePrev,
    rtwFunnel,
    atelierFunnel,
    traffic,
    lookedNotBought,
    rising,
    abandoned: { sessions: abandonedRows.length, valueNGN: abandonedValue },
    email: { sent: emailCount("SENT"), failed: emailCount("FAILED"), dead: emailCount("DEAD") },
    points: {
      issued: pointsIssued._sum.amount ?? 0,
      redeemed: Math.abs(pointsRedeemed._sum.amount ?? 0),
      outstanding: pointsOutstanding,
    },
    atelierStages,
    retentionDays,
    gloryNote: GLORY_UTM_NOTE,
  };
}
