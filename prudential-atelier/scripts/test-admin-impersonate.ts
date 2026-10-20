/**
 * "View as" (Super Admin viewing the admin as another person) can never lock
 * her out: it refuses people who cannot open the admin, and a leftover cookie
 * for one is ended rather than sending her to the sign-in page.
 *
 *   pnpm test:admin-impersonate
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { IMPERSONATION_END_PATH, assertCanImpersonateTarget } from "../src/lib/admin-impersonate";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (p: string) => readFileSync(join(root, p), "utf8");

const base = { actorId: "super1", actorRole: "SUPER_ADMIN", actorEmail: "s@x.test", targetId: "u1" };
assert(assertCanImpersonateTarget({ ...base, targetRole: "ADMIN", targetHasAdminAccess: true }).ok, "an admin may be viewed as");
assert(
  assertCanImpersonateTarget({ ...base, targetRole: "STAFF", targetHasAdminAccess: false, targetIsStaff: true }).ok,
  "a staff member may be viewed as (their staff portal)",
);
const client = assertCanImpersonateTarget({ ...base, targetRole: "CUSTOMER", targetHasAdminAccess: false, targetIsStaff: false });
assert(!client.ok && /no admin or staff portal access/.test(client.error), "someone with neither portal is refused, with the reason");

const route = src("src/app/api/admin/impersonate/route.ts");
assert(route.includes("targetHasAdminAccess: hasAnyAdminPermission("), "starting View as checks the person's admin access");

const auth = src("src/lib/admin-auth.ts");
assert(/hasAnyAdminPermission\(target\.role, actor\)/.test(auth), "a cookie for someone without admin access is not honoured");
assert(auth.includes("staleImpersonation = true"), "and is reported as stale");

const layout = src("src/app/(admin)/layout.tsx");
const stale = layout.indexOf("if (staleImpersonation) redirect(IMPERSONATION_END_PATH)");
const toLogin = layout.indexOf('redirect("/login?tab=admin")', layout.indexOf("resolveSessionAccess(session)"));
assert(stale > 0 && stale < toLogin, "the layout ends a stale View as before any sign-in redirect");
assert(layout.indexOf('if (staffImpersonation) redirect("/staff")') > 0, "View as a staff member opens their staff portal");

// Staff portal: shown as the person viewed, and read-only.
const mw = src("src/middleware.ts");
assert(
  /impersonating &&[\s\S]{0,200}pathname\.startsWith\("\/api\/staff"\)/.test(mw),
  "staff writes are refused while viewing as",
);
assert(src("src/app/(staff)/layout.tsx").includes("resolveStaffPortalUser"), "the staff portal shows the viewed person");
for (const f of ["attendance-history", "clock-status", "dashboard", "tasks", "work-log", "orders/[orderId]", "notifications", "notifications/count"]) {
  const text = src(`src/app/api/staff/${f}/route.ts`);
  assert(text.includes("resolveStaffPortalUser") && !/session\.user\.id/.test(text), `staff API ${f} reads the viewed person`);
}

assert(IMPERSONATION_END_PATH === "/api/admin/impersonate/end", "the end path is the end route");
const end = src("src/app/api/admin/impersonate/end/route.ts");
assert(end.includes("impersonationCookieOptions(0)") && end.includes('"/admin"'), "the end route clears the cookie and returns to the admin");
assert(!/signImpersonationPayload/.test(end), "the end route cannot start a view");

console.log("test-admin-impersonate: ok");
