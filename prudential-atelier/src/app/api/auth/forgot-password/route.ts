import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema } from "@/validations/auth";
import { sendPasswordResetEmail } from "@/lib/email";
import { generateResetToken, RESET_TTL_MS } from "@/lib/password-reset";
import { getPublicAppUrl } from "@/lib/app-url";
import { rateLimitOr429 } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const limited = rateLimitOr429(request, "forgot-password", 5, 15 * 60 * 1000);
  if (limited) return limited;

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
  const user = await prisma.user.findUnique({ where: { email } });

  if (user?.password) {
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
    const { raw, hash } = generateResetToken();
    await prisma.passwordResetToken.create({
      data: {
        token: hash,
        userId: user.id,
        expiresAt: new Date(Date.now() + RESET_TTL_MS),
      },
    });
    const resetUrl = `${getPublicAppUrl()}/auth/reset-password/${raw}`;
    void sendPasswordResetEmail(email, resetUrl).catch((e) =>
      console.warn("[forgot-password] mail", e),
    );
  }

  return NextResponse.json({ success: true });
}
