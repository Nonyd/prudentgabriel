import { PaymentStatus, SizeMode, StockMovementReason } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isCustomLine } from "@/lib/custom-size";
import {
  classifyPayments,
  money,
  type ClassifiedLine,
  type FinancePaymentSnap,
} from "@/lib/finance/classify";
import { linesInRange, loadFinanceSnaps } from "@/lib/finance/query";
import { compareSelling, type NotSellingPiece, type SellingCollection, type SellingPiece, type SellingSizeRow, type WhatsSellingReport } from "@/lib/finance/whats-selling-view";

export {
  COLLECTION_DOUBLE_COUNT_COPY,
  compareSelling,
  NO_COLLECTION_ASSIGNMENTS_COPY,
  NO_SALES_COPY,
  SELL_THROUGH_COPY,
  sortValue,
  whatsSellingCsv,
  type NotSellingPiece,
  type SellingCollection,
  type SellingPiece,
  type SellingSizeRow,
  type SellingSort,
  type WhatsSellingReport,
} from "@/lib/finance/whats-selling-view";

export function isOversellOrder(order: { status: string; paymentStatus: string } | null | undefined): boolean {
  if (!order) return false;
  return order.paymentStatus === PaymentStatus.PAID && order.status === "CANCELLED";
}

/** Cash taken for the garment. Points count as units elsewhere, not here. */
export function cashRevenueNGN(line: ClassifiedLine): number {
  return money(Math.max(0, line.salesNGN - line.pointsNGN));
}

export function lineCountsAsUnitSale(line: ClassifiedLine): boolean {
  if (line.businessLine !== "RTW" || line.resolution !== "rtw") return false;
  if (line.liabilityNGN > 0) return false;
  return line.salesNGN > 0 || line.pointsNGN > 0;
}

export function sellThroughRatio(unitsSold: number, stockedAtStart: number): number | null {
  if (stockedAtStart <= 0) return null;
  return unitsSold / stockedAtStart;
}

export type OrderItemSnap = {
  orderId: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  size: string | null;
  sizeMode: string | null;
  lineTotal: number;
};

export type ReturnSnap = {
  orderId: string;
  variantId: string;
  quantity: number;
  at: Date;
};

export type VariantSnap = {
  id: string;
  productId: string;
  size: string;
  stock: number;
  laterNet: number;
};

export type ProductSnap = {
  id: string;
  name: string;
  slug: string;
  thumbnailUrl: string | null;
  isPublished: boolean;
};

export type CollectionSnap = {
  id: string;
  name: string;
  slug: string;
  productIds: string[];
};

function stockedAtStart(v: VariantSnap): number {
  return v.stock - v.laterNet;
}

export function qualifyingOrderIds(
  snaps: FinancePaymentSnap[],
  lines: ClassifiedLine[],
): Set<string> {
  const byId = new Map(snaps.map((s) => [s.id, s]));
  const ids = new Set<string>();
  for (const line of lines) {
    if (!lineCountsAsUnitSale(line)) continue;
    const snap = byId.get(line.id);
    if (!snap?.orderId || !snap.order) continue;
    if (isOversellOrder(snap.order)) continue;
    ids.add(snap.orderId);
  }
  return ids;
}

function revenueByOrder(
  snaps: FinancePaymentSnap[],
  lines: ClassifiedLine[],
  orderIds: Set<string>,
): Map<string, number> {
  const byId = new Map(snaps.map((s) => [s.id, s]));
  const map = new Map<string, number>();
  for (const line of lines) {
    const snap = byId.get(line.id);
    const oid = snap?.orderId;
    if (!oid || !orderIds.has(oid)) continue;
    if (isOversellOrder(snap.order)) continue;
    map.set(oid, money((map.get(oid) ?? 0) + cashRevenueNGN(line)));
  }
  return map;
}

function netReturnedQty(
  returns: ReturnSnap[],
  orderId: string,
  variantId: string | null,
  from: Date,
  to: Date,
): number {
  if (!variantId) return 0;
  let n = 0;
  for (const r of returns) {
    if (r.orderId !== orderId || r.variantId !== variantId) continue;
    if (r.at < from || r.at >= to) continue;
    n += r.quantity;
  }
  return n;
}

