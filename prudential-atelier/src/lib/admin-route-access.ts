import {
  CMS_ADMIN_PERMISSIONS,
  hasAnyAdminPermission,
  isGeneralAdmin,
  isSuperAdmin,
  roleAllows,
  type AdminPermission,
} from "@/lib/roles";
import { sessionHasRole } from "@/lib/bespoke-roles";

/**
 * One gate for an admin path. Pages (layout) and matching APIs must use the
 * same kind of check so a screen never renders into a 403.
 */
export type AdminGate =
  | { type: "permission"; permission: AdminPermission | readonly AdminPermission[] }
  | { type: "super_admin" }
  | { type: "general_admin" }
  | { type: "portal" }
  | { type: "roles"; roles: readonly string[] };

type PathRule = {
  prefix: string;
  exact?: boolean;
  gate: AdminGate;
};

function perm(permission: AdminPermission | readonly AdminPermission[]): AdminGate {
  return { type: "permission", permission };
}

/**
 * Alterations are still on the Sprint B finance role list, not ROLE_PERMISSIONS.
 * Page and API stay on this list until T3.
 */
export const ALTERATION_ROLES = ["FINANCE_MANAGER", "BESPOKE_MANAGER", "ADMIN", "SUPER_ADMIN"] as const;

/**
 * Longest prefix wins. Shipping is `shop` (commerce), not `settings`.
 * Users & Roles is Super Admin only — same as `/api/admin/users`.
 */
const PATH_RULES: PathRule[] = [
  { prefix: "/admin/account-settings", gate: { type: "portal" } },
  { prefix: "/admin/notifications", gate: { type: "portal" } },

  { prefix: "/admin/settings/developer", gate: perm("settings.developer") },
  { prefix: "/admin/settings/users", gate: { type: "super_admin" } },
  { prefix: "/admin/settings/roles", gate: { type: "general_admin" } },
  { prefix: "/admin/settings/bank-accounts", gate: perm("settings") },
  { prefix: "/admin/settings/invoice", gate: perm("settings") },
  { prefix: "/admin/settings/appearance", gate: perm(CMS_ADMIN_PERMISSIONS) },
  { prefix: "/admin/settings/seo", gate: perm(CMS_ADMIN_PERMISSIONS) },
  { prefix: "/admin/settings/social", gate: perm(CMS_ADMIN_PERMISSIONS) },
  { prefix: "/admin/settings/content", gate: perm(CMS_ADMIN_PERMISSIONS) },
  { prefix: "/admin/settings", gate: perm("settings") },

  { prefix: "/admin/staff/performance", gate: perm("reports.staff") },
  { prefix: "/admin/staff", gate: perm("staff") },
  { prefix: "/admin/attendance", gate: perm("attendance") },
  { prefix: "/admin/team", gate: { type: "super_admin" } },

  { prefix: "/admin/careers", gate: { type: "general_admin" } },
  { prefix: "/admin/system", gate: { type: "general_admin" } },

  { prefix: "/admin/content/messages", gate: { type: "general_admin" } },
  { prefix: "/admin/content/email-templates", gate: { type: "general_admin" } },
  { prefix: "/admin/content/send-email", gate: { type: "general_admin" } },
  { prefix: "/admin/content/unsubscribes", gate: { type: "general_admin" } },
  { prefix: "/admin/content", gate: perm(CMS_ADMIN_PERMISSIONS) },
  { prefix: "/admin/gallery", gate: perm(CMS_ADMIN_PERMISSIONS) },
  { prefix: "/admin/reviews", gate: perm(CMS_ADMIN_PERMISSIONS) },

  { prefix: "/admin/logs", gate: perm("logs") },
  { prefix: "/admin/reports", gate: perm("reports") },

  { prefix: "/admin/products", gate: perm("shop.products") },
  { prefix: "/admin/collections", gate: perm("shop.products") },
  { prefix: "/admin/sizing", gate: perm("shop.products") },
  { prefix: "/admin/shop", gate: perm("shop.products") },
  { prefix: "/admin/import", gate: perm("shop.products") },
  { prefix: "/admin/orders", gate: perm("shop.orders") },
  { prefix: "/admin/checkouts", gate: perm("shop.orders") },
  { prefix: "/admin/coupons", gate: perm("shop.orders") },
  { prefix: "/admin/shipping", gate: perm("shop") },

  { prefix: "/admin/payments", gate: perm("payments") },
  { prefix: "/admin/invoices", gate: perm("invoices") },
  { prefix: "/admin/quotations", gate: perm("quotations") },
  { prefix: "/admin/alterations", gate: { type: "roles", roles: ALTERATION_ROLES } },

  { prefix: "/admin/bespoke", gate: perm("bespoke") },
  { prefix: "/admin/consultations", gate: perm("consultations") },
  { prefix: "/admin/consultants", gate: perm("consultations") },
  { prefix: "/admin/clients", gate: perm("clients") },
  { prefix: "/admin/customers", gate: perm("clients") },
  { prefix: "/admin/referrals", gate: perm("clients") },

  { prefix: "/admin", exact: true, gate: perm("dashboard") },
];

function normalizeAdminPath(pathname: string): string {
  const path = pathname.split("?")[0] ?? pathname;
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path || "/admin";
}

