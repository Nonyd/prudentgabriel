import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { passwordPolicySchema } from "@/lib/password-policy";
import { applyPasswordHash, hashResetToken } from "@/lib/password-reset";
import { loginPathForUser } from "@/lib/login-paths";
import { checkRateLimit, getClientIp, refundRateLimit } from "@/lib/rate-limit";
import { AUTH_ADDRESS_LIMIT, AUTH_WINDOW_MS, noteAddressCapHit } from "@/lib/auth-limits";
import { logServerError } from "@/lib/logger";

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

const INVALID_LINK = "Invalid or expired reset link";

/**
 * BA1: only a wrong or expired link counts, per address (50 per 15 minutes).
 * It used to be 8 requests of any kind per address, so a mistyped new password
 * or a few people on one carrier gateway resetting at once was refused. Each
 * request takes a unit first (parallel guesses stay bounded); anything but a
 * bad link gives it back. Reset tokens are 256-bit, so this is a tripwire, not
 * the defence.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const key = `reset-address:${ip}`;
  const limited = await checkRateLimit(key, AUTH_ADDRESS_LIMIT, AUTH_WINDOW_MS);
  if (!limited.ok) {
    await noteAddressCapHit("reset-password", ip, limited.retryAfterSec);
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }
  const res = await resetPassword(req);
  const body = (await res.clone().json().catch(() => null)) as { error?: unknown } | null;
  if (body?.error !== INVALID_LINK) await refundRateLimit(key);
  return res;
}

async function resetPassword(req: NextRequest): Promise<NextResponse> {
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
        return NextResponse.json({ error: INVALID_LINK }, { status: 400 });
      }
      const consumed = await prisma.passwordResetToken.deleteMany({
        where: { id: row.id, expiresAt: { gt: new Date() } },
      });
      if (consumed.count !== 1) {
        return NextResponse.json({ error: INVALID_LINK }, { status: 400 });
      }
      const user = await prisma.user.findUnique({
        where: { id: row.userId },
        select: {
          role: true,
          isStaff: true,
          userPermissions: { select: { permission: true, mode: true } },
        },
      });
      await applyPasswordHash(row.userId, hashed);
      const grants = (user?.userPermissions ?? [])
        .filter((p) => p.mode === "GRANT")
        .map((p) => p.permission);
      return NextResponse.json({
        success: true,
        next: loginPathForUser({
          role: user?.role,
          isStaff: user?.isStaff,
          permissionGrants: grants,
        }),
      });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!session.user.mustResetPassword) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await applyPasswordHash(session.user.id, hashed);
    return NextResponse.json({
      success: true,
      next: loginPathForUser(session.user),
    });
  } catch (err) {
    await logServerError({ errorType: "RESET_PASSWORD", error: err });
    return NextResponse.json({ error: "Could not update password" }, { status: 500 });
  }
}
