import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const RESET_TTL_MS = 60 * 60 * 1000;

export function hashResetToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

export function generateResetToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("hex");
  return { raw, hash: hashResetToken(raw) };
}

export async function invalidateUserAuth(userId: string): Promise<void> {
  await prisma.passwordResetToken.deleteMany({ where: { userId } });
  await prisma.session.deleteMany({ where: { userId } });
}

export async function applyPasswordHash(userId: string, passwordHash: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      password: passwordHash,
      mustResetPassword: false,
      passwordChangedAt: new Date(),
    },
  });
  await invalidateUserAuth(userId);
}

export function jwtIssuedBeforePasswordChange(
  tokenIat: number | undefined,
  passwordChangedAt: Date | null | undefined,
): boolean {
  if (!passwordChangedAt || typeof tokenIat !== "number" || !Number.isFinite(tokenIat)) {
    return false;
  }
  // Auth.js `iat` is Unix seconds. A millisecond timestamp is ~1e12 today.
  const iatSec = tokenIat > 1e11 ? Math.floor(tokenIat / 1000) : tokenIat;
  const changedSec = Math.floor(passwordChangedAt.getTime() / 1000);
  return iatSec < changedSec;
}
