/** Mailboxes that do not receive mail (hard-bounce or outbound-only). */
const UNDELIVERABLE = new Set([
  "admin@prudentgabriel.com",
  "noreply@prudentgabriel.com",
  "hello@prudentgabriel.com",
]);

function usable(raw: string | null | undefined): string | null {
  const email = raw?.trim().toLowerCase();
  if (!email || !email.includes("@")) return null;
  if (UNDELIVERABLE.has(email)) return null;
  return email;
}

async function fromDashboard(
  getSetting: (key: string) => Promise<string | null>,
  key: string,
): Promise<string | null> {
  return usable(await getSetting(key));
}

function fromEnvChain(keys: (string | undefined)[]): string | null {
  for (const raw of keys) {
    const email = usable(raw);
    if (email) return email;
  }
  return null;
}

/**
 * Operational alerts (oversell, bank transfer, unsent quotes, daily/weekly report,
 * bespoke admin, job-application fallback). Dashboard first — Slice U style.
 * Never `admin@` or `hello@`.
 */
export async function resolveAdminAlertEmail(
  getSetting: (key: string) => Promise<string | null>,
): Promise<string | null> {
  return (
    (await fromDashboard(getSetting, "admin_notification_email")) ||
    fromEnvChain([
      process.env.ORDERS_ADMIN_EMAIL,
      process.env.GENERAL_ADMIN_EMAIL,
      process.env.SUPER_ADMIN_EMAIL,
      process.env.ADMIN_EMAIL,
      process.env.ORDERS_EMAIL,
    ])
  );
}

/** Late-alert / HR. Falls back to operational if HR is unset. */
export async function resolveHrAlertEmail(
  getSetting: (key: string) => Promise<string | null>,
): Promise<string | null> {
  return (
    (await fromDashboard(getSetting, "hr_alert_email")) ||
    fromEnvChain([process.env.HR_MANAGER_EMAIL]) ||
    (await resolveAdminAlertEmail(getSetting))
  );
}
