export const PERMISSIONS = {
  VIEW_BESPOKE_ORDERS: "view_bespoke_orders",
  MARK_STAGES_COMPLETE: "mark_stages_complete",
  ASSIGN_STAFF: "assign_staff",
  VIEW_ORDER_DETAILS: "view_order_details",

  VIEW_CLIENTS: "view_clients",
  EDIT_CLIENTS: "edit_clients",
  ADD_CLIENT_NOTES: "add_client_notes",

  MANAGE_PRODUCTS: "manage_products",
  VIEW_RTW_ORDERS: "view_rtw_orders",
  PROCESS_RTW_ORDERS: "process_rtw_orders",

  VIEW_CONSULTATIONS: "view_consultations",
  MANAGE_CONSULTATIONS: "manage_consultations",
  SEND_MEETING_LINKS: "send_meeting_links",

  VIEW_STAFF: "view_staff",
  MANAGE_STAFF: "manage_staff",
  VIEW_ATTENDANCE: "view_attendance",
  VIEW_PERFORMANCE: "view_performance",

  VIEW_INVOICES: "view_invoices",
  MANAGE_INVOICES: "manage_invoices",
  CONFIRM_PAYMENTS: "confirm_payments",
  VIEW_FINANCIAL_REPORTS: "view_financial_reports",

  MANAGE_BLOG: "manage_blog",
  MANAGE_PAGES: "manage_pages",

  VIEW_DAILY_REPORTS: "view_daily_reports",
  VIEW_WEEKLY_REPORTS: "view_weekly_reports",

  MANAGE_USERS: "manage_users",
  MANAGE_ROLES: "manage_roles",
  VIEW_LOGS: "view_logs",
  ACCESS_DEVELOPER: "access_developer",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_PRESETS: Record<
  string,
  { name: string; description: string; permissions: Permission[] }
> = {
  TAILOR: {
    name: "Tailor",
    description: "Garment construction and tailoring",
    permissions: [PERMISSIONS.VIEW_BESPOKE_ORDERS, PERMISSIONS.VIEW_ORDER_DETAILS],
  },
  BEADER: {
    name: "Beader",
    description: "Beading and embellishment work",
    permissions: [PERMISSIONS.VIEW_BESPOKE_ORDERS, PERMISSIONS.VIEW_ORDER_DETAILS],
  },
  DESIGNER: {
    name: "Designer",
    description: "Fashion design and concept development",
    permissions: [
      PERMISSIONS.VIEW_BESPOKE_ORDERS,
      PERMISSIONS.VIEW_ORDER_DETAILS,
      PERMISSIONS.VIEW_CLIENTS,
    ],
  },
  BESPOKE_MANAGER: {
    name: "Bespoke Manager",
    description: "Full bespoke pipeline management",
    permissions: [
      PERMISSIONS.VIEW_BESPOKE_ORDERS,
      PERMISSIONS.MARK_STAGES_COMPLETE,
      PERMISSIONS.ASSIGN_STAFF,
      PERMISSIONS.VIEW_ORDER_DETAILS,
      PERMISSIONS.VIEW_CLIENTS,
      PERMISSIONS.ADD_CLIENT_NOTES,
      PERMISSIONS.VIEW_CONSULTATIONS,
    ],
  },
  RTW_MANAGER: {
    name: "RTW Manager",
    description: "Ready-to-wear shop management",
    permissions: [
      PERMISSIONS.MANAGE_PRODUCTS,
      PERMISSIONS.VIEW_RTW_ORDERS,
      PERMISSIONS.PROCESS_RTW_ORDERS,
    ],
  },
  CONTENT_MANAGER: {
    name: "Content Manager",
    description: "Website content and blog management",
    permissions: [PERMISSIONS.MANAGE_BLOG, PERMISSIONS.MANAGE_PAGES],
  },
  FINANCE_OFFICER: {
    name: "Finance Officer",
    description: "Invoice and payment management",
    permissions: [
      PERMISSIONS.VIEW_INVOICES,
      PERMISSIONS.MANAGE_INVOICES,
      PERMISSIONS.CONFIRM_PAYMENTS,
      PERMISSIONS.VIEW_FINANCIAL_REPORTS,
    ],
  },
  CONSULTATION_MANAGER: {
    name: "Consultation Manager",
    description: "Consultation booking and scheduling",
    permissions: [
      PERMISSIONS.VIEW_CONSULTATIONS,
      PERMISSIONS.MANAGE_CONSULTATIONS,
      PERMISSIONS.SEND_MEETING_LINKS,
      PERMISSIONS.VIEW_CLIENTS,
    ],
  },
  HR_MANAGER: {
    name: "HR Manager",
    description: "Staff and attendance management",
    permissions: [
      PERMISSIONS.VIEW_STAFF,
      PERMISSIONS.MANAGE_STAFF,
      PERMISSIONS.VIEW_ATTENDANCE,
      PERMISSIONS.VIEW_PERFORMANCE,
      PERMISSIONS.VIEW_DAILY_REPORTS,
    ],
  },
  GENERAL_MANAGER: {
    name: "General Manager",
    description: "Full operational access",
    permissions: [
      PERMISSIONS.VIEW_BESPOKE_ORDERS,
      PERMISSIONS.MARK_STAGES_COMPLETE,
      PERMISSIONS.ASSIGN_STAFF,
      PERMISSIONS.VIEW_ORDER_DETAILS,
      PERMISSIONS.VIEW_CLIENTS,
      PERMISSIONS.EDIT_CLIENTS,
      PERMISSIONS.ADD_CLIENT_NOTES,
      PERMISSIONS.MANAGE_PRODUCTS,
      PERMISSIONS.VIEW_RTW_ORDERS,
      PERMISSIONS.PROCESS_RTW_ORDERS,
      PERMISSIONS.VIEW_CONSULTATIONS,
      PERMISSIONS.MANAGE_CONSULTATIONS,
      PERMISSIONS.SEND_MEETING_LINKS,
      PERMISSIONS.VIEW_STAFF,
      PERMISSIONS.MANAGE_STAFF,
      PERMISSIONS.VIEW_ATTENDANCE,
      PERMISSIONS.VIEW_PERFORMANCE,
      PERMISSIONS.VIEW_INVOICES,
      PERMISSIONS.MANAGE_INVOICES,
      PERMISSIONS.CONFIRM_PAYMENTS,
      PERMISSIONS.VIEW_FINANCIAL_REPORTS,
      PERMISSIONS.MANAGE_BLOG,
      PERMISSIONS.MANAGE_PAGES,
      PERMISSIONS.VIEW_DAILY_REPORTS,
      PERMISSIONS.VIEW_WEEKLY_REPORTS,
    ],
  },
};

export type PermissionGroup = {
  label: string;
  items: { key: Permission; label: string }[];
};

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    label: "Orders & Production",
    items: [
      { key: PERMISSIONS.VIEW_BESPOKE_ORDERS, label: "View bespoke orders" },
      { key: PERMISSIONS.MARK_STAGES_COMPLETE, label: "Mark production stages complete" },
      { key: PERMISSIONS.ASSIGN_STAFF, label: "Assign tailors and beaders" },
      { key: PERMISSIONS.VIEW_ORDER_DETAILS, label: "View full order details" },
    ],
  },
  {
    label: "Clients",
    items: [
      { key: PERMISSIONS.VIEW_CLIENTS, label: "View client profiles" },
      { key: PERMISSIONS.EDIT_CLIENTS, label: "Edit client information" },
      { key: PERMISSIONS.ADD_CLIENT_NOTES, label: "Add notes to client profiles" },
    ],
  },
  {
    label: "Shop",
    items: [
      { key: PERMISSIONS.MANAGE_PRODUCTS, label: "Manage products" },
      { key: PERMISSIONS.VIEW_RTW_ORDERS, label: "View shop orders" },
      { key: PERMISSIONS.PROCESS_RTW_ORDERS, label: "Process shop orders" },
    ],
  },
  {
    label: "Consultations",
    items: [
      { key: PERMISSIONS.VIEW_CONSULTATIONS, label: "View consultations" },
      { key: PERMISSIONS.MANAGE_CONSULTATIONS, label: "Manage consultation calendar" },
      { key: PERMISSIONS.SEND_MEETING_LINKS, label: "Send virtual meeting links" },
    ],
  },
  {
    label: "Staff & HR",
    items: [
      { key: PERMISSIONS.VIEW_STAFF, label: "View staff profiles" },
      { key: PERMISSIONS.MANAGE_STAFF, label: "Manage staff profiles" },
      { key: PERMISSIONS.VIEW_ATTENDANCE, label: "View attendance records" },
      { key: PERMISSIONS.VIEW_PERFORMANCE, label: "View performance scores" },
    ],
  },
  {
    label: "Finance",
    items: [
      { key: PERMISSIONS.VIEW_INVOICES, label: "View invoices and quotes" },
      { key: PERMISSIONS.MANAGE_INVOICES, label: "Create and edit invoices" },
      { key: PERMISSIONS.CONFIRM_PAYMENTS, label: "Confirm bank transfer payments" },
      { key: PERMISSIONS.VIEW_FINANCIAL_REPORTS, label: "View financial reports" },
    ],
  },
  {
    label: "Content",
    items: [
      { key: PERMISSIONS.MANAGE_BLOG, label: "Write and publish blog posts" },
      { key: PERMISSIONS.MANAGE_PAGES, label: "Edit website pages" },
    ],
  },
  {
    label: "Reports",
    items: [
      { key: PERMISSIONS.VIEW_DAILY_REPORTS, label: "View daily reports" },
      { key: PERMISSIONS.VIEW_WEEKLY_REPORTS, label: "View weekly reports" },
    ],
  },
];

