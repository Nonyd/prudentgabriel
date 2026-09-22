import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { logError } from "@/lib/logger";

/**
 * Slice AZ5 — limits on anonymous uploads, on top of the per-IP limits in each
 * route. A daily cap per route bounds what any number of IPs can park on the
 * disk; a per-ticket cap bounds what one guest receipt ticket can upload.
 * Counters are the persisted RateLimitBucket rows (Slice AZ6).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Uploads per route per rolling day, across all visitors. */
export const DAILY_UPLOAD_CAPS = {
  "careers-upload": 150, // CV + portfolio + custom fields ≈ 3 files × 50 applications
  "consultations-upload": 300, // up to ~10 reference images × 30 bookings
  "receipt-upload": 200, // guest bank-transfer receipts
  "invoice-receipt-upload": 200,
  "receipt-ticket": 300,
} as const;

export type UploadRoute = keyof typeof DAILY_UPLOAD_CAPS;

/** Uploads one guest receipt ticket may make during its 30-minute life. */
export const RECEIPT_UPLOADS_PER_TICKET = 5;

const DAILY_CAP_MESSAGE =
  "We are receiving an unusual number of uploads right now. Please try again tomorrow, or email the atelier.";

/** 429 once the route's daily cap is reached; logs the first refusal. */
export async function dailyUploadCapOr429(route: UploadRoute): Promise<NextResponse | null> {
  const cap = DAILY_UPLOAD_CAPS[route];
  const result = await checkRateLimit(`upload-day:${route}`, cap, DAY_MS);
  if (result.ok) return null;
  // Log once per capped day: the first over-cap request only.
  const first = await checkRateLimit(`upload-day-alert:${route}`, 1, result.retryAfterSec * 1000);
  if (first.ok) {
    await logError({
      severity: "WARNING",
      errorType: "UPLOAD_DAILY_CAP",
      message: `${route} reached its daily cap of ${cap} uploads; further uploads refused for ${result.retryAfterSec}s.`,
    });
  }
  return NextResponse.json(
    { error: DAILY_CAP_MESSAGE },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSec) } },
  );
}

/** 429 once this ticket has made RECEIPT_UPLOADS_PER_TICKET uploads. */
export async function receiptTicketCapOr429(ticket: string, ticketExpMs: number): Promise<NextResponse | null> {
  const key = `receipt-ticket-uses:${createHash("sha256").update(ticket).digest("hex").slice(0, 32)}`;
  const ttl = Math.max(60_000, ticketExpMs - Date.now());
  const result = await checkRateLimit(key, RECEIPT_UPLOADS_PER_TICKET, ttl);
  if (result.ok) return null;
  return NextResponse.json(
    { error: "This upload link has been used several times already. Refresh the page for a new one." },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSec) } },
  );
}
