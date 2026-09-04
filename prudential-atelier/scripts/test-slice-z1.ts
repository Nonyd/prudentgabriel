/**
 * Slice Z1: nothing is spent until payment clears.
 *
 *   pnpm test:slice-z1
 */
import "./preload-test-env";
import {
  CouponType,
  CouponUsageStatus,
  PaymentStatus,
  PointsType,
  ProductCategory,
  ProductType,
  Role,
} from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { addCalendarMonths } from "../src/lib/points";
import { reservePoints, returnRedeemedPoints } from "../src/lib/points";
import { commitCouponUsage, releaseCouponUsage, reserveCouponUsage } from "../src/lib/coupon";
import {
  BANK_RESERVATION_TTL_MS,
  PSP_RESERVATION_TTL_MS,
  commitPaidCheckoutReservations,
  expireStaleCheckoutReservations,
  expireStaleCheckoutReservationsForActor,
  isCheckoutReservationStale,
  markRtwOrderPaymentFailed,
  prepareRtwPaymentAttempt,
  releaseUnpaidCheckoutReservations,
} from "../src/lib/checkout-reservations";
import { applyOrderAttention, REFUND_REQUIRED_ATTENTION } from "../src/lib/admin-orders-filter";
import { listRefundRequiredOrders } from "../src/lib/oversell-report";
import { FULFILMENT_STOCK_REFUSE_NOTE } from "../src/lib/stock-ledger";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const stamp = `z1-${Date.now()}`;

function runPure() {
  const now = new Date("2026-09-04T12:00:00Z");
  assert(
    isCheckoutReservationStale({
      createdAt: new Date(now.getTime() - PSP_RESERVATION_TTL_MS - 1),
      paymentGateway: "PAYSTACK",
      now,
    }),
    "Paystack hold older than 24h is stale",
  );
  assert(
    !isCheckoutReservationStale({
      createdAt: new Date(now.getTime() - 60 * 60 * 1000),
      paymentGateway: "PAYSTACK",
      now,
    }),
    "Paystack hold under 24h is live",
  );
  assert(
    !isCheckoutReservationStale({
      createdAt: new Date(now.getTime() - PSP_RESERVATION_TTL_MS - 1),
      paymentGateway: "BANK_TRANSFER",
      now,
    }),
    "Bank transfer is not stale at the card TTL",
  );
  assert(
    isCheckoutReservationStale({
      createdAt: new Date(now.getTime() - BANK_RESERVATION_TTL_MS - 1),
      paymentGateway: "BANK_TRANSFER",
      now,
    }),
    "Bank transfer hold older than 7 days is stale",
  );

  const refundWhere = applyOrderAttention({}, REFUND_REQUIRED_ATTENTION);
  assert(refundWhere.refundRecordedAt === null, "refund-required queue hides recorded refunds");
}

