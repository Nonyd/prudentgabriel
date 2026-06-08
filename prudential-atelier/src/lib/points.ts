import type { PrismaClient } from "@prisma/client";
import { PointsType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClientNotification } from "@/lib/customer-notifications";
import { sendLoyaltyTierUpgradeEmail, sendReferralRewardEmail } from "@/lib/email";
import { getTierPerks, getTierThresholds, tierFromPoints, TIER_LABELS } from "@/lib/loyalty";

const REFERRAL_FIRST_PURCHASE_CREDIT = 5000;

type PointsDb = Pick<PrismaClient, "user" | "pointsTransaction" | "clientProfile" | "order">;

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
    data: { loyaltyTier: newTier },
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

export async function awardReferralFirstPurchaseReward(
  buyerUserId: string,
  orderId: string,
  db: PointsDb = prisma,
): Promise<void> {
  const buyer = await db.user.findUnique({
    where: { id: buyerUserId },
    select: { referredById: true },
  });
  if (!buyer?.referredById) return;

  const referrerId = buyer.referredById;

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

  const referrerAfter = await db.user.update({
    where: { id: referrerId },
    data: { pointsBalance: { increment: REFERRAL_FIRST_PURCHASE_CREDIT } },
    select: { pointsBalance: true, email: true, name: true },
  });

  await db.pointsTransaction.create({
    data: {
      userId: referrerId,
      type: PointsType.EARNED_REFERRAL,
      amount: REFERRAL_FIRST_PURCHASE_CREDIT,
      balanceAfter: referrerAfter.pointsBalance,
      description: `Referral reward — friend's first purchase (${buyerUserId})`,
      orderId,
    },
  });

  await maybeUpgradeLoyaltyTier(referrerId, referrerAfter.pointsBalance, db);

  if (referrerAfter.email) {
    const firstName = referrerAfter.name?.split(" ")[0] ?? "there";
    void sendReferralRewardEmail({
      to: referrerAfter.email,
      firstName,
      creditNGN: REFERRAL_FIRST_PURCHASE_CREDIT,
    }).catch(() => {});
  }

  void createClientNotification({
    userId: referrerId,
    type: "REFERRAL_REWARD",
    title: "Referral reward earned!",
    message: "Your friend made their first purchase. ₦5,000 added to your account.",
    link: "/account/loyalty",
    entityId: orderId,
  }).catch(() => {});
}

async function runAwardPurchase(client: PointsDb, userId: string, points: number, orderId: string) {
  const updated = await client.user.update({
    where: { id: userId },
    data: { pointsBalance: { increment: points } },
    select: { pointsBalance: true },
  });

  await client.pointsTransaction.create({
    data: {
      userId,
      type: PointsType.EARNED_PURCHASE,
      amount: points,
      balanceAfter: updated.pointsBalance,
      description: "Points earned from order",
      orderId,
    },
  });

  await maybeUpgradeLoyaltyTier(userId, updated.pointsBalance, client);
  await awardReferralFirstPurchaseReward(userId, orderId, client);
}

export async function awardPurchasePoints(
  userId: string,
  orderTotalNGN: number,
  orderId: string,
  db?: PointsDb,
): Promise<number> {
  const points = Math.floor(orderTotalNGN / 100);
  if (points <= 0) {
    await awardReferralFirstPurchaseReward(userId, orderId, db ?? prisma);
    return 0;
  }

  if (db) {
    await runAwardPurchase(db, userId, points, orderId);
  } else {
    await prisma.$transaction(async (tx) => {
      await runAwardPurchase(tx, userId, points, orderId);
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
  if (points <= 0) return 0;

  const updated = await db.user.update({
    where: { id: userId },
    data: { pointsBalance: { increment: points } },
    select: { pointsBalance: true },
  });

  await db.pointsTransaction.create({
    data: {
      userId,
      type: PointsType.EARNED_REVIEW,
      amount: points,
      balanceAfter: updated.pointsBalance,
      description: `Points for verified product review (${productId})`,
    },
  });

  await maybeUpgradeLoyaltyTier(userId, updated.pointsBalance, db);

  return points;
}

export async function redeemPoints(
  userId: string,
  pointsToRedeem: number,
  orderId: string,
  db: PointsDb = prisma,
): Promise<void> {
  if (pointsToRedeem <= 0) return;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { pointsBalance: true },
  });
  if (!user || user.pointsBalance < pointsToRedeem) {
    throw new Error("Insufficient points");
  }

  const updated = await db.user.update({
    where: { id: userId },
    data: { pointsBalance: { decrement: pointsToRedeem } },
    select: { pointsBalance: true },
  });

  await db.pointsTransaction.create({
    data: {
      userId,
      type: PointsType.REDEEMED,
      amount: -pointsToRedeem,
      balanceAfter: updated.pointsBalance,
      description: "Points redeemed at checkout",
      orderId,
    },
  });
}

export function getPointsValue(points: number): number {
  return points;
}

type Tx = Pick<PrismaClient, "user" | "pointsTransaction">;

/** Call only inside `prisma.$transaction`. */
export async function awardReferralPoints(
  referrerId: string,
  newUserId: string,
  tx: Tx,
  points?: { referrer: number; newUser: number },
): Promise<void> {
  const REFERRER_PTS = points?.referrer ?? 250;
  const NEW_USER_PTS = points?.newUser ?? 0;

  const referrerAfter = await tx.user.update({
    where: { id: referrerId },
    data: { pointsBalance: { increment: REFERRER_PTS } },
    select: { pointsBalance: true },
  });

  await tx.pointsTransaction.create({
    data: {
      userId: referrerId,
      type: PointsType.EARNED_REFERRAL,
      amount: REFERRER_PTS,
      balanceAfter: referrerAfter.pointsBalance,
      description: "Referral reward — friend joined",
    },
  });

  if (NEW_USER_PTS > 0) {
    const newUserAfter = await tx.user.update({
      where: { id: newUserId },
      data: { pointsBalance: { increment: NEW_USER_PTS } },
      select: { pointsBalance: true },
    });

    await tx.pointsTransaction.create({
      data: {
        userId: newUserId,
        type: PointsType.EARNED_SIGNUP,
        amount: NEW_USER_PTS,
        balanceAfter: newUserAfter.pointsBalance,
        description: "Welcome bonus — referred signup",
      },
    });
  }
}
