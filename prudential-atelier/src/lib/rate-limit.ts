import { NextResponse } from "next/server";

type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();

/** Past this many keys, drop expired buckets so the Map can't grow without bound. */
const SWEEP_AT = 10_000;

function sweepExpired(now: number) {
  store.forEach((bucket, key) => {
    if (now >= bucket.resetAt) store.delete(key);
  });
}

export function checkRateLimit(key: string, limit: number, windowMs: number): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  if (store.size >= SWEEP_AT) sweepExpired(now);
  const bucket = store.get(key);

  if (!bucket || now >= bucket.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (bucket.count >= limit) {
    return { ok: false, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { ok: true };
}

export function clientIpFromHeaders(h: { get(name: string): string | null }): string {
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return h.get("x-real-ip") || "unknown";
}

export function getClientIp(req: Request): string {
  return clientIpFromHeaders(req.headers);
}

export function rateLimitOr429(
  req: Request,
  bucket: string,
  limit: number,
  windowMs: number,
): NextResponse | null {
  const ip = getClientIp(req);
  const result = checkRateLimit(`${bucket}:${ip}`, limit, windowMs);
  if (result.ok) return null;
  return NextResponse.json(
    { error: "Too many requests" },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSec) } },
  );
}