async function runDb() {
  const user = await prisma.user.create({
    data: {
      email: `${stamp}@slicez1.test`,
      name: "Slice Z1",
      role: Role.CUSTOMER,
      pointsBalance: 50_000,
    },
  });
  await prisma.pointsTransaction.create({
    data: {
      userId: user.id,
      type: PointsType.ADJUSTED_ADMIN,
      amount: 50_000,
      remaining: 50_000,
      expiresAt: addCalendarMonths(new Date(), 24),
      balanceAfter: 50_000,
      description: "z1 seed",
    },
  });

  const product = await prisma.product.create({
    data: {
      name: `Z1 Dress ${stamp}`,
      slug: `z1-dress-${stamp}`,
      description: "test",
      category: ProductCategory.FORMAL,
      type: ProductType.RTW,
      priceNGN: 80_000,
      basePriceNGN: 80_000,
      isPublished: true,
    },
  });
  const variant = await prisma.productVariant.create({
    data: { productId: product.id, size: "12", priceNGN: 80_000, stock: 3 },
  });
  const cart = await prisma.cartItem.create({
    data: {
      userId: user.id,
      productId: product.id,
      variantId: variant.id,
      quantity: 1,
      lineKey: `STANDARD:${variant.id}:none`,
    },
  });

  const coupon = await prisma.coupon.create({
    data: {
      code: `Z1${stamp.slice(-8).toUpperCase()}`,
      type: CouponType.FIXED_AMOUNT,
      value: 5_000,
      maxUsesTotal: 5,
      usedCount: 0,
      isActive: true,
    },
  });

  const order = await prisma.order.create({
    data: {
      orderNumber: `Z1-${stamp}`,
      userId: user.id,
      subtotal: 80_000,
      discount: 5_000,
      pointsDiscountNGN: 20_000,
      pointsUsed: 20_000,
      total: 55_000,
      couponId: coupon.id,
      couponCode: coupon.code,
      paymentStatus: PaymentStatus.PENDING,
      items: {
        create: {
          productId: product.id,
          variantId: variant.id,
          quantity: 1,
          size: "12",
          price: 80_000,
          lineTotal: 80_000,
        },
      },
    },
  });

  await prisma.$transaction(async (tx) => {
    await reserveCouponUsage(tx, {
      couponId: coupon.id,
      userId: user.id,
      email: user.email!,
      orderId: order.id,
    });
    await reservePoints(user.id, 20_000, order.id, tx, 1);
  });

  const afterReserve = await prisma.user.findUnique({ where: { id: user.id }, select: { pointsBalance: true } });
  assert(afterReserve?.pointsBalance === 30_000, `reserve holds 20k, got ${afterReserve?.pointsBalance}`);
  const couponHeld = await prisma.coupon.findUnique({ where: { id: coupon.id } });
  assert(couponHeld?.usedCount === 1, "coupon usedCount includes the hold");
  const usage = await prisma.couponUsage.findUnique({ where: { orderId: order.id } });
  assert(usage?.status === CouponUsageStatus.PENDING, "coupon usage is pending, not committed");
  const reservedRow = await prisma.pointsTransaction.findFirst({
    where: { orderId: order.id, type: PointsType.RESERVED },
  });
  assert(reservedRow?.amount === -20_000, "reservation is an append-only debit");
  const bagStill = await prisma.cartItem.findUnique({ where: { id: cart.id } });
  assert(bagStill != null, "logged-in bag is not emptied at order create");

  await markRtwOrderPaymentFailed(order.id);

  const afterFail = await prisma.user.findUnique({ where: { id: user.id }, select: { pointsBalance: true } });
  assert(afterFail?.pointsBalance === 50_000, `failed card restores points, got ${afterFail?.pointsBalance}`);
  const couponAfterFail = await prisma.coupon.findUnique({ where: { id: coupon.id } });
  assert(couponAfterFail?.usedCount === 0, `failed card restores coupon slot, got ${couponAfterFail?.usedCount}`);
  const usageAfter = await prisma.couponUsage.findUnique({ where: { orderId: order.id } });
  assert(usageAfter?.status === CouponUsageStatus.RELEASED, "failed card releases the coupon hold");
  const returned = await prisma.pointsTransaction.findFirst({
    where: { orderId: order.id, type: PointsType.RETURNED },
  });
  assert(returned?.amount === 20_000, "return is a new row, original RESERVED is unchanged");
  assert(reservedRow && reservedRow.amount === -20_000, "RESERVED row is not edited");
  const bagAfterFail = await prisma.cartItem.findUnique({ where: { id: cart.id } });
  assert(bagAfterFail != null, "failed card leaves the bag intact");
  const again = await returnRedeemedPoints(order.id);
  assert(again === 0, "release is idempotent");

  const order2 = await prisma.order.create({
    data: {
      orderNumber: `Z1B-${stamp}`,
      userId: user.id,
      subtotal: 80_000,
      discount: 5_000,
      pointsDiscountNGN: 10_000,
      pointsUsed: 10_000,
      total: 65_000,
      couponId: coupon.id,
      couponCode: coupon.code,
      paymentStatus: PaymentStatus.PENDING,
      items: {
        create: {
          productId: product.id,
          variantId: variant.id,
          quantity: 1,
          size: "12",
          price: 80_000,
          lineTotal: 80_000,
        },
      },
    },
  });
  await prisma.$transaction(async (tx) => {
    await reserveCouponUsage(tx, {
      couponId: coupon.id,
      userId: user.id,
      email: user.email!,
      orderId: order2.id,
    });
    await reservePoints(user.id, 10_000, order2.id, tx, 1);
  });
  await prisma.order.update({
    where: { id: order2.id },
    data: { paymentStatus: PaymentStatus.PAID },
  });
  await commitPaidCheckoutReservations({
    orderId: order2.id,
    userId: user.id,
    guestEmail: user.email,
    pointsUsed: 10_000,
    pointsDiscountNGN: 10_000,
    orderNumber: order2.orderNumber,
    createPointsPayment: true,
    clearCart: true,
  });
  const committed = await prisma.couponUsage.findUnique({ where: { orderId: order2.id } });
  assert(committed?.status === CouponUsageStatus.COMMITTED, "payment confirm commits the coupon");
  const bagGone = await prisma.cartItem.findUnique({ where: { id: cart.id } });
  assert(bagGone == null, "bag clears only once payment confirms");
  const pointsPay = await prisma.payment.findFirst({
    where: { orderId: order2.id, purpose: "POINTS_REDEMPTION" },
  });
  assert(pointsPay != null, "points ledger row is written at confirm, not at create");
  await releaseCouponUsage(prisma, order2.id);
  const stillCommitted = await prisma.couponUsage.findUnique({ where: { orderId: order2.id } });
  assert(stillCommitted?.status === CouponUsageStatus.COMMITTED, "committed coupon is not released on a later fail call");

  const stale = await prisma.order.create({
    data: {
      orderNumber: `Z1S-${stamp}`,
      userId: user.id,
      subtotal: 80_000,
      total: 80_000,
      paymentStatus: PaymentStatus.PENDING,
      paymentGateway: "PAYSTACK",
      createdAt: new Date(Date.now() - PSP_RESERVATION_TTL_MS - 5_000),
      items: {
        create: {
          productId: product.id,
          variantId: variant.id,
          quantity: 1,
          size: "12",
          price: 80_000,
          lineTotal: 80_000,
        },
      },
    },
  });
  await prisma.$transaction(async (tx) => {
    await reservePoints(user.id, 5_000, stale.id, tx, 1);
  });
  const beforeExpire = await prisma.user.findUnique({ where: { id: user.id }, select: { pointsBalance: true } });
  await expireStaleCheckoutReservations(prisma, new Date(), 50);
  const staleRow = await prisma.order.findUnique({ where: { id: stale.id }, select: { paymentStatus: true } });
  assert(staleRow?.paymentStatus === PaymentStatus.FAILED, "cron marks a stale pending order failed");
  const afterExpire = await prisma.user.findUnique({ where: { id: user.id }, select: { pointsBalance: true } });
  assert(
    afterExpire != null && beforeExpire != null && afterExpire.pointsBalance === beforeExpire.pointsBalance + 5_000,
    "stale reservation returns the points",
  );

  const oversell = await prisma.order.create({
    data: {
      orderNumber: `Z1O-${stamp}`,
      userId: user.id,
      subtotal: 80_000,
      total: 80_000,
      paymentStatus: PaymentStatus.PAID,
      status: "CANCELLED",
      adminNotes: FULFILMENT_STOCK_REFUSE_NOTE,
      items: {
        create: {
          productId: product.id,
          variantId: variant.id,
          quantity: 1,
          size: "12",
          price: 80_000,
          lineTotal: 80_000,
        },
      },
    },
  });
  const queued = await listRefundRequiredOrders();
  assert(
    queued.some((o) => o.id === oversell.id),
    "oversell paid+cancelled sits on the refund-required queue",
  );
  await prisma.order.update({
    where: { id: oversell.id },
    data: {
      refundRecordedAt: new Date(),
      refundRecordedById: user.id,
      refundRecordedByName: "Ada · ada@atelier.test",
      refundRecordedAmountNGN: 80_000,
    },
  });
  const afterRecord = await listRefundRequiredOrders();
  assert(
    afterRecord.every((o) => o.id !== oversell.id),
    "recording who issued the refund removes it from the queue",
  );

  const staleActor = await prisma.order.create({
    data: {
      orderNumber: `Z1A-${stamp}`,
      userId: user.id,
      guestEmail: user.email,
      subtotal: 80_000,
      total: 80_000,
      paymentStatus: PaymentStatus.PENDING,
      paymentGateway: "PAYSTACK",
      createdAt: new Date(Date.now() - PSP_RESERVATION_TTL_MS - 5_000),
      items: {
        create: {
          productId: product.id,
          variantId: variant.id,
          quantity: 1,
          size: "12",
          price: 80_000,
          lineTotal: 80_000,
        },
      },
    },
  });
  await prisma.$transaction(async (tx) => {
    await reservePoints(user.id, 4_000, staleActor.id, tx, 1);
  });
  const beforeActor = await prisma.user.findUnique({ where: { id: user.id }, select: { pointsBalance: true } });
  const actorReleased = await expireStaleCheckoutReservationsForActor(
    { userId: user.id, email: user.email },
    prisma,
    new Date(),
  );
  assert(actorReleased >= 1, "redemption-time expiry releases this customer's stale hold");
  const afterActor = await prisma.user.findUnique({ where: { id: user.id }, select: { pointsBalance: true } });
  assert(
    afterActor != null && beforeActor != null && afterActor.pointsBalance === beforeActor.pointsBalance + 4_000,
    "stale hold returns at the next checkout, not only when cron runs",
  );

  const retryOrder = await prisma.order.create({
    data: {
      orderNumber: `Z1R-${stamp}`,
      userId: user.id,
      guestEmail: user.email,
      subtotal: 80_000,
      discount: 5_000,
      pointsDiscountNGN: 8_000,
      pointsUsed: 8_000,
      total: 75_000,
      couponId: coupon.id,
      couponCode: coupon.code,
      paymentStatus: PaymentStatus.PENDING,
      items: {
        create: {
          productId: product.id,
          variantId: variant.id,
          quantity: 1,
          size: "12",
          price: 80_000,
          lineTotal: 80_000,
        },
      },
    },
  });
  await prisma.$transaction(async (tx) => {
    await reserveCouponUsage(tx, {
      couponId: coupon.id,
      userId: user.id,
      email: user.email!,
      orderId: retryOrder.id,
    });
    await reservePoints(user.id, 8_000, retryOrder.id, tx, 1);
  });
  await markRtwOrderPaymentFailed(retryOrder.id);
  const afterDecline = await prisma.user.findUnique({ where: { id: user.id }, select: { pointsBalance: true } });
  const prep = await prepareRtwPaymentAttempt(retryOrder.id);
  assert(!prep.error, `retry after decline re-holds, got ${prep.error ?? ""}`);
  const retried = await prisma.order.findUnique({
    where: { id: retryOrder.id },
    select: { paymentStatus: true },
  });
  assert(retried?.paymentStatus === PaymentStatus.PENDING, "retry flips the failed order back to pending");
  const afterPrep = await prisma.user.findUnique({ where: { id: user.id }, select: { pointsBalance: true } });
  assert(
    afterDecline != null && afterPrep != null && afterPrep.pointsBalance === afterDecline.pointsBalance - 8_000,
    "retry does not let her keep the points while paying the discounted total",
  );
  const couponRetry = await prisma.couponUsage.findUnique({ where: { orderId: retryOrder.id } });
  assert(couponRetry?.status === CouponUsageStatus.PENDING, "retry re-holds the coupon");
  await markRtwOrderPaymentFailed(retryOrder.id);
  const afterSecondFail = await prisma.user.findUnique({ where: { id: user.id }, select: { pointsBalance: true } });
  assert(
    afterDecline != null && afterSecondFail != null && afterSecondFail.pointsBalance === afterDecline.pointsBalance,
    "a second decline still returns the re-held points (net, not a one-shot return)",
  );

  const clutter = await prisma.order.create({
    data: {
      orderNumber: `Z1C-${stamp}`,
      userId: user.id,
      subtotal: 1,
      total: 1,
      paymentStatus: PaymentStatus.FAILED,
      createdAt: new Date(Date.now() - PSP_RESERVATION_TTL_MS * 3),
    },
  });
  const heldStale = await prisma.order.create({
    data: {
      orderNumber: `Z1H-${stamp}`,
      userId: user.id,
      subtotal: 80_000,
      total: 80_000,
      paymentStatus: PaymentStatus.PENDING,
      paymentGateway: "PAYSTACK",
      createdAt: new Date(Date.now() - PSP_RESERVATION_TTL_MS - 5_000),
      items: {
        create: {
          productId: product.id,
          variantId: variant.id,
          quantity: 1,
          size: "12",
          price: 80_000,
          lineTotal: 80_000,
        },
      },
    },
  });
  await prisma.$transaction(async (tx) => {
    await reservePoints(user.id, 3_000, heldStale.id, tx, 1);
  });
  const beforeClutter = await prisma.user.findUnique({ where: { id: user.id }, select: { pointsBalance: true } });
  await expireStaleCheckoutReservations(prisma, new Date(), 50);
  const afterClutter = await prisma.user.findUnique({ where: { id: user.id }, select: { pointsBalance: true } });
  assert(
    afterClutter != null &&
      beforeClutter != null &&
      afterClutter.pointsBalance === beforeClutter.pointsBalance + 3_000,
    "old failed orders without holds do not hide a stale points reservation from the sweep",
  );

  const orderIds = [
    order.id,
    order2.id,
    stale.id,
    oversell.id,
    staleActor.id,
    retryOrder.id,
    clutter.id,
    heldStale.id,
  ];
  await prisma.couponUsage.deleteMany({ where: { couponId: coupon.id } });
  await prisma.pointsTransaction.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.cartItem.deleteMany({ where: { userId: user.id } });
  await prisma.order.deleteMany({
    where: { id: { in: orderIds.filter((id) => id !== order2.id) } },
  });
  await prisma.pointsTransaction.deleteMany({ where: { userId: user.id, orderId: null } });
}

async function main() {
  runPure();
  try {
    await runDb();
  } finally {
    await prisma.$disconnect();
  }
  console.log("test-slice-z1: ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
