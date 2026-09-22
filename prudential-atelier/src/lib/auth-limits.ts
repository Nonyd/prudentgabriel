import { createHash } from "node:crypto";
import { checkRateLimit } from "@/lib/rate-limit";
import { logError } from "@/lib/logger";

/**
 * Limits on sign-in, forgot-password and reset-password (BA1).
 *
 * Two kinds of key, never one per address alone:
 * - per account: what actually stops someone guessing one password or
 *   mail-bombing one inbox;
 * - per address: a wide ceiling against spraying many accounts. Wide because
 *   office Wi-Fi and Nigerian carrier NAT put many people — sometimes
 *   thousands — behind one public address.
 *
 * Every time an address cap fires it is logged (once per window), so the error
 * log shows within a week whether the cap is catching attackers or customers.
 */

export const AUTH_WINDOW_MS = 15 * 60 * 1000;
/** Failed attempts at any account from one address, for each flow. */
export const AUTH_ADDRESS_LIMIT = 50;
/** Failed sign-ins at one account from one address. */
export const SIGNIN_ACCOUNT_LIMIT = 10;
/** Reset emails to one inbox, from anywhere. */
export const FORGOT_ACCOUNT_LIMIT = 5;

/** Hashed so the limiter table never holds an email. */
export function accountKey(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase(), "utf8").digest("hex").slice(0, 32);
}

/** 102.211.122.253 → 102.211.122.x; enough to recognise a carrier range, not a person. */
export function maskAddress(ip: string): string {
  if (ip.includes(":")) return `${ip.split(":").slice(0, 3).join(":")}::/48`;
  const parts = ip.split(".");
  return parts.length === 4 ? `${parts.slice(0, 3).join(".")}.x` : ip;
}

/** Log once per window that an address hit its cap. */
export async function noteAddressCapHit(flow: string, ip: string, retryAfterSec: number): Promise<void> {
  const first = await checkRateLimit(`auth-address-alert:${flow}:${ip}`, 1, Math.max(1, retryAfterSec) * 1000);
  if (!first.ok) return;
  await logError({
    severity: "WARNING",
    errorType: "AUTH_ADDRESS_CAP",
    message: `${flow}: ${maskAddress(ip)} reached ${AUTH_ADDRESS_LIMIT} failures in 15 minutes; refused for ${retryAfterSec}s.`,
  }).catch(() => {});
}
