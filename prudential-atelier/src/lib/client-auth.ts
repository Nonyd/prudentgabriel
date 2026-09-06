import { getSession } from "next-auth/react";
import type { Session } from "next-auth";
import type { SignInResponse } from "next-auth/react";
import { hasAnyAdminPermission } from "@/lib/roles";

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

  const role = session.user.role ?? "";
  if (hasAnyAdminPermission(role)) {
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
  const role = session?.user?.role ?? "";
  if (session?.user?.isStaff === true || role === "STAFF") return "/login?tab=staff";
  if (hasAnyAdminPermission(role)) return "/login?tab=admin";
  return "/auth/login";
}

/** API `{ error }` may be a string or Zod fieldErrors — never pass an object to React. */
export function authApiErrorMessage(data: unknown, fallback = "Something went wrong"): string {
  if (!data || typeof data !== "object") return fallback;
  const error = (data as { error?: unknown }).error;
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object") {
    const fields = error as Record<string, unknown>;
    for (const key of ["confirmPassword", "password", "token", "email"]) {
      const value = fields[key];
      if (Array.isArray(value) && typeof value[0] === "string") return value[0];
      if (typeof value === "string" && value.trim()) return value;
    }
  }
  return fallback;
}
