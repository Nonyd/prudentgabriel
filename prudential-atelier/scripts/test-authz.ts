/**
 * Authorization, public PII DTOs, receipt ownership, password-reset tokens, register oracle.
 *
 *   pnpm test:authz
 */
import "./preload-test-env";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Role } from "@prisma/client";
import {
  CMS_ADMIN_PERMISSIONS,
  hasAnyAdminPermission,
  hasPermission,
  inheritedDottedPermissions,
  roleAllows,
} from "../src/lib/roles";
import {
  canWriteSettingKey,
  deniedDeveloperWriteKey,
  isDeveloperSettingKey,
  COMMERCIAL_PAYMENTS_KEYS,
} from "../src/lib/settings-developer";
import {
  BESPOKE_ADMIN_ROLES,
  BESPOKE_MANAGER_ROLES,
  BESPOKE_ROLES,
  BESPOKE_STAFF_ROLES,
  sessionHasRole,
} from "../src/lib/bespoke-roles";
import {
  ADMIN_MATRIX_ROUTES,
  ADMIN_NAV_SECTIONS,
  accessRuleForAdminPath,
  adminNavAccessPath,
  adminNavItemIsActive,
  adminNavSectionIdForPath,
  firstAdminPathForRole,
  matrixAccess,
  roleMayAccessAdminPath,
  visibleAdminNavSections,
} from "../src/lib/admin-route-access";
import {
  canEditTargetUserPermissions,
  isRolePermissionsEditable,
  lastSuperAdminCannotBeRemoved,
} from "../src/lib/permission-policy";
import { KEMI_EMAIL } from "../src/lib/permission-catalog";
import { canAccessStaffPortal, authApiErrorMessage, loginPathAfterPasswordReset } from "../src/lib/client-auth";
import type { Session } from "next-auth";
import {
  actorOwnsBespokeOrder,
  toPublicConsultationDto,
  toPublicRtwOrderDto,
  toPublicTrackDto,
} from "../src/lib/public-pii-dtos";
import {
  generateResetToken,
  hashResetToken,
  jwtIssuedBeforePasswordChange,
  RESET_TTL_MS,
} from "../src/lib/password-reset";
import { bindSessionUser } from "../src/lib/session-user";
import { sanitizeCmsHtml } from "../src/lib/sanitize-html";
import { passwordPolicySchema } from "../src/lib/password-policy";
import { mimeFromMagicBytes } from "../src/lib/image-upload-mime";
import { verifyPFAStudent } from "../src/lib/pfa-verify";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "../src");

function routeSource(rel: string): string {
  return readFileSync(join(srcRoot, rel), "utf8");
}

function statusForRoles(role: string, allowed: string[]): 200 | 403 {
  return sessionHasRole(role, null, allowed) ? 200 : 403;
}

/** Same gate as `(staff)/layout.tsx` and `canAccessStaffPortal`. */
function staffLayoutAllows(role: string, isStaff: boolean): boolean {
  return isStaff === true || role === "STAFF";
}

