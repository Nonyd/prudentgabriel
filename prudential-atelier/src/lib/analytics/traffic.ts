import { PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { attributionLabel } from "@/lib/analytics/attribution";
import { CHANNELS, channelFor } from "@/lib/analytics/channel";
import { analyticsDayUtc } from "@/lib/analytics/record";
import { getRetentionDays } from "@/lib/analytics/retention";
import { GAP_BUCKETS, SCREEN_BUCKETS } from "@/lib/analytics/visitor";
import type { CountRow, TrafficRangeId, TrafficReport, TrafficTotals } from "@/lib/analytics/traffic-view";

export type { TrafficRangeId, TrafficReport } from "@/lib/analytics/traffic-view";

const DAY_MS = 86_400_000;
/** Lagos is UTC+1 all year. */
const LAGOS_OFFSET_MS = 60 * 60 * 1000;

export const TRAFFIC_RANGES: { id: Exclude<TrafficRangeId, "custom">; label: string; days: number }[] = [
  { id: "today", label: "Today", days: 1 },
  { id: "7d", label: "7 days", days: 7 },
  { id: "30d", label: "30 days", days: 30 },
  { id: "90d", label: "90 days", days: 90 },
  { id: "12m", label: "12 months", days: 365 },
  { id: "all", label: "All time", days: 0 },
];

/** Longer than this and the chart groups by month. */
const DAILY_MAX_DAYS = 120;
/** A custom range may reach this far back. */
const CUSTOM_MAX_DAYS = 5 * 366;

export type TrafficRangeSpec = { id: TrafficRangeId; from?: string; to?: string };

function parseIsoDay(raw: string | null | undefined): Date | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || isoDay(d) !== raw ? null : d;
}

export function parseTrafficRange(params: URLSearchParams): TrafficRangeSpec {
  const id = params.get("range");
  if (id === "custom") {
    const from = parseIsoDay(params.get("from"));
    const to = parseIsoDay(params.get("to"));
    if (from && to) return { id: "custom", from: isoDay(from), to: isoDay(to) };
  }
  return TRAFFIC_RANGES.some((r) => r.id === id) ? { id: id as TrafficRangeId } : { id: "30d" };
}

type Window = { fromDay: Date; toDay: Date; buckets: string[]; monthly: boolean };

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

function ym(d: Date) {
  return d.toISOString().slice(0, 7);
}

function spanDays(fromDay: Date, toDay: Date) {
  return Math.round((toDay.getTime() - fromDay.getTime()) / DAY_MS) + 1;
}

function makeWindow(fromDay: Date, toDay: Date, monthly = spanDays(fromDay, toDay) > DAILY_MAX_DAYS): Window {
  const buckets: string[] = [];
  if (monthly) buckets.push(...monthsBetween(fromDay, toDay));
  else for (let t = fromDay.getTime(); t <= toDay.getTime(); t += DAY_MS) buckets.push(isoDay(new Date(t)));
  return { fromDay, toDay, buckets, monthly };
}

/** The same number of days, ending the day before. */
function previousOf(w: Window): Window {
  const days = spanDays(w.fromDay, w.toDay);
  const toDay = new Date(w.fromDay.getTime() - DAY_MS);
  return makeWindow(new Date(toDay.getTime() - (days - 1) * DAY_MS), toDay, w.monthly);
}

/** First day any page view was counted, daily or already rolled into a month. */
async function firstDataDay(): Promise<Date | null> {
  const [daily, monthly] = await Promise.all([
    prisma.analyticsPageDaily.findFirst({ orderBy: { day: "asc" }, select: { day: true } }),
    prisma.analyticsPageMonthly.findFirst({ orderBy: { yearMonth: "asc" }, select: { yearMonth: true } }),
  ]);
  const candidates = [daily?.day, monthly ? new Date(`${monthly.yearMonth}-01T00:00:00Z`) : undefined].filter(
    (d): d is Date => d instanceof Date,
  );
  return candidates.length ? new Date(Math.min(...candidates.map((d) => d.getTime()))) : null;
}

