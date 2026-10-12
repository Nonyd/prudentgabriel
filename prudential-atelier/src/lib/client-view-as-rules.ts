/**
 * "View as client": the rules both the edge middleware and the server read.
 * Edge-safe: no Prisma, no node:crypto. The session itself is in client-view-as.ts.
 *
 * While an admin views as a client, her session is the client's: /account, the
 * shop, checkout and every account API act as her. A few things stay hers alone
 * (her password, closing her account, her saved cards), the portals are closed
 * until the admin exits, and every page opened and every change made is written
 * to the activity log under the admin's name.
 */

export const VIEW_AS_TTL_MS = 60 * 60 * 1000;

/** What the browser's session carries while viewing as a client. */
export type ViewAsSessionInfo = {
  actorId: string;
  actorName: string;
  actorEmail: string;
  clientName: string;
  clientProfileId: string;
  startedAt: number;
  exp: number;
};

export const VIEW_AS_BLOCKED_MESSAGE =
  "Not while viewing as a client: her password, her saved cards and closing her account stay hers.";

const READS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Pages an admin viewing as a client is sent back from (to /account). */
export function viewAsClosedPage(pathname: string): boolean {
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/staff") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/auth/reset-password")
  );
}

/** Account APIs that stay hers alone. */
export function viewAsBlockedApi(method: string, pathname: string): boolean {
  const m = method.toUpperCase();
  if (READS.has(m)) return false;
  if (pathname === "/api/account" && m === "DELETE") return true;
  if (pathname === "/api/account/password" || pathname.startsWith("/api/account/password/")) return true;
  if (pathname.startsWith("/api/account/profile/password")) return true;
  if (pathname.startsWith("/api/account/payment-methods")) return true;
  return false;
}

/** Plumbing that is not something the admin did: sign-in, the log itself, telemetry. */
const NOT_ACTIONS = ["/api/auth/", "/api/view-as", "/api/logs/", "/api/analytics/", "/api/currency/"];

/**
 * Whether a request is worth a line in the activity log: every change, and every
 * page opened. Reads behind the page (API GETs) and link prefetches are not.
 */
export function viewAsLoggable(
  method: string,
  pathname: string,
  headers: { get(name: string): string | null },
): boolean {
  const m = method.toUpperCase();
  // Signing out from her account ends the visit and signs the admin out: worth a line.
  if (pathname === "/api/auth/signout" && m === "POST") return true;
  if (NOT_ACTIONS.some((p) => pathname === p.replace(/\/$/, "") || pathname.startsWith(p))) return false;
  if (!READS.has(m)) return true;
  if (m !== "GET" || pathname.startsWith("/api/")) return false;
  const prefetch =
    headers.get("next-router-prefetch") !== null ||
    headers.get("purpose") === "prefetch" ||
    (headers.get("sec-purpose") ?? "").includes("prefetch");
  return !prefetch;
}

/** One line for the activity log. */
export function describeViewAsRequest(method: string, pathname: string, serverAction: boolean): string {
  const m = method.toUpperCase();
  if (m === "GET") return `Opened ${pathname}`;
  if (pathname === "/api/auth/signout") return "Signed out (this ended the visit)";
  if (serverAction) return `Submitted a form on ${pathname}`;
  return `${m} ${pathname}`;
}