export function aggregatePeriod(input: {
  from: Date;
  to: Date;
  snaps: FinancePaymentSnap[];
  lines: ClassifiedLine[];
  items: OrderItemSnap[];
  returns: ReturnSnap[];
  variants: VariantSnap[];
  products: ProductSnap[];
  collections: CollectionSnap[];
}): {
  pieces: Omit<SellingPiece, "unitsPrev" | "revenuePrev" | "sellThroughPrev">[];
  collections: Omit<SellingCollection, "unitsPrev" | "revenuePrev" | "sellThroughPrev">[];
  collectionsAssigned: boolean;
  notSelling: NotSellingPiece[];
} {
  const orderIds = qualifyingOrderIds(input.snaps, input.lines);
  const orderRevenue = revenueByOrder(input.snaps, input.lines, orderIds);
  const variantsById = new Map(input.variants.map((v) => [v.id, v]));
  const productsById = new Map(input.products.map((p) => [p.id, p]));

  type Acc = {
    unitsSold: number;
    revenueNGN: number;
    orderedToMeasure: number;
    sizeSold: Map<string, number>;
  };
  const acc = new Map<string, Acc>();
  const ensure = (productId: string): Acc => {
    let row = acc.get(productId);
    if (!row) {
      row = { unitsSold: 0, revenueNGN: 0, orderedToMeasure: 0, sizeSold: new Map() };
      acc.set(productId, row);
    }
    return row;
  };

  const itemsByOrder = new Map<string, OrderItemSnap[]>();
  for (const item of input.items) {
    if (!orderIds.has(item.orderId)) continue;
    const list = itemsByOrder.get(item.orderId) ?? [];
    list.push(item);
    itemsByOrder.set(item.orderId, list);
  }

  itemsByOrder.forEach((items, orderId) => {
    const garmentTotal = items.reduce((s, it) => s + it.lineTotal, 0);
    const cash = orderRevenue.get(orderId) ?? 0;
    for (const item of items) {
      const custom = isCustomLine(item.sizeMode ?? SizeMode.STANDARD);
      const returned = custom
        ? 0
        : Math.min(item.quantity, netReturnedQty(input.returns, orderId, item.variantId, input.from, input.to));
      const remaining = Math.max(0, item.quantity - returned);
      const share = garmentTotal > 0 ? item.lineTotal / garmentTotal : 0;
      const itemCash = money(cash * share * (item.quantity === 0 ? 0 : remaining / item.quantity));
      const row = ensure(item.productId);
      row.revenueNGN = money(row.revenueNGN + itemCash);
      if (custom) {
        row.orderedToMeasure += remaining;
      } else {
        row.unitsSold += remaining;
        const size = item.size || variantsById.get(item.variantId ?? "")?.size || "?";
        row.sizeSold.set(size, (row.sizeSold.get(size) ?? 0) + remaining);
      }
    }
  });

  const stockStartByProduct = new Map<string, number>();
  const sizesHeld = new Map<string, Map<string, number>>();
  for (const v of input.variants) {
    stockStartByProduct.set(v.productId, (stockStartByProduct.get(v.productId) ?? 0) + Math.max(0, stockedAtStart(v)));
    const held = sizesHeld.get(v.productId) ?? new Map();
    held.set(v.size, (held.get(v.size) ?? 0) + v.stock);
    sizesHeld.set(v.productId, held);
  }

  const pieces = Array.from(acc.entries())
    .map(([productId, row]) => {
      const product = productsById.get(productId);
      const stocked = stockStartByProduct.get(productId) ?? 0;
      const held = sizesHeld.get(productId) ?? new Map();
      const sizeKeys = new Set(Array.from(row.sizeSold.keys()).concat(Array.from(held.keys())));
      const sizes: SellingSizeRow[] = Array.from(sizeKeys)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .map((size) => ({
          size,
          sold: row.sizeSold.get(size) ?? 0,
          stockHeld: held.get(size) ?? 0,
        }));
      return {
        productId,
        slug: product?.slug ?? productId,
        name: product?.name ?? "Unknown piece",
        thumbnailUrl: product?.thumbnailUrl ?? null,
        unitsSold: row.unitsSold,
        revenueNGN: row.revenueNGN,
        orderedToMeasure: row.orderedToMeasure,
        stockedAtStart: stocked,
        sellThrough: sellThroughRatio(row.unitsSold, stocked),
        sizes,
      };
    })
    .filter((p) => p.unitsSold > 0 || p.orderedToMeasure > 0 || p.revenueNGN > 0);

  const soldIds = new Set(pieces.map((p) => p.productId));
  const notSelling: NotSellingPiece[] = input.products
    .filter((p) => p.isPublished)
    .map((p) => {
      const heldMap = sizesHeld.get(p.id);
      const held = heldMap ? Array.from(heldMap.values()).reduce((s, n) => s + n, 0) : 0;
      return { product: p, stockHeld: held };
    })
    .filter(({ product, stockHeld }) => stockHeld > 0 && !soldIds.has(product.id))
    .map(({ product, stockHeld }) => ({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      thumbnailUrl: product.thumbnailUrl,
      stockHeld,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const collectionsAssigned = input.collections.some((c) => c.productIds.length > 0);
  const pieceById = new Map(pieces.map((p) => [p.productId, p]));
  const collections = input.collections
    .filter((c) => c.productIds.length > 0)
    .map((c) => {
      let unitsSold = 0;
      let revenueNGN = 0;
      let orderedToMeasure = 0;
      let stockedAtStartTotal = 0;
      for (const pid of c.productIds) {
        const piece = pieceById.get(pid);
        if (piece) {
          unitsSold += piece.unitsSold;
          revenueNGN = money(revenueNGN + piece.revenueNGN);
          orderedToMeasure += piece.orderedToMeasure;
        }
        stockedAtStartTotal += stockStartByProduct.get(pid) ?? 0;
      }
      return {
        collectionId: c.id,
        name: c.name,
        slug: c.slug,
        unitsSold,
        revenueNGN,
        orderedToMeasure,
        stockedAtStart: stockedAtStartTotal,
        sellThrough: sellThroughRatio(unitsSold, stockedAtStartTotal),
      };
    })
    .filter((c) => c.unitsSold > 0 || c.orderedToMeasure > 0 || c.revenueNGN > 0);

  return { pieces, collections, collectionsAssigned, notSelling };
}

function withPrev<T extends { unitsSold: number; revenueNGN: number; sellThrough: number | null }>(
  current: T[],
  previous: T[],
  key: (row: T) => string,
): Array<T & { unitsPrev: number; revenuePrev: number; sellThroughPrev: number | null }> {
  const prevMap = new Map(previous.map((row) => [key(row), row]));
  return current.map((row) => {
    const prev = prevMap.get(key(row));
    return {
      ...row,
      unitsPrev: prev?.unitsSold ?? 0,
      revenuePrev: prev?.revenueNGN ?? 0,
      sellThroughPrev: prev?.sellThrough ?? null,
    };
  });
}

async function loadCatalogSnaps(from: Date): Promise<{
  items: OrderItemSnap[];
  returns: ReturnSnap[];
  variants: VariantSnap[];
  products: ProductSnap[];
  collections: CollectionSnap[];
}> {
  const [products, variants, collections, movementsAfter] = await Promise.all([
    prisma.product.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        isPublished: true,
        images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1, select: { url: true } },
      },
    }),
    prisma.productVariant.findMany({
      select: { id: true, productId: true, size: true, stock: true },
    }),
    prisma.collection.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        products: { select: { productId: true } },
      },
    }),
    prisma.stockMovement.findMany({
      where: { createdAt: { gte: from } },
      select: { variantId: true, delta: true },
    }),
  ]);

  const laterNet = new Map<string, number>();
  for (const m of movementsAfter) {
    laterNet.set(m.variantId, (laterNet.get(m.variantId) ?? 0) + m.delta);
  }

  const variantSnaps: VariantSnap[] = variants.map((v) => ({
    id: v.id,
    productId: v.productId,
    size: v.size,
    stock: v.stock,
    laterNet: laterNet.get(v.id) ?? 0,
  }));

  return {
    items: [],
    returns: [],
    variants: variantSnaps,
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      thumbnailUrl: p.images[0]?.url ?? null,
      isPublished: p.isPublished,
    })),
    collections: collections.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      productIds: c.products.map((cp) => cp.productId),
    })),
  };
}

