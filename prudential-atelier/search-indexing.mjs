/**
 * Whether search engines may index this deployment.
 *
 * Decided by the site's own public URL, never by a flag: only the production
 * host is indexable. Staging, previews and localhost are `noindex` by default,
 * so copying staging's env to production cannot switch indexing off there, and
 * a new environment cannot become indexable by accident.
 *
 * Plain ESM so next.config.mjs (headers) and app code (robots.ts) share it.
 */

/** Hosts whose responses may be indexed. */
export const INDEXABLE_HOSTS = ["prudentgabriel.com", "www.prudentgabriel.com"];

export const NOINDEX_HEADER_VALUE = "noindex, nofollow";

/**
 * @param {string | undefined | null} raw a URL or bare host
 * @returns {string} lower-case hostname, or "" when unparseable
 */
export function hostOf(raw) {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";
  try {
    return new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/**
 * @param {string | undefined | null} siteUrl the deployment's public URL
 * @returns {boolean}
 */
export function isIndexableSiteUrl(siteUrl) {
  return INDEXABLE_HOSTS.includes(hostOf(siteUrl));
}

/**
 * Same precedence as getPublicAppUrl() in src/lib/app-url.ts.
 * @param {Record<string, string | undefined>} env
 * @returns {boolean}
 */
export function searchIndexingAllowed(env = process.env) {
  return isIndexableSiteUrl(env.NEXT_PUBLIC_APP_URL?.trim() || env.VERCEL_URL?.trim() || "");
}
