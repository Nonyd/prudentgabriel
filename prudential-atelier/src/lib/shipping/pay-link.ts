import { createHmac, timingSafeEqual } from "node:crypto";
import { getPublicAppUrl } from "@/lib/app-url";

/**
 * The shipping pay link in the quote email and the reminders.
 *
 * It never expires: the code is a signature of the order id, so it opens the
 * order's pay page for as long as the order exists. The page makes a fresh
 * Paystack checkout on every click, because a Paystack checkout link itself
 * does expire. Once shipping is paid the page simply says so.
 */
function secret(): string {
  return process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
}

export function shippingPayCode(orderId: string): string {
  return createHmac("sha256", secret()).update(`shipping-pay:${orderId}`).digest("base64url").slice(0, 32);
}

export function verifyShippingPayCode(orderId: string, code: string | null | undefined): boolean {
  if (!secret() || !code) return false;
  const a = Buffer.from(shippingPayCode(orderId), "utf8");
  const b = Buffer.from(code, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function shippingPayPath(orderId: string): string {
  return `/payment/shipping/${encodeURIComponent(orderId)}?c=${shippingPayCode(orderId)}`;
}

export function shippingPayUrl(orderId: string): string {
  return `${getPublicAppUrl()}${shippingPayPath(orderId)}`;
}
