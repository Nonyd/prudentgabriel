import type { Prisma, PrismaClient, StockMovementReason } from "@prisma/client";
import { getSetting } from "@/lib/settings";
import { notifyLowStock } from "@/lib/notifications";
import { revalidateProduct } from "@/lib/revalidate";

export const FULFILMENT_STOCK_REFUSE_NOTE =
  "Fulfilment refused: stock was insufficient after payment. Refund the customer — do not ship.";

export class InsufficientVariantStockError extends Error {
  readonly variantId: string;
  readonly quantity: number;

  constructor(variantId: string, quantity: number) {
    super("INSUFFICIENT_VARIANT_STOCK");
    this.name = "InsufficientVariantStockError";
    this.variantId = variantId;
    this.quantity = quantity;
  }
}

export type StockTx = Prisma.TransactionClient | PrismaClient;

export type StockWriteResult = {
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  size: string;
  stock: number;
  lowStockAt: number;
  previousStock: number;
};

async function lockVariant(tx: StockTx, variantId: string): Promise<void> {
  // Real Prisma TransactionClient supports raw queries for row-level locking.
  // Some unit-test fixtures mock the transaction client with only the methods
  // they need, so we treat missing raw-query helpers as "no locking".
  const anyTx = tx as unknown as { $queryRaw?: unknown; $executeRaw?: unknown };
  if (typeof anyTx.$queryRaw === "function") {
    await (anyTx as { $queryRaw: typeof tx.$queryRaw }).$queryRaw`SELECT id FROM "ProductVariant" WHERE id = ${variantId} FOR UPDATE`;
    return;
  }
  if (typeof anyTx.$executeRaw === "function") {
    await (anyTx as { $executeRaw: typeof tx.$executeRaw }).$executeRaw`SELECT id FROM "ProductVariant" WHERE id = ${variantId} FOR UPDATE`;
    return;
  }
}

async function loadVariant(tx: StockTx, variantId: string) {
  const row = await tx.productVariant.findUnique({
    where: { id: variantId },
    select: {
      id: true,
      stock: true,
      size: true,
      lowStockAt: true,
      productId: true,
      product: { select: { id: true, name: true, slug: true } },
    },
  });
  if (!row) throw new Error(`Variant ${variantId} not found`);
  return row;
}

/**
 * Only writer allowed to set ProductVariant.stock and Product.inStock.
 */
export async function recomputeVariantStock(tx: StockTx, variantId: string): Promise<StockWriteResult> {
  const row = await loadVariant(tx, variantId);
  const agg = await tx.stockMovement.aggregate({
    where: { variantId },
    _sum: { delta: true },
  });
  const stock = agg._sum.delta ?? 0;
  await tx.productVariant.update({
    where: { id: variantId },
    data: { stock },
  });
  await syncProductInStock(tx, row.productId);
  return {
    variantId,
    productId: row.productId,
    productName: row.product.name,
    productSlug: row.product.slug,
    size: row.size,
    stock,
    lowStockAt: row.lowStockAt,
    previousStock: row.stock,
  };
}

export async function syncProductInStock(tx: StockTx, productId: string): Promise<void> {
  const inStock = await tx.productVariant.findFirst({
    where: { productId, stock: { gt: 0 } },
    select: { id: true },
  });
  await tx.product.update({
    where: { id: productId },
    data: { inStock: Boolean(inStock) },
  });
}

async function ensureOpeningIfBare(tx: StockTx, variantId: string, cachedStock: number): Promise<void> {
  const existing = await tx.stockMovement.count({ where: { variantId } });
  if (existing > 0) return;
  if (cachedStock === 0) return;
  await tx.stockMovement.create({
    data: {
      variantId,
      delta: cachedStock,
      reason: "OPENING",
      note: "Opening balance inferred from cached stock before first ledger row",
    },
  });
}

