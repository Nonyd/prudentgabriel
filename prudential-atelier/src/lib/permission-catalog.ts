import type { AdminPermission } from "@/lib/roles";
import { roleLabel } from "@/lib/roles";

export const KEMI_EMAIL = "yadahahfreekah@gmail.com";

export const ALL_ADMIN_PERMISSIONS: readonly AdminPermission[] = [
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
] as const;

export type PermissionCatalogEntry = {
  key: AdminPermission;
  group: string;
  label: string;
  description: string;
  /** Super Admin only — not offered on other roles or as a user grant. */
  superAdminOnly?: boolean;
};

export const ADMIN_PERMISSION_CATALOG: readonly PermissionCatalogEntry[] = [
  {
    key: "dashboard",
    group: "Daily work",
    label: "Executive dashboard",
    description: "Open the operations dashboard and see the morning numbers.",
  },
  {
    key: "bespoke",
    group: "Daily work",
    label: "Atelier pipeline",
    description: "Open bespoke orders and move them through the atelier stages.",
  },
  {
    key: "consultations",
    group: "Daily work",
    label: "Consultations",
    description: "See bookings and manage consultants.",
  },
  {
    key: "quotations",
    group: "Daily work",
    label: "Quotations",
    description: "Draft, send, and follow bespoke quotations.",
  },
  {
    key: "invoices",
    group: "Daily work",
    label: "Invoices",
    description: "Issue and follow atelier invoices.",
  },
  {
    key: "shop",
    group: "Shop",
    label: "Full shop",
    description: "Products, orders, coupons, and shipping — the whole ready-to-wear desk.",
  },
  {
    key: "shop.products",
    group: "Shop",
    label: "Catalogue",
    description: "Products, collections, sizing, and imports.",
  },
  {
    key: "shop.orders",
    group: "Shop",
    label: "Orders",
    description: "Ready-to-wear orders, shipping quotes, refunds, coupons, and abandoned checkouts.",
  },
  {
    key: "clients",
    group: "People",
    label: "Client CRM",
    description: "Open and edit client records.",
  },
  {
    key: "clients.view",
    group: "People",
    label: "View clients",
    description: "See client records without full CRM edit access. Unused until a page is wired to it.",
  },
  {
    key: "staff",
    group: "People",
    label: "Staff",
    description: "Open the staff list and profiles.",
  },
  {
    key: "staff.view",
    group: "People",
    label: "View staff",
    description: "See staff records without managing them.",
  },
  {
    key: "attendance",
    group: "People",
    label: "Attendance",
    description: "Clock-in records and the attendance board.",
  },
  {
    key: "finance",
    group: "Money",
    label: "Finance",
    description: "Financial operations that sit beside invoices and payments.",
  },
  {
    key: "payments",
    group: "Money",
    label: "Payments",
    description: "Confirm bank transfers and view the payment ledger.",
  },
  {
    key: "reports",
    group: "Money",
    label: "Financial reports",
    description: "Open the reports desk — revenue and related figures.",
  },
  {
    key: "reports.staff",
    group: "Money",
    label: "Staff performance",
    description: "See performance figures for the atelier floor.",
  },
  {
    key: "content",
    group: "House",
    label: "House content",
    description: "CMS pages, journal, gallery, and related house copy.",
  },
  {
    key: "content.blog",
    group: "House",
    label: "Journal",
    description: "Write and publish journal posts.",
  },
  {
    key: "content.pages",
    group: "House",
    label: "Pages",
    description: "Edit site pages, appearance, SEO, and social links.",
  },
  {
    key: "logs",
    group: "System",
    label: "Logs",
    description: "Activity and error logs.",
  },
  {
    key: "settings",
    group: "System",
    label: "Settings",
    description: "General, email, notifications, and other house configuration. Does not include developer secrets.",
  },
  {
    key: "settings.bank-accounts",
    group: "System",
    label: "Bank accounts",
    description: "The accounts printed on invoices and used to match transfers. Does not open the rest of Settings.",
  },
  {
    key: "settings.developer",
    group: "System",
    label: "Developer",
    description: "API secrets, gateways, and technical credentials. Super Admin only.",
    superAdminOnly: true,
  },
];

export const EDITABLE_ADMIN_ROLES = [
  "ADMIN",
  "STAFF_ADMIN",
  "BESPOKE_MANAGER",
  "RTW_MANAGER",
  "CONTENT_MANAGER",
  "FINANCE_MANAGER",
  "HR_MANAGER",
  "CONSULTATION_MANAGER",
  "STAFF",
] as const;

export type RolePermissionProposal = {
  id: string;
  role: string;
  add: AdminPermission[];
  kind: "gap" | "regression" | "split";
  title: string;
  reason: string;
};

export const ROLE_PERMISSION_PROPOSALS: readonly RolePermissionProposal[] = [
  {
    id: "t3-clients-bespoke",
    role: "BESPOKE_MANAGER",
    add: ["clients"],
    kind: "gap",
    title: "Let Bespoke Manager open Client CRM",
    reason:
      "They already hold clients.view, which currently unlocks nothing. They work with clients every day. Granting Client CRM is the smallest fix; clients.view can stay as a narrower future gate.",
  },
  {
    id: "t3-clients-consultation",
    role: "CONSULTATION_MANAGER",
    add: ["clients"],
    kind: "gap",
    title: "Let Consultation Manager open Client CRM",
    reason:
      "Same unused clients.view. Consultation work is client work; they should reach the CRM without a Super Admin standing over the booking.",
  },
  {
    id: "t3-quotations-bespoke",
    role: "BESPOKE_MANAGER",
    add: ["quotations"],
    kind: "regression",
    title: "Restore quotations to Bespoke Manager",
    reason:
      "This is a regression, not a gap. An older role list allowed them on the quotations route; Step 2 tightened the gate to the quotations permission, which this role never had. Restoring it is a fix.",
  },
  {
    id: "t3-hr-performance",
    role: "HR_MANAGER",
    add: ["reports.staff"],
    kind: "gap",
    title: "Let HR Manager see Performance",
    reason: "Attendance is already on the role. Performance sits next to it and is gated on reports.staff, which they do not have.",
  },
  {
    id: "t3-finance-reports",
    role: "FINANCE_MANAGER",
    add: ["reports"],
    kind: "gap",
    title: "Let Finance Manager open financial reports",
    reason: "They already hold invoices, quotations, finance, and payments. The reports desk is the missing money surface.",
  },
  {
    id: "t3-finance-bank",
    role: "FINANCE_MANAGER",
    add: ["settings.bank-accounts"],
    kind: "split",
    title: "Let Finance Manager see bank accounts — without all of Settings",
    reason:
      "Bank accounts used to sit behind settings, which also opens email, notifications, and other house configuration. The permission is now split. Do not grant settings to this role.",
  },
];

export function catalogEntry(key: string): PermissionCatalogEntry | undefined {
  return ADMIN_PERMISSION_CATALOG.find((e) => e.key === key);
}

export function roleDisplayName(role: string): string {
  return roleLabel(role);
}

export const ADMIN_PREVIEW_COOKIE = "pg_admin_preview_role";
