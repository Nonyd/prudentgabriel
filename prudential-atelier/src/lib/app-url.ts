const DEFAULT_DEV_APP_URL = "http://localhost:3000";

/**
 * Canonical public site origin for redirects, metadata, and email links.
 * Prefer `NEXT_PUBLIC_APP_URL` in all environments; defaults to local dev.
 */
export function getPublicAppUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return DEFAULT_DEV_APP_URL;
  return raw.replace(/\/+$/, "");
}

/** Hostname only (e.g. prudentgabriel.com) for inline hints. */
export function getPublicAppHostname(): string {
  try {
    return new URL(getPublicAppUrl()).hostname;
  } catch {
    return "localhost";
  }
}