async function appendAndRecompute(
  tx: StockTx,
  input: {
    variantId: string;
    delta: number;
    reason: StockMovementReason;
    orderId?: string | null;
    actorId?: string | null;
    note?: string | null;
  },
): Promise<StockWriteResult> {
  await lockVariant(tx, input.variantId);
  const row = await loadVariant(tx, input.variantId);
  await ensureOpeningIfBare(tx, input.variantId, row.stock);
  await tx.stockMovement.create({
    data: {
      variantId: input.variantId,
      delta: input.delta,
      reason: input.reason,
      orderId: input.orderId ?? null,
      actorId: input.actorId ?? null,
      note: input.note ?? null,
    },
  });
  return recomputeVariantStock(tx, input.variantId);
}

export async function applySale(
  tx: StockTx,
  params: { variantId: string; quantity: number; orderId: string },
): Promise<StockWriteResult> {
  if (params.quantity < 1) throw new Error("SALE quantity must be positive");
  await lockVariant(tx, params.variantId);
  const row = await loadVariant(tx, params.variantId);
  await ensureOpeningIfBare(tx, params.variantId, row.stock);
  const available =
    (
      await tx.stockMovement.aggregate({
        where: { variantId: params.variantId },
        _sum: { delta: true },
      })
    )._sum.delta ?? 0;
  if (available < params.quantity) {
    throw new InsufficientVariantStockError(params.variantId, params.quantity);
  }
  await tx.stockMovement.create({
    data: {
      variantId: params.variantId,
      delta: -params.quantity,
      reason: "SALE",
      orderId: params.orderId,
    },
  });
  return recomputeVariantStock(tx, params.variantId);
}

export async function applyCountCorrection(
  tx: StockTx,
  params: { variantId: string; newStock: number; actorId: string },
): Promise<StockWriteResult | null> {
  if (params.newStock < 0) throw new Error("stock cannot be negative");
  await lockVariant(tx, params.variantId);
  const row = await loadVariant(tx, params.variantId);
  await ensureOpeningIfBare(tx, params.variantId, row.stock);
  const current = (await tx.stockMovement.aggregate({
    where: { variantId: params.variantId },
    _sum: { delta: true },
  }))._sum.delta ?? 0;
  const delta = params.newStock - current;
  if (delta === 0) return null;
  await tx.stockMovement.create({
    data: {
      variantId: params.variantId,
      delta,
      reason: "COUNT_CORRECTION",
      actorId: params.actorId,
      note: `was ${current}, now ${params.newStock}`,
    },
  });
  return recomputeVariantStock(tx, params.variantId);
}

export async function applyOpening(
  tx: StockTx,
  params: { variantId: string; stock: number },
): Promise<StockWriteResult | null> {
  if (params.stock < 0) throw new Error("stock cannot be negative");
  const existing = await tx.stockMovement.count({ where: { variantId: params.variantId } });
  if (existing > 0) {
    throw new Error(`Variant ${params.variantId} already has stock movements`);
  }
  if (params.stock === 0) {
    await syncProductInStock(tx, (await loadVariant(tx, params.variantId)).productId);
    return null;
  }
  await tx.stockMovement.create({
    data: {
      variantId: params.variantId,
      delta: params.stock,
      reason: "OPENING",
    },
  });
  return recomputeVariantStock(tx, params.variantId);
}

export async function applyReturn(
  tx: StockTx,
  params: {
    variantId: string;
    quantity: number;
    reason: "CANCEL_RETURN" | "REFUND_RETURN";
    orderId: string;
    actorId?: string | null;
    note?: string | null;
  },
): Promise<StockWriteResult> {
  if (params.quantity < 1) throw new Error("return quantity must be positive");
  return appendAndRecompute(tx, {
    variantId: params.variantId,
    delta: params.quantity,
    reason: params.reason,
    orderId: params.orderId,
    actorId: params.actorId,
    note: params.note,
  });
}

export function isOversellRefuse(adminNotes: string | null | undefined): boolean {
  return Boolean(adminNotes?.includes(FULFILMENT_STOCK_REFUSE_NOTE));
}

