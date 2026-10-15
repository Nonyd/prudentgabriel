/**
 * Cascade delete for a single shop order (admin order page, Danger zone).
 *
 * Dependency list (every row that would otherwise orphan an Order):
 *
 * Restrict — must delete or refuse before the order:
 *   Payment.orderId (RESTRICT + append-only trigger — app.ledger_bypass)
 *   StoreMovement.orderId, CostOfProduction.orderId, Requisition.orderId (blocked, not deleted)
 *
 * Cascade from Order: OrderItem, CouponUsage.
 *
 * Loose pointers (no FK): PointsTransaction.orderId (deleted), Review.orderId (unlinked).
 *
 * Policy (same shape as products and consultations):
 *   Quiet   — no Payment row. Any admin with shop.orders.
 *   Loud    — Payment rows exist, confirmed or not. SUPER_ADMIN + typed DELETE;
 *             a snapshot of every payment goes to the activity log.
 *   Blocked — atelier records point at the order.
 *
 * After commit: Payment.receiptUrl and Order.paymentReceiptUrl files.
 */

import { ActivityAction, PaymentMethod, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CASCADE_CONFIRMATION, formatReceivedNGN, joinNamedList, type CascadePaymentSnap } from "@/lib/cascade-copy";
import { enableLedgerBypass, ProductCascadeError, type CascadeActor } from "@/lib/product-cascade-delete";
import {
  ORDER_CASCADE_MODULE,
  ORDER_CASCADE_RECORD_TYPE,
  type OrderCascadePreview,
  type OrderCascadeSnapshot,
} from "@/lib/order-cascade-copy";

function money(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

function isConfirmedMoney(status: PaymentStatus): boolean {
  return status === PaymentStatus.CONFIRMED || status === PaymentStatus.PAID;
}

function isUnconfirmed(status: PaymentStatus): boolean {
  return (
    status === PaymentStatus.PENDING || status === PaymentStatus.FAILED || status === PaymentStatus.REJECTED
  );
}

export type OrderCascadePlan = Omit<OrderCascadePreview, "viewerCanDelete"> & {
  orderId: string;
  mediaUrls: string[];
};

export async function loadOrderPlan(id: string): Promise<OrderCascadePlan> {
  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      orderNumber: true,
      total: true,
      status: true,
      paymentStatus: true,
      createdAt: true,
      guestEmail: true,
      guestName: true,
      paymentReceiptUrl: true,
      user: { select: { email: true, name: true } },
      payments: {
        select: {
          reference: true,
          method: true,
          status: true,
          amount: true,
          confirmedAt: true,
          createdAt: true,
          receiptUrl: true,
        },
      },
      _count: { select: { storeMovements: true, costsOfProduction: true, requisitions: true } },
    },
  });
  if (!order) {
    throw new ProductCascadeError("NOT_FOUND", "Order not found", 404);
  }

  const atelier: string[] = [];
  if (order._count.storeMovements > 0) atelier.push(`${order._count.storeMovements} store book entries`);
  if (order._count.costsOfProduction > 0) atelier.push(`${order._count.costsOfProduction} cost of production records`);
  if (order._count.requisitions > 0) atelier.push(`${order._count.requisitions} requisitions`);
  const blocked = atelier.length > 0;

  const payments: CascadePaymentSnap[] = order.payments.map((p) => ({
    reference: p.reference,
    method: p.method,
    status: p.status,
    amountNGN: money(Number(p.amount)),
    at: (p.confirmedAt ?? p.createdAt).toISOString(),
    orderNumber: order.orderNumber,
  }));
  const receivedNGN = money(
    order.payments
      .filter((p) => isConfirmedMoney(p.status) && p.method !== PaymentMethod.POINTS)
      .reduce((s, p) => s + Number(p.amount), 0),
  );

  const name = order.user
    ? order.user.name
    : order.guestName;
  const email = order.user?.email ?? order.guestEmail;

  const mediaUrls = Array.from(
    new Set(
      [order.paymentReceiptUrl, ...order.payments.map((p) => p.receiptUrl)].filter((u): u is string => Boolean(u)),
    ),
  );

  return {
    loud: !blocked && payments.length > 0,
    blocked,
    blockReason: blocked ? `This order is linked to ${joinNamedList(atelier)} in the atelier.` : null,
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      customer: [name, email].filter(Boolean).join(" · ") || null,
      totalNGN: money(order.total),
      paymentStatus: order.paymentStatus,
      status: order.status,
      createdAt: order.createdAt.toISOString(),
    },
    payments,
    receivedNGN,
    unconfirmedCount: order.payments.filter((p) => isUnconfirmed(p.status)).length,
    orderId: order.id,
    mediaUrls,
  };
}

