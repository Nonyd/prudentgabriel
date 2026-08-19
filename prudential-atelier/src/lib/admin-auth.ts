import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import {
  CMS_ADMIN_PERMISSIONS,
  hasAnyAdminPermission,
  hasPermission,
  type AdminPermission,
} from "@/lib/roles";

export { CMS_ADMIN_PERMISSIONS };

const CONTENT_SETTING_GROUPS = new Set(["CONTENT", "APPEARANCE", "SEO", "SOCIAL"]);

export function permissionForSettingsGroup(group: string): AdminPermission | readonly AdminPermission[] {
  if (CONTENT_SETTING_GROUPS.has(group.toUpperCase())) return CMS_ADMIN_PERMISSIONS;
  return "settings";
}

export function isGeneralAdminRole(role: string | undefined): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

type Gate = { ok: true; session: Session } | { ok: false; response: NextResponse };

async function sessionGate(): Promise<Gate> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { ok: true, session };
}

/** Any role with a non-empty ROLE_PERMISSIONS entry (admin portal chrome). */
export async function requireAdminPortalApi(): Promise<Gate> {
  const gate = await sessionGate();
  if (!gate.ok) return gate;
  if (!hasAnyAdminPermission(gate.session.user.role)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return gate;
}

/** Per-route permission from ROLE_PERMISSIONS (parent keys cover dotted children). */
export async function requireAdminApi(
  permission: AdminPermission | readonly AdminPermission[],
): Promise<Gate> {
  const gate = await sessionGate();
  if (!gate.ok) return gate;
  const needed = Array.isArray(permission) ? permission : [permission];
  const role = gate.session.user.role;
  const ok = needed.some((p) => hasPermission(role, p));
  if (!ok) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return gate;
}

/** SUPER_ADMIN and ADMIN (General Manager) only. */
export async function requireGeneralAdminApi(): Promise<Gate> {
  const gate = await sessionGate();
  if (!gate.ok) return gate;
  if (!isGeneralAdminRole(gate.session.user.role)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return gate;
}

export async function requireSuperAdminApi(): Promise<Gate> {
  const gate = await sessionGate();
  if (!gate.ok) return gate;
  if (gate.session.user.role !== "SUPER_ADMIN") {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return gate;
}