export async function restockOrderLines(
  tx: StockTx,
  params: {
    orderId: string;
    adminNotes: string | null | undefined;
    paymentStatus: string;
    items: { variantId: string | null; quantity: number; sizeMode: string | null }[];
    reason: "CANCEL_RETURN" | "REFUND_RETURN";
    actorId?: string | null;
    note: string;
    shouldDecrementStock: (sizeMode: string | null | undefined) => boolean;
  },
): Promise<StockWriteResult[]> {
  if (isOversellRefuse(params.adminNotes)) return [];
  if (params.paymentStatus !== "PAID") return [];
  const out: StockWriteResult[] = [];
  for (const item of params.items) {
    if (!item.variantId) continue;
    if (!params.shouldDecrementStock(item.sizeMode)) continue;
    out.push(
      await applyReturn(tx, {
        variantId: item.variantId,
        quantity: item.quantity,
        reason: params.reason,
        orderId: params.orderId,
        actorId: params.actorId,
        note: params.note,
      }),
    );
  }
  return out;
}

export async function maybeNotifyLowStock(result: StockWriteResult): Promise<void> {
  if (result.stock > result.lowStockAt) return;
  const flag = await getSetting("notify_low_stock");
  if (flag !== null && flag !== "true") return;
  notifyLowStock(
    { name: result.productName },
    { id: result.variantId, size: result.size, stock: result.stock },
  );
}

export async function afterStockWrites(results: StockWriteResult[]): Promise<void> {
  const slugs = new Set(results.map((r) => r.productSlug));
  await Promise.all(
    Array.from(slugs).map((slug) => revalidateProduct(slug).catch(() => undefined)),
  );
  for (const r of results) {
    await maybeNotifyLowStock(r);
  }
}

export async function collectionVariantIds(tx: StockTx, collectionId: string): Promise<Set<string>> {
  const collection = await tx.collection.findUnique({
    where: { id: collectionId },
    select: { id: true, autoTag: true },
  });
  if (!collection) return new Set();

  const manuals = await tx.collectionProduct.findMany({
    where: { collectionId },
    select: { productId: true },
  });
  const productIds = new Set(manuals.map((m) => m.productId));
  const tag = collection.autoTag?.trim();
  if (tag) {
    const auto = await tx.product.findMany({
      where: { tags: { has: tag } },
      select: { id: true },
    });
    for (const p of auto) productIds.add(p.id);
  }
  if (productIds.size === 0) return new Set();
  const variants = await tx.productVariant.findMany({
    where: { productId: { in: Array.from(productIds) } },
    select: { id: true },
  });
  return new Set(variants.map((v) => v.id));
}

export type StockReconcileRow = {
  variantId: string;
  cached: number;
  summed: number;
};

export async function reconcileVariantStock(db: StockTx): Promise<{
  ok: boolean;
  rows: StockReconcileRow[];
  mismatches: StockReconcileRow[];
}> {
  const variants = await db.productVariant.findMany({
    select: { id: true, stock: true },
  });
  const sums = await db.stockMovement.groupBy({
    by: ["variantId"],
    _sum: { delta: true },
  });
  const sumById = new Map(sums.map((s) => [s.variantId, s._sum.delta ?? 0]));
  const rows: StockReconcileRow[] = variants.map((v) => ({
    variantId: v.id,
    cached: v.stock,
    summed: sumById.get(v.id) ?? 0,
  }));
  const mismatches = rows.filter((r) => r.cached !== r.summed);
  return { ok: mismatches.length === 0, rows, mismatches };
}

export async function ensureAllOpeningMovements(db: PrismaClient): Promise<number> {
  const variants = await db.productVariant.findMany({
    select: { id: true, stock: true },
  });
  const existing = await db.stockMovement.findMany({
    select: { variantId: true },
    distinct: ["variantId"],
  });
  const has = new Set(existing.map((e) => e.variantId));
  let created = 0;
  for (const v of variants) {
    if (has.has(v.id)) continue;
    if (v.stock === 0) continue;
    await db.stockMovement.create({
      data: { variantId: v.id, delta: v.stock, reason: "OPENING" },
    });
    created += 1;
  }
  return created;
}
