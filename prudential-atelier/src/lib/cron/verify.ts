/**
 * Pluggable cron auth. Vercel sends `Authorization: Bearer ${CRON_SECRET}`.
 * Phase 5 VPS can swap this file for localhost-only or the same shared secret.
 */
export function verifyCronRequest(req: Request): boolean {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return authHeader === `Bearer ${secret}`;
}
