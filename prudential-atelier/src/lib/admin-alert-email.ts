/** Mailboxes that do not receive mail (hard-bounce or outbound-only). */
const UNDELIVERABLE = new Set([
  "admin@prudentgabriel.com",
  "noreply@prudentgabriel.com",
]);

function usable(raw: string | null | undefined): string | null {
  const email = raw?.trim().toLowerCase();
  if (!email || !email.includes("@")) return null;
  if (UNDELIVERABLE.has(email)) return null;
  return email;
}

/**
 * Inbox for operational alerts (oversell, etc.). Never `admin@` — that mailbox
 * does not exist and hard-bounces.
 */
export async function resolveAdminAlertEmail(getSetting: (key: string) => Promise<string | null>): Promise<string> {
  const fromEnv =
    usable(process.env.ORDERS_ADMIN_EMAIL) ||
    usable(process.env.GENERAL_ADMIN_EMAIL) ||
    usable(process.env.SUPER_ADMIN_EMAIL) ||
    usable(process.env.ADMIN_EMAIL);

  if (fromEnv) return fromEnv;

  const fromDb =
    usable(await getSetting("contact_email")) ||
    usable(await getSetting("store_email")) ||
    usable(await getSetting("admin_notification_email"));

  if (fromDb) return fromDb;

  return "hello@prudentgabriel.com";
}
