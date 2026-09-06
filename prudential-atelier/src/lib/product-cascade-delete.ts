/**
 * Slice AC — cascade product delete.
 *
 * AC3 dependency list (every row that would otherwise orphan a Product):
 *
 * Direct, Restrict (must delete before Product):
 *   OrderItem, CartItem, WishlistItem, Review
 *
 * Direct, Cascade (Product delete covers these; listed so none are forgotten):
 *   ProductImage, ProductVariant, ProductColor, ProductMeasurement,
 *   CollectionProduct, CollectionReel (SetNull on product), BundleItem (source and target)
 *
 * Via ProductVariant (Cascade from variant, except OrderItem which is Restrict):
 *   StockMovement (append-only trigger — same app.ledger_bypass as Payment)
 *   StockAlert, CartItem.variantId
 *
 * Via Order (an order that contains any of the products is removed whole):
 *   OrderItem (Cascade from Order)
 *   CouponUsage (Cascade from Order)
 *   Payment (RESTRICT + append-only trigger — delete with bypass before Order)
 *   StockMovement.orderId (SetNull on Order delete; rows then go with the variant)
 *
 * Loose pointers (no FK, still point at the gone product/order):
 *   PointsTransaction.orderId
 *   CheckoutSession.orderId and cartSnapshot.lines[].productId
 *   Review.orderId
 *
 * After commit, not in the transaction:
 *   ProductImage.url, ProductColor.imageUrl (store files)
 *
 * Not touched: PackagingProfile (SetNull), ErrorLog.orderId, Payment.receiptUrl files.
 */

import { ActivityAction, PaymentMethod, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CONSULTATION_CASCADE_RECORD_TYPE } from "@/lib/consultation-cascade-copy";
import {
  cascadeDialogCopy,
  formatReceivedNGN,
  MAX_PRODUCT_CASCADE,
  PRODUCT_CASCADE_CONFIRMATION,
  PRODUCT_CASCADE_MODULE,
  PRODUCT_CASCADE_RECORD_TYPE,
  type CascadeOrderSnap,
  type CascadePaymentSnap,
  type CascadeProductSnap,
  type CascadeSiblingPiece,
  type ProductCascadePreview,
  type ProductCascadeSnapshot,
} from "@/lib/product-cascade-copy";

export {
  cascadeDialogCopy,
  formatReceivedNGN,
  MAX_PRODUCT_CASCADE,
  PRODUCT_CASCADE_CONFIRMATION,
  PRODUCT_CASCADE_MODULE,
  PRODUCT_CASCADE_RECORD_TYPE,
};
export type {
  CascadeOrderSnap,
  CascadePaymentSnap,
  CascadeProductSnap,
  ProductCascadePreview,
  ProductCascadeSnapshot,
};

export const PRODUCT_CASCADE_DEPENDENCIES = [
  "Payment",
  "PointsTransaction",
  "CheckoutSession",
  "Review",
  "CartItem",
  "WishlistItem",
  "Order (and OrderItem, CouponUsage)",
  "StockMovement",
  "StockAlert",
  "ProductImage",
  "ProductColor",
  "ProductMeasurement",
  "CollectionProduct",
  "CollectionReel",
  "BundleItem",
  "ProductVariant",
  "Product",
] as const;

export type ProductCascadeErrorCode = "FORBIDDEN" | "CONFIRM" | "NOT_FOUND" | "EMPTY" | "TOO_MANY" | "FAILED" | "BLOCKED";

export class ProductCascadeError extends Error {
  constructor(
    public readonly code: ProductCascadeErrorCode,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ProductCascadeError";
  }
}

export type CascadeActor = {
  userId: string;
  email: string | null;
  role: string;
  ip: string | null;
};

export type ProductCascadePlan = ProductCascadePreview & {
  productIds: string[];
  orderIds: string[];
  slugs: string[];
};

