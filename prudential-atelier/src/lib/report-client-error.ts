/**
 * Path prefixes whose next segment is a capability token (src/lib/capability-registry.ts):
 * the URL alone opens something without a sign-in, so it must never reach ErrorLog.
 * Each is matched with and without a leading /api.
 */
export const TOKEN_PATH_PREFIXES: readonly string[][] = [
  ["invoice"],
  ["track"],
  ["receipt"],
  ["quote"],
  ["approve"],
  ["unsubscribe"],
  ["auth", "reset-password"],
  ["auth", "verify-email"],
  ["checkout", "restore"],
  ["consultation", "book"],
];

export const REDACTED_SEGMENT = ":token";

function redactPath(pathname: string): string {
  const parts = pathname.split("/");
  // parts[0] is "" for an absolute path.
  for (let i = 1; i < parts.length; i += 1) {
    for (const prefix of TOKEN_PATH_PREFIXES) {
      const startsAtRoot = i === 1;
      const startsAfterApi = i === 2 && parts[1] === "api";
      if (!startsAtRoot && !startsAfterApi) continue;
      const matches = prefix.every((seg, k) => parts[i + k] === seg);
      const tokenAt = i + prefix.length;
      if (matches && parts[tokenAt]) parts[tokenAt] = REDACTED_SEGMENT;
    }
  }
  return parts.join("/");
}

/**
 * Error-log URL with no secrets: token path segments become ":token", and the
 * query string and hash are dropped entirely (reset links, invite tokens and
 * UTM tags all live there). Keeps the origin when the input had one.
 */
export function redactErrorUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  try {
    const hasOrigin = /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
    const url = new URL(value, "http://redact.invalid");
    const path = redactPath(url.pathname);
    return (hasOrigin ? `${url.origin}${path}` : path).slice(0, 2000);
  } catch {
    // Not parseable: keep only what precedes ? or #, then redact.
    return redactPath(value.split(/[?#]/)[0] ?? "").slice(0, 2000);
  }
}

const TOKEN_IN_TEXT = new RegExp(
  `(/(?:api/)?(?:${TOKEN_PATH_PREFIXES.map((p) => p.join("/")).join("|")})/)[^/?#\\s"'\`)]+`,
  "g",
);

/** For free text (messages, stacks) that may quote the page URL: same token rule, applied inline. */
export function redactTokensInText(text: string): string {
  return text.replace(TOKEN_IN_TEXT, `$1${REDACTED_SEGMENT}`);
}

/** Browser → POST /api/logs/client. Failures are swallowed so reporting cannot loop. */
export function reportClientError(error: {
  message?: string;
  stack?: string;
  digest?: string;
}): void {
  if (typeof window === "undefined") return;
  const message = (error.message ?? "Client error").slice(0, 2000);
  const body = JSON.stringify({
    message,
    stack: error.stack?.slice(0, 8000),
    digest: error.digest?.slice(0, 200),
    url: redactErrorUrl(window.location.href),
  });
  void fetch("/api/logs/client", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

/**
 * Errors that are not the site's: scripts Facebook/Instagram in-app browsers and
 * wallet extensions inject, bots, and requests the visitor's connection dropped.
 * Dropped in the browser and again on the server, so old tabs cannot fill the log.
 */
const OUTSIDE_SOURCES = [
  "iabjs://", // Facebook / Instagram in-app browser scripts
  "chrome-extension://",
  "moz-extension://",
  "safari-extension://",
  "safari-web-extension://",
  "ext:core/", // Deno-based crawlers
];
const OUTSIDE_MESSAGES = [
  "java object is gone",
  "window.webkit.messagehandlers",
  "redefine property: ethereum",
  "metamask",
  "resizeobserver",
  "script error",
];
/** A request the network dropped: the visitor's connection, not a bug. */
const NETWORK_MESSAGES = new Set([
  "failed to fetch",
  "load failed",
  "networkerror when attempting to fetch resource.",
  "the network connection was lost.",
  "the internet connection appears to be offline.",
  "the operation was aborted.",
  "the user aborted a request.",
  "fetch is aborted",
  "cancelled",
]);

export function isOutsideNoise(error: { message?: string | null; stack?: string | null }): boolean {
  const message = (error.message ?? "").trim().toLowerCase();
  const stack = (error.stack ?? "").toLowerCase();
  if (!message) return true;
  if (NETWORK_MESSAGES.has(message.replace(/^typeerror:\s*/, ""))) return true;
  if (OUTSIDE_MESSAGES.some((m) => message.includes(m))) return true;
  if (OUTSIDE_SOURCES.some((s) => message.includes(s) || stack.includes(s))) return true;
  return false;
}

/** A page script from before the latest deploy is gone: reloading fetches the new one. */
export function isStaleChunkError(message: string | null | undefined): boolean {
  return /loading (css )?chunk [\w-]+ failed|chunkloaderror/i.test(message ?? "");
}

const CHUNK_RELOAD_KEY = "pg_chunk_reload_at";

/**
 * After a deploy, an open tab asks for scripts that no longer exist. Reload once
 * (not more than once a minute, so a real failure still gets reported).
 */
export function reloadForStaleChunk(): boolean {
  try {
    const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

