import { Role } from "@prisma/client";
import {
  applyUserOverrides,
  permissionSetAllows,
  toPermissionSet,
  type AccessActor,
  type PermissionSource,
} from "@/lib/permission-resolve";

export type { AccessActor, PermissionSource };

export type AdminPermission =
  | "dashboard"
  | "bespoke"
  | "consultations"
  | "invoices"
  | "quotations"
  | "shop"
  | "shop.products"
  | "shop.orders"
  | "clients"
  | "clients.view"
  | "staff"
  | "staff.view"
  | "attendance"
  | "finance"
  | "reports"
  | "reports.staff"
  | "content"
  | "content.blog"
  | "content.pages"
  | "payments"
  | "logs"
  | "settings"
  | "settings.bank-accounts"
  | "settings.developer";

/** CMS surfaces: parent `content` plus CONTENT_MANAGER's dotted keys. */
export const CMS_ADMIN_PERMISSIONS = [
  "content",
  "content.blog",
  "content.pages",
] as const satisfies readonly AdminPermission[];

/** General Admin (Mrs. Prudent + deputies) — maps to ADMIN in the schema. */
export const ROLE_PERMISSIONS: Record<string, readonly AdminPermission[] | ["*"]> = {
  SUPER_ADMIN: ["*"],


  ADMIN: [
    "dashboard",
    "bespoke",
    "consultations",
    "invoices",
    "quotations",
    "shop",
    "clients",
    "staff",
    "attendance",
    "finance",
    "payments",
    "reports",
    "content",
    "logs",
    "settings",
  ],

  STAFF_ADMIN: [
    "dashboard",
    "bespoke",
    "consultations",
    "invoices",
    "quotations",
    "shop",
    "clients",
    "staff",
    "attendance",
    "finance",
    "payments",
    "content",
  ],

  BESPOKE_MANAGER: ["bespoke", "consultations", "clients.view"],
  RTW_MANAGER: ["shop.products", "shop.orders"],
  CONTENT_MANAGER: ["content.blog", "content.pages"],
  FINANCE_MANAGER: ["invoices", "quotations", "finance", "payments", "reports", "settings.bank-accounts"],
  HR_MANAGER: ["staff", "attendance"],
  CONSULTATION_MANAGER: ["consultations", "clients.view"],
  STAFF: [],
} as const;

export const PROTECTED_ACCOUNTS = [
  process.env.SUPER_ADMIN_EMAIL,
  process.env.GENERAL_ADMIN_EMAIL,
].filter(Boolean) as string[];

export function seedRolePermissionSet(role: string | undefined | null): ReadonlySet<string> | "*" {
  if (!role) return new Set();
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return new Set();
  if (perms[0] === "*") return "*";
  return new Set(perms as readonly string[]);
}

export function resolveEffectivePermissionSet(
  role: string | undefined | null,
  actor?: AccessActor,
): ReadonlySet<string> | "*" {
  if (isSuperAdmin(role, actor?.email)) return "*";
  if (actor?.resolved !== undefined) return toPermissionSet(actor.resolved);
  const roleSet =
    actor?.rolePermissions !== undefined
      ? toPermissionSet(actor.rolePermissions)
      : seedRolePermissionSet(role);
  return applyUserOverrides(roleSet, actor?.grants, actor?.revokes);
}

export function hasAnyAdminPermission(
  role: string | undefined | null,
  actor?: AccessActor,
): boolean {
  if (!role) return false;
  const set = resolveEffectivePermissionSet(role, actor);
  if (set === "*") return true;
  return set.size > 0;
}

export function isGeneralAdmin(role: string | undefined | null): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function isSuperAdmin(role: string | undefined | null, email?: string | null): boolean {
  if (role === "SUPER_ADMIN") return true;
  if (email && email === process.env.SUPER_ADMIN_EMAIL) return true;
  return false;
}

export function isProtectedAccount(email: string | null | undefined): boolean {
  if (!email) return false;
  return PROTECTED_ACCOUNTS.includes(email);
}

export function isSuperAdminAccount(email: string | null | undefined): boolean {
  return !!email && email === process.env.SUPER_ADMIN_EMAIL;
}

export function isGeneralAdminAccount(email: string | null | undefined): boolean {
  return !!email && email === process.env.GENERAL_ADMIN_EMAIL;
}

