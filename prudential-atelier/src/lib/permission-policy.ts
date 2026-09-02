import { isSuperAdmin } from "@/lib/roles";
import { ADMIN_PERMISSION_CATALOG, EDITABLE_ADMIN_ROLES } from "@/lib/permission-catalog";
import type { AdminPermission } from "@/lib/roles";

export function isRolePermissionsEditable(role: string | undefined | null): boolean {
  if (!role) return false;
  if (role === "SUPER_ADMIN") return false;
  return (EDITABLE_ADMIN_ROLES as readonly string[]).includes(role);
}

export function lastSuperAdminCannotBeRemoved(superAdminCount: number): boolean {
  return superAdminCount <= 1;
}

export function canEditTargetUserPermissions(opts: {
  actorId: string | undefined | null;
  actorRole: string | undefined | null;
  actorEmail?: string | null;
  targetId: string;
  targetRole: string;
}): { ok: true } | { ok: false; reason: string } {
  if (!isSuperAdmin(opts.actorRole, opts.actorEmail)) {
    return { ok: false, reason: "Only Super Admin can edit permissions." };
  }
  if (!opts.actorId) {
    return { ok: false, reason: "Missing actor." };
  }
  if (opts.actorId === opts.targetId) {
    return { ok: false, reason: "You cannot edit your own permissions." };
  }
  if (opts.targetRole === "SUPER_ADMIN") {
    return { ok: false, reason: "Super Admin always holds every permission and cannot be edited." };
  }
  return { ok: true };
}

export function canChangeTargetRole(opts: {
  targetRole: string;
  nextRole: string | undefined;
  superAdminCount: number;
}): { ok: true } | { ok: false; reason: string } {
  if (opts.nextRole === undefined) return { ok: true };
  if (opts.targetRole !== "SUPER_ADMIN") return { ok: true };
  if (lastSuperAdminCannotBeRemoved(opts.superAdminCount)) {
    return { ok: false, reason: "The last Super Admin cannot be demoted." };
  }
  return { ok: false, reason: "Super Admin role cannot be changed." };
}

export function filterEditablePermissions(keys: readonly string[]): AdminPermission[] {
  const allowed = new Set(
    ADMIN_PERMISSION_CATALOG.filter((e) => !e.superAdminOnly).map((e) => e.key),
  );
  return keys.filter((k): k is AdminPermission => allowed.has(k as AdminPermission));
}
