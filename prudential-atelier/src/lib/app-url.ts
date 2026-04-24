const DEFAULT_DEV_APP_URL = "http://localhost:3000";

function stripTrailingSlashes(s: string): string {
  return s.replace(/\/+$/, "");
}

/**
 * Values like `prudentgabriel.com` or Vercel's `VERCEL_URL` (host only) are not
 * valid for `new URL()` — prefix `https://` so metadata and links never throw.
 */
function toAbsoluteHttpOrigin(raw: string): string {
  const trimmed = stripTrailingSlashes(raw.trim());
  if (!trimmed) return DEFAULT_DEV_APP_URL;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * Canonical public site origin for redirects, metadata, and email links.
 * Prefer `NEXT_PUBLIC_APP_URL` in all environments; on Vercel falls back to
 * `VERCEL_URL` when unset; otherwise local dev.
 */
export function getPublicAppUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw) return toAbsoluteHttpOrigin(raw);
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return toAbsoluteHttpOrigin(vercel);
  return DEFAULT_DEV_APP_URL;
}

/** Hostname only (e.g. prudentgabriel.com) for inline hints. */
export function getPublicAppHostname(): string {
  try {
    return new URL(getPublicAppUrl()).hostname;
  } catch {
    return "localhost";
  }
}