export function accessRuleForAdminPath(pathname: string): AdminGate | null {
  const path = normalizeAdminPath(pathname);
  if (!path.startsWith("/admin")) return null;

  const ranked = [...PATH_RULES].sort((a, b) => {
    if (a.exact !== b.exact) return a.exact ? -1 : 1;
    return b.prefix.length - a.prefix.length;
  });

  for (const rule of ranked) {
    if (rule.exact) {
      if (path === rule.prefix) return rule.gate;
      continue;
    }
    if (path === rule.prefix || path.startsWith(`${rule.prefix}/`)) return rule.gate;
  }

  return null;
}

export function roleAllowsGate(
  role: string | undefined | null,
  gate: AdminGate,
  email?: string | null,
): boolean {
  if (!role) return false;
  switch (gate.type) {
    case "permission":
      return roleAllows(role, gate.permission);
    case "super_admin":
      return isSuperAdmin(role, email);
    case "general_admin":
      return isGeneralAdmin(role);
    case "portal":
      return hasAnyAdminPermission(role);
    case "roles":
      return sessionHasRole(role, email, [...gate.roles]);
  }
}

export function roleMayAccessAdminPath(
  role: string | undefined | null,
  pathname: string,
  email?: string | null,
): boolean {
  const gate = accessRuleForAdminPath(pathname);
  if (!gate) return false;
  return roleAllowsGate(role, gate, email);
}

/** First sidebar-shaped landing a role may open. Account settings is last resort. */
export const ADMIN_LANDING_CANDIDATES = [
  "/admin",
  "/admin/bespoke",
  "/admin/consultations",
  "/admin/invoices",
  "/admin/quotations",
  "/admin/products",
  "/admin/orders",
  "/admin/shipping",
  "/admin/staff",
  "/admin/attendance",
  "/admin/clients",
  "/admin/payments",
  "/admin/reports",
  "/admin/content",
  "/admin/content/blog",
  "/admin/content/pages",
  "/admin/settings",
  "/admin/account-settings",
] as const;

export function firstAdminPathForRole(role: string, email?: string | null): string {
  for (const path of ADMIN_LANDING_CANDIDATES) {
    if (roleMayAccessAdminPath(role, path, email)) return path;
  }
  return hasAnyAdminPermission(role) ? "/admin/account-settings" : "/login?tab=admin";
}

/** Layout redirect when the current path is denied. Null means render. */
export function deniedAdminRedirect(
  role: string,
  pathname: string,
  email?: string | null,
): string | null {
  if (roleMayAccessAdminPath(role, pathname, email)) return null;
  const dest = firstAdminPathForRole(role, email);
  if (dest === pathname) return "/admin/account-settings";
  return dest;
}

/** Route groups for the role × page × API matrix (sidebar-shaped). */
export const ADMIN_MATRIX_ROUTES: {
  group: string;
  path: string;
  api: string;
}[] = [
  { group: "Executive", path: "/admin", api: "dashboard (RSC)" },
  { group: "Bespoke", path: "/admin/bespoke", api: "GET /api/admin/bespoke" },
  { group: "Consultations", path: "/admin/consultations", api: "GET /api/admin/consultations" },
  { group: "Invoices", path: "/admin/invoices", api: "GET /api/admin/invoices" },
  { group: "Quotations", path: "/admin/quotations", api: "GET /api/quotations" },
  { group: "Products", path: "/admin/products", api: "GET /api/admin/products" },
  { group: "Orders", path: "/admin/orders", api: "GET /api/admin/orders" },
  { group: "Shipping", path: "/admin/shipping", api: "GET /api/admin/shipping" },
  { group: "Coupons", path: "/admin/coupons", api: "GET /api/admin/coupons" },
  { group: "Staff", path: "/admin/staff", api: "GET /api/staff" },
  { group: "Attendance", path: "/admin/attendance", api: "GET /api/attendance/today" },
  { group: "Performance", path: "/admin/staff/performance", api: "GET /api/admin/staff/performance" },
  { group: "Careers", path: "/admin/careers", api: "GET /api/admin/careers/jobs" },
  { group: "Clients", path: "/admin/clients", api: "GET /api/admin/customers" },
  { group: "Payments", path: "/admin/payments", api: "GET /api/admin/payments/pending" },
  { group: "Bank accounts", path: "/admin/settings/bank-accounts", api: "GET /api/admin/bank-accounts" },
  { group: "Reports", path: "/admin/reports", api: "GET /api/admin/reports" },
  { group: "Content", path: "/admin/content", api: "GET /api/admin/content/pages" },
  { group: "Blog", path: "/admin/content/blog", api: "GET /api/blog" },
  { group: "Messages", path: "/admin/content/messages", api: "GET /api/admin/messages" },
  { group: "Logs", path: "/admin/logs/activity", api: "GET /api/logs/activity" },
  { group: "System", path: "/admin/system/jobs", api: "GET /api/admin/system/jobs" },
  { group: "Settings", path: "/admin/settings", api: "GET /api/admin/settings" },
  { group: "Developer", path: "/admin/settings/developer", api: "GET /api/admin/settings/developer" },
  { group: "Users & Roles", path: "/admin/settings/users", api: "GET /api/admin/users" },
  { group: "Job Roles", path: "/admin/settings/roles", api: "GET /api/admin/job-roles" },
  { group: "Account", path: "/admin/account-settings", api: "PATCH /api/admin/account/password" },
];

export function matrixAccess(role: string, path: string): "allow" | "deny" {
  return roleMayAccessAdminPath(role, path) ? "allow" : "deny";
}
