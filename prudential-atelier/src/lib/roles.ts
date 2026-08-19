import { Role } from "@prisma/client";

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
  FINANCE_MANAGER: ["invoices", "quotations", "finance", "payments"],
  HR_MANAGER: ["staff", "attendance"],
  CONSULTATION_MANAGER: ["consultations", "clients.view"],
  STAFF: [],
} as const;

export const PROTECTED_ACCOUNTS = [
  process.env.SUPER_ADMIN_EMAIL,
  process.env.GENERAL_ADMIN_EMAIL,
].filter(Boolean) as string[];

export function hasAnyAdminPermission(role: string | undefined | null): boolean {
  if (!role) return false;
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  if (perms[0] === "*") return true;
  return perms.length > 0;
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
): boolean {
  if (!role) return false;
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  if (perms[0] === "*") return true;
  const list = perms as readonly AdminPermission[];
  if (list.includes(permission)) return true;
  const dot = permission.indexOf(".");
  if (dot > 0) {
    const parent = permission.slice(0, dot) as AdminPermission;
    // Developer settings are SUPER_ADMIN-only; `settings` must not unlock them.
    if (permission === "settings.developer") return false;
    if (list.includes(parent)) return true;
  }
  return false;
}

/** Same predicate `requireAdminApi` uses after a session exists. */
export function roleAllows(
  role: string | undefined | null,
  needed: AdminPermission | readonly AdminPermission[],
): boolean {
  const list = Array.isArray(needed) ? needed : [needed];
  return list.some((p) => hasPermission(role, p));
}

const ALL_PERMISSIONS: readonly AdminPermission[] = [
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
  "settings.developer",
];

/** Dotted children unlocked only because the parent key is on the role. */
export function inheritedDottedPermissions(role: string): AdminPermission[] {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms || perms[0] === "*") return [];
  const list = perms as readonly AdminPermission[];
  const out: AdminPermission[] = [];
  for (const p of ALL_PERMISSIONS) {
    const dot = p.indexOf(".");
    if (dot < 0) continue;
    if (list.includes(p)) continue;
    if (hasPermission(role, p)) out.push(p);
  }
  return out;
}

export function canAccessLogs(role: string | undefined | null, email?: string | null): boolean {
  return isSuperAdmin(role, email) || hasPermission(role, "logs");
}

export function canAccessReports(role: string | undefined | null, email?: string | null): boolean {
  return isSuperAdmin(role, email) || hasPermission(role, "reports");
}

export function canAccessSettings(role: string | undefined | null, email?: string | null): boolean {
  return isSuperAdmin(role, email) || hasPermission(role, "settings");
}

export function roleLabel(role: Role | string): string {
  if (role === "ADMIN") return "General Admin";
  if (role === "STAFF_ADMIN") return "Admin";
  return role.replace(/_/g, " ");
}
