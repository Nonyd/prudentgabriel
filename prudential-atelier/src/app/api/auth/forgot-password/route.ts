import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema } from "@/validations/auth";
import { sendPasswordResetEmail } from "@/lib/email";
import { issuePasswordResetToken } from "@/lib/password-reset";
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
    const { raw, hash } = await issuePasswordResetToken(user.id);
    const resetUrl = `${getPublicAppUrl()}/auth/reset-password/${raw}`;
    void sendPasswordResetEmail(email, resetUrl, hash).catch((e) =>
      console.warn("[forgot-password] mail", e),
    );
  }

  return NextResponse.json({ success: true });
}
