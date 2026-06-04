import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { PointsType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/validations/auth";
import { awardReferralPoints } from "@/lib/points";
import { sendWelcomeEmail } from "@/lib/email";
import { notifyNewCustomer } from "@/lib/notifications";
import { getLoyaltyRulePoints } from "@/lib/loyalty";
import { tierFromPoints, getTierThresholds } from "@/lib/loyalty";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { firstName, lastName, email, phone, password, referralCode } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  let referrerId: string | undefined;
  const refCode = referralCode?.trim();
  if (refCode) {
    const referrer = await prisma.user.findUnique({ where: { referralCode: refCode } });
    if (referrer) referrerId = referrer.id;
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const name = `${firstName} ${lastName}`.trim();
  const signupPoints = await getLoyaltyRulePoints("SIGNUP");
  const referralPoints = await getLoyaltyRulePoints("SIGNUP_REFERRAL");
  const thresholds = await getTierThresholds();

  let pointsBalance = 0;

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        phone,
        password: hashedPassword,
        referredById: referrerId,
      },
    });

    if (referrerId) {
      await awardReferralPoints(referrerId, user.id, tx, {
        referrer: referralPoints,
        newUser: signupPoints,
      });
      const u = await tx.user.findUnique({
        where: { id: user.id },
        select: { pointsBalance: true },
      });
      pointsBalance = u?.pointsBalance ?? 0;
    } else if (signupPoints > 0) {
      const updated = await tx.user.update({
        where: { id: user.id },
        data: { pointsBalance: { increment: signupPoints } },
        select: { pointsBalance: true },
      });
      await tx.pointsTransaction.create({
        data: {
          userId: user.id,
          type: PointsType.EARNED_SIGNUP,
          amount: signupPoints,
          balanceAfter: updated.pointsBalance,
          description: "Welcome bonus",
        },
      });
      pointsBalance = updated.pointsBalance;
    }

    const tier = tierFromPoints(pointsBalance, thresholds);
    await tx.clientProfile.create({
      data: {
        userId: user.id,
        loyaltyPoints: pointsBalance,
        loyaltyTier: tier,
        referredBy: referrerId,
      },
    });
  });

  const createdUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, name: true, email: true, referralCode: true },
  });
  if (createdUser) {
    void notifyNewCustomer(createdUser);
  }
  void sendWelcomeEmail(
    email.toLowerCase(),
    firstName,
    pointsBalance,
    createdUser?.referralCode ?? "",
  );

  return NextResponse.json({ success: true });
}
