const DEFAULT_DEV_APP_URL = "http://localhost:3000";

function stripTrailingSlashes(s: string): string {
  return s.replace(/\/+$/, "");
}

/**
 * Values like `prudentgabriel.com` or Vercel's `VERCEL_URL` (host only) are not
 * valid for `new URL()` — prefix `https://` so metadata and links never throw.
 */
function toAbsoluteHttpOrigin(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return DEFAULT_DEV_APP_URL;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${stripTrailingSlashes(trimmed)}`;
  try {
    const parsed = new URL(candidate);
    if (!parsed.hostname) return DEFAULT_DEV_APP_URL;
    return stripTrailingSlashes(parsed.origin);
  } catch {
    return DEFAULT_DEV_APP_URL;
  }
}

/** Join a stored path (`/admin/orders/x`) onto the public origin. Already-absolute http(s) is left as-is. */
export function absolutePublicUrl(pathOrUrl: string): string {
  const origin = getPublicAppUrl();
  const raw = pathOrUrl.trim();
  if (!raw) return origin;
  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      if (!parsed.hostname) return `${origin}${raw.startsWith("/") ? raw : `/${raw}`}`;
      return raw;
    } catch {
      return `${origin}${raw.startsWith("/") ? raw : `/${raw}`}`;
    }
  }
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return `${origin}${path}`;
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