async function resolveWindows(
  spec: TrafficRangeSpec,
  now: Date,
): Promise<{ cur: Window; prev: Window | null; label: string; firstDay: string | null }> {
  const today = analyticsDayUtc(now);
  const first = await firstDataDay();
  const firstDay = first ? isoDay(first) : null;

  if (spec.id === "custom" && spec.from && spec.to) {
    let fromDay = new Date(`${spec.from}T00:00:00Z`);
    let toDay = new Date(`${spec.to}T00:00:00Z`);
    if (fromDay > toDay) [fromDay, toDay] = [toDay, fromDay];
    if (toDay > today) toDay = today;
    if (fromDay > toDay) fromDay = toDay;
    const earliest = new Date(today.getTime() - (CUSTOM_MAX_DAYS - 1) * DAY_MS);
    if (fromDay < earliest) fromDay = earliest;
    const cur = makeWindow(fromDay, toDay);
    return { cur, prev: previousOf(cur), label: "Custom", firstDay };
  }

  if (spec.id === "all") {
    const fromDay = first && first < today ? first : today;
    return { cur: makeWindow(fromDay, today), prev: null, label: "All time", firstDay };
  }

  if (spec.id === "12m") {
    const fromDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 11, 1));
    const cur = makeWindow(fromDay, today, true);
    const prevFrom = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 23, 1));
    const prevTo = new Date(fromDay.getTime() - DAY_MS);
    return { cur, prev: makeWindow(prevFrom, prevTo, true), label: "12 months", firstDay };
  }

  const preset = TRAFFIC_RANGES.find((r) => r.id === spec.id) ?? TRAFFIC_RANGES[2]!;
  const cur = makeWindow(new Date(today.getTime() - (preset.days - 1) * DAY_MS), today, false);
  return { cur, prev: previousOf(cur), label: preset.label, firstDay };
}

function monthsBetween(fromDay: Date, toDay: Date): string[] {
  const out: string[] = [];
  const c = new Date(Date.UTC(fromDay.getUTCFullYear(), fromDay.getUTCMonth(), 1));
  while (c <= toDay) {
    out.push(ym(c));
    c.setUTCMonth(c.getUTCMonth() + 1);
  }
  return out;
}

type Row = { bucket: string; weekday: number | null; dim: string; key: string; count: number };

/**
 * Daily rows inside the window, plus whole-month totals for months the
 * retention job has already rolled up (a month is either all daily or all monthly).
 */
async function loadWindow(w: Window) {
  const where = { day: { gte: w.fromDay, lte: w.toDay } };
  const months = monthsBetween(w.fromDay, w.toDay);
  const [dimD, pageD, refD, prodD, dimM, pageM, refM, prodM] = await Promise.all([
    prisma.analyticsDimDaily.findMany({ where }),
    prisma.analyticsPageDaily.findMany({ where }),
    prisma.analyticsReferralDaily.findMany({ where }),
    prisma.analyticsProductDaily.findMany({ where }),
    prisma.analyticsDimMonthly.findMany({ where: { yearMonth: { in: months } } }),
    prisma.analyticsPageMonthly.findMany({ where: { yearMonth: { in: months } } }),
    prisma.analyticsReferralMonthly.findMany({ where: { yearMonth: { in: months } } }),
    prisma.analyticsProductMonthly.findMany({ where: { yearMonth: { in: months } } }),
  ]);
  const dailyMonths = new Set([...dimD, ...pageD].map((r) => ym(r.day)));
  const keep = <T extends { yearMonth: string }>(rows: T[]) => rows.filter((r) => !dailyMonths.has(r.yearMonth));
  const bucketOf = (day: Date) => (w.monthly ? ym(day) : isoDay(day));

  const dims: Row[] = [
    ...dimD.map((r) => ({ bucket: bucketOf(r.day), weekday: r.day.getUTCDay(), dim: r.dim, key: r.key, count: r.count })),
    ...keep(dimM).map((r) => ({ bucket: r.yearMonth, weekday: null, dim: r.dim, key: r.key, count: r.count })),
  ];
  const pages = [
    ...pageD.map((r) => ({ bucket: bucketOf(r.day), path: r.path, count: r.count })),
    ...keep(pageM).map((r) => ({ bucket: r.yearMonth, path: r.path, count: r.count })),
  ];
  const refs = [
    ...refD.map((r) => ({ ...r, bucket: bucketOf(r.day) })),
    ...keep(refM).map((r) => ({ ...r, bucket: r.yearMonth })),
  ].map((r) => ({
    bucket: r.bucket,
    source: r.source,
    medium: r.medium,
    campaign: r.campaign,
    content: r.content,
    count: r.count,
  }));
  const products = [...prodD, ...keep(prodM)].map((r) => ({ productId: r.productId, count: r.count }));
  return { dims, pages, refs, products };
}