export function hasJobPermission(permissions: string[], permission: Permission): boolean {
  return permissions.includes(permission);
}

export type PermissionSession = {
  user?: {
    role?: string;
    jobRolePermissions?: string[];
  };
} | null | undefined;

/** Session-aware permission check (SUPER_ADMIN / ADMIN bypass; else JobRole permissions). */
export function hasPermission(session: PermissionSession, permissionKey: Permission): boolean {
  const role = session?.user?.role;
  if (!role) return false;
  if (role === "SUPER_ADMIN" || role === "ADMIN") return true;
  const perms = session?.user?.jobRolePermissions ?? [];
  return perms.includes(permissionKey);
}

export function hasAnyPermission(session: PermissionSession, keys: Permission[]): boolean {
  return keys.some((key) => hasPermission(session, key));
}

/** When a user has a JobRole assigned, enforce granular permissions on admin routes. */
export function shouldEnforceJobPermissions(session: PermissionSession): boolean {
  const role = session?.user?.role;
  if (role === "SUPER_ADMIN" || role === "ADMIN") return false;
  return (session?.user?.jobRolePermissions?.length ?? 0) > 0;
}

/** JobRole permission keys required for an admin path (any one grants access). */
export function getJobPermissionsForAdminPath(pathname: string): Permission[] | null {
  if (pathname.startsWith("/admin/account-settings")) return null;
  if (pathname.startsWith("/admin/settings/developer")) return [PERMISSIONS.ACCESS_DEVELOPER];
  if (pathname.startsWith("/admin/settings/users")) return [PERMISSIONS.MANAGE_USERS];
  if (pathname.startsWith("/admin/settings/roles")) return [PERMISSIONS.MANAGE_ROLES];
  if (pathname.startsWith("/admin/logs")) return [PERMISSIONS.VIEW_LOGS];
  if (pathname.startsWith("/admin/reports")) {
    return [
      PERMISSIONS.VIEW_DAILY_REPORTS,
      PERMISSIONS.VIEW_WEEKLY_REPORTS,
      PERMISSIONS.VIEW_FINANCIAL_REPORTS,
    ];
  }
  if (pathname.startsWith("/admin/settings")) return null;
  if (pathname === "/admin") return null;

  if (pathname.startsWith("/admin/bespoke")) return [PERMISSIONS.VIEW_BESPOKE_ORDERS];
  if (pathname.startsWith("/admin/consultations")) return [PERMISSIONS.VIEW_CONSULTATIONS];
  if (pathname.startsWith("/admin/invoices") || pathname.startsWith("/admin/quotations")) {
    return [PERMISSIONS.VIEW_INVOICES, PERMISSIONS.MANAGE_INVOICES];
  }
  if (
    pathname.startsWith("/admin/products") ||
    pathname.startsWith("/admin/collections") ||
    pathname.startsWith("/admin/coupons")
  ) {
    return [PERMISSIONS.MANAGE_PRODUCTS];
  }
  if (pathname.startsWith("/admin/orders")) {
    return [PERMISSIONS.VIEW_RTW_ORDERS, PERMISSIONS.PROCESS_RTW_ORDERS];
  }
  if (pathname.startsWith("/admin/payments")) {
    return [PERMISSIONS.CONFIRM_PAYMENTS, PERMISSIONS.VIEW_FINANCIAL_REPORTS];
  }
  if (pathname.startsWith("/admin/clients") || pathname.startsWith("/admin/customers")) {
    return [PERMISSIONS.VIEW_CLIENTS];
  }
  if (pathname.startsWith("/admin/staff/performance")) return [PERMISSIONS.VIEW_PERFORMANCE];
  if (pathname.startsWith("/admin/staff") || pathname.startsWith("/admin/team")) {
    return [PERMISSIONS.VIEW_STAFF, PERMISSIONS.MANAGE_STAFF];
  }
  if (pathname.startsWith("/admin/attendance") || pathname.startsWith("/admin/clock-in")) {
    return [PERMISSIONS.VIEW_ATTENDANCE];
  }
  if (pathname.startsWith("/admin/content") || pathname.startsWith("/admin/gallery") || pathname.startsWith("/admin/reviews")) {
    return [PERMISSIONS.MANAGE_BLOG, PERMISSIONS.MANAGE_PAGES];
  }
  if (pathname.startsWith("/admin/import")) {
    return [PERMISSIONS.MANAGE_PRODUCTS, PERMISSIONS.MANAGE_BLOG];
  }
  if (pathname.startsWith("/admin/notifications") || pathname.startsWith("/admin/referrals")) {
    return [PERMISSIONS.VIEW_CLIENTS, PERMISSIONS.EDIT_CLIENTS];
  }

  return null;
}