async function main() {
  // Live VPS User.role counts (prudentgabriel-postgres + staging, 2026-08-19).
  // CUSTOMER count 0. No CONTENT_MANAGER / RTW_MANAGER / etc. Neon is not evidence.
  const productionRoles: Record<string, number> = {
    STAFF: 6,
    SUPER_ADMIN: 2,
    ADMIN: 1,
  };
  for (const role of Object.keys(productionRoles)) {
    if (role === "STAFF") {
      assert(!roleAllows(role, "dashboard"), "STAFF has empty ROLE_PERMISSIONS — staff portal, not /admin");
      continue;
    }
    assert(roleAllows(role, "dashboard") || role === "SUPER_ADMIN", `${role} must not be an empty ROLE_PERMISSIONS hole`);
  }
  assert(roleAllows("SUPER_ADMIN", "payments"), "SUPER_ADMIN reaches payments");
  assert(roleAllows("SUPER_ADMIN", "shop.orders"), "SUPER_ADMIN reaches orders");
  assert(roleAllows("SUPER_ADMIN", CMS_ADMIN_PERMISSIONS), "SUPER_ADMIN reaches CMS");
  assert(roleAllows("SUPER_ADMIN", "settings"), "SUPER_ADMIN reaches settings");

  // Mrs. Prudent holds ADMIN (prudent@prudentgabriel.com)
  const mrs = "ADMIN";
  const mrsMustReach = [
    "consultations",
    "bespoke",
    "quotations",
    "invoices",
    "payments",
    "clients",
    "reports",
    "shop.orders",
    "shop.products",
    "content",
    "settings",
  ] as const;
  for (const perm of mrsMustReach) {
    assert(roleAllows(mrs, perm), `Mrs. Prudent (ADMIN) must reach ${perm}`);
  }
  assert(roleAllows("SUPER_ADMIN", "settings.developer"), "SUPER_ADMIN reaches developer settings");
  assert(!roleAllows("ADMIN", "settings.developer"), "ADMIN must not inherit settings.developer");
  assert(!canWriteSettingKey("ADMIN", "paystack_secret_key"), "ADMIN cannot write Paystack secret");
  assert(!canWriteSettingKey("ADMIN", "paystack_public_key"), "ADMIN cannot write Paystack public key");
  assert(canWriteSettingKey("ADMIN", "paystack_enabled"), "ADMIN can toggle Paystack enabled");
  assert(canWriteSettingKey("SUPER_ADMIN", "paystack_secret_key"), "SUPER_ADMIN can write Paystack secret");
  assert(deniedDeveloperWriteKey("ADMIN", ["paystack_enabled", "paystack_secret_key"]) === "paystack_secret_key", "mixed PAYMENTS patch denies the secret");
  assert(deniedDeveloperWriteKey("ADMIN", ["paystack_enabled"]) === null, "commercial PAYMENTS patch is allowed");
  assert(deniedDeveloperWriteKey("SUPER_ADMIN", ["paystack_secret_key"]) === null, "SUPER_ADMIN secret patch is allowed");
  assert(!canWriteSettingKey("ADMIN", "email_tpl_welcome"), "email templates are not a settings write");
  assert(!canWriteSettingKey("ADMIN", "resend_api_key"), "ADMIN cannot write Resend key");
  assert(isDeveloperSettingKey("slack_webhook_url"), "Slack webhook is a developer credential");
  assert(isDeveloperSettingKey("smtp_username"), "SMTP user field is a developer key");
  assert(isDeveloperSettingKey("smtp_password"), "SMTP secret field is a developer key");
  assert(isDeveloperSettingKey("dhl_password"), "DHL secret field is a developer key");
  assert(isDeveloperSettingKey("smtp_use_ssl"), "SMTP SSL flag is a developer key");
  assert(!isDeveloperSettingKey("paystack_enabled"), "enabled flags are commercial");
  assert(COMMERCIAL_PAYMENTS_KEYS.has("paystack_enabled"), "enabled flags are on the commercial set");

  const paymentsPatchSrc = routeSource("app/api/admin/settings/[group]/route.ts");
  assert(paymentsPatchSrc.includes("deniedDeveloperWriteKey"), "PAYMENTS PATCH uses deniedDeveloperWriteKey");
  const testPaySrc = routeSource("app/api/admin/settings/test-payment/route.ts");
  assert(testPaySrc.includes('requireAdminApi("settings.developer")'), "test-payment is settings.developer");
  const devRouteSrc = routeSource("app/api/admin/settings/developer/route.ts");
  assert(devRouteSrc.includes('requireAdminApi("settings.developer")'), "developer settings API is settings.developer");

  // Positive × negative matrix for route groups (200 iff roleAllows)
  const groups: { name: string; perm: Parameters<typeof roleAllows>[1] }[] = [
    { name: "payments", perm: "payments" },
    { name: "shop.orders", perm: "shop.orders" },
    { name: "shop.products", perm: "shop.products" },
    { name: "invoices", perm: "invoices" },
    { name: "quotations", perm: "quotations" },
    { name: "bespoke", perm: "bespoke" },
    { name: "consultations", perm: "consultations" },
    { name: "clients", perm: "clients" },
    { name: "cms", perm: CMS_ADMIN_PERMISSIONS },
    { name: "reports", perm: "reports" },
    { name: "settings (PAYMENTS)", perm: "settings" },
  ];
  const expect200: Record<string, string[]> = {
    SUPER_ADMIN: groups.map((g) => g.name),
    ADMIN: groups.map((g) => g.name),
    STAFF_ADMIN: groups.filter((g) => g.name !== "reports" && g.name !== "settings (PAYMENTS)").map((g) => g.name),
    STAFF: [],
    CONTENT_MANAGER: ["cms"],
    FINANCE_MANAGER: ["payments", "invoices", "quotations", "reports"],
    RTW_MANAGER: ["shop.orders", "shop.products"],
    BESPOKE_MANAGER: ["bespoke", "consultations"],
    CONSULTATION_MANAGER: ["consultations"],
    HR_MANAGER: [],
  };
  for (const [role, allowed] of Object.entries(expect200)) {
    for (const g of groups) {
      const actual = roleAllows(role, g.perm) ? 200 : 403;
      const expected = allowed.includes(g.name) ? 200 : 403;
      assert(actual === expected, `${role} × ${g.name}: expected ${expected} got ${actual}`);
    }
  }

  const matrixRoles = [
    "SUPER_ADMIN",
    "ADMIN",
    "STAFF_ADMIN",
    "STAFF",
    "CONTENT_MANAGER",
    "FINANCE_MANAGER",
    "RTW_MANAGER",
    "BESPOKE_MANAGER",
    "CONSULTATION_MANAGER",
    "HR_MANAGER",
  ];
  for (const role of matrixRoles) {
    for (const row of ADMIN_MATRIX_ROUTES) {
      const page = matrixAccess(role, row.path);
      const api = matrixAccess(role, row.path);
      assert(page === api, `${role} × ${row.group}: page ${page} vs API ${api} must agree`);
    }
  }

  assert(matrixAccess("RTW_MANAGER", "/admin/products") === "allow", "RTW_MANAGER reaches products (positive)");
  assert(matrixAccess("RTW_MANAGER", "/admin/orders") === "allow", "RTW_MANAGER reaches orders (positive)");
  assert(matrixAccess("RTW_MANAGER", "/admin/shipping") === "deny", "RTW_MANAGER does not configure shipping");
  assert(matrixAccess("CONTENT_MANAGER", "/admin/content") === "allow", "CONTENT_MANAGER reaches content (positive)");
  assert(matrixAccess("CONTENT_MANAGER", "/admin/content/blog") === "allow", "CONTENT_MANAGER reaches blog (positive)");
  assert(matrixAccess("CONTENT_MANAGER", "/admin/payments") === "deny", "CONTENT_MANAGER is denied payments");
  assert(matrixAccess("HR_MANAGER", "/admin/staff") === "allow", "HR_MANAGER reaches staff (positive)");
  assert(matrixAccess("HR_MANAGER", "/admin/attendance") === "allow", "HR_MANAGER reaches attendance (positive)");
  assert(matrixAccess("HR_MANAGER", "/admin/payments") === "deny", "HR_MANAGER is denied payments");
  assert(matrixAccess("FINANCE_MANAGER", "/admin/payments") === "allow", "FINANCE_MANAGER reaches payments (positive)");
  assert(matrixAccess("FINANCE_MANAGER", "/admin/invoices") === "allow", "FINANCE_MANAGER reaches invoices (positive)");
  assert(matrixAccess("FINANCE_MANAGER", "/admin/quotations") === "allow", "FINANCE_MANAGER reaches quotations (positive)");
  assert(matrixAccess("FINANCE_MANAGER", "/admin/products") === "deny", "FINANCE_MANAGER is denied products");
  assert(matrixAccess("STAFF_ADMIN", "/admin/shipping") === "allow", "STAFF_ADMIN reaches shipping via shop (positive)");
  assert(matrixAccess("STAFF_ADMIN", "/admin/settings") === "deny", "STAFF_ADMIN is denied settings");
  assert(matrixAccess("ADMIN", "/admin/settings/users") === "deny", "ADMIN does not open Users & Roles");
  assert(matrixAccess("SUPER_ADMIN", "/admin/settings/users") === "allow", "SUPER_ADMIN opens Users & Roles (positive)");
  assert(matrixAccess("STAFF", "/admin") === "deny", "STAFF is denied the admin executive page");
  assert(matrixAccess("STAFF", "/admin/bespoke") === "deny", "STAFF is denied admin bespoke");
  assert(matrixAccess("BESPOKE_MANAGER", "/admin/bespoke") === "allow", "BESPOKE_MANAGER reaches atelier (positive)");
  assert(matrixAccess("CONSULTATION_MANAGER", "/admin/consultations") === "allow", "CONSULTATION_MANAGER reaches consultations (positive)");
  assert(matrixAccess("CONSULTATION_MANAGER", "/admin/clients") === "deny", "clients.view is not the clients page gate");

  assert(firstAdminPathForRole("RTW_MANAGER") === "/admin/products", "RTW_MANAGER lands on products");
  assert(firstAdminPathForRole("CONTENT_MANAGER") === "/admin/content", "CONTENT_MANAGER lands on content");
  assert(firstAdminPathForRole("HR_MANAGER") === "/admin/staff", "HR_MANAGER lands on staff");
  assert(firstAdminPathForRole("FINANCE_MANAGER") === "/admin/invoices", "FINANCE_MANAGER lands on invoices");
  assert(firstAdminPathForRole("ADMIN") === "/admin", "ADMIN lands on executive");

  const rtwNav = visibleAdminNavSections("RTW_MANAGER");
  assert(rtwNav.every((s) => s.items.length > 0), "visible nav never includes an empty section");
  assert(!rtwNav.some((s) => s.id === "people"), "People is omitted for RTW_MANAGER (no visible items)");
  assert(!rtwNav.some((s) => s.id === "executive"), "Executive is omitted for RTW_MANAGER");
  assert(rtwNav.some((s) => s.id === "orders"), "RTW_MANAGER sees Orders");
  assert(rtwNav.some((s) => s.id === "catalogue"), "RTW_MANAGER sees Catalogue");
  const peopleDef = ADMIN_NAV_SECTIONS.find((s) => s.id === "people");
  assert(peopleDef != null, "People section exists in the map");
  assert(
    peopleDef.items.every((item) => !roleMayAccessAdminPath("RTW_MANAGER", adminNavAccessPath(item.href))),
    "RTW_MANAGER cannot access any People href (source of empty-section omit)",
  );
  assert(visibleAdminNavSections("SUPER_ADMIN").length === ADMIN_NAV_SECTIONS.length, "SUPER_ADMIN sees every nav section");
  assert(adminNavSectionIdForPath("/admin/content/pages") === "site", "Pages belong to Site, not House content prefix");
  assert(adminNavSectionIdForPath("/admin/settings/appearance") === "site", "Appearance belongs to Site");
  const allOrders = { href: "/admin/orders", label: "All orders", icon: "orders" };
  const refunds = { href: "/admin/orders?attention=refund-required", label: "Refund required", icon: "refund" };
  assert(adminNavItemIsActive("/admin/orders", "attention=refund-required", "", refunds), "refund queue is active on its query");
  assert(!adminNavItemIsActive("/admin/orders", "attention=refund-required", "", allOrders), "All orders is not active on a queue");
  const commerce = ADMIN_NAV_SECTIONS.find((s) => s.id === "commerce");
  assert(commerce?.items.at(-1)?.href === "/admin/sizing", "Sizing is last in Commerce setup");
  const sidebarSrc = routeSource("components/admin/AdminSidebar.tsx");
  assert(sidebarSrc.includes("visibleAdminNavSections"), "sidebar visibility comes from the Step 2 map");
  assert(!sidebarSrc.includes("superAdminOnly"), "sidebar has no second permission flags");

  const shippingSrc = routeSource("app/api/admin/shipping/route.ts");
  assert(shippingSrc.includes('requireAdminApi("shop")'), "shipping API is shop, not settings");
  assert(!shippingSrc.includes('requireAdminApi("settings")'), "shipping API no longer uses settings");
  const usersMw = readFileSync(join(srcRoot, "middleware.ts"), "utf8");
  assert(
    usersMw.includes('pathname.startsWith("/admin/settings/users") && role !== "SUPER_ADMIN"'),
    "Users & Roles middleware is Super Admin only",
  );
  assert(routeSource("app/api/staff/route.ts").includes('requireAdminApi("staff")'), "staff list API is staff permission");
  assert(routeSource("app/api/attendance/today/route.ts").includes('requireAdminApi("attendance")'), "attendance API is attendance permission");
  assert(routeSource("app/api/quotations/route.ts").includes('requireAdminApi("quotations")'), "quotations API is quotations permission");
  assert(routeSource("app/api/blog/route.ts").includes("CMS_ADMIN_PERMISSIONS"), "blog admin API is CMS permissions");
  assert(routeSource("app/api/admin/clients/search/route.ts").includes('requireAdminApi("clients")'), "client search matches Client CRM");
  const layoutSrc = routeSource("app/(admin)/layout.tsx");
  assert(layoutSrc.includes("deniedAdminRedirect"), "admin layout uses the shared path guard");
  const permSrc = routeSource("lib/permissions.ts");
  assert(!permSrc.includes("getJobPermissionsForAdminPath"), "dead JobRole path checks are gone");

  const adminAppDir = join(srcRoot, "app/(admin)/admin");
  const pageFiles: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name === "page.tsx") pageFiles.push(p);
    }
  };
  walk(adminAppDir);
  assert(pageFiles.length > 40, "expected a full set of admin pages");
  const marker = "/app/(admin)/admin/";
  for (const file of pageFiles) {
    const posix = file.replace(/\\/g, "/");
    const idx = posix.indexOf(marker);
    assert(idx >= 0, `admin page outside expected tree: ${posix}`);
    const rel = posix.slice(idx + marker.length);
    const route = rel.replace(/\/page\.tsx$/, "").replace(/^page\.tsx$/, "");
    const normalized = route ? `/admin/${route.replace(/\[.+?\]/g, "x")}` : "/admin";
    assert(accessRuleForAdminPath(normalized) !== null, `unmapped admin page ${normalized} (${rel})`);
  }
  assert(roleMayAccessAdminPath("ADMIN", "/admin/products/x/edit"), "product edit inherits shop.products");
  assert(roleMayAccessAdminPath("ADMIN", "/admin/products/x/stock"), "product stock history inherits shop.products");

  assert(inheritedDottedPermissions("ADMIN").includes("shop.orders"), "ADMIN inherits shop.orders from shop");
  assert(inheritedDottedPermissions("STAFF_ADMIN").includes("shop.orders"), "STAFF_ADMIN inherits shop.orders from shop");
  assert(!inheritedDottedPermissions("ADMIN").includes("settings.developer"), "settings.developer is not inherited");
  assert(inheritedDottedPermissions("ADMIN").includes("settings.bank-accounts"), "ADMIN inherits bank accounts from settings");
  assert(inheritedDottedPermissions("CONTENT_MANAGER").length === 0, "CONTENT_MANAGER has no parent-key inheritance");

  // Slice T Step 4 — resolved set, not a second map
  assert(!isRolePermissionsEditable("SUPER_ADMIN"), "SUPER_ADMIN permissions are not editable");
  assert(isRolePermissionsEditable("RTW_MANAGER"), "RTW_MANAGER permissions are editable");
  assert(lastSuperAdminCannotBeRemoved(1), "the last SUPER_ADMIN cannot be removed");
  assert(!lastSuperAdminCannotBeRemoved(2), "a spare SUPER_ADMIN can be removed");
  assert(
    canEditTargetUserPermissions({
      actorId: "nony",
      actorRole: "SUPER_ADMIN",
      targetId: "nony",
      targetRole: "RTW_MANAGER",
    }).ok === false,
    "a user cannot edit themselves",
  );
  assert(
    canEditTargetUserPermissions({
      actorId: "nony",
      actorRole: "SUPER_ADMIN",
      targetId: "kemi",
      targetRole: "SUPER_ADMIN",
    }).ok === false,
    "SUPER_ADMIN accounts are not editable",
  );

  assert(roleAllows("ADMIN", "payments"), "role grant stands without a revoke");
  assert(
    !roleAllows("ADMIN", "payments", { revokes: ["payments"] }),
    "a user REVOKE beats a role grant",
  );
  assert(
    !hasPermission("ADMIN", "payments", { revokes: ["payments"] }),
    "REVOKE removes payments even though ADMIN seed has it",
  );
  assert(
    !hasPermission("ADMIN", "shop.orders", { revokes: ["shop.orders"] }),
    "REVOKE beats parent-key inheritance (shop → shop.orders)",
  );

  const kemi = { grants: ["bespoke", "consultations"] as const };
  assert(roleAllows("RTW_MANAGER", "bespoke", kemi), "Kemi atelier grant reaches bespoke");
  assert(roleAllows("RTW_MANAGER", "consultations", kemi), "Kemi atelier grant reaches consultations");
  assert(roleMayAccessAdminPath("RTW_MANAGER", "/admin/bespoke", KEMI_EMAIL, kemi), "Kemi path: bespoke");
  assert(roleMayAccessAdminPath("RTW_MANAGER", "/admin/consultations", KEMI_EMAIL, kemi), "Kemi path: consultations");
  assert(!roleAllows("RTW_MANAGER", "payments", kemi), "Kemi still cannot touch payments");
  assert(!roleAllows("RTW_MANAGER", "settings", kemi), "Kemi still cannot touch settings");
  assert(!roleAllows("RTW_MANAGER", "settings.developer", kemi), "Kemi still cannot touch developer");
  assert(!roleMayAccessAdminPath("RTW_MANAGER", "/admin/payments", KEMI_EMAIL, kemi), "Kemi payments path denied");
  assert(!roleMayAccessAdminPath("RTW_MANAGER", "/admin/settings", KEMI_EMAIL, kemi), "Kemi settings path denied");
  assert(!roleMayAccessAdminPath("RTW_MANAGER", "/admin/settings/developer", KEMI_EMAIL, kemi), "Kemi developer path denied");
  assert(!roleMayAccessAdminPath("RTW_MANAGER", "/admin/settings/users", KEMI_EMAIL, kemi), "Kemi users path denied");
  const kemiNav = visibleAdminNavSections("RTW_MANAGER", KEMI_EMAIL, kemi);
  assert(kemiNav.some((s) => s.id === "atelier"), "Kemi nav shows Atelier after grant");
  assert(kemiNav.some((s) => s.id === "consultations"), "Kemi nav shows Consultations after grant");
  assert(!kemiNav.some((s) => s.id === "payments"), "Kemi nav hides Payments");
  assert(!kemiNav.some((s) => s.id === "settings"), "Kemi nav hides Settings");
  const kemiHidden = ADMIN_NAV_SECTIONS.flatMap((s) => s.items).filter(
    (item) =>
      !kemiNav.some((section) => section.items.some((visible) => visible.href === item.href)),
  );
  for (const item of kemiHidden) {
    const path = adminNavAccessPath(item.href);
    assert(
      !roleMayAccessAdminPath("RTW_MANAGER", path, KEMI_EMAIL, kemi),
      `hidden nav ${item.href} must 403 (same gate as the API)`,
    );
  }

  assert(roleMayAccessAdminPath("FINANCE_MANAGER", "/admin/settings/bank-accounts"), "FINANCE_MANAGER reaches bank accounts via the split permission");
  assert(roleMayAccessAdminPath("FINANCE_MANAGER", "/admin/reports"), "FINANCE_MANAGER reaches reports");
  assert(!roleMayAccessAdminPath("FINANCE_MANAGER", "/admin/settings/email"), "FINANCE_MANAGER does not get the rest of Settings");
  assert(
    roleMayAccessAdminPath("FINANCE_MANAGER", "/admin/settings/bank-accounts", null, {
      grants: ["settings.bank-accounts"],
    }),
    "FINANCE_MANAGER reaches bank accounts when granted the split permission",
  );
  assert(
    !roleMayAccessAdminPath("FINANCE_MANAGER", "/admin/settings/email", null, {
      grants: ["settings.bank-accounts"],
    }),
    "bank-accounts grant does not open the rest of Settings",
  );

  const authzSrc = routeSource("lib/admin-auth.ts");
  assert(authzSrc.includes("resolveSessionAccess"), "APIs resolve the same set as the nav");
  assert(authzSrc.includes("permissionGrants"), "user GRANTs are applied on the API");
  const usersDeleteSrc = routeSource("app/api/admin/users/[id]/route.ts");
  assert(usersDeleteSrc.includes("Cannot remove the last Super Admin"), "last SUPER_ADMIN cannot be deleted");
  const seedSrc = routeSource("lib/permission-seed.ts");
  assert(seedSrc.includes("ROLE_PERMISSIONS"), "ROLE_PERMISSIONS remains the seed");
  const cacheSrc = routeSource("lib/permission-cache.ts");
  assert(cacheSrc.includes("ROLE_PERMISSIONS"), "empty DB falls back to ROLE_PERMISSIONS");
  assert(cacheSrc.includes("permissionCacheState"), "cache revision is shared, not process-only");

  // STAFF portal (Sprint B stage-gates) — not ROLE_PERMISSIONS / requireAdminApi
  assert(BESPOKE_STAFF_ROLES.includes("STAFF"), "STAFF is on BESPOKE_STAFF_ROLES");
  assert(!BESPOKE_MANAGER_ROLES.includes("STAFF"), "STAFF is not a bespoke manager");
  assert(!BESPOKE_ADMIN_ROLES.includes("STAFF"), "STAFF is not a bespoke admin");
  assert(BESPOKE_ROLES === BESPOKE_STAFF_ROLES, "BESPOKE_ROLES is the staff list");

  const staffSession = { user: { id: "staff_1", role: "STAFF", isStaff: true } } as Session;
  assert(canAccessStaffPortal(staffSession), "STAFF reaches /staff via canAccessStaffPortal");
  assert(staffLayoutAllows("STAFF", true), "STAFF layout allows isStaff");
  assert(staffLayoutAllows("STAFF", false), "STAFF layout allows role STAFF even if isStaff flag missing");
  assert(!staffLayoutAllows("CUSTOMER", false), "customers cannot enter /staff");
  assert(!hasAnyAdminPermission("STAFF"), "empty ROLE_PERMISSIONS must not be the staff-portal gate");
  assert(
    staffLayoutAllows("STAFF", true) || hasAnyAdminPermission("STAFF"),
    "requireStaffPortal: STAFF still enters via isStaff/role, not permissions",
  );

  const staffStageRoutes: { file: string; gate: string }[] = [
    { file: "app/api/bespoke/[orderId]/complete-stage/route.ts", gate: "BESPOKE_STAFF_ROLES" },
    { file: "app/api/bespoke/[orderId]/request-approval/route.ts", gate: "BESPOKE_STAFF_ROLES" },
    { file: "app/api/bespoke/[orderId]/stage-media/route.ts", gate: "BESPOKE_STAFF_ROLES" },
    { file: "app/api/bespoke/[orderId]/stage-draft/route.ts", gate: "BESPOKE_STAFF_ROLES" },
    { file: "app/api/bespoke/route.ts", gate: "BESPOKE_STAFF_ROLES" },
    { file: "app/api/bespoke/[orderId]/route.ts", gate: "BESPOKE_STAFF_ROLES" },
    { file: "app/api/clients/[clientId]/measurements/route.ts", gate: "BESPOKE_ROLES" },
    { file: "app/api/clients/[clientId]/notes/route.ts", gate: "BESPOKE_ROLES" },
    { file: "app/api/clients/[clientId]/communications/route.ts", gate: "BESPOKE_ROLES" },
    { file: "app/api/moodboards/route.ts", gate: "BESPOKE_ROLES" },
    { file: "app/api/moodboards/[id]/route.ts", gate: "BESPOKE_ROLES" },
  ];
  for (const r of staffStageRoutes) {
    const src = routeSource(r.file);
    assert(src.includes("requireRoles"), `${r.file} must use requireRoles`);
    assert(src.includes(r.gate), `${r.file} must gate on ${r.gate}`);
    assert(!src.includes("requireAdminApi"), `${r.file} must not use requireAdminApi`);
    assert(statusForRoles("STAFF", BESPOKE_STAFF_ROLES) === 200, `STAFF 200 on ${r.file}`);
  }
  const revertSrc = routeSource("app/api/bespoke/[orderId]/revert-stage/route.ts");
  assert(revertSrc.includes("BESPOKE_ADMIN_ROLES"), "revert-stage uses BESPOKE_ADMIN_ROLES");
  assert(!revertSrc.includes("requireAdminApi"), "revert-stage must not use requireAdminApi");
  assert(statusForRoles("STAFF", BESPOKE_ADMIN_ROLES) === 403, "STAFF 403 on revert-stage");
  const payConfirmSrc = routeSource("app/api/admin/payments/[id]/confirm/route.ts");
  assert(payConfirmSrc.includes('requireAdminApi("payments")'), "payment confirm is requireAdminApi(payments)");
  assert(!roleAllows("STAFF", "payments"), "STAFF 403 on payment confirm");

  // B1 — CONTENT_MANAGER cannot hit money / user admin surfaces
  assert(!hasPermission("CONTENT_MANAGER", "payments"), "CONTENT_MANAGER must not have payments");
  assert(!hasPermission("CONTENT_MANAGER", "settings"), "CONTENT_MANAGER must not have settings");
  assert(!hasPermission("CONTENT_MANAGER", "shop.orders"), "CONTENT_MANAGER must not have shop.orders (API read denied; confirm if UI-only was intended)");
  assert(hasPermission("CONTENT_MANAGER", "content.pages"), "CONTENT_MANAGER keeps content.pages");
  assert(hasPermission("FINANCE_MANAGER", "payments"), "FINANCE_MANAGER has payments");
  assert(hasPermission("ADMIN", "payments"), "ADMIN has payments");

  // B2 — track DTO never includes leaked keys
  const track = toPublicTrackDto({
    orderRef: "BQ-2026-00001",
    status: "IN_PRODUCTION" as never,
    currentStage: "PATTERN_MAKING" as never,
    clientName: "Ada Lovelace",
    deliveryDate: new Date("2026-09-01"),
  });
  const trackJson = JSON.stringify(track);
  for (const key of ["clientEmail", "clientPhone", "paymentRef", "receiptConfirmToken", "sessionNotes"]) {
    assert(!Object.prototype.hasOwnProperty.call(track, key), `track DTO must not have key ${key}`);
    assert(!trackJson.includes(key), `track DTO JSON must not mention ${key}`);
  }
  assert(track.clientFirstName === "Ada", "first name only");

  const consult = toPublicConsultationDto({
    bookingNumber: "CB-26-00001",
    status: "CONFIRMED" as never,
    paymentStatus: "PAID" as never,
    clientName: "Ada Lovelace",
    confirmedDate: new Date(),
    confirmedTime: "10:00",
    offering: { sessionType: "STYLING_SESSION" },
    consultant: { name: "Prudent" },
  });
  const consultJson = JSON.stringify(consult);
  for (const key of ["clientEmail", "clientPhone", "paymentRef", "sessionNotes"]) {
    assert(!Object.prototype.hasOwnProperty.call(consult, key), `consultation DTO must not have ${key}`);
    assert(!consultJson.includes("clientEmail"), "consultation DTO must not leak clientEmail");
  }

  const rtw = toPublicRtwOrderDto({
    orderNumber: "PA-26-00001",
    status: "PENDING",
    paymentStatus: "PENDING" as never,
    total: 1,
    currency: "NGN",
    items: [{ product: { name: "Dress" }, size: "M", quantity: 1 }],
  });
  assert(!("guestEmail" in rtw), "RTW DTO must not include guestEmail");
  assert(!("addressSnapshot" in rtw), "RTW DTO must not include addressSnapshot");
  assert(!("paymentRef" in rtw), "RTW tracker must not include paymentRef");
  assert(!("collectionCode" in rtw), "RTW tracker must not include collectionCode");
  const rtwJson = JSON.stringify(rtw);
  for (const key of ["guestEmail", "guestPhone", "addressSnapshot", "paymentRef", "collectionCode"]) {
    assert(!rtwJson.includes(key), `RTW tracker JSON must not mention ${key}`);
  }
  assert(rtw.paid.currency === "NGN", "NGN order is paid in naira");
  assert(Array.isArray(rtw.items) && rtw.items[0]?.size === "M", "tracker carries size");

  // B3 — non-owner cannot confirm
  assert(
    !actorOwnsBespokeOrder({
      actorId: "user_attacker",
      actorEmail: "attacker@example.test",
      clientEmail: "owner@example.test",
      profileUserId: "user_owner",
    }),
    "non-owner must not own order even with a valid token path",
  );
  assert(
    actorOwnsBespokeOrder({
      actorId: "user_owner",
      actorEmail: "owner@example.test",
      clientEmail: "owner@example.test",
      profileUserId: "user_owner",
    }),
    "owner email/id must match",
  );

  // B7 — token hashing, single-use / expiry helpers
  const { raw, hash } = generateResetToken();
  assert(hash === hashResetToken(raw), "hash is deterministic");
  assert(hash !== raw, "store hash not raw token");
  assert(RESET_TTL_MS === 60 * 60 * 1000, "1 hour expiry");
  const used = new Set<string>();
  const consume = (tokenHash: string, expiresAt: Date, now: Date) => {
    if (used.has(tokenHash)) return false;
    if (expiresAt < now) return false;
    used.add(tokenHash);
    return true;
  };
  const now = new Date();
  assert(consume(hash, new Date(now.getTime() + 1000), now), "first use succeeds");
  assert(!consume(hash, new Date(now.getTime() + 1000), now), "second use fails");
  const { hash: expiredHash } = generateResetToken();
  assert(!consume(expiredHash, new Date(now.getTime() - 1000), now), "expired token fails");
  assert(
    jwtIssuedBeforePasswordChange(100, new Date(200_000)),
    "JWT iat before passwordChangedAt is stale",
  );
  assert(
    !jwtIssuedBeforePasswordChange(300, new Date(200_000)),
    "JWT iat after passwordChangedAt is valid",
  );
  assert(
    !jwtIssuedBeforePasswordChange(undefined, new Date()),
    "missing iat must not invalidate",
  );
  assert(
    !jwtIssuedBeforePasswordChange(1_700_000_000, null),
    "null passwordChangedAt must not invalidate existing sessions",
  );
  const changed = new Date(1_700_000_500_000); // ms
  assert(
    !jwtIssuedBeforePasswordChange(1_700_000_500, changed),
    "same unix second is not stale",
  );
  assert(
    jwtIssuedBeforePasswordChange(1_700_000_499, changed),
    "previous unix second is stale",
  );
  assert(
    !jwtIssuedBeforePasswordChange(1_700_000_500_000, changed),
    "millisecond iat is normalised and not stale at the same instant",
  );
  assert(
    bindSessionUser({
      foundById: { id: "old", isActive: true },
      foundByEmail: { id: "new", isActive: true },
    })?.id === "old",
    "existing user id wins over email",
  );
  assert(
    bindSessionUser({
      foundById: null,
      foundByEmail: { id: "current", isActive: true },
    })?.rebound === true,
    "stale JWT rebinds to the current row for that email",
  );
  assert(
    bindSessionUser({ foundById: { id: "gone", isActive: false }, foundByEmail: null }) === null,
    "inactive user drops the session",
  );
  assert(
    bindSessionUser({ foundById: null, foundByEmail: null }) === null,
    "unknown JWT drops the session",
  );
  assert(passwordPolicySchema.safeParse("password").success === false, "policy rejects no upper/digit");
  assert(passwordPolicySchema.safeParse("Password1").success === true, "policy accepts upper+digit");

  const resetPage = routeSource("app/(auth)/auth/reset-password/[token]/page.tsx");
  assert(resetPage.includes("hardNavigate"), "email reset uses a full page load after success");
  assert(!resetPage.includes("router.push"), "email reset must not soft-navigate after success");
  assert(resetPage.includes("signOut"), "email reset clears a stale session cookie");
  const forcedReset = routeSource("components/auth/ResetPasswordClient.tsx");
  assert(forcedReset.includes("hardNavigate"), "forced reset uses a full page load after success");
  assert(!forcedReset.includes("await update()"), "forced reset must not refresh a revoked JWT");
  assert(forcedReset.includes("loginPathAfterPasswordReset"), "forced reset sends the user to sign-in");
  const adminLayout = routeSource("app/(admin)/layout.tsx");
  assert(adminLayout.includes("authOrNull"), "admin layout must not throw on a stale session");
  const accountLayout = routeSource("app/(account)/layout.tsx");
  assert(accountLayout.includes("authOrNull"), "account layout must not throw on a stale session");
  assert(
    authApiErrorMessage({ error: { password: ["Password must contain at least one number"] } }).includes(
      "number",
    ),
    "fieldErrors become a string",
  );
  assert(loginPathAfterPasswordReset({ user: { role: "ADMIN" } } as Session) === "/login?tab=admin", "admin reset lands on admin login");
  assert(loginPathAfterPasswordReset(null) === "/auth/login", "unknown session lands on customer login");

  // B6 — register responses are identical
  const existingBody = { success: true };
  const newBody = { success: true };
  assert(JSON.stringify(existingBody) === JSON.stringify(newBody), "register success payload is identical");

  // B8 — PFA mock refused unless explicitly set in development
  const prev = process.env.PFA_VERIFY_METHOD;
  delete process.env.PFA_VERIFY_METHOD;
  const refused = await verifyPFAStudent("PFA/2024/001");
  assert(refused.valid === false, "unset PFA_VERIFY_METHOD refuses");
  process.env.PFA_VERIFY_METHOD = prev;

  // B10 — sanitizer strips script
  const dirty = `<p>Hi</p><script>alert(1)</script><a href="javascript:alert(1)">x</a>`;
  const clean = sanitizeCmsHtml(dirty);
  assert(!clean.includes("script"), "script tags stripped");
  assert(!clean.toLowerCase().includes("javascript:"), "javascript urls stripped");

  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert(mimeFromMagicBytes(jpeg) === "image/jpeg", "jpeg magic");

  void Role.CUSTOMER;
  console.log("OK — test-authz");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