async function loadItemsAndReturns(orderIds: string[], from: Date, to: Date): Promise<{
  items: OrderItemSnap[];
  returns: ReturnSnap[];
}> {
  if (orderIds.length === 0) return { items: [], returns: [] };
  const [items, returns] = await Promise.all([
    prisma.orderItem.findMany({
      where: { orderId: { in: orderIds } },
      select: {
        orderId: true,
        productId: true,
        variantId: true,
        quantity: true,
        size: true,
        sizeMode: true,
        lineTotal: true,
      },
    }),
    prisma.stockMovement.findMany({
      where: {
        orderId: { in: orderIds },
        reason: { in: [StockMovementReason.CANCEL_RETURN, StockMovementReason.REFUND_RETURN] },
        createdAt: { gte: from, lt: to },
      },
      select: { orderId: true, variantId: true, delta: true, createdAt: true },
    }),
  ]);
  return {
    items: items.map((it) => ({
      orderId: it.orderId,
      productId: it.productId,
      variantId: it.variantId,
      quantity: it.quantity,
      size: it.size,
      sizeMode: it.sizeMode,
      lineTotal: it.lineTotal,
    })),
    returns: returns
      .filter((r): r is typeof r & { orderId: string } => Boolean(r.orderId))
      .map((r) => ({
        orderId: r.orderId,
        variantId: r.variantId,
        quantity: r.delta,
        at: r.createdAt,
      })),
  };
}