function sumBy<T>(rows: T[], key: (r: T) => string, value: (r: T) => number): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + value(r));
  return m;
}

function metric(dims: Row[], key: string) {
  return dims.filter((r) => r.dim === "m" && r.key === key).reduce((s, r) => s + r.count, 0);
}

function dimRows(dims: Row[], dim: string, order?: readonly string[]): CountRow[] {
  const m = sumBy(
    dims.filter((r) => r.dim === dim),
    (r) => r.key,
    (r) => r.count,
  );
  const rows = Array.from(m.entries()).map(([key, count]) => ({ key, count }));
  if (order) return order.map((key) => ({ key, count: m.get(key) ?? 0 }));
  return rows.sort((a, b) => b.count - a.count);
}

/** Landing rows keep no separate referrer: a source with a dot is a referring site, otherwise a utm_source. */
function channelRows(refs: { source: string; medium: string; campaign: string; count: number }[]): CountRow[] {
  const m = new Map<string, number>();
  for (const r of refs) {
    const source = r.source === "(direct)" ? "" : r.source;
    const referrer = source.includes(".") && !r.medium ? source : "";
    const ch = channelFor({ source: referrer ? "" : source, medium: r.medium, campaign: r.campaign, referrer });
    m.set(ch, (m.get(ch) ?? 0) + r.count);
  }
  return CHANNELS.map((key) => ({ key, count: m.get(key) ?? 0 }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);
}

async function paidOrders(w: Window) {
  const from = new Date(w.fromDay.getTime() - LAGOS_OFFSET_MS);
  const to = new Date(w.toDay.getTime() + DAY_MS - LAGOS_OFFSET_MS);
  return prisma.order.findMany({
    where: { paidAt: { gte: from, lt: to }, paymentStatus: PaymentStatus.PAID },
    select: { attribution: true, total: true, shippingAmount: true },
  });
}

type PaidOrder = Awaited<ReturnType<typeof paidOrders>>[number];

/** An order carries attribution only when it was placed during a counted (consented) visit. */
function fromCountedVisit(o: PaidOrder): boolean {
  return o.attribution != null && typeof o.attribution === "object";
}

function totalsOf(data: Awaited<ReturnType<typeof loadWindow>>, paid: PaidOrder[]): TrafficTotals {
  const orders = paid.length;
  const revenueNGN = paid.reduce((s, o) => s + Math.max(0, (o.total ?? 0) - (o.shippingAmount ?? 0)), 0);
  const countedOrders = paid.filter(fromCountedVisit).length;
  const { dims, pages, refs } = data;
  const pageviews = pages.reduce((s, r) => s + r.count, 0);
  const visitors = metric(dims, "visitors");
  // Visits are first landings, counted since slice AT. Engagement only since site traffic,
  // so bounce rate divides by the visits counted on those same days.
  const sessions = refs.reduce((s, r) => s + r.count, 0);
  const trackedSessions = metric(dims, "sessions");
  const engaged = Math.min(trackedSessions, metric(dims, "engaged"));
  const dwellN = metric(dims, "dwell_n");
  const returning = dims.filter((r) => r.dim === "visitor" && r.key === "returning").reduce((s, r) => s + r.count, 0);
  return {
    visitors,
    returningVisitors: returning,
    newVisitors: Math.max(0, visitors - returning),
    pageviews,
    sessions,
    engagedSessions: engaged,
    bounceRate: trackedSessions > 0 ? 1 - engaged / trackedSessions : null,
    pagesPerSession: sessions > 0 ? pageviews / sessions : 0,
    avgPageSeconds: dwellN > 0 ? metric(dims, "dwell_s") / dwellN : 0,
    orders,
    revenueNGN,
    countedOrders,
    conversion: sessions > 0 ? Math.min(1, countedOrders / sessions) : 0,
    bots: metric(dims, "bots"),
  };
}

function bucketLabel(bucket: string, monthly: boolean): string {
  const d = new Date(monthly ? `${bucket}-01T00:00:00Z` : `${bucket}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", monthly ? { month: "short", year: "2-digit", timeZone: "UTC" } : { day: "numeric", month: "short", timeZone: "UTC" }).format(d);
}

const EMPTY_WINDOW_DATA = { dims: [] as Row[], pages: [], refs: [], products: [] };

export async function buildTrafficReport(spec: TrafficRangeSpec, now = new Date()): Promise<TrafficReport> {
  const { cur, prev, label, firstDay } = await resolveWindows(spec, now);

  const liveFrom = new Date(Math.floor(now.getTime() / 60_000) * 60_000 - 29 * 60_000);
  const [data, prevData, orders, prevOrders, minutes, retentionDays, firstVisitorDay] = await Promise.all([
    loadWindow(cur),
    prev ? loadWindow(prev) : Promise.resolve(EMPTY_WINDOW_DATA),
    paidOrders(cur),
    prev ? paidOrders(prev) : Promise.resolve([] as PaidOrder[]),
    prisma.analyticsMinute.findMany({ where: { minute: { gte: liveFrom } } }),
    getRetentionDays(),
    prisma.analyticsDimDaily.findFirst({
      where: { dim: "m", key: "visitors" },
      orderBy: { day: "asc" },
      select: { day: true },
    }),
  ]);

  const sales = (o: { total: number | null; shippingAmount: number | null }) =>
    Math.max(0, (o.total ?? 0) - (o.shippingAmount ?? 0));
  const totals = totalsOf(data, orders);
  const prevTotals = totalsOf(prevData, prevOrders);

  // Over time
  const pvByBucket = sumBy(data.pages, (r) => r.bucket, (r) => r.count);
  const dimsByBucket = (dim: string, key: string) =>
    sumBy(
      data.dims.filter((r) => r.dim === dim && r.key === key),
      (r) => r.bucket,
      (r) => r.count,
    );
  const visitorsB = dimsByBucket("m", "visitors");
  const sessionsB = sumBy(data.refs, (r) => r.bucket, (r) => r.count);
  const returningB = dimsByBucket("visitor", "returning");
  const series = cur.buckets.map((b) => ({
    bucket: b,
    label: bucketLabel(b, cur.monthly),
    pageviews: pvByBucket.get(b) ?? 0,
    visitors: visitorsB.get(b) ?? 0,
    sessions: sessionsB.get(b) ?? 0,
    returning: returningB.get(b) ?? 0,
  }));

  // Right now
  const byMinute = new Map(minutes.map((m) => [m.minute.getTime(), m.count]));
  const live = Array.from({ length: 30 }, (_, i) => {
    const t = liveFrom.getTime() + i * 60_000;
    return { minutesAgo: 29 - i, count: byMinute.get(t) ?? 0 };
  });

  // Pages
  const pageTotals = sumBy(data.pages, (r) => r.path, (r) => r.count);
  const dwellS = sumBy(data.dims.filter((r) => r.dim === "dwell_s"), (r) => r.key, (r) => r.count);
  const dwellN = sumBy(data.dims.filter((r) => r.dim === "dwell_n"), (r) => r.key, (r) => r.count);
  const landings = sumBy(data.dims.filter((r) => r.dim === "landing"), (r) => r.key, (r) => r.count);
  const prevPages = sumBy(prevData.pages, (r) => r.path, (r) => r.count);
  const pages = Array.from(pageTotals.entries())
    .map(([path, views]) => ({
      path,
      views,
      prevViews: prevPages.get(path) ?? 0,
      entries: landings.get(path) ?? 0,
      avgSeconds: (dwellN.get(path) ?? 0) > 0 ? (dwellS.get(path) ?? 0) / dwellN.get(path)! : null,
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 25);

  // Where they came from
  const orderAttr = orders.map((o) => {
    const a = (o.attribution ?? {}) as { source?: string; medium?: string; campaign?: string; content?: string };
    return { source: a.source || "(direct)", medium: a.medium ?? "", campaign: a.campaign ?? "", content: a.content ?? "", sales: sales(o) };
  });
  const srcLandings = sumBy(data.refs, (r) => r.source || "(direct)", (r) => r.count);
  const srcOrders = sumBy(orderAttr, (r) => r.source, () => 1);
  const srcSales = sumBy(orderAttr, (r) => r.source, (r) => r.sales);
  const sources = Array.from(new Set([...Array.from(srcLandings.keys()), ...Array.from(srcOrders.keys())]))
    .map((source) => ({
      source,
      landings: srcLandings.get(source) ?? 0,
      orders: srcOrders.get(source) ?? 0,
      revenueNGN: srcSales.get(source) ?? 0,
    }))
    .sort((a, b) => b.landings - a.landings || b.orders - a.orders)
    .slice(0, 20);

  const campKey = (r: { source: string; medium: string; campaign: string; content: string }) =>
    [r.source || "(direct)", r.medium, r.campaign, r.content].join("|");
  const campRefs = data.refs.filter((r) => r.campaign);
  const campLandings = sumBy(campRefs, campKey, (r) => r.count);
  const campOrders = sumBy(orderAttr.filter((r) => r.campaign), campKey, () => 1);
  const campSales = sumBy(orderAttr.filter((r) => r.campaign), campKey, (r) => r.sales);
  const campaigns = Array.from(new Set([...Array.from(campLandings.keys()), ...Array.from(campOrders.keys())]))
    .map((k) => {
      const [source, medium, campaign, content] = k.split("|");
      return {
        label: attributionLabel({ source: source!, medium, campaign, content }),
        landings: campLandings.get(k) ?? 0,
        orders: campOrders.get(k) ?? 0,
        revenueNGN: campSales.get(k) ?? 0,
      };
    })
    .sort((a, b) => b.orders - a.orders || b.landings - a.landings)
    .slice(0, 15);

  // When — weekday × hour needs daily rows; whole rolled-up months have no weekday.
  const heat = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  for (const r of data.dims) {
    if (r.dim !== "hour" || r.weekday == null) continue;
    const h = Number(r.key);
    if (h >= 0 && h < 24) heat[r.weekday]![h]! += r.count;
  }

  // Products
  const viewMap = sumBy(data.products, (r) => r.productId, (r) => r.count);
  const topIds = Array.from(viewMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const [names, sold] = topIds.length
    ? await Promise.all([
        prisma.product.findMany({ where: { id: { in: topIds.map(([id]) => id) } }, select: { id: true, name: true, slug: true } }),
        prisma.orderItem.groupBy({
          by: ["productId"],
          where: {
            productId: { in: topIds.map(([id]) => id) },
            order: {
              paymentStatus: PaymentStatus.PAID,
              paidAt: {
                gte: new Date(cur.fromDay.getTime() - LAGOS_OFFSET_MS),
                lt: new Date(cur.toDay.getTime() + DAY_MS - LAGOS_OFFSET_MS),
              },
            },
          },
          _sum: { quantity: true },
        }),
      ])
    : [[], []];
  const nameById = new Map(names.map((p) => [p.id, p]));
  const soldById = new Map(sold.map((s) => [s.productId, s._sum.quantity ?? 0]));
  const products = topIds.map(([productId, views]) => ({
    productId,
    name: nameById.get(productId)?.name ?? "Removed piece",
    views,
    unitsSold: soldById.get(productId) ?? 0,
  }));

  const countries = dimRows(data.dims, "country");

  return {
    range: {
      id: spec.id,
      label,
      from: isoDay(cur.fromDay),
      to: isoDay(cur.toDay),
      prevFrom: prev ? isoDay(prev.fromDay) : null,
      prevTo: prev ? isoDay(prev.toDay) : null,
      monthly: cur.monthly,
      firstDay,
      today: isoDay(analyticsDayUtc(now)),
    },
    generatedAt: now.toISOString(),
    totals,
    prevTotals,
    series,
    live,
    countries,
    countryKnown: countries.some((c) => c.key !== "unknown" && c.count > 0),
    channels: channelRows(data.refs),
    sources,
    campaigns,
    pages,
    landings: Array.from(landings.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12),
    notFound: dimRows(data.dims, "404").slice(0, 15),
    devices: dimRows(data.dims, "device"),
    browsers: dimRows(data.dims, "browser"),
    os: dimRows(data.dims, "os"),
    screens: dimRows(data.dims, "screen", SCREEN_BUCKETS),
    gaps: dimRows(data.dims, "gap", GAP_BUCKETS),
    heat,
    products,
    retentionDays,
    visitorsSince: firstVisitorDay ? isoDay(firstVisitorDay.day) : null,
  };
}
