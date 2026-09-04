import {
  CouponUsageStatus,
  PaymentGateway,
  PaymentPurpose,
  PaymentStatus,
  type Prisma,
  type PrismaClient,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { INTERACTIVE_TX } from "@/lib/prisma-tx";
import { commitCouponUsage, releaseCouponUsage, rereserveCouponUsage } from "@/lib/coupon";
import {
  InsufficientPointsError,
  netHeldPointsForOrder,
  pointsPaymentData,
  reservePoints,
  returnRedeemedPoints,
} from "@/lib/points";
import { resolveClientId } from "@/lib/payments/ledger";

type ReservationsDb = Prisma.TransactionClient | PrismaClient;

type UnpaidHoldOrder = {
  id: string;
  createdAt: Date;
  paymentGateway: PaymentGateway | null;
  paymentStatus: PaymentStatus;
};

/** Card / wallet sessions. Bank transfer is allowed longer — she may pay the next day. */
export const PSP_RESERVATION_TTL_MS = 24 * 60 * 60 * 1000;
export const BANK_RESERVATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function reservationTtlMs(gateway: PaymentGateway | null | undefined): number {
  return gateway === PaymentGateway.BANK_TRANSFER ? BANK_RESERVATION_TTL_MS : PSP_RESERVATION_TTL_MS;
}

export function isCheckoutReservationStale(params: {
  createdAt: Date;
  paymentGateway: PaymentGateway | null;
  now?: Date;
}): boolean {
  const now = params.now ?? new Date();
  return now.getTime() - params.createdAt.getTime() >= reservationTtlMs(params.paymentGateway);
}

async function loadStalePendingOrders(
  db: ReservationsDb,
  now: Date,
  take: number,
): Promise<UnpaidHoldOrder[]> {
  const cardCutoff = new Date(now.getTime() - PSP_RESERVATION_TTL_MS);
  const bankCutoff = new Date(now.getTime() - BANK_RESERVATION_TTL_MS);
  const select = { id: true, createdAt: true, paymentGateway: true, paymentStatus: true } as const;

  const [card, bank] = await Promise.all([
    db.order.findMany({
      where: {
        paymentStatus: PaymentStatus.PENDING,
        createdAt: { lte: cardCutoff },
        NOT: { paymentGateway: PaymentGateway.BANK_TRANSFER },
      },
      select,
      orderBy: { createdAt: "asc" },
      take,
    }),
    db.order.findMany({
      where: {
        paymentStatus: PaymentStatus.PENDING,
        paymentGateway: PaymentGateway.BANK_TRANSFER,
        createdAt: { lte: bankCutoff },
      },
      select,
      orderBy: { createdAt: "asc" },
      take,
    }),
  ]);

  const byId = new Map<string, UnpaidHoldOrder>();
  for (const order of card.concat(bank)) byId.set(order.id, order);
  return Array.from(byId.values());
}

/**
 * Undo a pre-payment hold: points back, coupon slot back, bag untouched (it was never cleared).
 * Safe to call twice. Does not run on PAID orders — those holds already committed.
 */
export async function releaseUnpaidCheckoutReservations(
  orderId: string,
  db: ReservationsDb = prisma,
): Promise<{ pointsReturned: number; couponReleased: boolean }> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, paymentStatus: true },
  });
  if (!order) return { pointsReturned: 0, couponReleased: false };
  if (order.paymentStatus === PaymentStatus.PAID || order.paymentStatus === PaymentStatus.REFUNDED) {
    return { pointsReturned: 0, couponReleased: false };
  }

  const usage = await db.couponUsage.findUnique({
    where: { orderId },
    select: { status: true },
  });
  await releaseCouponUsage(db, orderId);
  const pointsReturned = await returnRedeemedPoints(orderId, db);
  return { pointsReturned, couponReleased: usage?.status === CouponUsageStatus.PENDING };
}

/** After money has cleared: coupon is used, points ledger payment is written, bag is emptied. */
export async function commitPaidCheckoutReservations(params: {
  orderId: string;
  userId?: string | null;
  guestEmail?: string | null;
  pointsUsed: number;
  pointsDiscountNGN: number;
  orderNumber: string;
  createPointsPayment: boolean;
  clearCart: boolean;
  db?: ReservationsDb;
}): Promise<void> {
  const db = params.db ?? prisma;
  await commitCouponUsage(db, params.orderId);

  if (params.createPointsPayment && params.pointsUsed > 0 && params.pointsDiscountNGN > 0.01) {
    const existing = await db.payment.findFirst({
      where: { orderId: params.orderId, purpose: PaymentPurpose.POINTS_REDEMPTION },
      select: { id: true },
    });
    if (!existing) {
      const clientId = await resolveClientId({
        userId: params.userId,
        email: params.guestEmail,
      });
      await db.payment.create({
        data: pointsPaymentData({
          orderId: params.orderId,
          orderNumber: params.orderNumber,
          amountNGN: params.pointsDiscountNGN,
          clientId,
        }),
      });
    }
  }

  if (params.clearCart && params.userId) {
    await db.cartItem.deleteMany({ where: { userId: params.userId } });
  }
}

