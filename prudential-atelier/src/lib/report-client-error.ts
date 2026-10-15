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