function money(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

function customerEmail(order: {
  guestEmail: string | null;
  user: { email: string } | null;
}): string | null {
  const email = order.user?.email ?? order.guestEmail;
  return email ? email.trim().toLowerCase() : null;
}

function isConfirmedMoney(status: PaymentStatus): boolean {
  return status === PaymentStatus.CONFIRMED || status === PaymentStatus.PAID;
}

function cashReceived(payments: { amount: Prisma.Decimal | number; status: PaymentStatus; method: PaymentMethod }[]): number {
  return money(
    payments
      .filter((p) => isConfirmedMoney(p.status) && p.method !== PaymentMethod.POINTS)
      .reduce((s, p) => s + Number(p.amount), 0),
  );
}

async function loadSiblingPieces(orderIds: string[], deletingIds: string[]): Promise<CascadeSiblingPiece[]> {
  if (orderIds.length === 0) return [];
  const items = await prisma.orderItem.findMany({
    where: { orderId: { in: orderIds }, productId: { notIn: deletingIds } },
    select: { productId: true, product: { select: { name: true } } },
  });
  const map = new Map<string, string>();
  for (const it of items) {
    if (!map.has(it.productId)) map.set(it.productId, it.product.name);
  }
  return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
}

export async function previewProductCascade(productIds: string[]): Promise<ProductCascadePreview> {
  return loadPlan(productIds);
}

export async function loadPlan(productIds: string[]): Promise<ProductCascadePlan> {
  const unique = Array.from(new Set(productIds.map((id) => id.trim()).filter(Boolean)));
  if (unique.length === 0) {
    throw new ProductCascadeError("EMPTY", "Select at least one product", 400);
  }
  if (unique.length > MAX_PRODUCT_CASCADE) {
    throw new ProductCascadeError("TOO_MANY", `Maximum ${MAX_PRODUCT_CASCADE} products per request`, 400);
  }

  const products = await prisma.product.findMany({
    where: { id: { in: unique } },
    select: {
      id: true,
      name: true,
      slug: true,
      images: { select: { url: true } },
      colors: { select: { imageUrl: true } },
      variants: { select: { sku: true } },
    },
  });
  if (products.length === 0) {
    throw new ProductCascadeError("NOT_FOUND", "Product not found", 404);
  }

  const foundIds = products.map((p) => p.id);
  const orderItems = await prisma.orderItem.findMany({
    where: { productId: { in: foundIds } },
    select: { productId: true, orderId: true },
  });
  const orderIds = Array.from(new Set(orderItems.map((i) => i.orderId)));
  const productsWithOrders = new Set(orderItems.map((i) => i.productId)).size;

  const orders =
    orderIds.length === 0
      ? []
      : await prisma.order.findMany({
          where: { id: { in: orderIds } },
          select: {
            id: true,
            orderNumber: true,
            createdAt: true,
            total: true,
            guestEmail: true,
            user: { select: { email: true } },
            payments: {
              select: { reference: true, method: true, status: true, amount: true, confirmedAt: true, createdAt: true },
            },
          },
        });

  const paymentRows = orders.flatMap((o) =>
    o.payments.map((p) => ({
      reference: p.reference,
      method: p.method,
      status: p.status,
      amountNGN: money(Number(p.amount)),
      at: (p.confirmedAt ?? p.createdAt).toISOString(),
      orderNumber: o.orderNumber,
      amount: p.amount,
    })),
  );

  const orderSnaps: CascadeOrderSnap[] = orders.map((o) => {
    const email = customerEmail(o);
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      date: o.createdAt.toISOString(),
      totalNGN: money(o.total),
      receivedNGN: cashReceived(o.payments),
      customerEmail: email,
    };
  });

  const customerEmails = Array.from(
    new Set(orderSnaps.map((o) => o.customerEmail).filter((e): e is string => Boolean(e))),
  );
  const siblingPieces = await loadSiblingPieces(orderIds, foundIds);
  const receivedNGN = money(orderSnaps.reduce((s, o) => s + o.receivedNGN, 0));
  const loud = orderIds.length > 0 || paymentRows.length > 0;

  const mediaUrls = Array.from(
    new Set(
      products.flatMap((p) => [
        ...p.images.map((im) => im.url),
        ...p.colors.map((c) => c.imageUrl).filter((u): u is string => Boolean(u)),
      ]),
    ),
  );

  const productSnaps: CascadeProductSnap[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    skus: p.variants.map((v) => v.sku).filter((s): s is string => Boolean(s)),
  }));

  return {
    loud,
    productCount: products.length,
    productsWithOrders,
    products: productSnaps,
    orders: orderSnaps,
    payments: paymentRows.map(({ reference, method, status, amountNGN, at, orderNumber }) => ({
      reference,
      method,
      status,
      amountNGN,
      at,
      orderNumber,
    })),
    customerEmails,
    siblingPieces,
    receivedNGN,
    mediaUrls,
    productIds: foundIds,
    orderIds,
    slugs: products.map((p) => p.slug),
  };
}

export function assertCascadeAllowed(role: string, loud: boolean): void {
  if (loud && role !== "SUPER_ADMIN") {
    throw new ProductCascadeError(
      "FORBIDDEN",
      "Only a Super Admin can delete products that have been ordered",
      403,
    );
  }
}

export function assertLoudConfirmation(loud: boolean, confirmation: string | undefined): void {
  if (!loud) return;
  if (confirmation !== PRODUCT_CASCADE_CONFIRMATION) {
    throw new ProductCascadeError(
      "CONFIRM",
      `Type ${PRODUCT_CASCADE_CONFIRMATION} to delete products that have been ordered`,
      400,
    );
  }
}

export async function enableLedgerBypass(tx: Prisma.TransactionClient): Promise<void> {
  await tx.$executeRawUnsafe(`SET LOCAL app.ledger_bypass = 'on'`);
}

