import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { analyticsDayUtc } from "@/lib/analytics/record";
import { RTW_EXCLUDED_CATEGORIES } from "@/lib/rtw-aisle";
import { optimizeImageUrl } from "@/lib/utils";

/**
 * Storefront "recent activity" toasts. Every line is real: a paid order, today's
 * product-page opens, or this week's most-opened pieces. Ready-to-wear only.
 * Buyers show as first name + city at most — never a surname, email or phone.
 */

export type RecentActivityProduct = { name: string; slug: string; image: string | null };

export type RecentActivityItem =
  | { kind: "purchase"; id: string; who: string; where: string | null; at: string; product: RecentActivityProduct }
  | { kind: "views"; id: string; count: number; product: RecentActivityProduct }
  | { kind: "popular"; id: string; product: RecentActivityProduct };

const PURCHASE_WINDOW_DAYS = 14;
const MAX_PURCHASES = 12;
/** Below this, "viewed N times today" reads as quiet, not busy. */
const MIN_VIEWS_TODAY = 5;
const POPULAR_COUNT = 3;

const DEAD_STATUSES = ["PENDING", "CANCELLED", "REFUNDED", "ABANDONED"] as const;

const rtwWhere = {
  isPublished: true,
  type: "RTW" as const,
  category: { notIn: [...RTW_EXCLUDED_CATEGORIES] },
};

const productSelect = {
  id: true,
  name: true,
  slug: true,
  images: { orderBy: [{ isPrimary: "desc" as const }, { sortOrder: "asc" as const }], take: 1, select: { url: true } },
};

function toProduct(p: { name: string; slug: string; images: { url: string }[] }): RecentActivityProduct {
  const url = p.images[0]?.url?.trim();
  return { name: p.name, slug: p.slug, image: url ? optimizeImageUrl(url, 160) : null };
}

function firstWord(s: string | null | undefined): string | null {
  const w = s?.trim().split(/\s+/)[0];
  if (!w || /^(guest|customer|client|test)$/i.test(w)) return null;
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

async function loadRecentActivity(): Promise<RecentActivityItem[]> {
  if (process.env.SKIP_DB_BUILD === "1") return [];
  const now = new Date();
  const since = new Date(now.getTime() - PURCHASE_WINDOW_DAYS * 86_400_000);
  const today = analyticsDayUtc(now);
  const weekAgo = new Date(today.getTime() - 6 * 86_400_000);

  const [orders, viewsToday, viewsWeek] = await Promise.all([
    prisma.order.findMany({
      where: {
        paidAt: { gte: since },
        isBespoke: false,
        status: { notIn: [...DEAD_STATUSES] },
        items: { some: { product: rtwWhere } },
      },
      orderBy: { paidAt: "desc" },
      take: MAX_PURCHASES,
      select: {
        id: true,
        paidAt: true,
        guestName: true,
        addressSnapshot: true,
        user: { select: { name: true } },
        items: { where: { product: rtwWhere }, take: 1, select: { product: { select: productSelect } } },
      },
    }),
    prisma.analyticsProductDaily.findMany({
      where: { day: today, count: { gte: MIN_VIEWS_TODAY } },
      orderBy: { count: "desc" },
      take: 10,
    }),
    prisma.analyticsProductDaily.groupBy({
      by: ["productId"],
      where: { day: { gte: weekAgo, lte: today } },
      _sum: { count: true },
      orderBy: { _sum: { count: "desc" } },
      take: 20,
    }),
  ]);

  const items: RecentActivityItem[] = [];

  for (const o of orders) {
    const product = o.items[0]?.product;
    if (!product || !o.paidAt) continue;
    const snap = (o.addressSnapshot ?? null) as { firstName?: string; city?: string; country?: string } | null;
    const who = firstWord(snap?.firstName) ?? firstWord(o.user?.name) ?? firstWord(o.guestName) ?? "Someone";
    const where = snap?.city?.trim() || snap?.country?.trim() || null;
    items.push({ kind: "purchase", id: `p-${o.id}`, who, where, at: o.paidAt.toISOString(), product: toProduct(product) });
  }

  const viewIds = [...viewsToday.map((v) => v.productId), ...viewsWeek.map((v) => v.productId)];
  if (viewIds.length) {
    const products = await prisma.product.findMany({
      where: { id: { in: Array.from(new Set(viewIds)) }, ...rtwWhere },
      select: productSelect,
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    for (const v of viewsToday) {
      const p = byId.get(v.productId);
      if (p) items.push({ kind: "views", id: `v-${p.id}`, count: v.count, product: toProduct(p) });
    }
    let popular = 0;
    for (const v of viewsWeek) {
      if (popular >= POPULAR_COUNT) break;
      const p = byId.get(v.productId);
      if (!p) continue;
      items.push({ kind: "popular", id: `w-${p.id}`, product: toProduct(p) });
      popular++;
    }
  }

  return items;
}

export const getRecentActivity = unstable_cache(loadRecentActivity, ["recent-activity-rtw"], { revalidate: 300 });
