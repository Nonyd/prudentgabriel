import type { Prisma, PrismaClient } from "@prisma/client";
import { PaymentMethod, PaymentPurpose, PaymentStatus, PointsType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClientNotification } from "@/lib/customer-notifications";
import { sendLoyaltyTierUpgradeEmail, sendReferralRewardEmail } from "@/lib/email";
import { getLoyaltyRulePoints, getTierPerks, getTierThresholds, tierFromPoints, TIER_LABELS } from "@/lib/loyalty";
import { getSetting } from "@/lib/settings";
import {
  addCalendarMonths,
  cashSpendNGN,
  DEFAULT_EXPIRY_MONTHS,
  DEFAULT_MIN_REDEMPTION,
  DEFAULT_POINT_RATE_NGN,
  emailRoot,
  LOYALTY_ACTIONS,
  phonesMatch,
  pointsToNaira,
  purchasePointsFromSpend,
  SETTING_KEYS,
} from "@/lib/points-value";

export {
  addCalendarMonths,
  cashSpendNGN,
  clampRedemption,
  DEFAULT_EXPIRY_MONTHS,
  DEFAULT_MIN_REDEMPTION,
  DEFAULT_POINT_RATE_NGN,
  emailRoot,
  garmentEligibleNGN,
  LOYALTY_ACTIONS,
  maxRedeemablePoints,
  nairaToPoints,
  phonesMatch,
  pointsToNaira,
  PRUDENT_POINTS_COPY,
  purchasePointsFromSpend,
  SETTING_KEYS,
} from "@/lib/points-value";

type PointsDb = Prisma.TransactionClient | PrismaClient;

export class InsufficientPointsError extends Error {
  constructor() {
    super("Insufficient points");
    this.name = "InsufficientPointsError";
  }
}

export async function getPointRateNGN(): Promise<number> {
  const raw = (await getSetting(SETTING_KEYS.rateNGN)) ?? (await getSetting(SETTING_KEYS.rateNGNLegacy));
  const n = raw != null ? Number.parseFloat(raw) : DEFAULT_POINT_RATE_NGN;
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_POINT_RATE_NGN;
  return n;
}

export async function getMinRedemptionPoints(): Promise<number> {
  const raw =
    (await getSetting(SETTING_KEYS.minRedemption)) ?? (await getSetting(SETTING_KEYS.minRedemptionLegacy));
  const n = raw != null ? Number.parseInt(raw, 10) : DEFAULT_MIN_REDEMPTION;
  if (!Number.isFinite(n) || n < 0) return DEFAULT_MIN_REDEMPTION;
  return n;
}

export async function getExpiryMonths(): Promise<number> {
  const raw = await getSetting(SETTING_KEYS.expiryMonths);
  const n = raw != null ? Number.parseInt(raw, 10) : DEFAULT_EXPIRY_MONTHS;
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_EXPIRY_MONTHS;
  return n;
}

export function getPointsValue(points: number, rateNGN = DEFAULT_POINT_RATE_NGN): number {
  return pointsToNaira(points, rateNGN);
}

export async function derivedPointsBalance(userId: string, db: PointsDb = prisma): Promise<number> {
  const agg = await db.pointsTransaction.aggregate({
    where: { userId },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? 0;
}

export async function outstandingPointsTotal(db: PointsDb = prisma): Promise<number> {
  const agg = await db.user.aggregate({
    _sum: { pointsBalance: true },
  });
  return agg._sum.pointsBalance ?? 0;
}

async function syncLoyaltyCaches(userId: string, newBalance: number, db: PointsDb): Promise<void> {
  await db.clientProfile.updateMany({
    where: { userId },
    data: { loyaltyPoints: newBalance },
  });
  await maybeUpgradeLoyaltyTier(userId, newBalance, db);
}

async function maybeUpgradeLoyaltyTier(userId: string, newPointsBalance: number, db: PointsDb): Promise<void> {
  const profile = await db.clientProfile.findUnique({
    where: { userId },
    select: { loyaltyTier: true },
  });
  if (!profile) return;

  const thresholds = await getTierThresholds();
  const oldTier = profile.loyaltyTier;
  const newTier = tierFromPoints(newPointsBalance, thresholds);
  if (newTier === oldTier) return;

  await db.clientProfile.update({
    where: { userId },
    data: { loyaltyTier: newTier, loyaltyPoints: newPointsBalance },
  });

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });
  if (!user?.email) return;

  const firstName = user.name?.split(" ")[0] ?? "there";
  const perks = getTierPerks(newTier);

  void sendLoyaltyTierUpgradeEmail({
    to: user.email,
    firstName,
    newTier,
    perks,
  }).catch(() => {});

  void createClientNotification({
    userId,
    type: "LOYALTY_TIER_UPGRADE",
    title: `You've reached ${TIER_LABELS[newTier]} status!`,
    message: `Congratulations — you are now a ${TIER_LABELS[newTier]} member.`,
    link: "/account/loyalty",
  }).catch(() => {});
}