async function checkoutSessionIds(
  tx: Prisma.TransactionClient,
  productIds: string[],
  orderIds: string[],
): Promise<string[]> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "CheckoutSession"
    WHERE (
      ${orderIds.length > 0 ? Prisma.sql`"orderId" IN (${Prisma.join(orderIds)})` : Prisma.sql`FALSE`}
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE("cartSnapshot"->'lines', '[]'::jsonb)) AS line
        WHERE (line->>'productId') IN (${Prisma.join(productIds)})
      )
    )
  `;
  return rows.map((r) => r.id);
}

export async function deleteProductGraph(tx: Prisma.TransactionClient, plan: ProductCascadePlan): Promise<void> {
  const { productIds, orderIds } = plan;

  if (orderIds.length > 0) {
    await tx.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    await tx.pointsTransaction.deleteMany({ where: { orderId: { in: orderIds } } });
  }

  const sessionIds = await checkoutSessionIds(tx, productIds, orderIds);
  if (sessionIds.length > 0) {
    await tx.checkoutSession.deleteMany({ where: { id: { in: sessionIds } } });
  }

  await tx.review.deleteMany({ where: { productId: { in: productIds } } });
  if (orderIds.length > 0) {
    await tx.review.updateMany({ where: { orderId: { in: orderIds } }, data: { orderId: null } });
  }

  await tx.cartItem.deleteMany({ where: { productId: { in: productIds } } });
  await tx.wishlistItem.deleteMany({ where: { productId: { in: productIds } } });

  if (orderIds.length > 0) {
    await tx.order.deleteMany({ where: { id: { in: orderIds } } });
  }

  await tx.product.deleteMany({ where: { id: { in: productIds } } });
}

export async function writeCascadeLog(
  tx: Prisma.TransactionClient,
  plan: ProductCascadePlan,
  actor: CascadeActor,
): Promise<string> {
  const snapshot: ProductCascadeSnapshot = {
    kind: PRODUCT_CASCADE_RECORD_TYPE,
    products: plan.products,
    orders: plan.orders,
    payments: plan.payments,
    siblingPieces: plan.siblingPieces,
    customerEmails: plan.customerEmails,
    receivedNGN: plan.receivedNGN,
    actor: { userId: actor.userId, email: actor.email, role: actor.role, ip: actor.ip },
  };
  const copy = cascadeDialogCopy(plan);
  const description = plan.loud
    ? `Cascade deleted ${plan.productCount} products (${plan.productsWithOrders} with orders, ${formatReceivedNGN(plan.receivedNGN)} received)`
    : `Deleted ${plan.productCount} ${plan.productCount === 1 ? "product" : "products"} with no orders`;

  const row = await tx.activityLog.create({
    data: {
      userId: actor.userId,
      userEmail: actor.email,
      userRole: actor.role,
      action: ActivityAction.DELETE,
      module: PRODUCT_CASCADE_MODULE,
      description: `${description}. ${copy.heading}`,
      recordId: plan.productIds[0],
      recordType: PRODUCT_CASCADE_RECORD_TYPE,
      ipAddress: actor.ip,
      snapshot: snapshot as Prisma.InputJsonValue,
    },
  });
  return row.id;
}

export type ProductCascadeResult = {
  logId: string;
  mediaUrls: string[];
  slugs: string[];
  deletedProductIds: string[];
  loud: boolean;
};

export async function executeProductCascade(opts: {
  productIds: string[];
  actor: CascadeActor;
  confirmation?: string;
  injectFailure?: "after-graph";
}): Promise<ProductCascadeResult> {
  const plan = await loadPlan(opts.productIds);
  assertCascadeAllowed(opts.actor.role, plan.loud);
  assertLoudConfirmation(plan.loud, opts.confirmation);

  try {
    const logId = await prisma.$transaction(
      async (tx) => {
        await enableLedgerBypass(tx);
        await deleteProductGraph(tx, plan);
        if (opts.injectFailure === "after-graph") {
          throw new Error("injected cascade failure");
        }
        return writeCascadeLog(tx, plan, opts.actor);
      },
      { timeout: 60_000, maxWait: 15_000 },
    );

    return {
      logId,
      mediaUrls: plan.mediaUrls,
      slugs: plan.slugs,
      deletedProductIds: plan.productIds,
      loud: plan.loud,
    };
  } catch (e) {
    if (e instanceof ProductCascadeError) throw e;
    const message = e instanceof Error ? e.message : "Delete failed";
    if (message === "injected cascade failure") throw e;
    throw new ProductCascadeError("FAILED", "Delete failed; nothing was removed", 500);
  }
}

export function paymentAtInRange(iso: string, from: Date, to: Date): boolean {
  const t = new Date(iso).getTime();
  return t >= from.getTime() && t < to.getTime();
}

export async function cascadeDeletionsInPeriod(
  from: Date,
  to: Date,
): Promise<{ paymentCount: number; logIds: string[] }> {
  const logs = await prisma.activityLog.findMany({
    where: {
      recordType: { in: [PRODUCT_CASCADE_RECORD_TYPE, CONSULTATION_CASCADE_RECORD_TYPE] },
      createdAt: { gte: from },
    },
    select: { id: true, snapshot: true },
  });
  const logIds: string[] = [];
  let paymentCount = 0;
  for (const log of logs) {
    const snap = log.snapshot as { kind?: string; payments?: CascadePaymentSnap[] } | null;
    if (!snap || !Array.isArray(snap.payments)) continue;
    const hits = snap.payments.filter((p) => paymentAtInRange(p.at, from, to));
    if (hits.length === 0) continue;
    paymentCount += hits.length;
    logIds.push(log.id);
  }
  return { paymentCount, logIds };
}
