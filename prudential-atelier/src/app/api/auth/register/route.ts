import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { INTERACTIVE_TX } from "@/lib/prisma-tx";
import { registerSchema } from "@/validations/auth";
import { awardSignupPoints, awardNewsletterPoints, emailRoot, phonesMatch } from "@/lib/points";
import { sendWelcomeEmail, sendAccountExistsEmail } from "@/lib/email";
import { customerLoginUrl } from "@/lib/customer-email";
import { rateLimitOr429 } from "@/lib/rate-limit";
import { notifyNewCustomer } from "@/lib/notifications";
import { tierFromPoints, getTierThresholds } from "@/lib/loyalty";

export async function POST(request: Request) {
  const limited = rateLimitOr429(request, "register", 5, 15 * 60 * 1000);
  if (limited) return limited;

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
  const emailNorm = email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: emailNorm } });
  if (existing) {
    void sendAccountExistsEmail(emailNorm, customerLoginUrl()).catch((e) =>
      console.warn("[register] exists mail", e),
    );
    return NextResponse.json({ success: true });
  }

  let referrerId: string | undefined;
  const refCode = referralCode?.trim();
  if (refCode) {
    const referrer = await prisma.user.findUnique({
      where: { referralCode: refCode },
      select: { id: true, email: true, phone: true },
    });
    if (referrer) {
      const self =
        emailRoot(referrer.email) === emailRoot(emailNorm) || phonesMatch(referrer.phone, phone);
      if (!self) referrerId = referrer.id;
    }
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const name = `${firstName} ${lastName}`.trim();
  const thresholds = await getTierThresholds();

  let pointsBalance = 0;

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email: emailNorm,
        phone,
        password: hashedPassword,
        referredById: referrerId,
      },
    });

    pointsBalance = await awardSignupPoints(user.id, tx);

    const tier = tierFromPoints(pointsBalance, thresholds);
    await tx.clientProfile.create({
      data: {
        userId: user.id,
        loyaltyPoints: pointsBalance,
        loyaltyTier: tier,
        referredBy: referrerId,
      },
    });
  }, INTERACTIVE_TX);

  const createdUser = await prisma.user.findUnique({
    where: { email: emailNorm },
    select: { id: true, name: true, email: true, referralCode: true },
  });
  if (createdUser) {
    void notifyNewCustomer(createdUser);
    const onList = await prisma.newsletterSubscriber.findUnique({
      where: { email: emailNorm },
      select: { email: true },
    });
    if (onList) await awardNewsletterPoints(createdUser.id);
  }

  void sendWelcomeEmail(emailNorm, firstName, pointsBalance, createdUser?.referralCode ?? "");

  return NextResponse.json({ success: true });
}
