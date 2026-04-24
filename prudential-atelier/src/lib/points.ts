import type { PrismaClient } from "@prisma/client";
import { PointsType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type PointsDb = Pick<PrismaClient, "user" | "pointsTransaction">;

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
}

export async function awardPurchasePoints(
  userId: string,
  orderTotalNGN: number,
  orderId: string,
  db?: PointsDb,
): Promise<number> {
  const points = Math.floor(orderTotalNGN / 100);
  if (points <= 0) return 0;

  if (db) {
    await runAwardPurchase(db, userId, points, orderId);
  } else {
    await prisma.$transaction(async (tx) => {
      await runAwardPurchase(tx, userId, points, orderId);
    });
  }
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
export async function awardReferralPoints(referrerId: string, newUserId: string, tx: Tx): Promise<void> {
  const REFERRER_PTS = 250;
  const NEW_USER_PTS = 500;

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
