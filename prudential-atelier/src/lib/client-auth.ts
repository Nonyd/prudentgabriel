import { getSession } from "next-auth/react";
import type { Session } from "next-auth";
import type { SignInResponse } from "next-auth/react";
import { loginPathForUser, userHasAdminAccess } from "@/lib/login-paths";

export { loginPathForUser, safeLoginNext, destinationAfterCustomerSignIn, userHasAdminAccess } from "@/lib/login-paths";

export function isSignInFailure(res: SignInResponse | undefined): boolean {
  return !res?.ok || Boolean(res?.error);
}

export function canAccessStaffPortal(session: Session | null | undefined): boolean {
  if (!session?.user?.id) return false;
  const { role, isStaff } = session.user;
  return isStaff === true || role === "STAFF";
}

/** Where to send the user after a successful staff-portal sign-in, or null if not allowed. */
export function resolveStaffPortalRedirect(session: Session | null | undefined): string | null {
  if (!session?.user?.id) return null;

  if (session.user.mustResetPassword) {
    return "/reset-password?required=true";
  }

  if (userHasAdminAccess(session.user)) {
    return "/admin";
  }

  if (canAccessStaffPortal(session)) {
    return "/staff";
  }

  return null;
}

type WaitOptions = {
  maxAttempts?: number;
  delayMs?: number;
  /** Defaults to waiting until `session.user.id` is set. */
  until?: (session: Session | null) => boolean;
};

export async function waitForClientSession(options?: WaitOptions): Promise<Session | null> {
  const maxAttempts = options?.maxAttempts ?? 20;
  const delayMs = options?.delayMs ?? 100;
  const until =
    options?.until ?? ((session) => Boolean(session?.user?.id));

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const session = await getSession();
    if (until(session)) return session;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
}

/** Full navigation so middleware and RSC see the new session cookie. */
export function hardNavigate(url: string): void {
  window.location.assign(url);
}

/** Sign-in screen to open after a password reset (cookie is no longer valid). */
export function loginPathAfterPasswordReset(session: Session | null | undefined): string {
  return loginPathForUser(session?.user);
}

/** API `{ error }` may be a string or Zod fieldErrors — never pass an object to React. */
const FIELD_ORDER = ["password", "confirmPassword", "email", "token", "firstName", "lastName", "name", "phone"];

/** The first message out of a field map, preferring the fields people most often get wrong. */
function firstFieldMessage(fields: Record<string, unknown>): string | null {
  const keys = [...FIELD_ORDER.filter((k) => k in fields), ...Object.keys(fields).filter((k) => !FIELD_ORDER.includes(k))];
  for (const key of keys) {
    const value = fields[key];
    if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) return value[0];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

/**
 * A readable message from an auth API error body. Handles a plain string, a
 * field map, and zod's flatten() shape ({ formErrors, fieldErrors }) — which a
 * form must never render as an object.
 */
export function authApiErrorMessage(data: unknown, fallback = "Something went wrong"): string {
  if (!data || typeof data !== "object") return fallback;
  const error = (data as { error?: unknown }).error;
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object") {
    const e = error as { fieldErrors?: unknown; formErrors?: unknown };
    if (e.fieldErrors && typeof e.fieldErrors === "object") {
      const m = firstFieldMessage(e.fieldErrors as Record<string, unknown>);
      if (m) return m;
    }
    if (Array.isArray(e.formErrors) && typeof e.formErrors[0] === "string") return e.formErrors[0];
    const m = firstFieldMessage(error as Record<string, unknown>);
    if (m) return m;
  }
  return fallback;
}

/**
 * The message for a failed auth request: a 429 says how long to wait; anything
 * else uses the server's words. Reads the body safely (an HTML error page is
 * not JSON). Never claims success.
 */
export async function authResponseMessage(res: Response, fallback = "Something went wrong. Please try again."): Promise<string> {
  if (res.status === 429) {
    const secs = Number(res.headers.get("Retry-After"));
    const minutes = Number.isFinite(secs) && secs > 0 ? Math.max(1, Math.ceil(secs / 60)) : 15;
    return `Too many attempts. Please wait ${minutes} minute${minutes === 1 ? "" : "s"}, then try again.`;
  }
  const data = await res.json().catch(() => null);
  return authApiErrorMessage(data, fallback);
}

export const NETWORK_ERROR_MESSAGE = "We could not reach the server. Please check your connection and try again.";

/** Query flag the sign-in pages read to say why the person is there. */
export const PASSWORD_CHANGED_REASON = "password-changed";

/**
 * Change a password from a settings screen. A failure returns the server's
 * reason (the password rule, "current password is incorrect"), never a generic
 * line. A success ends every session, this one included (passwordChangedAt), so
 * the caller should sign the person out and send them to sign in again.
 */
export async function submitPasswordChange(
  url: string,
  body: { currentPassword: string; newPassword: string; confirmPassword: string },
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    return { ok: false, message: await authResponseMessage(res, "Could not update your password.") };
  } catch {
    return { ok: false, message: NETWORK_ERROR_MESSAGE };
  }
}
