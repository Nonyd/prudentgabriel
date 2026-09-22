import { prisma } from "@/lib/prisma";
import { jwtIssuedBeforePasswordChange } from "@/lib/password-reset";

/**
 * Slice AZ9 — sign every account out at once.
 *
 * Reuses the passwordChangedAt mechanism: Auth.js re-runs the jwt callback on
 * every request, and a session whose `iat` is older than a cutoff is dropped.
 * Per user the cutoff is User.passwordChangedAt; for everyone it is this
 * house-wide timestamp. Nothing to rotate on the host, and it can be done
 * again at any time.
 *
 * Read with its own short cache (not the 5-minute settings cache): every
 * instance honours a revocation within REVOCATION_CACHE_MS.
 */

export const SESSIONS_REVOKED_AT_KEY = "security_sessions_revoked_at";
export const REVOCATION_CACHE_MS = 15_000;
export const REVOKE_ALL_CONFIRMATION = "SIGN OUT EVERYONE";

let cache: { value: Date | null; at: number } | null = null;

export async function getSessionsRevokedAt(): Promise<Date | null> {
  if (cache && Date.now() - cache.at < REVOCATION_CACHE_MS) return cache.value;
  let value: Date | null = null;
  try {
    const row = await prisma.siteSetting.findUnique({
      where: { key: SESSIONS_REVOKED_AT_KEY },
      select: { value: true },
    });
    const d = row?.value ? new Date(row.value) : null;
    value = d && Number.isFinite(d.getTime()) ? d : null;
  } catch {
    // Fail open on a read error: a database blip must not sign everyone out.
    value = cache?.value ?? null;
  }
  cache = { value, at: Date.now() };
  return value;
}

/** True when a session issued at `iat` predates the house-wide cutoff. */
export async function sessionRevokedGlobally(iat: number | undefined): Promise<boolean> {
  return jwtIssuedBeforePasswordChange(iat, await getSessionsRevokedAt());
}

/** Every session issued before now stops working (within REVOCATION_CACHE_MS on other instances). */
export async function revokeAllSessions(updatedBy: string): Promise<Date> {
  // One second ahead so a session issued in this same second is also dropped.
  const at = new Date(Math.ceil(Date.now() / 1000) * 1000 + 1000);
  await prisma.siteSetting.upsert({
    where: { key: SESSIONS_REVOKED_AT_KEY },
    update: { value: at.toISOString(), updatedBy },
    create: {
      key: SESSIONS_REVOKED_AT_KEY,
      value: at.toISOString(),
      group: "STORE",
      label: "All sessions revoked at",
      type: "TEXT",
      isPublic: false,
      updatedBy,
    },
  });
  cache = { value: at, at: Date.now() };
  return at;
}