export function toOrderPreview(plan: OrderCascadePlan, isSuperAdmin: boolean): OrderCascadePreview {
  const { orderId: _orderId, mediaUrls: _mediaUrls, ...rest } = plan;
  return { ...rest, viewerCanDelete: !plan.loud || isSuperAdmin };
}

export async function executeOrderCascade(opts: {
  id: string;
  actor: CascadeActor;
  confirmation?: string;
}): Promise<{ logId: string; mediaUrls: string[]; loud: boolean }> {
  const plan = await loadOrderPlan(opts.id);
  if (plan.blocked) {
    throw new ProductCascadeError("BLOCKED", plan.blockReason ?? "This order cannot be deleted from here", 409);
  }
  if (plan.loud && opts.actor.role !== "SUPER_ADMIN") {
    throw new ProductCascadeError(
      "FORBIDDEN",
      "Only a Super Admin can delete an order with payment records. Cancel it instead.",
      403,
    );
  }
  if (plan.loud && opts.confirmation !== CASCADE_CONFIRMATION) {
    throw new ProductCascadeError(
      "CONFIRM",
      `Type ${CASCADE_CONFIRMATION} to delete an order with payment records`,
      400,
    );
  }

  try {
    const logId = await prisma.$transaction(
      async (tx) => {
        if (plan.loud) {
          await enableLedgerBypass(tx);
          await tx.payment.deleteMany({ where: { orderId: plan.orderId } });
        }
        await tx.pointsTransaction.deleteMany({ where: { orderId: plan.orderId } });
        await tx.review.updateMany({ where: { orderId: plan.orderId }, data: { orderId: null } });
        await tx.order.delete({ where: { id: plan.orderId } });
        return writeOrderLog(tx, plan, opts.actor);
      },
      { timeout: 60_000, maxWait: 15_000 },
    );
    return { logId, mediaUrls: plan.mediaUrls, loud: plan.loud };
  } catch (e) {
    if (e instanceof ProductCascadeError) throw e;
    throw new ProductCascadeError("FAILED", "Delete failed; nothing was removed", 500);
  }
}

async function writeOrderLog(
  tx: Prisma.TransactionClient,
  plan: OrderCascadePlan,
  actor: CascadeActor,
): Promise<string> {
  const snapshot: OrderCascadeSnapshot = {
    kind: ORDER_CASCADE_RECORD_TYPE,
    order: plan.order,
    payments: plan.payments,
    receivedNGN: plan.receivedNGN,
    actor: { userId: actor.userId, email: actor.email, role: actor.role, ip: actor.ip },
  };
  const n = plan.payments.length;
  const description = plan.loud
    ? `Deleted order ${plan.order.orderNumber} with ${n} ${n === 1 ? "payment" : "payments"} (${formatReceivedNGN(plan.receivedNGN)} received)`
    : `Deleted order ${plan.order.orderNumber} with no payment`;

  const row = await tx.activityLog.create({
    data: {
      userId: actor.userId,
      userEmail: actor.email,
      userRole: actor.role,
      action: ActivityAction.DELETE,
      module: ORDER_CASCADE_MODULE,
      description,
      recordId: plan.orderId,
      recordType: ORDER_CASCADE_RECORD_TYPE,
      ipAddress: actor.ip,
      snapshot: snapshot as Prisma.InputJsonValue,
    },
  });
  return row.id;
}