/** Maps legacy admin nav permissions to JobRole keys (any one grants visibility). */
export const ADMIN_NAV_JOB_PERMISSIONS: Partial<Record<string, Permission[]>> = {
  bespoke: [PERMISSIONS.VIEW_BESPOKE_ORDERS],
  consultations: [PERMISSIONS.VIEW_CONSULTATIONS],
  invoices: [PERMISSIONS.VIEW_INVOICES, PERMISSIONS.MANAGE_INVOICES],
  quotations: [PERMISSIONS.VIEW_INVOICES, PERMISSIONS.MANAGE_INVOICES],
  shop: [PERMISSIONS.MANAGE_PRODUCTS, PERMISSIONS.VIEW_RTW_ORDERS, PERMISSIONS.PROCESS_RTW_ORDERS],
  clients: [PERMISSIONS.VIEW_CLIENTS],
  staff: [PERMISSIONS.VIEW_STAFF, PERMISSIONS.MANAGE_STAFF],
  attendance: [PERMISSIONS.VIEW_ATTENDANCE],
  finance: [PERMISSIONS.CONFIRM_PAYMENTS, PERMISSIONS.VIEW_FINANCIAL_REPORTS],
  payments: [PERMISSIONS.CONFIRM_PAYMENTS],
  reports: [
    PERMISSIONS.VIEW_DAILY_REPORTS,
    PERMISSIONS.VIEW_WEEKLY_REPORTS,
    PERMISSIONS.VIEW_FINANCIAL_REPORTS,
    PERMISSIONS.VIEW_PERFORMANCE,
  ],
  content: [PERMISSIONS.MANAGE_BLOG, PERMISSIONS.MANAGE_PAGES],
  logs: [PERMISSIONS.VIEW_LOGS],
};

export function mapDepartmentToEnum(department?: string | null) {
  const d = (department ?? "").trim().toUpperCase();
  if (d.includes("TAILOR")) return "TAILOR" as const;
  if (d.includes("BEAD")) return "BEADER" as const;
  if (d.includes("DESIGN")) return "DESIGNER" as const;
  if (d.includes("PATTERN")) return "PATTERN_CUTTER" as const;
  return "GENERAL" as const;
}

export function resolveSystemRoleForAdmin(jobRoleName: string): "ADMIN" | "STAFF_ADMIN" {
  return jobRoleName === "General Manager" ? "ADMIN" : "STAFF_ADMIN";
}
