import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import {
  CMS_ADMIN_PERMISSIONS,
  hasAnyAdminPermission,
  hasPermission,
  type AccessActor,
  type AdminPermission,
} from "@/lib/roles";
import { getAdminPreviewRole } from "@/lib/admin-preview";
import { cachedRoleActorPatch, ensurePermissionCache } from "@/lib/permission-cache";

export { CMS_ADMIN_PERMISSIONS };

const CONTENT_SETTING_GROUPS = new Set(["CONTENT", "APPEARANCE", "SEO", "SOCIAL"]);

export function permissionForSettingsGroup(group: string): AdminPermission | readonly AdminPermission[] {
  if (CONTENT_SETTING_GROUPS.has(group.toUpperCase())) return CMS_ADMIN_PERMISSIONS;
  return "settings";
}

export function isGeneralAdminRole(role: string | undefined): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function sessionAccessActor(
  session: Session,
  previewRole?: string | null,
): { role: string; actor: AccessActor } {
  const email = session.user?.email ?? null;
  const realRole = session.user?.role ?? "";
  const role = previewRole || realRole;
  const grants = previewRole ? [] : (session.user?.permissionGrants ?? []);
  const revokes = previewRole ? [] : (session.user?.permissionRevokes ?? []);
  return {
    role,
    actor: {
      email: previewRole ? null : email,
      grants,
      revokes,
      ...cachedRoleActorPatch(role),
    },
  };
}

export async function resolveSessionAccess(session: Session): Promise<{
  role: string;
  actor: AccessActor;
  previewRole: string | null;
}> {
  await ensurePermissionCache();
  const previewRole = await getAdminPreviewRole(session.user?.role, session.user?.email);
  const { role, actor } = sessionAccessActor(session, previewRole);
  return { role, actor, previewRole };
}

type Gate = { ok: true; session: Session } | { ok: false; response: NextResponse };

async function sessionGate(): Promise<Gate> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { ok: true, session };
}

/** Any role with a non-empty permission set (admin portal chrome). */
export async function requireAdminPortalApi(): Promise<Gate> {
  const gate = await sessionGate();
  if (!gate.ok) return gate;
  const { role, actor } = await resolveSessionAccess(gate.session);
  if (!hasAnyAdminPermission(role, actor)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return gate;
}

/** Per-route permission from the resolved set (parent keys cover dotted children). */
export async function requireAdminApi(
  permission: AdminPermission | readonly AdminPermission[],
): Promise<Gate> {
  const gate = await sessionGate();
  if (!gate.ok) return gate;
  const needed = Array.isArray(permission) ? permission : [permission];
  const { role, actor } = await resolveSessionAccess(gate.session);
  const ok = needed.some((p) => hasPermission(role, p, actor));
  if (!ok) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return gate;
}

/** SUPER_ADMIN and ADMIN only. Preview role is applied so "view as" is honest. */
export async function requireGeneralAdminApi(): Promise<Gate> {
  const gate = await sessionGate();
  if (!gate.ok) return gate;
  const { role } = await resolveSessionAccess(gate.session);
  if (!isGeneralAdminRole(role)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return gate;
}

/** Real Super Admin only — preview as another role cannot open this gate. */
export async function requireSuperAdminApi(): Promise<Gate> {
  const gate = await sessionGate();
  if (!gate.ok) return gate;
  if (gate.session.user.role !== "SUPER_ADMIN") {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return gate;
}
