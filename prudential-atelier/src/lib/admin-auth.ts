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
import { getAdminImpersonation, type ImpersonationPayload } from "@/lib/admin-impersonate";
import { cachedRoleActorPatch, ensurePermissionCache } from "@/lib/permission-cache";
import { prisma } from "@/lib/prisma";
import { isStaffPortalPerson } from "@/lib/staff-view-as";

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

/**
 * Who the admin screens are for. While the Super Admin views as someone, this
 * is that person: their id, name and email, so "assigned to me", "my alerts",
 * the greeting and the account card are theirs, not hers.
 */
export type EffectiveAdminUser = { id: string; name: string; email: string | null };

/** The access a person would have in the admin, as "View as" shows it. */
export function impersonationActor(target: {
  email: string;
  role: string;
  userPermissions: { permission: string; mode: string }[];
}): AccessActor {
  return {
    email: target.email,
    grants: target.userPermissions.filter((p) => p.mode === "GRANT").map((p) => p.permission),
    revokes: [
      ...target.userPermissions.filter((p) => p.mode === "REVOKE").map((p) => p.permission),
      "settings.developer",
    ],
    ...cachedRoleActorPatch(target.role),
  };
}

export async function resolveSessionAccess(session: Session): Promise<{
  role: string;
  actor: AccessActor;
  user: EffectiveAdminUser;
  previewRole: string | null;
  impersonation: ImpersonationPayload | null;
  /**
   * A "View as" cookie names someone who cannot open the admin (Staff, a client,
   * someone since deactivated). It is ignored here, and the admin layout ends it,
   * so the Super Admin is never sent back to the sign-in page by her own cookie.
   */
  staleImpersonation: boolean;
  /** The cookie names an active staff member: the admin layout sends her to their staff portal. */
  staffImpersonation: boolean;
}> {
  await ensurePermissionCache();
  const impersonation = await getAdminImpersonation(session.user?.role, session.user?.email);
  let staleImpersonation = false;
  let staffImpersonation = false;
  if (impersonation) {
    const target = await prisma.user.findUnique({
      where: { id: impersonation.targetId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isStaff: true,
        isActive: true,
        userPermissions: { select: { permission: true, mode: true } },
      },
    });
    const actor = target ? impersonationActor(target) : null;
    if (target && actor && target.isActive && target.role !== "SUPER_ADMIN" && hasAnyAdminPermission(target.role, actor)) {
      return {
        role: target.role,
        actor,
        user: { id: target.id, name: target.name?.trim() || target.email, email: target.email },
        previewRole: null,
        impersonation,
        staleImpersonation: false,
        staffImpersonation: false,
      };
    }
    if (target?.isActive && target.role !== "SUPER_ADMIN" && isStaffPortalPerson(target)) staffImpersonation = true;
    else staleImpersonation = true;
  }

  const previewRole = await getAdminPreviewRole(session.user?.role, session.user?.email);
  const { role, actor } = sessionAccessActor(session, previewRole);
  const user: EffectiveAdminUser = {
    id: session.user?.id ?? "",
    name: session.user?.name?.trim() || session.user?.email || "",
    email: session.user?.email ?? null,
  };
  return { role, actor, user, previewRole, impersonation: null, staleImpersonation, staffImpersonation };
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

/** Real Super Admin only — preview/impersonation cannot open this gate unless opted in. */
export async function requireSuperAdminApi(opts?: { allowImpersonation?: boolean }): Promise<Gate> {
  const gate = await sessionGate();
  if (!gate.ok) return gate;
  if (gate.session.user.role !== "SUPER_ADMIN") {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  if (!opts?.allowImpersonation) {
    const impersonation = await getAdminImpersonation(gate.session.user.role, gate.session.user.email);
    if (impersonation) {
      return {
        ok: false,
        response: NextResponse.json({ error: "View as user is read-only." }, { status: 403 }),
      };
    }
  }
  return gate;
}
