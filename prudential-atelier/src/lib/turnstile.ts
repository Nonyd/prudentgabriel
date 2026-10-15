import { logServerError } from "@/lib/logger";

/**
 * Cloudflare Turnstile: a spam check on public forms.
 *
 * Keys are read at request time, not baked into the build: TURNSTILE_SITE_KEY
 * (shown to the browser) and TURNSTILE_SECRET_KEY (server only). With no keys
 * the check is off, so local and staging work without a Cloudflare widget.
 */
export function turnstileSiteKey(): string | null {
  const key = process.env.TURNSTILE_SITE_KEY?.trim();
  return key && process.env.TURNSTILE_SECRET_KEY?.trim() ? key : null;
}

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileResult = { ok: true } | { ok: false; reason: "missing" | "invalid" | "unavailable" };

export async function verifyTurnstile(token: unknown, ip: string | null): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret || !process.env.TURNSTILE_SITE_KEY?.trim()) return { ok: true };
  if (typeof token !== "string" || !token || token.length > 2048) return { ok: false, reason: "missing" };

  const form = new URLSearchParams({ secret, response: token });
  if (ip && ip !== "unknown") form.set("remoteip", ip);
  try {
    const res = await fetch(VERIFY_URL, { method: "POST", body: form, signal: AbortSignal.timeout(8000) });
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    return data.success === true ? { ok: true } : { ok: false, reason: "invalid" };
  } catch (error) {
    void logServerError({ errorType: "TURNSTILE_VERIFY", error });
    return { ok: false, reason: "unavailable" };
  }
}

export function turnstileErrorMessage(reason: "missing" | "invalid" | "unavailable"): string {
  if (reason === "unavailable") return "We could not check the form just now. Please try again in a moment.";
  return "Please complete the security check, then send again.";
}