/** Conditional increment. The only writer of User.pointsBalance besides redeem/adjust/expire. */
async function creditPoints(
  db: PointsDb,
  params: {
    userId: string;
    amount: number;
    type: PointsType;
    description: string;
    orderId?: string | null;
    rateNGN?: number | null;
    expiresAt?: Date | null;
  },
): Promise<number> {
  if (params.amount <= 0) return 0;

  const months = await getExpiryMonths();
  const expiresAt = params.expiresAt === undefined ? addCalendarMonths(new Date(), months) : params.expiresAt;

  const updated = await db.user.update({
    where: { id: params.userId },
    data: { pointsBalance: { increment: params.amount } },
    select: { pointsBalance: true },
  });

  await db.pointsTransaction.create({
    data: {
      userId: params.userId,
      type: params.type,
      amount: params.amount,
      remaining: params.amount,
      balanceAfter: updated.pointsBalance,
      description: params.description,
      orderId: params.orderId ?? null,
      rateNGN: params.rateNGN ?? null,
      expiresAt,
    },
  });

  await syncLoyaltyCaches(params.userId, updated.pointsBalance, db);
  return params.amount;
}

async function consumeUnexpiredRemaining(db: PointsDb, userId: string, points: number, now: Date): Promise<void> {
  const credits = await db.pointsTransaction.findMany({
    where: {
      userId,
      remaining: { gt: 0 },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: [{ expiresAt: "asc" }, { createdAt: "asc" }],
  });
  let left = points;
  for (const row of credits) {
    if (left <= 0) break;
    const take = Math.min(row.remaining, left);
    await db.pointsTransaction.update({
      where: { id: row.id },
      data: { remaining: { decrement: take } },
    });
    left -= take;
  }
}

export async function expireOverduePoints(db: PointsDb = prisma, now = new Date(), userId?: string): Promise<number> {
  const due = await db.pointsTransaction.findMany({
    where: {
      remaining: { gt: 0 },
      expiresAt: { lte: now },
      ...(userId ? { userId } : {}),
    },
    take: 200,
    orderBy: { expiresAt: "asc" },
  });
  let expired = 0;
  for (const row of due) {
    const pts = row.remaining;
    await db.pointsTransaction.update({
      where: { id: row.id },
      data: { remaining: 0 },
    });
    const spent = await db.user.updateMany({
      where: { id: row.userId, pointsBalance: { gte: pts } },
      data: { pointsBalance: { decrement: pts } },
    });
    if (spent.count !== 1) {
      await db.user.update({
        where: { id: row.userId },
        data: { pointsBalance: 0 },
      });
    }
    const after = await db.user.findUnique({
      where: { id: row.userId },
      select: { pointsBalance: true },
    });
    const balanceAfter = after?.pointsBalance ?? 0;
    await db.pointsTransaction.create({
      data: {
        userId: row.userId,
        type: PointsType.EXPIRED,
        amount: -pts,
        remaining: 0,
        balanceAfter,
        description: `Prudent Points expired (award ${row.id})`,
        orderId: row.orderId,
      },
    });
    await syncLoyaltyCaches(row.userId, balanceAfter, db);
    expired += pts;
  }
  return expired;
}

/**
 * Atomic spend. Fails when the cached balance is insufficient — two tabs cannot
 * spend the same points twice (Slice G stock idiom: updateMany where balance >= n).
 */
export async function redeemPoints(
  userId: string,
  pointsToRedeem: number,
  orderId: string,
  db: PointsDb = prisma,
  rateNGN?: number,
): Promise<void> {
  if (pointsToRedeem <= 0) return;

  const now = new Date();
  await expireOverduePoints(db, now, userId);

  const rate = rateNGN ?? (await getPointRateNGN());
  const spent = await db.user.updateMany({
    where: { id: userId, pointsBalance: { gte: pointsToRedeem } },
    data: { pointsBalance: { decrement: pointsToRedeem } },
  });
  if (spent.count !== 1) {
    throw new InsufficientPointsError();
  }

  await consumeUnexpiredRemaining(db, userId, pointsToRedeem, now);

  const after = await db.user.findUnique({
    where: { id: userId },
    select: { pointsBalance: true },
  });
  const balanceAfter = after?.pointsBalance ?? 0;

  await db.pointsTransaction.create({
    data: {
      userId,
      type: PointsType.REDEEMED,
      amount: -pointsToRedeem,
      remaining: 0,
      balanceAfter,
      description: "Prudent Points redeemed at checkout",
      orderId,
      rateNGN: rate,
    },
  });

  await syncLoyaltyCaches(userId, balanceAfter, db);
}

/** Append-only return. Never edits the original REDEEMED row. */
export async function returnRedeemedPoints(
  orderId: string,
  db: PointsDb = prisma,
): Promise<number> {
  const existingReturn = await db.pointsTransaction.findFirst({
    where: { orderId, type: PointsType.RETURNED },
    select: { id: true },
  });
  if (existingReturn) return 0;

  const redeemed = await db.pointsTransaction.findMany({
    where: { orderId, type: PointsType.REDEEMED },
  });
  if (redeemed.length === 0) return 0;

  let returned = 0;
  const months = await getExpiryMonths();
  const now = new Date();
  const freshExpiry = addCalendarMonths(now, months);
  for (const row of redeemed) {
    const pts = Math.abs(row.amount);
    if (pts <= 0 || !row.userId) continue;
    const originalWindow = addCalendarMonths(row.createdAt, months);
    const afterOriginalExpiry = originalWindow.getTime() <= now.getTime();
    await creditPoints(db, {
      userId: row.userId,
      amount: pts,
      type: PointsType.RETURNED,
      description: afterOriginalExpiry
        ? "Prudent Points returned after original expiry — new 24 months from today"
        : "Prudent Points returned — order did not complete",
      orderId,
      rateNGN: row.rateNGN,
      expiresAt: freshExpiry,
    });
    returned += pts;
  }
  return returned;
}

export async function adjustPointsAdmin(params: {
  userId: string;
  delta: number;
  reason: string;
  db?: PointsDb;
}): Promise<number> {
  const db = params.db ?? prisma;
  const reason = params.reason.trim();
  if (!reason) throw new Error("A reason is required");
  if (params.delta === 0) throw new Error("Amount must be non-zero");

  if (params.delta > 0) {
    await creditPoints(db, {
      userId: params.userId,
      amount: params.delta,
      type: PointsType.ADJUSTED_ADMIN,
      description: reason,
    });
  } else {
    const deduct = Math.abs(params.delta);
    const now = new Date();
    await expireOverduePoints(db, now, params.userId);
    const spent = await db.user.updateMany({
      where: { id: params.userId, pointsBalance: { gte: deduct } },
      data: { pointsBalance: { decrement: deduct } },
    });
    if (spent.count !== 1) {
      throw new InsufficientPointsError();
    }
    await consumeUnexpiredRemaining(db, params.userId, deduct, now);
    const after = await db.user.findUnique({
      where: { id: params.userId },
      select: { pointsBalance: true },
    });
    await db.pointsTransaction.create({
      data: {
        userId: params.userId,
        type: PointsType.ADJUSTED_ADMIN,
        amount: -deduct,
        remaining: 0,
        balanceAfter: after?.pointsBalance ?? 0,
        description: reason,
      },
    });
    await syncLoyaltyCaches(params.userId, after?.pointsBalance ?? 0, db);
  }

  const user = await db.user.findUnique({
    where: { id: params.userId },
    select: { pointsBalance: true },
  });
  return user?.pointsBalance ?? 0;
}

export async function awardSignupPoints(userId: string, db: PointsDb = prisma): Promise<number> {
  const points = await getLoyaltyRulePoints(LOYALTY_ACTIONS.SIGNUP);
  if (points <= 0) return 0;
  return creditPoints(db, {
    userId,
    amount: points,
    type: PointsType.EARNED_SIGNUP,
    description: "Welcome Prudent Points",
  });
}

async function runAwardPurchase(client: PointsDb, userId: string, points: number, orderId: string, cashNGN: number) {
  if (points > 0) {
    await creditPoints(client, {
      userId,
      amount: points,
      type: PointsType.EARNED_PURCHASE,
      description: `Prudent Points — ₦${Math.round(cashNGN).toLocaleString("en-NG")} spent on this order`,
      orderId,
    });
  }
  await awardReferralFirstPurchaseReward(userId, orderId, client);
}

export async function awardPurchasePoints(
  userId: string,
  garmentNGN: number,
  orderId: string,
  db?: PointsDb,
  pointsDiscountNGN = 0,
): Promise<number> {
  const existing = await (db ?? prisma).pointsTransaction.findFirst({
    where: { orderId, userId, type: PointsType.EARNED_PURCHASE },
    select: { id: true, amount: true },
  });
  if (existing) {
    await awardReferralFirstPurchaseReward(userId, orderId, db ?? prisma);
    return existing.amount;
  }

  const perTen = await getLoyaltyRulePoints(LOYALTY_ACTIONS.PURCHASE_PER_10);
  const cashNGN = cashSpendNGN(garmentNGN, pointsDiscountNGN);
  const points = purchasePointsFromSpend(cashNGN, perTen);

  if (db) {
    await runAwardPurchase(db, userId, points, orderId, cashNGN);
  } else {
    await prisma.$transaction(async (tx) => {
      await runAwardPurchase(tx, userId, points, orderId, cashNGN);
    });
  }
  return points;
}

export async function awardReviewPoints(
  userId: string,
  points: number,
  productId: string,
  db: PointsDb = prisma,
): Promise<number> {
  const fromRule = await getLoyaltyRulePoints(LOYALTY_ACTIONS.REVIEW);
  const award = points > 0 ? points : fromRule;
  if (award <= 0) return 0;
  return creditPoints(db, {
    userId,
    amount: award,
    type: PointsType.EARNED_REVIEW,
    description: `Prudent Points for a verified product review (${productId})`,
  });
}

async function awardOnce(params: {
  userId: string;
  type: PointsType;
  action: string;
  description: string;
  yearKey?: string;
  db?: PointsDb;
}): Promise<number> {
  const db = params.db ?? prisma;
  const existing = await db.pointsTransaction.findFirst({
    where: {
      userId: params.userId,
      type: params.type,
      ...(params.yearKey ? { description: { contains: params.yearKey } } : {}),
    },
    select: { id: true },
  });
  if (existing) return 0;
  const points = await getLoyaltyRulePoints(params.action);
  if (points <= 0) return 0;
  return creditPoints(db, {
    userId: params.userId,
    amount: points,
    type: params.type,
    description: params.description,
  });
}

export async function awardNewsletterPoints(userId: string, db: PointsDb = prisma): Promise<number> {
  return awardOnce({
    userId,
    type: PointsType.EARNED_NEWSLETTER,
    action: LOYALTY_ACTIONS.NEWSLETTER,
    description: "Prudent Points — newsletter signup",
    db,
  });
}

export async function awardStyleProfilePoints(userId: string, db: PointsDb = prisma): Promise<number> {
  return awardOnce({
    userId,
    type: PointsType.EARNED_PROFILE,
    action: LOYALTY_ACTIONS.STYLE_PROFILE,
    description: "Prudent Points — style profile completed",
    db,
  });
}

export async function awardBirthdayPoints(userId: string, year: number, db: PointsDb = prisma): Promise<number> {
  return awardOnce({
    userId,
    type: PointsType.EARNED_BIRTHDAY,
    action: LOYALTY_ACTIONS.BIRTHDAY,
    description: `Prudent Points — birthday ${year}`,
    yearKey: `birthday ${year}`,
    db,
  });
}

/**
 * Referral points only after the referred person completes a first paid order.
 * Blocks self-referral (email root, phone, referrer with no paid order of their own).
 */
export async function awardReferralFirstPurchaseReward(
  buyerUserId: string,
  orderId: string,
  db: PointsDb = prisma,
): Promise<void> {
  const buyer = await db.user.findUnique({
    where: { id: buyerUserId },
    select: { referredById: true, email: true, phone: true },
  });
  if (!buyer?.referredById) return;

  const referrerId = buyer.referredById;
  if (referrerId === buyerUserId) return;

  const priorPaidCount = await db.order.count({
    where: {
      userId: buyerUserId,
      paymentStatus: "PAID",
      id: { not: orderId },
    },
  });
  if (priorPaidCount > 0) return;

  const rewardKey = `first purchase (${buyerUserId})`;
  const existing = await db.pointsTransaction.findFirst({
    where: {
      userId: referrerId,
      type: PointsType.EARNED_REFERRAL,
      description: { contains: rewardKey },
    },
  });
  if (existing) return;

  const referrer = await db.user.findUnique({
    where: { id: referrerId },
    select: { email: true, phone: true, name: true },
  });
  if (!referrer) return;

  if (buyer.email && referrer.email && emailRoot(buyer.email) === emailRoot(referrer.email)) return;
  if (phonesMatch(buyer.phone, referrer.phone)) return;

  const referrerHasPaidOrder = await db.order.count({
    where: { userId: referrerId, paymentStatus: "PAID" },
  });
  if (referrerHasPaidOrder === 0) return;

  const sameInstrument = await samePaymentInstrument(referrerId, buyerUserId, orderId, db);
  if (sameInstrument) return;

  const points = await getLoyaltyRulePoints(LOYALTY_ACTIONS.REFERRAL_FIRST_ORDER);
  if (points <= 0) return;

  const rate = await getPointRateNGN();
  await creditPoints(db, {
    userId: referrerId,
    amount: points,
    type: PointsType.EARNED_REFERRAL,
    description: `Referral reward — friend's first purchase (${buyerUserId})`,
    orderId,
    rateNGN: rate,
  });

  const referrerAfter = await db.user.findUnique({
    where: { id: referrerId },
    select: { pointsBalance: true, email: true, name: true },
  });

  const creditNGN = pointsToNaira(points, rate);
  if (referrerAfter?.email) {
    const firstName = referrerAfter.name?.split(" ")[0] ?? "there";
    void sendReferralRewardEmail({
      to: referrerAfter.email,
      firstName,
      creditNGN,
      orderId,
    }).catch(() => {});
  }

  void createClientNotification({
    userId: referrerId,
    type: "REFERRAL_REWARD",
    title: "Referral reward earned!",
    message: `Your friend made their first purchase. ${points.toLocaleString()} Prudent Points added to your account.`,
    link: "/account/loyalty",
    entityId: orderId,
  }).catch(() => {});
}

async function samePaymentInstrument(
  referrerId: string,
  buyerId: string,
  buyerOrderId: string,
  db: PointsDb,
): Promise<boolean> {
  const [referrerPays, buyerPays] = await Promise.all([
    db.payment.findMany({
      where: { clientId: referrerId, status: PaymentStatus.CONFIRMED, method: { not: PaymentMethod.POINTS } },
      select: { gatewayPayload: true },
      take: 20,
    }),
    db.payment.findMany({
      where: {
        OR: [{ clientId: buyerId }, { orderId: buyerOrderId }],
        status: PaymentStatus.CONFIRMED,
        method: { not: PaymentMethod.POINTS },
      },
      select: { gatewayPayload: true },
      take: 10,
    }),
  ]);
  const refPrints = new Set(referrerPays.map(instrumentFingerprint).filter(Boolean));
  if (refPrints.size === 0) return false;
  return buyerPays.some((p) => {
    const fp = instrumentFingerprint(p);
    return Boolean(fp && refPrints.has(fp));
  });
}

function instrumentFingerprint(row: { gatewayPayload: Prisma.JsonValue | null }): string | null {
  const payload = row.gatewayPayload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const obj = payload as Record<string, unknown>;
  const nested =
    obj.authorization && typeof obj.authorization === "object" && !Array.isArray(obj.authorization)
      ? (obj.authorization as Record<string, unknown>)
      : obj;
  const last4 = String(nested.last4 ?? nested.last_4 ?? nested.cardLast4 ?? "").replace(/\D/g, "");
  const bin = String(nested.bin ?? nested.cardBin ?? nested.iin ?? "").replace(/\D/g, "");
  const auth = String(nested.authorization_code ?? nested.authorizationCode ?? "").trim();
  if (auth.length > 4) return `auth:${auth}`;
  if (last4.length === 4 && bin.length >= 4) return `card:${bin}:${last4}`;
  return null;
}

/** @deprecated Referral points are awarded on first paid order, never on signup. */
export async function awardReferralPoints(
  _referrerId: string,
  _newUserId: string,
  _tx: Pick<PrismaClient, "user" | "pointsTransaction">,
  _points?: { referrer: number; newUser: number },
): Promise<void> {
  return;
}

export function pointsPaymentReference(orderNumber: string): string {
  return `PA-POINTS-${orderNumber}`;
}

export function pointsPaymentData(params: {
  orderId: string;
  orderNumber: string;
  amountNGN: number;
  clientId: string;
}): Prisma.PaymentUncheckedCreateInput {
  return {
    reference: pointsPaymentReference(params.orderNumber),
    amount: params.amountNGN,
    currency: "NGN",
    method: PaymentMethod.POINTS,
    status: PaymentStatus.CONFIRMED,
    purpose: PaymentPurpose.POINTS_REDEMPTION,
    orderId: params.orderId,
    clientId: params.clientId,
    confirmedAt: new Date(),
  };
}
