import { NextRequest, NextResponse } from "next/server";
import { PointsType, PaymentStatus, ShippingQuoteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";
import {
  assertCanMarkReadyForCollection,
  assertCanMarkShipped,
  canTransitionOrder,
  isPickupFulfilment,
  shippingRequiresTracking,
} from "@/lib/order-status";
import { generateCollectionCode, normalizeCollectionCode } from "@/lib/shipping/collection";
import { awardPurchasePoints, returnRedeemedPoints } from "@/lib/points";
import { releaseUnpaidCheckoutReservations } from "@/lib/checkout-reservations";
import { sendOrderShippedEmail, sendPickupReadyEmail, sendRtwOrderDeliveredEmail } from "@/lib/email";
import { notifyOrderDelivered, notifyOrderShipped } from "@/lib/customer-notifications";
import { deleteOrdersByIds } from "@/lib/order-delete";
import { rtwHasOutstandingBalance } from "@/lib/payments/rtw-totals";
import { shouldDecrementStock } from "@/lib/custom-size";
import { restockOrderLines, afterStockWrites, isOversellRefuse } from "@/lib/stock-ledger";
import { INTERACTIVE_TX } from "@/lib/prisma-tx";
import { z } from "zod";

const patchSchema = z.object({
  status: z
    .enum([
      "PENDING",
      "CONFIRMED",
      "PROCESSING",
      "SHIPPED",
      "DELIVERED",
      "READY_FOR_COLLECTION",
      "COLLECTED",
      "CANCELLED",
      "REFUNDED",
    ])
    .optional(),
  adminNotes: z.string().optional().nullable(),
  trackingNumber: z.string().optional().nullable(),
  carrier: z.string().optional().nullable(),
  collectionCode: z.string().optional(),
  returnToStock: z.boolean().optional(),
});

const recordRefundSchema = z.object({
  recordRefund: z.object({
    full: z.boolean(),
    amountNGN: z.number().nonnegative(),
    reason: z.string().min(1),
    returnToStock: z.boolean().optional(),
  }),
});

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi("shop.orders");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: { include: { product: { include: { images: true } }, variant: true } },
      user: true,
      shippingZone: true,
      coupon: true,
    },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(order);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi("shop.orders");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const refundTry = recordRefundSchema.safeParse(body);
  if (refundTry.success) {
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (order.paymentStatus !== "PAID") {
      return NextResponse.json({ error: "Refund can only be recorded for paid orders" }, { status: 400 });
    }
    const { full, amountNGN, reason, returnToStock } = refundTry.data.recordRefund;
    if (!full && amountNGN > order.total) {
      return NextResponse.json({ error: "Refund amount exceeds order total" }, { status: 400 });
    }
    const stamp = new Date().toISOString().slice(0, 10);
    const wantStock = Boolean(returnToStock) && full && !isOversellRefuse(order.adminNotes);
    const actorId = gate.session.user.id;
    const actorName =
      [gate.session.user.name, gate.session.user.email].filter(Boolean).join(" · ") || actorId;
    const refundAmount = full ? order.total : amountNGN;
    const line = `\n[${stamp}] Refund recorded by ${actorName}: ₦${Math.round(refundAmount).toLocaleString("en-NG")}. Reason: ${reason}${
      wantStock ? ". Returned to stock." : returnToStock ? ". Not returned to stock (partial or oversell)." : ". Not returned to stock."
    }`;
    const adminNotes = [order.adminNotes?.trim() ?? "", line].filter(Boolean).join("\n");
    const nextStatus = full ? "REFUNDED" : "PROCESSING";
    const items = wantStock
      ? await prisma.orderItem.findMany({
          where: { orderId: id },
          select: { variantId: true, quantity: true, sizeMode: true },
        })
      : [];
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.order.update({
        where: { id },
        data: {
          paymentStatus: "REFUNDED",
          status: nextStatus,
          adminNotes,
          refundRecordedAt: new Date(),
          refundRecordedById: actorId,
          refundRecordedByName: actorName,
          refundRecordedAmountNGN: refundAmount,
        },
      });
      if (full) {
        await returnRedeemedPoints(id, tx);
      }
      const writes = wantStock
        ? await restockOrderLines(tx, {
            orderId: id,
            adminNotes: order.adminNotes,
            paymentStatus: order.paymentStatus,
            items,
            reason: "REFUND_RETURN",
            actorId,
            note: `Refund recorded. ${reason}. Return to stock: yes.`,
            shouldDecrementStock,
          })
        : [];
      return { row, writes };
    }, INTERACTIVE_TX);
    if (updated.writes.length) await afterStockWrites(updated.writes);
    return NextResponse.json(updated.row);
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const nextStatus = parsed.data.status;
  if (nextStatus !== undefined && nextStatus !== order.status) {
    if (!canTransitionOrder(order.status, nextStatus, {
      kind: order.shippingMethodKind,
      fulfilmentKind: order.fulfilmentKind,
    })) {
      return NextResponse.json({ error: "Invalid status transition" }, { status: 400 });
    }
  }

  if (nextStatus === "SHIPPED") {
    const gateShip = assertCanMarkShipped(order);
    if (!gateShip.ok) return NextResponse.json({ error: gateShip.error }, { status: 400 });
    if (shippingRequiresTracking(order.shippingMethodKind) && !(parsed.data.trackingNumber ?? order.trackingNumber)) {
      return NextResponse.json({ error: "Tracking number is required to mark shipped" }, { status: 400 });
    }
  }

  if (nextStatus === "READY_FOR_COLLECTION") {
    const gateReady = assertCanMarkReadyForCollection(order);
    if (!gateReady.ok) return NextResponse.json({ error: gateReady.error }, { status: 400 });
  }

  if (nextStatus === "COLLECTED") {
    if (!isPickupFulfilment(order.shippingMethodKind)) {
      return NextResponse.json({ error: "Only pickup orders can be marked collected" }, { status: 400 });
    }
    if (rtwHasOutstandingBalance(order)) {
      return NextResponse.json({ error: "Cannot collect while a balance is outstanding" }, { status: 400 });
    }
    const presented = parsed.data.collectionCode ? normalizeCollectionCode(parsed.data.collectionCode) : "";
    const expected = order.collectionCode ? normalizeCollectionCode(order.collectionCode) : "";
    if (!expected || presented !== expected) {
      return NextResponse.json({ error: "Collection code does not match" }, { status: 400 });
    }
  }

  const userRow =
    order.userId != null
      ? await prisma.user.findUnique({
          where: { id: order.userId },
          select: { email: true, name: true },
        })
      : null;
  const email = userRow?.email ?? order.guestEmail ?? null;
  const firstName =
    userRow?.name?.split(" ")[0] ?? (order.guestName ?? "Customer").split(" ")[0] ?? "Customer";

  const collectionCode =
    parsed.data.status === "READY_FOR_COLLECTION"
      ? order.collectionCode ?? generateCollectionCode()
      : undefined;

  const wantCancelRestock =
    parsed.data.status === "CANCELLED" &&
    parsed.data.status !== order.status &&
    parsed.data.returnToStock === true &&
    order.paymentStatus === "PAID" &&
    !isOversellRefuse(order.adminNotes);

  const cancelItems = wantCancelRestock
    ? await prisma.orderItem.findMany({
        where: { orderId: id },
        select: { variantId: true, quantity: true, sizeMode: true },
      })
    : [];
  const actorId = gate.session.user.id;
  const cancelWrites: Awaited<ReturnType<typeof restockOrderLines>> = [];

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.order.update({
      where: { id },
      data: {
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
        ...(parsed.data.adminNotes !== undefined ? { adminNotes: parsed.data.adminNotes } : {}),
        ...(parsed.data.trackingNumber !== undefined ? { trackingNumber: parsed.data.trackingNumber } : {}),
        ...(parsed.data.carrier !== undefined ? { carrier: parsed.data.carrier } : {}),
        ...(collectionCode ? { collectionCode, collectionReadyAt: new Date() } : {}),
        ...(parsed.data.status === "COLLECTED" ? { collectedAt: new Date() } : {}),
        ...(parsed.data.status === "SHIPPED" && order.shippingQuoteStatus === ShippingQuoteStatus.QUOTED
          ? {}
          : {}),
      },
    });

    if (
      (parsed.data.status === "CANCELLED" || parsed.data.status === "REFUNDED") &&
      parsed.data.status !== order.status
    ) {
      if (
        order.paymentStatus === PaymentStatus.PENDING ||
        order.paymentStatus === PaymentStatus.FAILED
      ) {
        await releaseUnpaidCheckoutReservations(id, tx);
      } else {
        await returnRedeemedPoints(id, tx);
      }
    }

    if (wantCancelRestock) {
      const writes = await restockOrderLines(tx, {
        orderId: id,
        adminNotes: order.adminNotes,
        paymentStatus: order.paymentStatus,
        items: cancelItems,
        reason: "CANCEL_RETURN",
        actorId,
        note: "Admin cancel. Return to stock: yes.",
        shouldDecrementStock,
      });
      cancelWrites.push(...writes);
    }

    if (parsed.data.status === "DELIVERED" && order.userId && order.paymentStatus === "PAID") {
      const existing = await tx.pointsTransaction.findFirst({
        where: { orderId: id, type: PointsType.EARNED_PURCHASE },
      });
      if (!existing) {
        await awardPurchasePoints(
          order.userId,
          Math.max(0, order.subtotal - order.discount),
          id,
          tx,
          order.pointsDiscountNGN,
        );
      }
    }

    return row;
  }, INTERACTIVE_TX);

  if (cancelWrites.length) await afterStockWrites(cancelWrites);

  if (parsed.data.status === "READY_FOR_COLLECTION" && email) {
    const pickup = order.pickupLocationId
      ? await prisma.pickupLocation.findUnique({ where: { id: order.pickupLocationId } })
      : await prisma.pickupLocation.findFirst({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
    void sendPickupReadyEmail({
      to: email,
      firstName,
      orderNumber: order.orderNumber,
      collectionCode: updated.collectionCode ?? collectionCode ?? "",
      pickupName: pickup?.name ?? "the atelier",
      address: pickup?.address ?? "",
      hours: pickup?.hours ?? "",
      instructions: pickup?.instructions,
    });
  }

  if (parsed.data.status === "SHIPPED" && email) {
    void sendOrderShippedEmail({
      to: email,
      firstName,
      orderNumber: order.orderNumber,
      trackingNumber: parsed.data.trackingNumber ?? updated.trackingNumber ?? undefined,
      carrier: parsed.data.carrier ?? updated.carrier ?? undefined,
      estimatedDays: undefined,
    });
    if (order.userId) {
      notifyOrderShipped({
        userId: order.userId,
        orderId: order.id,
        orderNumber: order.orderNumber,
      });
    }
  }

  if (parsed.data.status === "DELIVERED" && email) {
    void sendRtwOrderDeliveredEmail({
      to: email,
      firstName,
      orderNumber: order.orderNumber,
    });
    if (order.userId) {
      notifyOrderDelivered({
        userId: order.userId,
        orderId: order.id,
        orderNumber: order.orderNumber,
      });
    }
  }

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi("shop.orders");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  try {
    const deleted = await deleteOrdersByIds([id]);
    if (deleted === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, deleted });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    if (msg.includes("payment records")) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    console.error("[admin/orders DELETE]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
