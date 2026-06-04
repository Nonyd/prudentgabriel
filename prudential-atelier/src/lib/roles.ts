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
  GENERAL_ADMIN: [
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
  BESPOKE_MANAGER: ["bespoke", "consultations", "clients.view", "staff.view"],
  RTW_MANAGER: ["shop.products", "shop.orders"],
  CONTENT_MANAGER: ["content.blog", "content.pages"],
  FINANCE_MANAGER: ["invoices", "quotations", "finance", "payments"],
  HR_MANAGER: ["staff", "attendance", "reports.staff"],
  CONSULTATION_MANAGER: ["consultations", "clients.view"],
  STAFF: [],
} as const;

export const PROTECTED_ACCOUNTS = [
  process.env.SUPER_ADMIN_EMAIL,
  process.env.GENERAL_ADMIN_EMAIL,
].filter(Boolean) as string[];

export function isAdminRole(role: string | undefined | null): boolean {
  if (!role) return false;
  return role === "ADMIN" || role === "SUPER_ADMIN" || role.endsWith("_MANAGER");
}

export function isSuperAdmin(role: string | undefined | null, email?: string | null): boolean {
  if (role === "SUPER_ADMIN") return true;
  if (email && PROTECTED_ACCOUNTS.includes(email) && email === process.env.SUPER_ADMIN_EMAIL) {
    return true;
  }
  return false;
}

export function hasPermission(
  role: string | undefined | null,
  permission: AdminPermission,
): boolean {
  if (!role) return false;
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return role === "ADMIN" || role === "SUPER_ADMIN";
  if (perms[0] === "*") return true;
  return (perms as readonly AdminPermission[]).includes(permission);
}

export function roleLabel(role: Role | string): string {
  return role.replace(/_/g, " ");
}
