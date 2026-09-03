import { createHmac, timingSafeEqual } from "node:crypto";

function secret(): string {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
}

export function signMediaKey(key: string, expEpochSec: number): string {
  const s = secret();
  if (!s) throw new Error("AUTH_SECRET is required to sign media URLs");
  return createHmac("sha256", s).update(`${key}:${expEpochSec}`).digest("base64url");
}

export function verifyMediaSignature(key: string, expEpochSec: number, sig: string): boolean {
  const s = secret();
  if (!s || !sig) return false;
  if (!Number.isFinite(expEpochSec) || expEpochSec * 1000 < Date.now()) return false;
  const expected = signMediaKey(key, expEpochSec);
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
