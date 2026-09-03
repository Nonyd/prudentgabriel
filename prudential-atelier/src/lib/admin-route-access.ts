import {
  CMS_ADMIN_PERMISSIONS,
  hasAnyAdminPermission,
  isGeneralAdmin,
  isSuperAdmin,
  roleAllows,
  type AccessActor,
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
  { prefix: "/admin/settings/bank-accounts", gate: perm(["settings", "settings.bank-accounts"]) },
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
  actor?: AccessActor,
): boolean {
  if (!role) return false;
  const merged: AccessActor = { ...actor, email: actor?.email ?? email };
  switch (gate.type) {
    case "permission":
      return roleAllows(role, gate.permission, merged);
    case "super_admin":
      return isSuperAdmin(role, merged.email);
    case "general_admin":
      return isGeneralAdmin(role);
    case "portal":
      return hasAnyAdminPermission(role, merged);
    case "roles":
      return sessionHasRole(role, merged.email, [...gate.roles]);
  }
}

export function roleMayAccessAdminPath(
  role: string | undefined | null,
  pathname: string,
  email?: string | null,
  actor?: AccessActor,
): boolean {
  const gate = accessRuleForAdminPath(pathname);
  if (!gate) return false;
  return roleAllowsGate(role, gate, email, actor);
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

export function firstAdminPathForRole(role: string, email?: string | null, actor?: AccessActor): string {
  for (const path of ADMIN_LANDING_CANDIDATES) {
    if (roleMayAccessAdminPath(role, path, email, actor)) return path;
  }
  return hasAnyAdminPermission(role, actor) ? "/admin/account-settings" : "/login?tab=admin";
}

/** Layout redirect when the current path is denied. Null means render. */
export function deniedAdminRedirect(
  role: string,
  pathname: string,
  email?: string | null,
  actor?: AccessActor,
): string | null {
  if (roleMayAccessAdminPath(role, pathname, email, actor)) return null;
  const dest = firstAdminPathForRole(role, email, actor);
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

/** Page → what it owns → where related work lives. Used by Slice U sweep tests. */
export const ADMIN_PAGE_OWNERS: readonly {
  path: string;
  owns: string;
  linksTo: string;
}[] = [
  { path: "/admin", owns: "Executive dashboard", linksTo: "Nav" },
  { path: "/admin/orders", owns: "Ready-to-wear orders", linksTo: "Nav" },
  { path: "/admin/checkouts", owns: "Abandoned checkouts", linksTo: "Nav" },
  { path: "/admin/consultations", owns: "Consultation bookings", linksTo: "Nav" },
  { path: "/admin/consultants", owns: "Consultant roster", linksTo: "Nav" },
  { path: "/admin/bespoke", owns: "Atelier pipeline", linksTo: "Nav" },
  { path: "/admin/quotations", owns: "Quotations", linksTo: "Nav" },
  { path: "/admin/invoices", owns: "Invoices", linksTo: "Nav" },
  { path: "/admin/alterations", owns: "Alteration tickets", linksTo: "Nav" },
  { path: "/admin/payments", owns: "Payment ledger and transfer confirmation", linksTo: "Nav" },
  { path: "/admin/settings/bank-accounts", owns: "House bank accounts (up to eight)", linksTo: "Nav + Settings hub" },
  { path: "/admin/reports", owns: "Financial reports", linksTo: "Nav" },
  { path: "/admin/clients", owns: "Client CRM", linksTo: "Nav" },
  { path: "/admin/customers", owns: "Redirect to Clients", linksTo: "/admin/clients" },
  { path: "/admin/referrals", owns: "Referral analytics", linksTo: "Nav" },
  { path: "/admin/staff", owns: "Staff directory", linksTo: "Nav" },
  { path: "/admin/attendance", owns: "Attendance", linksTo: "Nav" },
  { path: "/admin/staff/performance", owns: "Staff performance", linksTo: "Nav" },
  { path: "/admin/team", owns: "Redirect to Users & Roles", linksTo: "/admin/settings/users" },
  { path: "/admin/products", owns: "Catalogue products", linksTo: "Nav" },
  { path: "/admin/collections", owns: "Collections", linksTo: "Nav" },
  { path: "/admin/content/media", owns: "Media library", linksTo: "Nav" },
  { path: "/admin/products/guide", owns: "Upload guide", linksTo: "Nav" },
  { path: "/admin/coupons", owns: "Coupons", linksTo: "Nav" },
  { path: "/admin/shipping", owns: "Shipping modes and copy (not carrier keys)", linksTo: "Nav" },
  { path: "/admin/sizing", owns: "Sizing", linksTo: "Nav" },
  { path: "/admin/content", owns: "Content hub", linksTo: "Nav" },
  { path: "/admin/content/blog", owns: "Journal", linksTo: "Nav" },
  { path: "/admin/content/email-templates", owns: "Transactional email copy", linksTo: "Nav" },
  { path: "/admin/content/send-email", owns: "One-off mail", linksTo: "Nav" },
  { path: "/admin/content/unsubscribes", owns: "Unsubscribe list", linksTo: "Nav" },
  { path: "/admin/content/messages", owns: "Contact messages", linksTo: "Nav" },
  { path: "/admin/gallery", owns: "Portfolio gallery", linksTo: "Nav" },
  { path: "/admin/reviews", owns: "Testimonials", linksTo: "Nav" },
  { path: "/admin/careers", owns: "Careers", linksTo: "Nav" },
  { path: "/admin/careers/applications", owns: "Career applications", linksTo: "Nav" },
  { path: "/admin/notifications", owns: "Admin notification inbox", linksTo: "Top bar bell" },
  { path: "/admin/bespoke/intake", owns: "Bespoke intake forms", linksTo: "Pipeline, not nav" },
  { path: "/admin/customers/[id]", owns: "Shop account / points (kept; not the Clients list)", linksTo: "Clients + consultations" },
  { path: "/admin/settings", owns: "Settings hub and general store fields", linksTo: "Nav" },
  { path: "/admin/settings/payments", owns: "Gateway on/off, deposit, overlay FX, warranty days", linksTo: "Settings hub" },
  { path: "/admin/settings/store", owns: "Store name, contact, currency, shipping thresholds", linksTo: "Settings hub" },
  { path: "/admin/settings/loyalty", owns: "Points and referral rewards", linksTo: "Settings hub" },
  { path: "/admin/settings/invoice", owns: "Business details, VAT, invoice numbering (not house banks)", linksTo: "Settings hub" },
  { path: "/admin/settings/email", owns: "From-name, reply-to, SMS flags (not API keys)", linksTo: "Settings hub + Nav" },
  { path: "/admin/settings/notifications", owns: "Notification flags", linksTo: "Nav" },
  { path: "/admin/settings/developer", owns: "All credentials", linksTo: "Nav" },
  { path: "/admin/settings/users", owns: "Users, roles, impersonation, password reset links", linksTo: "Nav" },
  { path: "/admin/settings/roles", owns: "Job role templates", linksTo: "Nav" },
  { path: "/admin/settings/appearance", owns: "Appearance", linksTo: "Nav" },
  { path: "/admin/settings/seo", owns: "SEO", linksTo: "Nav" },
  { path: "/admin/settings/social", owns: "Social links", linksTo: "Nav" },
  { path: "/admin/content/pages", owns: "CMS pages", linksTo: "Nav" },
  { path: "/admin/account-settings", owns: "Own password", linksTo: "Top bar" },
  { path: "/admin/system/jobs", owns: "Cron jobs", linksTo: "Nav" },
  { path: "/admin/system/emails", owns: "Email outbox", linksTo: "Nav" },
  { path: "/admin/logs/activity", owns: "Activity log", linksTo: "Nav" },
  { path: "/admin/logs/errors", owns: "Error log", linksTo: "Nav" },
];

export const ADMIN_NAV_STORAGE_KEY = "prudentgabriel.adminNav.v1";

export type AdminNavItemDef = {
  href: string;
  label: string;
  icon: string;
  badgeKey?: string;
  alsoActive?: string[];
};

export type AdminNavSectionDef = {
  id: string;
  label: string;
  /** Daily work starts open; configuration starts closed. */
  defaultOpen: boolean;
  items: AdminNavItemDef[];
};

/** Path used for Step 2 access (query and hash stripped). */
export function adminNavAccessPath(href: string): string {
  const path = href.split("?")[0]?.split("#")[0] ?? href;
  return normalizeAdminPath(path);
}

/**
 * Sidebar structure. Visibility is `roleMayAccessAdminPath` on each href —
 * not a second permission field. Empty sections are omitted by
 * `visibleAdminNavSections`.
 */
export const ADMIN_NAV_SECTIONS: AdminNavSectionDef[] = [
  {
    id: "executive",
    label: "Executive",
    defaultOpen: true,
    items: [{ href: "/admin", label: "Dashboard", icon: "dashboard" }],
  },
  {
    id: "orders",
    label: "Orders",
    defaultOpen: true,
    items: [
      { href: "/admin/orders", label: "All orders", icon: "orders" },
      {
        href: `/admin/orders?attention=quote-pending-all`,
        label: "Awaiting shipping quote",
        icon: "quote",
      },
      {
        href: `/admin/orders?attention=refund-required`,
        label: "Refund required",
        icon: "refund",
      },
    ],
  },
  {
    id: "consultations",
    label: "Consultations",
    defaultOpen: true,
    items: [
      { href: "/admin/consultations", label: "Bookings", icon: "consultations", badgeKey: "consultations" },
      { href: "/admin/consultants", label: "Consultants", icon: "consultants" },
    ],
  },
  {
    id: "atelier",
    label: "Atelier",
    defaultOpen: true,
    items: [
      { href: "/admin/bespoke", label: "Pipeline", icon: "atelier", badgeKey: "bespoke" },
      { href: "/admin/quotations", label: "Quotations", icon: "quotations" },
      { href: "/admin/invoices", label: "Invoices", icon: "invoices" },
      { href: "/admin/alterations", label: "Alterations", icon: "alterations" },
    ],
  },
  {
    id: "payments",
    label: "Payments",
    defaultOpen: true,
    items: [
      { href: "/admin/payments", label: "Ledger", icon: "payments" },
      { href: "/admin/payments#transfers", label: "Transfers to confirm", icon: "transfers" },
      { href: "/admin/settings/bank-accounts", label: "Bank accounts", icon: "bank" },
      { href: "/admin/reports", label: "Financial reports", icon: "reports" },
    ],
  },
  {
    id: "people",
    label: "People",
    defaultOpen: true,
    items: [
      { href: "/admin/clients", label: "Clients", icon: "clients" },
      { href: "/admin/referrals", label: "Referrals", icon: "referrals" },
      { href: "/admin/staff", label: "Staff", icon: "staff" },
      { href: "/admin/attendance", label: "Attendance", icon: "attendance" },
      { href: "/admin/staff/performance", label: "Performance", icon: "performance" },
    ],
  },
  {
    id: "catalogue",
    label: "Catalogue",
    defaultOpen: false,
    items: [
      { href: "/admin/products", label: "Products", icon: "products" },
      { href: "/admin/collections", label: "Collections", icon: "collections" },
      { href: "/admin/content/media", label: "Media", icon: "media" },
      { href: "/admin/products/guide", label: "How to upload", icon: "guide" },
    ],
  },
  {
    id: "commerce",
    label: "Commerce setup",
    defaultOpen: false,
    items: [
      { href: "/admin/coupons", label: "Coupons", icon: "coupons" },
      { href: "/admin/shipping", label: "Shipping", icon: "shipping" },
      { href: "/admin/sizing", label: "Sizing", icon: "sizing" },
    ],
  },
  {
    id: "house",
    label: "House",
    defaultOpen: false,
    items: [
      { href: "/admin/content", label: "Content", icon: "content" },
      { href: "/admin/content/blog", label: "Journal", icon: "journal" },
      { href: "/admin/reviews", label: "Testimonials", icon: "reviews" },
      { href: "/admin/gallery", label: "Gallery", icon: "gallery" },
      { href: "/admin/careers", label: "Careers", icon: "careers", alsoActive: ["/admin/careers/new"] },
      { href: "/admin/careers/applications", label: "Applications", icon: "applications" },
      { href: "/admin/content/messages", label: "Messages", icon: "messages", badgeKey: "messages" },
      { href: "/admin/content/email-templates", label: "Email templates", icon: "templates" },
      { href: "/admin/content/send-email", label: "Send email", icon: "send-email" },
      { href: "/admin/content/unsubscribes", label: "Unsubscribes", icon: "unsubscribes" },
    ],
  },
  {
    id: "site",
    label: "Site",
    defaultOpen: false,
    items: [
      { href: "/admin/settings/appearance", label: "Appearance", icon: "appearance" },
      { href: "/admin/settings/seo", label: "SEO", icon: "seo" },
      { href: "/admin/content/pages", label: "Pages", icon: "pages" },
      { href: "/admin/settings/social", label: "Social", icon: "social" },
    ],
  },
  {
    id: "system",
    label: "System",
    defaultOpen: false,
    items: [
      { href: "/admin/system/jobs", label: "Jobs", icon: "jobs" },
      { href: "/admin/system/emails", label: "Emails", icon: "sys-emails" },
      { href: "/admin/checkouts", label: "Abandoned checkouts", icon: "checkouts" },
      { href: "/admin/logs/activity", label: "Activity log", icon: "logs" },
      { href: "/admin/logs/errors", label: "Error log", icon: "errors" },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    defaultOpen: false,
    items: [
      { href: "/admin/settings", label: "General", icon: "settings" },
      { href: "/admin/settings/email", label: "Email", icon: "email" },
      { href: "/admin/settings/notifications", label: "Notifications", icon: "notifications" },
      { href: "/admin/settings/developer", label: "Developer", icon: "developer" },
      { href: "/admin/settings/users", label: "Users & Roles", icon: "users" },
      { href: "/admin/settings/roles", label: "Job roles", icon: "roles" },
    ],
  },
];

export function defaultAdminNavOpenState(): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const section of ADMIN_NAV_SECTIONS) {
    out[section.id] = section.defaultOpen;
  }
  return out;
}

export function visibleAdminNavSections(
  role: string | undefined | null,
  email?: string | null,
  actor?: AccessActor,
): AdminNavSectionDef[] {
  return ADMIN_NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) =>
      roleMayAccessAdminPath(role, adminNavAccessPath(item.href), email, actor),
    ),
  })).filter((section) => section.items.length > 0);
}