export async function markRtwOrderPaymentFailed(orderId: string): Promise<boolean> {
  const flipped = await prisma.order.updateMany({
    where: { id: orderId, paymentStatus: PaymentStatus.PENDING },
    data: { paymentStatus: PaymentStatus.FAILED },
  });
  await prisma.$transaction(async (tx) => {
    await releaseUnpaidCheckoutReservations(orderId, tx);
  }, INTERACTIVE_TX);
  return flipped.count > 0;
}

/**
 * A declined card that she retries on the same order must re-hold coupon and points.
 * Otherwise she would pay the discounted total with the promotion and the points already returned.
 */
export async function prepareRtwPaymentAttempt(orderId: string): Promise<{ error?: string }> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      paymentStatus: true,
      couponId: true,
      pointsUsed: true,
      pointsRateLocked: true,
      userId: true,
      guestEmail: true,
      user: { select: { email: true } },
    },
  });
  if (!order || order.paymentStatus !== PaymentStatus.FAILED) return {};

  try {
    await prisma.$transaction(async (tx) => {
      if (order.couponId) {
        const email = (order.guestEmail ?? order.user?.email ?? "").trim().toLowerCase();
        if (email) {
          await rereserveCouponUsage(tx, {
            orderId: order.id,
            couponId: order.couponId,
            userId: order.userId,
            email,
          });
        }
      }
      if (order.pointsUsed > 0 && order.userId) {
        const held = await netHeldPointsForOrder(order.id, tx);
        const need = order.pointsUsed - held;
        if (need > 0) {
          await reservePoints(order.userId, need, order.id, tx, order.pointsRateLocked ?? undefined);
        }
      }
      await tx.order.updateMany({
        where: { id: order.id, paymentStatus: PaymentStatus.FAILED },
        data: { paymentStatus: PaymentStatus.PENDING },
      });
    }, INTERACTIVE_TX);
  } catch (e) {
    if (e instanceof InsufficientPointsError) {
      return { error: "Insufficient points. Start checkout again to apply what you have left." };
    }
    if (e instanceof Error && /coupon/i.test(e.message)) {
      return { error: e.message };
    }
    throw e;
  }
  return {};
}

export async function expireStaleCheckoutReservationsForActor(
  params: { userId?: string | null; email?: string | null },
  db: ReservationsDb = prisma,
  now = new Date(),
): Promise<number> {
  const or: Prisma.OrderWhereInput[] = [];
  if (params.userId) or.push({ userId: params.userId });
  const email = params.email?.trim().toLowerCase();
  if (email) or.push({ guestEmail: email });
  if (or.length === 0) return 0;

  const orders = await db.order.findMany({
    where: {
      paymentStatus: { in: [PaymentStatus.PENDING, PaymentStatus.FAILED] },
      OR: or,
    },
    select: { id: true, createdAt: true, paymentGateway: true, paymentStatus: true },
    take: 30,
  });

  let processed = 0;
  for (const order of orders) {
    if (!isCheckoutReservationStale({ createdAt: order.createdAt, paymentGateway: order.paymentGateway, now })) {
      continue;
    }
    if (order.paymentStatus === PaymentStatus.PENDING) {
      await db.order.updateMany({
        where: { id: order.id, paymentStatus: PaymentStatus.PENDING },
        data: { paymentStatus: PaymentStatus.FAILED },
      });
    }
    await releaseUnpaidCheckoutReservations(order.id, db);
    processed += 1;
  }
  return processed;
}

export async function expireStaleCheckoutReservations(
  db: ReservationsDb = prisma,
  now = new Date(),
  limit = 50,
): Promise<number> {
  const candidates = await loadStalePendingOrders(db, now, 200);
  const stale = candidates.slice(0, limit);

  let processed = 0;
  for (const order of stale) {
    if (order.paymentStatus === PaymentStatus.PENDING) {
      await db.order.updateMany({
        where: { id: order.id, paymentStatus: PaymentStatus.PENDING },
        data: { paymentStatus: PaymentStatus.FAILED },
      });
    }
    await releaseUnpaidCheckoutReservations(order.id, db);
    processed += 1;
  }

  const paidPendingCoupon = await db.couponUsage.findMany({
    where: {
      status: CouponUsageStatus.PENDING,
      order: { paymentStatus: PaymentStatus.PAID },
    },
    select: { orderId: true },
    take: limit,
  });
  for (const row of paidPendingCoupon) {
    await commitCouponUsage(db, row.orderId);
    processed += 1;
  }

  return processed;
}
