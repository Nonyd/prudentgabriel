import { getPublicAppUrl } from "@/lib/app-url";

/** Customer-facing house name in mail (sender, subject, header, footer). */
export const CUSTOMER_HOUSE_NAME = "PRUDENT GABRIEL";

/**
 * Square crest size. HTML width/height must match the mark.
 * A 168×56 box stretches a square logo in Gmail mobile.
 */
export const EMAIL_LOGO_PX = 56;

/** Full-page customer login. `/login` without a client callback is the staff portal. */
export function customerLoginUrl(appUrl = getPublicAppUrl()): string {
  return `${appUrl}/auth/login?callbackUrl=${encodeURIComponent("/account")}`;
}

/** Treat the old default From name as stale so live settings still send as the house. */
export function resolveCustomerFromName(raw: string | null | undefined): string {
  const name = raw?.trim();
  if (!name || name === "Prudential Atelier") return CUSTOMER_HOUSE_NAME;
  return name;
}
