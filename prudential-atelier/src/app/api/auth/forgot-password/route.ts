import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema } from "@/validations/auth";
import { sendPasswordResetEmail } from "@/lib/email";
import { issuePasswordResetToken } from "@/lib/password-reset";
import { getPublicAppUrl } from "@/lib/app-url";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  AUTH_ADDRESS_LIMIT,
  AUTH_WINDOW_MS,
  FORGOT_ACCOUNT_LIMIT,
  accountKey,
  noteAddressCapHit,
} from "@/lib/auth-limits";

function tooMany(retryAfterSec: number) {
  return NextResponse.json(
    { error: "Too many requests" },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
  );
}

/**
 * BA1: every request can send an email, so every request counts — but per inbox
 * (5, from anywhere: no mail-bombing one person) and per address (50), not 5
 * per address. Five resets across everyone on one carrier gateway was nothing.
 * The same answer whether or not the account exists.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: true });
  }

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: true });
  }

  const email = parsed.data.email.toLowerCase();

  const ip = getClientIp(request);
  const address = await checkRateLimit(`forgot-address:${ip}`, AUTH_ADDRESS_LIMIT, AUTH_WINDOW_MS);
  if (!address.ok) {
    await noteAddressCapHit("forgot-password", ip, address.retryAfterSec);
    return tooMany(address.retryAfterSec);
  }
  const inbox = await checkRateLimit(`forgot-account:${accountKey(email)}`, FORGOT_ACCOUNT_LIMIT, AUTH_WINDOW_MS);
  if (!inbox.ok) return tooMany(inbox.retryAfterSec);

  const user = await prisma.user.findUnique({ where: { email } });

  if (user?.password) {
    const { raw, hash } = await issuePasswordResetToken(user.id);
    const resetUrl = `${getPublicAppUrl()}/auth/reset-password/${raw}`;
    void sendPasswordResetEmail(email, resetUrl, hash).catch((e) =>
      console.warn("[forgot-password] mail", e),
    );
  }

  return NextResponse.json({ success: true });
}
