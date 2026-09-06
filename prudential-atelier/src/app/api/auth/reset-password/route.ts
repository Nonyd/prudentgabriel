import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { passwordPolicySchema } from "@/lib/password-policy";
import { applyPasswordHash, hashResetToken } from "@/lib/password-reset";
import { rateLimitOr429 } from "@/lib/rate-limit";

const bodySchema = z
  .object({
    token: z.string().optional(),
    password: passwordPolicySchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export async function POST(req: NextRequest) {
  const limited = rateLimitOr429(req, "reset-password", 8, 15 * 60 * 1000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const hashed = await bcrypt.hash(parsed.data.password, 12);
  const token = parsed.data.token?.trim();

  try {
    if (token) {
      const tokenHash = hashResetToken(token);
      const row = await prisma.passwordResetToken.findUnique({ where: { token: tokenHash } });
      if (!row || row.expiresAt < new Date()) {
        return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
      }
      const consumed = await prisma.passwordResetToken.deleteMany({
        where: { id: row.id, expiresAt: { gt: new Date() } },
      });
      if (consumed.count !== 1) {
        return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
      }
      await applyPasswordHash(row.userId, hashed);
      return NextResponse.json({ success: true });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!session.user.mustResetPassword) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await applyPasswordHash(session.user.id, hashed);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[reset-password]", err);
    return NextResponse.json({ error: "Could not update password" }, { status: 500 });
  }
}
