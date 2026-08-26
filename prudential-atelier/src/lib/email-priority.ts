/** Transactional mail drains first. */
export const EMAIL_PRIORITY_TRANSACTIONAL = 100;
/** Campaign / marketing mail. Always behind transactional in the drain. */
export const EMAIL_PRIORITY_MARKETING = 0;

/** Drain treats this and above as transactional (no per-run cap). */
export const TRANSACTIONAL_MIN_PRIORITY = 50;

/**
 * Marketing messages processed per email-outbox tick after transactional work.
 * 60/min ≈ one per second — under Resend/Brevo burst limits, so a campaign
 * cannot empty the daily quota in a single drain the way a 500-at-once send would.
 */
export const MARKETING_DRAIN_LIMIT = 60;

export const MARKETING_TEMPLATES = new Set([
  "admin-broadcast",
  "admin-single",
  "collection-campaign",
  "abandoned-cart",
  "back-in-stock",
]);

export const UNSUBSCRIBE_URL_PLACEHOLDER = "__UNSUBSCRIBE_URL__";

export function isMarketingTemplate(template: string): boolean {
  return MARKETING_TEMPLATES.has(template);
}
