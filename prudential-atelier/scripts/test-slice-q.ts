/**
 * Slice Q: pay with Prudent Points.
 *
 *   pnpm test:slice-q
 */
import "./preload-test-env";
import { PaymentGateway, PaymentStatus, PointsType, Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import {
  assertPspChargeBinds,
  expectedAmountInPspUnits,
  PaymentBindError,
} from "../src/lib/payment-bind";
import { rtwChargeAmountForeign, rtwChargeAmountNGN } from "../src/lib/payments/rtw-totals";
import {
  addCalendarMonths,
  awardPurchasePoints,
  awardReferralPoints,
  clampRedemption,
  emailRoot,
  expireOverduePoints,
  InsufficientPointsError,
  purchasePointsFromSpend,
  redeemPoints,
  returnRedeemedPoints,
} from "../src/lib/points";
import { birthdayMatches } from "../src/lib/cron/jobs/prudent-points";
import type { LockedFx } from "../src/lib/fx";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const fx: LockedFx = {
  rate: 0.00065,
  gbpRate: 0.00052,
  source: "test",
  fetchedAt: new Date(),
  stale: false,
};

function runPure() {
  const shipping = clampRedemption({
    requested: 200_000,
    availablePoints: 200_000,
    subtotalNGN: 100_000,
    discountNGN: 0,
    rateNGN: 1,
    minRedemption: 100,
  });
  assert(shipping.points === 100_000, `points must not cover shipping, got ${shipping.points}`);
  assert(shipping.valueNGN === 100_000, "redeemed value is garment only");

  const withCoupon = clampRedemption({
    requested: 90_000,
    availablePoints: 90_000,
    subtotalNGN: 100_000,
    discountNGN: 20_000,
    rateNGN: 1,
    minRedemption: 100,
  });
  assert(withCoupon.points === 80_000, "points apply after coupon, still not over garment");

  const belowMin = clampRedemption({
    requested: 40,
    availablePoints: 40,
    subtotalNGN: 100_000,
    discountNGN: 0,
    rateNGN: 1,
    minRedemption: 5_000,
  });
  assert(belowMin.points === 0, "below minimum redemption is refused");

  assert(purchasePointsFromSpend(250_000, 1) === 25_000, "1 point per ₦10 of cash spend");
  assert(purchasePointsFromSpend(0, 1) === 0, "a fully-points order earns nothing");
  assert(purchasePointsFromSpend(90_000, 1) === 9_000, "earn is on amount spent, not item count");

  const doubled = clampRedemption({
    requested: 50_000,
    availablePoints: 50_000,
    subtotalNGN: 100_000,
    discountNGN: 0,
    rateNGN: 2,
    minRedemption: 100,
  });
  assert(doubled.valueNGN === 100_000, "value uses the locked rate");
  assert(doubled.points === 50_000, "50k points at ₦2 = ₦100k garment");

  assert(emailRoot("a+spam@gmail.com") === emailRoot("a@gmail.com"), "gmail plus-addressing collapses");
  assert(emailRoot("Ada.Eze@gmail.com") === emailRoot("adaeze@gmail.com"), "gmail dots collapse");

  const feb29 = new Date(Date.UTC(2000, 1, 29));
  const nonLeap = new Date(Date.UTC(2026, 1, 28));
  assert(birthdayMatches(feb29, nonLeap), "29 Feb awards on 28 Feb in a non-leap year");

  const pastOrder = { pointsUsed: 10_000, pointsRateLocked: 1, pointsDiscountNGN: 10_000 };
  const laterRate = 0.5;
  const historicValue = pastOrder.pointsUsed * pastOrder.pointsRateLocked;
  assert(historicValue === 10_000, "past order value is the locked rate");
  assert(historicValue !== pastOrder.pointsUsed * laterRate, "a later rate must not rewrite the order");

  const outstanding = rtwChargeAmountNGN({
    paymentStatus: PaymentStatus.PENDING,
    total: 145_000,
    amountPaid: 100_000,
    balance: 45_000,
  });
  assert(outstanding === 45_000, `bind expected 45000 after points, got ${outstanding}`);

  const firstUnpaid = rtwChargeAmountNGN({
    paymentStatus: PaymentStatus.PENDING,
    total: 145_000,
    amountPaid: 0,
    balance: 145_000,
  });
  assert(firstUnpaid === 145_000, "unpaid order still binds against full total");

  const heldNotLedgered = rtwChargeAmountNGN({
    paymentStatus: PaymentStatus.PENDING,
    total: 145_000,
    amountPaid: 0,
    balance: 145_000,
    pointsDiscountNGN: 100_000,
  });
  assert(heldNotLedgered === 45_000, `PSP charge after a points hold is 45000, got ${heldNotLedgered}`);

  const fullyPoints = rtwChargeAmountNGN({
    paymentStatus: PaymentStatus.PENDING,
    total: 100_000,
    amountPaid: 100_000,
    balance: 0,
  });
  assert(fullyPoints === 0, "fully-points order has nothing to send to a gateway");

  const foreign = rtwChargeAmountForeign(
    {
      paymentStatus: PaymentStatus.PENDING,
      total: 200_000,
      amountPaid: 50_000,
      pointsDiscountNGN: 50_000,
      fxUsdAmountLocked: 130,
    },
    "USD",
    fx,
  );
  assert(foreign === 97.5, `foreign charge should be locked $130 − $32.50, got ${foreign}`);

  const noLog = { log: false } as const;
  assertPspChargeBinds(
    {
      id: "order-pts",
      storedReference: "PA-REST",
      expectedAmount: expectedAmountInPspUnits(PaymentGateway.PAYSTACK, 45_000),
      expectedCurrency: "NGN",
    },
    {
      gateway: PaymentGateway.PAYSTACK,
      reference: "PA-REST",
      amount: 4_500_000,
      currency: "NGN",
      metadataEntityId: "order-pts",
    },
    noLog,
  );

  try {
    assertPspChargeBinds(
      {
        id: "order-pts",
        storedReference: "PA-REST",
        expectedAmount: expectedAmountInPspUnits(PaymentGateway.PAYSTACK, 45_000),
        expectedCurrency: "NGN",
      },
      {
        gateway: PaymentGateway.PAYSTACK,
        reference: "PA-REST",
        amount: 1_000,
        currency: "NGN",
        metadataEntityId: "order-pts",
      },
      noLog,
    );
    throw new Error("FAIL: underpay after points should mismatch");
  } catch (e) {
    assert(e instanceof PaymentBindError && e.code === "AMOUNT_MISMATCH", "underpay is AMOUNT_MISMATCH");
  }
}

async function runDb() {
  const stamp = `q-${Date.now()}`;
  const user = await prisma.user.create({
    data: {
      email: `${stamp}@sliceq.test`,
      name: "Slice Q",
      role: Role.CUSTOMER,
      pointsBalance: 1_000,
    },
  });

  try {
    await prisma.pointsTransaction.create({
      data: {
        userId: user.id,
        type: PointsType.ADJUSTED_ADMIN,
        amount: 1_000,
        remaining: 1_000,
        expiresAt: addCalendarMonths(new Date(), 24),
        balanceAfter: 1_000,
        description: "test seed",
      },
    });

    const [a, b] = await Promise.allSettled([
      prisma.$transaction((tx) => redeemPoints(user.id, 800, `order-a-${stamp}`, tx, 1)),
      prisma.$transaction((tx) => redeemPoints(user.id, 800, `order-b-${stamp}`, tx, 1)),
    ]);
    const wins = [a, b].filter((r) => r.status === "fulfilled").length;
    const losses = [a, b].filter((r) => r.status === "rejected").length;
    assert(wins === 1 && losses === 1, `concurrent redeem must allow one win, got wins=${wins} losses=${losses}`);
    if (losses === 1) {
      const rejected = [a, b].find((r) => r.status === "rejected") as PromiseRejectedResult;
      assert(
        rejected.reason instanceof InsufficientPointsError ||
          (rejected.reason instanceof Error && rejected.reason.message.includes("Insufficient")),
        "losing tab is insufficient points",
      );
    }

    const after = await prisma.user.findUnique({ where: { id: user.id }, select: { pointsBalance: true } });
    assert(after?.pointsBalance === 200, `balance after one 800-point spend should be 200, got ${after?.pointsBalance}`);

    const spent = await prisma.pointsTransaction.findFirst({
      where: { userId: user.id, type: PointsType.REDEEMED },
    });
    assert(spent && spent.amount === -800, "redeem writes a negative ledger row");
    const orderId = spent!.orderId!;

    const returned = await prisma.$transaction((tx) => returnRedeemedPoints(orderId, tx));
    assert(returned === 800, `cancel must return 800 points, got ${returned}`);
    const again = await prisma.$transaction((tx) => returnRedeemedPoints(orderId, tx));
    assert(again === 0, "return is idempotent");

    const restored = await prisma.user.findUnique({ where: { id: user.id }, select: { pointsBalance: true } });
    assert(restored?.pointsBalance === 1_000, `returned balance 1000, got ${restored?.pointsBalance}`);
    const returnRow = await prisma.pointsTransaction.findFirst({
      where: { userId: user.id, type: PointsType.RETURNED, orderId },
    });
    assert(returnRow?.amount === 800, "return is a new row, not an edit");
    assert(spent!.amount === -800, "original redeem row is unchanged");

    const fullyPts = await awardPurchasePoints(user.id, 250_000, `ord-full-${stamp}`, undefined, 250_000);
    assert(fullyPts === 0, "a fully-points order earns nothing");

    await awardReferralPoints(user.id, user.id, prisma);
    const signupRefs = await prisma.pointsTransaction.count({
      where: { userId: user.id, type: PointsType.EARNED_REFERRAL },
    });
    assert(signupRefs === 0, "referral points do not pay on signup");

    const cashEarn = await awardPurchasePoints(user.id, 10_000, `ord-cash-${stamp}`, undefined, 0);
    assert(cashEarn === 1_000, `₦10,000 spent earns 1,000 points, got ${cashEarn}`);

    const u2 = await prisma.user.create({
      data: { email: `${stamp}-exp@sliceq.test`, name: "Slice Q exp", role: Role.CUSTOMER, pointsBalance: 5_000 },
    });
    await prisma.pointsTransaction.create({
      data: {
        userId: u2.id,
        type: PointsType.ADJUSTED_ADMIN,
        amount: 5_000,
        remaining: 5_000,
        expiresAt: addCalendarMonths(new Date(), 24),
        balanceAfter: 5_000,
        description: "expiry seed",
      },
    });
    await prisma.$transaction((tx) => redeemPoints(u2.id, 5_000, `ord-exp-${stamp}`, tx, 1));
    await prisma.pointsTransaction.updateMany({
      where: { userId: u2.id, type: PointsType.REDEEMED },
      data: { createdAt: addCalendarMonths(new Date(), -25) },
    });
    const lateReturn = await prisma.$transaction((tx) => returnRedeemedPoints(`ord-exp-${stamp}`, tx));
    assert(lateReturn === 5_000, "return after expiry still restores the points");
    const lateRow = await prisma.pointsTransaction.findFirst({
      where: { userId: u2.id, type: PointsType.RETURNED },
    });
    assert(lateRow?.description.includes("after original expiry"), "fresh 24 months is noted on the row");
    assert(lateRow?.expiresAt && lateRow.expiresAt.getTime() > Date.now(), "returned points have a new expiry");

    await prisma.pointsTransaction.updateMany({
      where: { userId: u2.id, remaining: { gt: 0 } },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    const expired = await expireOverduePoints(prisma, new Date(), u2.id);
    assert(expired === 5_000, `expiry writes off remaining, got ${expired}`);
    const expiredRow = await prisma.pointsTransaction.findFirst({
      where: { userId: u2.id, type: PointsType.EXPIRED },
    });
    assert(expiredRow && expiredRow.amount === -5_000, "expiry is a new row");

    await prisma.pointsTransaction.deleteMany({ where: { userId: u2.id } });
    await prisma.user.delete({ where: { id: u2.id } }).catch(() => undefined);
  } finally {
    await prisma.pointsTransaction.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
  }
}

async function main() {
  runPure();
  await runDb();
  console.log("test-slice-q: ok");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
