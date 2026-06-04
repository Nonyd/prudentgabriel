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
    "content",
  ],

  BESPOKE_MANAGER: ["bespoke", "consultations", "clients.view"],
  RTW_MANAGER: ["shop.products", "shop.orders"],
  CONTENT_MANAGER: ["content.blog", "content.pages"],
  FINANCE_MANAGER: ["invoices", "quotations", "finance"],
  HR_MANAGER: ["staff", "attendance"],
  CONSULTATION_MANAGER: ["consultations", "clients.view"],
  STAFF: [],
} as const;

export const PROTECTED_ACCOUNTS = [
  process.env.SUPER_ADMIN_EMAIL,
  process.env.GENERAL_ADMIN_EMAIL,
].filter(Boolean) as string[];

export function isAdminRole(role: string | undefined | null): boolean {
  if (!role) return false;
  return (
    role === "ADMIN" ||
    role === "SUPER_ADMIN" ||
    role === "STAFF_ADMIN" ||
    role.endsWith("_MANAGER")
  );
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
  if (!isAdminRole(actorRole)) return false;
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
  return (perms as readonly AdminPermission[]).includes(permission);
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