export function adminNavSectionIdForPath(pathname: string): string | null {
  const path = normalizeAdminPath(pathname);
  let best: { id: string; len: number } | null = null;
  for (const section of ADMIN_NAV_SECTIONS) {
    for (const item of section.items) {
      const itemPath = adminNavAccessPath(item.href);
      let len = 0;
      if (itemPath === "/admin") {
        if (path === "/admin") len = itemPath.length;
      } else if (path === itemPath || path.startsWith(`${itemPath}/`)) {
        len = itemPath.length;
      } else if (item.alsoActive?.some((p) => path === p || path.startsWith(`${p}/`))) {
        len = itemPath.length;
      }
      if (len > 0 && (!best || len > best.len)) best = { id: section.id, len };
    }
  }
  return best?.id ?? null;
}

export function adminNavItemIsActive(
  pathname: string,
  search: string,
  hash: string,
  item: AdminNavItemDef,
): boolean {
  const path = normalizeAdminPath(pathname);
  const raw = item.href;
  const [withoutHash, itemHash = ""] = raw.split("#");
  const [itemPathRaw, itemQuery = ""] = (withoutHash ?? raw).split("?");
  const itemPath = normalizeAdminPath(itemPathRaw ?? "/admin");
  const currentSearch = search.startsWith("?") ? search.slice(1) : search;
  const currentHash = hash.startsWith("#") ? hash : hash ? `#${hash}` : "";
  const wantHash = itemHash ? `#${itemHash}` : "";

  let pathOk = false;
  if (itemPath === "/admin") {
    pathOk = path === "/admin";
  } else {
    pathOk =
      path === itemPath ||
      path.startsWith(`${itemPath}/`) ||
      Boolean(item.alsoActive?.some((p) => path === p || path.startsWith(`${p}/`)));
  }
  if (!pathOk) return false;

  if (itemQuery) {
    const want = new URLSearchParams(itemQuery);
    const have = new URLSearchParams(currentSearch);
    return Array.from(want.entries()).every(([key, value]) => have.get(key) === value);
  }

  if (wantHash) {
    return path === itemPath && currentHash === wantHash;
  }

  if (itemPath === "/admin/orders" && path === "/admin/orders") {
    const have = new URLSearchParams(currentSearch);
    if (have.get("attention")) return false;
  }

  if (itemPath === "/admin/payments" && path === "/admin/payments") {
    if (currentHash === "#transfers") return false;
  }

  return true;
}
