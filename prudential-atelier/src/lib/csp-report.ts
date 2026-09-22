/**
 * Parse CSP violation reports (Slice AZ4) into privacy-safe aggregates.
 *
 * Browsers send either `application/csp-report` ({ "csp-report": {...} }, from
 * report-uri) or `application/reports+json` ([{ type: "csp-violation", body }]).
 * We keep only the directive, the blocked origin and the page's first path
 * segment — never full URLs, which on /invoice/… or /track/… contain tokens.
 */

export type CspViolationKey = {
  directive: string;
  blockedOrigin: string;
  documentPath: string;
};

/** Reports larger than this are dropped unread. */
export const CSP_REPORT_MAX_BYTES = 16 * 1024;
/** A single POST may batch reports; cap how many we count. */
export const CSP_REPORT_MAX_ITEMS = 20;

const SHORT = 120;

function clip(s: string): string {
  return s.length > SHORT ? s.slice(0, SHORT) : s;
}

/** "https://js.stripe.com/v3/x.js" → "https://js.stripe.com"; keywords kept ("inline", "eval", "data"). */
export function blockedOriginOf(raw: unknown): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return "(none)";
  if (/^(inline|eval|wasm-eval|trusted-types-policy|trusted-types-sink)$/i.test(s)) return s.toLowerCase();
  // Reporting API sends bare "data"/"blob"; report-uri sends "data:…".
  if (/^(data|blob|mediastream|filesystem)(:|$)/i.test(s)) return `${s.split(":")[0].toLowerCase()}:`;
  try {
    return clip(new URL(s).origin);
  } catch {
    return "(unparsed)";
  }
}

/** "https://site/invoice/abc?x=1" → "/invoice"; "/" stays "/". Never returns a token. */
export function documentPathOf(raw: unknown): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return "(none)";
  try {
    const first = new URL(s).pathname.split("/").filter(Boolean)[0];
    return first ? clip(`/${first}`) : "/";
  } catch {
    return "(unparsed)";
  }
}

/** "script-src-elem 'self' …" → "script-src-elem". */
function directiveOf(raw: unknown): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  return clip(s.split(/\s+/)[0] || "(none)");
}

function fromBody(body: Record<string, unknown>): CspViolationKey {
  return {
    directive: directiveOf(body["effective-directive"] ?? body.effectiveDirective ?? body["violated-directive"]),
    blockedOrigin: blockedOriginOf(body["blocked-uri"] ?? body.blockedURL),
    documentPath: documentPathOf(body["document-uri"] ?? body.documentURL),
  };
}

export function parseCspReports(payload: unknown): CspViolationKey[] {
  const out: CspViolationKey[] = [];
  if (Array.isArray(payload)) {
    for (const item of payload.slice(0, CSP_REPORT_MAX_ITEMS)) {
      if (item && typeof item === "object" && (item as { type?: unknown }).type === "csp-violation") {
        const body = (item as { body?: unknown }).body;
        if (body && typeof body === "object") out.push(fromBody(body as Record<string, unknown>));
      }
    }
    return out;
  }
  if (payload && typeof payload === "object") {
    const legacy = (payload as { "csp-report"?: unknown })["csp-report"];
    if (legacy && typeof legacy === "object") out.push(fromBody(legacy as Record<string, unknown>));
  }
  return out;
}
