/**
 * Shared guard for fixture / demo seed scripts.
 * Staging and production must never receive demo clients, orders, or invoices.
 */
export const PRODUCTION_DB_HOST_MARKERS = [
  "ep-sparkling-field-abfslmfw", // Neon production compute (jolly-feather-41999434)
  "br-bold-boat-abs0vzgk",
  "prudentgabriel-postgres", // VPS production compose hostname
];

export const STAGING_DB_HOST_MARKERS = [
  "prudentgabriel-staging-postgres",
];

export function databaseUrlHost(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url.replace(/^prisma\+/, "")).hostname.toLowerCase();
  } catch {
    const m = url.match(/@([^/?]+)/);
    return (m?.[1] ?? "").toLowerCase();
  }
}

export function looksLikeProductionDatabase(url = process.env.DATABASE_URL ?? process.env.DIRECT_URL): boolean {
  const host = databaseUrlHost(url);
  if (!host) return false;
  return PRODUCTION_DB_HOST_MARKERS.some((marker) => host.includes(marker.toLowerCase()));
}

export function looksLikeStagingDatabase(url = process.env.DATABASE_URL ?? process.env.DIRECT_URL): boolean {
  const host = databaseUrlHost(url);
  if (!host) return false;
  return STAGING_DB_HOST_MARKERS.some((marker) => host.includes(marker.toLowerCase()));
}

/** Call at the top of any fixture seed. Exits non-zero if unsafe. */
export function assertFixturesAllowed(scriptName: string): void {
  if (looksLikeProductionDatabase()) {
    console.error(
      `${scriptName}: refused — DATABASE_URL points at production.\n` +
        "Fixture / demo seeds must never run against production.",
    );
    process.exit(1);
  }
  if (looksLikeStagingDatabase()) {
    console.error(
      `${scriptName}: refused — DATABASE_URL points at staging.\n` +
        "Fixture / demo seeds must never run against staging.",
    );
    process.exit(1);
  }
  if (process.env.ALLOW_FIXTURES !== "true") {
    console.error(
      `${scriptName}: refused — set ALLOW_FIXTURES=true to run demo/fixture seeds.\n` +
        "This is local/dev only. Production uses `pnpm db:seed` (bootstrap).",
    );
    process.exit(1);
  }
}