/** Only SUPER_ADMIN may modify Mrs. Prudent's account; super admin seat is immutable by others. */
export function canModifyAdminUser(
  actorRole: string | undefined | null,
  actorEmail: string | null | undefined,
  targetEmail: string | null | undefined,
): boolean {
  if (!isGeneralAdmin(actorRole) && actorRole !== "SUPER_ADMIN") return false;
  if (isSuperAdmin(actorRole, actorEmail)) return true;
  if (isSuperAdminAccount(targetEmail)) return false;
  if (isGeneralAdminAccount(targetEmail)) return false;
  return actorRole === "ADMIN";
}

export function hasPermission(
  role: string | undefined | null,
  permission: AdminPermission,
  actor?: AccessActor,
): boolean {
  if (!role && !actor?.resolved) return false;
  if (isSuperAdmin(role, actor?.email)) return true;
  if (actor?.revokes?.includes(permission)) return false;
  return permissionSetAllows(resolveEffectivePermissionSet(role, actor), permission);
}

/** Same predicate `requireAdminApi` uses after a session exists. */
export function roleAllows(
  role: string | undefined | null,
  needed: AdminPermission | readonly AdminPermission[],
  actor?: AccessActor,
): boolean {
  const list = Array.isArray(needed) ? needed : [needed];
  return list.some((p) => hasPermission(role, p, actor));
}

export const ALL_PERMISSIONS: readonly AdminPermission[] = [
  "dashboard",
  "bespoke",
  "consultations",
  "invoices",
  "quotations",
  "shop",
  "shop.products",
  "shop.orders",
  "clients",
  "clients.view",
  "staff",
  "staff.view",
  "attendance",
  "finance",
  "reports",
  "reports.staff",
  "content",
  "content.blog",
  "content.pages",
  "payments",
  "logs",
  "settings",
  "settings.bank-accounts",
  "settings.developer",
];

/** Dotted children unlocked only because the parent key is on the role. */
export function inheritedDottedPermissions(role: string, actor?: AccessActor): AdminPermission[] {
  const roleSet =
    actor?.rolePermissions !== undefined
      ? toPermissionSet(actor.rolePermissions)
      : seedRolePermissionSet(role);
  if (roleSet === "*") return [];
  const out: AdminPermission[] = [];
  for (const p of ALL_PERMISSIONS) {
    const dot = p.indexOf(".");
    if (dot < 0) continue;
    if (roleSet.has(p)) continue;
    if (hasPermission(role, p, { ...actor, grants: [], revokes: [], resolved: undefined, rolePermissions: actor?.rolePermissions })) {
      out.push(p);
    }
  }
  return out;
}

export function permissionSourceFor(
  role: string | undefined | null,
  permission: AdminPermission,
  actor?: AccessActor,
): PermissionSource {
  if (isSuperAdmin(role, actor?.email)) return "super_admin";
  const roleSet =
    actor?.rolePermissions !== undefined
      ? toPermissionSet(actor.rolePermissions)
      : seedRolePermissionSet(role);
  const fromRole = permissionSetAllows(roleSet, permission);
  const granted = (actor?.grants ?? []).includes(permission);
  const revoked = (actor?.revokes ?? []).includes(permission);
  if (revoked) return "revoked";
  if (granted && !fromRole) return "granted";
  if (fromRole) return "from_role";
  return "from_role";
}

export function canAccessLogs(
  role: string | undefined | null,
  email?: string | null,
  actor?: AccessActor,
): boolean {
  return isSuperAdmin(role, email) || hasPermission(role, "logs", { ...actor, email: actor?.email ?? email });
}

export function canAccessReports(
  role: string | undefined | null,
  email?: string | null,
  actor?: AccessActor,
): boolean {
  return isSuperAdmin(role, email) || hasPermission(role, "reports", { ...actor, email: actor?.email ?? email });
}

export function canAccessSettings(
  role: string | undefined | null,
  email?: string | null,
  actor?: AccessActor,
): boolean {
  return isSuperAdmin(role, email) || hasPermission(role, "settings", { ...actor, email: actor?.email ?? email });
}

export function roleLabel(role: Role | string): string {
  if (role === "ADMIN") return "General Admin";
  if (role === "STAFF_ADMIN") return "Admin";
  return role.replace(/_/g, " ");
}
