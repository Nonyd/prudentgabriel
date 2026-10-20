/**
 * Staging never emails anyone by accident. Its database is a copy of
 * production (deploy/restore-staging-from-prod.sh), so it holds real clients,
 * real staff and the real provider keys; without this, every cron and every
 * test click on staging would reach real inboxes.
 *
 * Blocked when the app runs at staging.prudentgabriel.com, or anywhere
 * EMAIL_DELIVERY=off is set. While blocked, only the addresses in
 * EMAIL_STAGING_ALLOWLIST receive mail (comma-separated; "@example.com"
 * allows a whole domain). Unset allowlist: nobody.
 */

const STAGING_HOST = "staging.prudentgabriel.com";

export function isEmailDeliveryBlocked(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.EMAIL_DELIVERY?.trim().toLowerCase() === "off") return true;
  const urls = `${env.NEXT_PUBLIC_APP_URL ?? ""} ${env.APP_URL ?? ""}`.toLowerCase();
  return urls.includes(STAGING_HOST);
}

function allowlist(env: NodeJS.ProcessEnv): string[] {
  return (env.EMAIL_STAGING_ALLOWLIST ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** "Name <a@b.com>" or "a@b.com" → "a@b.com". */
function bare(address: string): string {
  const m = address.match(/<([^>]+)>/);
  return (m ? m[1]! : address).trim().toLowerCase();
}

export function isAllowedWhileBlocked(address: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const a = bare(address);
  return allowlist(env).some((rule) => (rule.startsWith("@") ? a.endsWith(rule) : a === rule));
}

/** Keeps only allowlisted addresses from a comma-separated list; undefined when none are left. */
export function keepAllowed(list: string | null | undefined, env: NodeJS.ProcessEnv = process.env): string | undefined {
  if (!list) return undefined;
  const kept = list
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && isAllowedWhileBlocked(s, env));
  return kept.length ? kept.join(", ") : undefined;
}
