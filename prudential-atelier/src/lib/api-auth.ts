import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { isAdminRole } from "@/lib/roles";
import { sessionHasRole } from "@/lib/bespoke-roles";
import { verifyCronRequest } from "@/lib/cron/verify";

export {
  BESPOKE_STAFF_ROLES,
  BESPOKE_MANAGER_ROLES,
  BESPOKE_ADMIN_ROLES,
  BESPOKE_ROLES,
  sessionHasRole,
} from "@/lib/bespoke-roles";

type AuthResult =
  | { ok: true; session: Session }
  | { ok: false; response: NextResponse };

export async function requireSession(): Promise<AuthResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { ok: true, session };
}

export async function requireRoles(roles: string[]): Promise<AuthResult> {
  const gate = await requireSession();
  if (!gate.ok) return gate;
  if (!sessionHasRole(gate.session.user.role, gate.session.user.email, roles)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return gate;
}

export async function requireAdmin(): Promise<AuthResult> {
  const gate = await requireSession();
  if (!gate.ok) return gate;
  if (!isAdminRole(gate.session.user.role)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return gate;
}

export async function requireStaff(): Promise<AuthResult> {
  return requireRoles(["STAFF", "ADMIN", "SUPER_ADMIN"]);
}

export async function requireStaffPortal(): Promise<AuthResult> {
  const gate = await requireSession();
  if (!gate.ok) return gate;
  const { role, isStaff } = gate.session.user;
  if (isStaff === true || role === "STAFF" || isAdminRole(role)) return gate;
  return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
}

/** @deprecated Prefer verifyCronRequest from @/lib/cron/verify — kept for legacy routes. */
export function validateCronSecret(req: Request): boolean {
  return verifyCronRequest(req);
}

export const HR_ROLES = ["HR_MANAGER", "ADMIN", "SUPER_ADMIN"];
export const FINANCE_ROLES = ["FINANCE_MANAGER", "BESPOKE_MANAGER", "ADMIN", "SUPER_ADMIN"];
export const CONTENT_ROLES = ["CONTENT_MANAGER", "ADMIN", "SUPER_ADMIN"];
export const LOG_ROLES = ["ADMIN", "SUPER_ADMIN"];
