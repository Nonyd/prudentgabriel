import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { INTERACTIVE_TX } from "@/lib/prisma-tx";
import { registerSchema } from "@/validations/auth";
import { awardSignupPoints, awardNewsletterPoints, emailRoot, phonesMatch } from "@/lib/points";
import { sendWelcomeEmail, sendAccountExistsEmail } from "@/lib/email";
import { customerLoginUrl } from "@/lib/customer-email";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { AUTH_ADDRESS_LIMIT, AUTH_WINDOW_MS, FORGOT_ACCOUNT_LIMIT, accountKey, noteAddressCapHit } from "@/lib/auth-limits";
import { logServerError } from "@/lib/logger";
import { notifyNewCustomer } from "@/lib/notifications";
import { tierFromPoints, getTierThresholds } from "@/lib/loyalty";

function tooMany(retryAfterSec: number) {
  return NextResponse.json(
    { error: "Too many requests" },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
  );
}

async function accountExists(email: string) {
  await sendAccountExistsEmail(email, customerLoginUrl()).catch((e) => console.warn("[register] exists mail", e));
  return NextResponse.json({ success: true });
}

/**
 * Per address (50, like the other BA1 limits: an office or a carrier NAT shares
 * one) and per inbox (5, so no one mail-bombs an address), not 5 per address.
 * The answer is the same whether or not the account exists.
 */
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
  const emailNorm = email.toLowerCase();

  const ip = getClientIp(request);
  const address = await checkRateLimit(`register-address:${ip}`, AUTH_ADDRESS_LIMIT, AUTH_WINDOW_MS);
  if (!address.ok) {
    await noteAddressCapHit("register", ip, address.retryAfterSec);
    return tooMany(address.retryAfterSec);
  }
  const inbox = await checkRateLimit(`register-account:${accountKey(emailNorm)}`, FORGOT_ACCOUNT_LIMIT, AUTH_WINDOW_MS);
  if (!inbox.ok) return tooMany(inbox.retryAfterSec);

  const existing = await prisma.user.findUnique({ where: { email: emailNorm } });
  if (existing) return accountExists(emailNorm);

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

  try {
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
  } catch (e) {
    // Two submissions for one email at once: the second is an existing account.
    if ((e as { code?: string }).code === "P2002") return accountExists(emailNorm);
    await logServerError({ errorType: "REGISTER", error: e });
    return NextResponse.json({ error: "We could not create your account just now. Please try again." }, { status: 500 });
  }

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
