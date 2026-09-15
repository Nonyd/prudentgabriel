import { hasAnyAdminPermission, type AccessActor } from "@/lib/roles";

const LOGIN_AFTER_RESET = new Set(["/login?tab=admin", "/login?tab=staff", "/auth/login"]);

export type LoginPathUser = {
  role?: string | null;
  isStaff?: boolean;
  permissionGrants?: readonly string[];
  permissionRevokes?: readonly string[];
  adminPermissions?: readonly string[] | "*";
};

export function accessActorFromUser(user: LoginPathUser | null | undefined): AccessActor {
  return {
    grants: user?.permissionGrants,
    revokes: user?.permissionRevokes,
  };
}

export function userHasAdminAccess(user: LoginPathUser | null | undefined): boolean {
  return hasAnyAdminPermission(user?.role, accessActorFromUser(user));
}

/** Sign-in screen after a password reset (the session cookie is no longer valid). */
export function loginPathForUser(user: LoginPathUser | null | undefined): string {
  if (userHasAdminAccess(user)) return "/login?tab=admin";
  if (user?.isStaff === true || user?.role === "STAFF") return "/login?tab=staff";
  return "/auth/login";
}

/** Ignore a forged `next` from the reset API. */
export function safeLoginNext(value: unknown, fallback = "/auth/login"): string {
  return typeof value === "string" && LOGIN_AFTER_RESET.has(value) ? value : fallback;
}

function isDefaultCustomerHome(path: string): boolean {
  return path === "/account" || path === "/account/";
}

/**
 * Customer `/auth/login` defaults to `/account`. House staff who used forgot-password
 * must not be dumped on the client portal.
 */
export function destinationAfterCustomerSignIn(
  user: LoginPathUser | null | undefined,
  callbackUrl: string,
): string {
  const trimmed = callbackUrl.trim() || "/account";
  if (userHasAdminAccess(user) && isDefaultCustomerHome(trimmed)) return "/admin";
  if (
    (user?.isStaff === true || user?.role === "STAFF") &&
    isDefaultCustomerHome(trimmed)
  ) {
    return "/staff";
  }
  return trimmed;
}
