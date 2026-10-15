/**
 * Client-safe copy and pure rules for marketing consent (no Prisma here, so
 * forms can import it). The database side lives in marketing-consent.ts.
 */

/** The words beside the opt-in box. Unticked by default; never a condition of anything. */
export const MARKETING_CONSENT_LABEL =
  "Send me news of new collections and private events. Unsubscribe any time.";

export type MarketingConsentSource = "register" | "account" | "newsletter";

/**
 * Broadcast audiences that are promotional by nature: only opted-in addresses
 * receive them. The other sources (a client's active order, an upcoming
 * consultation, one named client or address) are service correspondence.
 */
export const CONSENT_GATED_SOURCES: ReadonlySet<string> = new Set([
  "newsletter",
  "customers",
  "rtw_purchasers",
  "collection_buyers",
  "gold_platinum",
  "all",
]);

export function isConsentGatedSource(source: string): boolean {
  return CONSENT_GATED_SOURCES.has(source);
}

/** Keep the addresses that opted in (case-insensitive). */
export function keepConsented(emails: string[], consented: ReadonlySet<string>): string[] {
  return emails.filter((e) => consented.has(e.trim().toLowerCase()));
}

/** `prudent-gabriel-data-YYYY-MM-DD.json`, in UTC. */
export function dataExportFilename(now: Date = new Date()): string {
  return `prudent-gabriel-data-${now.toISOString().slice(0, 10)}.json`;
}

/** The address an account is moved to on deletion: unique, undeliverable, not hers. */
export function deletedAccountEmail(userId: string): string {
  return `deleted_${userId}@prudentgabriel.local`;
}
