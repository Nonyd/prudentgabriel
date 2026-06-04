import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { isAdminRole, isSuperAdmin } from "@/lib/roles";

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
  const role = gate.session.user.role ?? "";
  const email = gate.session.user.email;
  if (role === "SUPER_ADMIN" || isSuperAdmin(role, email)) return gate;
  if (role === "ADMIN" && roles.includes("ADMIN")) return gate;
  if (roles.includes(role)) return gate;
  return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
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

export function validateCronSecret(req: Request): boolean {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return authHeader === `Bearer ${secret}`;
}

export const BESPOKE_ROLES = ["BESPOKE_MANAGER", "ADMIN", "SUPER_ADMIN"];
export const HR_ROLES = ["HR_MANAGER", "ADMIN", "SUPER_ADMIN"];
export const FINANCE_ROLES = ["FINANCE_MANAGER", "BESPOKE_MANAGER", "ADMIN", "SUPER_ADMIN"];
export const CONTENT_ROLES = ["CONTENT_MANAGER", "ADMIN", "SUPER_ADMIN"];
export const LOG_ROLES = ["ADMIN", "SUPER_ADMIN"];
