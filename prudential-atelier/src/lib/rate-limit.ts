import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientIpFromHeaders } from "@/lib/http/client-ip";

export { clientIpFromHeaders } from "@/lib/http/client-ip";

/**
 * Rate limiting (Slice AZ6). Counters live in Postgres (RateLimitBucket), so
 * every instance shares them and a deploy does not reset them. One atomic
 * upsert per check, using the database clock. If the database is unreachable
 * the check falls back to a per-process Map rather than failing the request.
 */

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

type Bucket = { count: number; resetAt: number };
const memory = new Map<string, Bucket>();
const MEMORY_SWEEP_AT = 10_000;

function checkMemory(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  if (memory.size >= MEMORY_SWEEP_AT) {
    memory.forEach((b, k) => {
      if (now >= b.resetAt) memory.delete(k);
    });
  }
  const bucket = memory.get(key);
  if (!bucket || now >= bucket.resetAt) {
    memory.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  bucket.count += 1;
  if (bucket.count > limit) return { ok: false, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
  return { ok: true };
}

/** ~1 in 200 checks deletes buckets that expired over an hour ago. */
const SWEEP_PROBABILITY = 0.005;
let warnedFallback = false;

async function checkDatabase(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const rows = await prisma.$queryRaw<{ count: number; retry_ms: number }[]>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt")
    VALUES (${key}, 1, now() + make_interval(secs => ${windowMs / 1000}))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."resetAt" <= now() THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" <= now() THEN EXCLUDED."resetAt" ELSE "RateLimitBucket"."resetAt" END
    RETURNING "count", (EXTRACT(EPOCH FROM ("resetAt" - now())) * 1000)::float8 AS retry_ms
  `;
  if (Math.random() < SWEEP_PROBABILITY) {
    void prisma.$executeRaw`DELETE FROM "RateLimitBucket" WHERE "resetAt" < now() - interval '1 hour'`.catch(() => {});
  }
  const row = rows[0];
  if (!row || row.count <= limit) return { ok: true };
  return { ok: false, retryAfterSec: Math.max(1, Math.ceil(row.retry_ms / 1000)) };
}

export async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  try {
    return await checkDatabase(key, limit, windowMs);
  } catch (e) {
    if (!warnedFallback) {
      warnedFallback = true;
      console.warn("[rate-limit] database unavailable, using per-process counters", e instanceof Error ? e.message : e);
    }
    return checkMemory(key, limit, windowMs);
  }
}

export function getClientIp(req: Request): string {
  return clientIpFromHeaders(req.headers);
}

export async function rateLimitOr429(
  req: Request,
  bucket: string,
  limit: number,
  windowMs: number,
): Promise<NextResponse | null> {
  const ip = getClientIp(req);
  const result = await checkRateLimit(`${bucket}:${ip}`, limit, windowMs);
  if (result.ok) return null;
  return NextResponse.json(
    { error: "Too many requests" },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSec) } },
  );
}