async function periodBundle(from: Date, to: Date) {
  const snaps = await loadFinanceSnaps(from, to);
  const lines = linesInRange(classifyPayments(snaps), from, to);
  const catalog = await loadCatalogSnaps(from);
  const orderIds = Array.from(qualifyingOrderIds(snaps, lines));
  const { items, returns } = await loadItemsAndReturns(orderIds, from, to);
  return aggregatePeriod({
    from,
    to,
    snaps,
    lines,
    items,
    returns,
    variants: catalog.variants,
    products: catalog.products,
    collections: catalog.collections,
  });
}

export async function buildWhatsSelling(from: Date, to: Date, prevFrom?: Date, prevTo?: Date): Promise<WhatsSellingReport> {
  const current = await periodBundle(from, to);
  const previous =
    prevFrom && prevTo && prevTo.getTime() > 0 ? await periodBundle(prevFrom, prevTo) : null;

  return {
    collectionsAssigned: current.collectionsAssigned,
    notSelling: current.notSelling,
    pieces: withPrev(current.pieces, previous?.pieces ?? [], (p) => p.productId).sort((a, b) =>
      compareSelling("sellThrough", a, b),
    ),
    collections: withPrev(current.collections, previous?.collections ?? [], (c) => c.collectionId).sort((a, b) =>
      compareSelling("sellThrough", a, b),
    ),
  };
}

async function allTimeBundle() {
  return periodBundle(new Date(0), new Date());
}

/** All-time units sold (stock + made-to-measure), for the storefront Best sellers row. */
export async function rankedProductIdsByUnitsSold(): Promise<string[]> {
  const bundle = await allTimeBundle();
  return bundle.pieces
    .slice()
    .sort((a, b) => b.unitsSold + b.orderedToMeasure - (a.unitsSold + a.orderedToMeasure) || b.revenueNGN - a.revenueNGN || a.name.localeCompare(b.name))
    .map((p) => p.productId);
}

export async function unitsSoldByProductId(): Promise<Map<string, number>> {
  const bundle = await allTimeBundle();
  const map = new Map<string, number>();
  for (const p of bundle.pieces) {
    map.set(p.productId, p.unitsSold + p.orderedToMeasure);
  }
  return map;
}

