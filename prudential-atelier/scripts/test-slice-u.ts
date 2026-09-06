/**
 * Slice U: credential honesty, no set-password, impersonation rules.
 *
 *   pnpm test:slice-u
 */
import "./preload-test-env";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CREDENTIAL_CATALOG,
  ENV_SOURCE_LABEL,
  credentialDisplayValue,
  describeCredentialSource,
  firstEnvValue,
} from "../src/lib/credential-catalog";
import {
  ADMIN_IMPERSONATE_COOKIE,
  IMPERSONATE_TTL_MS,
  assertCanImpersonateTarget,
  impersonationRemainingMs,
  parseImpersonationCookie,
  signImpersonationPayload,
} from "../src/lib/admin-impersonate";
import { ADMIN_NAV_SECTIONS, ADMIN_PAGE_OWNERS, roleMayAccessAdminPath } from "../src/lib/admin-route-access";
import { isDeveloperSettingKey } from "../src/lib/settings-developer";
import {
  createResendProvider,
} from "../src/lib/email-providers";
import { jwtIssuedBeforePasswordChange } from "../src/lib/password-reset";
import { parseOptionalPhone } from "../src/lib/admin-users";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "../src");

function routeSource(rel: string): string {
  return readFileSync(join(srcRoot, rel), "utf8");
}

process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? "slice-u-test-secret";

function main() {
  assert(describeCredentialSource("", "re_live") === "environment", "env-only is environment");
  assert(describeCredentialSource("db-key", "re_live") === "database", "database wins when both set");
  assert(describeCredentialSource("", "") === "unset", "empty is unset");
  assert(
    credentialDisplayValue("environment", null, "••••••••") === ENV_SOURCE_LABEL,
    "env-only is not shown blank",
  );
  assert(credentialDisplayValue("unset", null, "••••••••") === "", "unset may be blank");
  assert(credentialDisplayValue("database", "secret", "••••••••") === "••••••••", "stored secret is redacted");

  const envOnly = firstEnvValue(["RESEND_API_KEY"], {
    ...process.env,
    RESEND_API_KEY: "re_test_only",
  });
  assert(envOnly === "re_test_only", "firstEnvValue reads the process env");

  const resend = CREDENTIAL_CATALOG.find((e) => e.id === "resend_api_key");
  assert(resend?.home === "database", "Resend can live in the database");
  assert(resend?.runtime === "database", "Resend runtime is database after Slice U");
  const cron = CREDENTIAL_CATALOG.find((e) => e.id === "cron_secret");
  assert(cron?.home === "host_env", "CRON_SECRET stays on the host");
  const cloud = CREDENTIAL_CATALOG.find((e) => e.id === "cloudinary");
  assert(cloud?.home === "host_env", "Cloudinary stays on the host");
  const db = CREDENTIAL_CATALOG.find((e) => e.id === "database_url");
  assert(db?.home === "circular", "DATABASE_URL is circular");
  const oxr = CREDENTIAL_CATALOG.find((e) => e.id === "open_exchange_rates_app_id");
  assert(oxr?.home === "database", "Open Exchange Rates moved to the dashboard");
  assert(isDeveloperSettingKey("open_exchange_rates_app_id"), "OXR app id is a developer credential");

  const emailSrc = routeSource("lib/email-providers.ts");
  assert(!emailSrc.includes("envOrSetting"), "email providers no longer env-then-db");
  assert(!emailSrc.includes("process.env.RESEND_API_KEY"), "Resend provider does not read process.env");
  assert(emailSrc.includes("getDashboardSecret"), "email providers read the dashboard");

  const paySrc = routeSource("lib/payments/config.ts");
  assert(!paySrc.includes("settingOrEnv"), "payments config no longer db-then-env");
  assert(paySrc.includes("getDashboardSecret"), "payments config reads the dashboard");

  const stripeBespoke = routeSource("app/api/bespoke/[orderId]/verify-payment/route.ts");
  assert(!stripeBespoke.includes("process.env.STRIPE_SECRET_KEY"), "bespoke Stripe verify does not read env");

  const stripePm = routeSource("app/api/account/payment-methods/[id]/route.ts");
  assert(!stripePm.includes("process.env.STRIPE_SECRET_KEY"), "saved cards do not read Stripe env");

  const gigSrc = routeSource("lib/shipping/carriers/gig.ts");
  assert(!gigSrc.includes('env("GIG_API_KEY")'), "GIG does not fall back to env");

  const blankResend = createResendProvider({ apiKey: null });
  assert(!blankResend.isConfigured(), "Resend with no dashboard key is not configured");
  const envResend = createResendProvider();
  assert(!envResend.isConfigured(), "Resend without opts does not pick up process.env");

  const usersPatch = routeSource("app/api/admin/users/[id]/route.ts");
  assert(usersPatch.includes("cannot set another person's password"), "users PATCH refuses a password field");
  assert(usersPatch.includes("forceSignOutUser"), "email change signs the user out");
  assert(usersPatch.includes("parseOptionalPhone"), "users PATCH accepts a phone number");
  const usersPost = routeSource("app/api/admin/users/route.ts");
  assert(usersPost.includes("parseOptionalPhone"), "invite stores an optional phone number");
  const usersUi = routeSource("components/admin/settings/UserManagementClient.tsx");
  assert(usersUi.includes("Phone number"), "invite and edit have a phone field");
  assert(usersUi.includes('type="tel"'), "phone fields use tel input");
  assert(!usersUi.includes("cursor-not-allowed rounded-[3px] border border-sand bg-bg/60"), "email is editable");
  const emptyPhone = parseOptionalPhone("");
  assert(emptyPhone.ok && emptyPhone.phone === null, "empty phone clears the number");
  assert(!parseOptionalPhone("123").ok, "short phone is rejected");
  const ngPhone = parseOptionalPhone("+234 801 234 5678");
  assert(ngPhone.ok && ngPhone.phone === "+234 801 234 5678", "formatted NG phone is accepted");
  const resetRoute = routeSource("app/api/admin/users/[id]/reset-password/route.ts");
  assert(resetRoute.includes("sendAdminPasswordReset"), "admin reset sends a link");
  assert(!resetRoute.toLowerCase().includes("bcrypt"), "admin reset does not hash a chosen password");

  const denied = assertCanImpersonateTarget({
    actorId: "nony",
    actorRole: "SUPER_ADMIN",
    actorEmail: "nony@example.test",
    targetId: "kemi",
    targetRole: "SUPER_ADMIN",
  });
  assert(!denied.ok, "cannot impersonate a Super Admin");

  const adminDenied = assertCanImpersonateTarget({
    actorId: "admin",
    actorRole: "ADMIN",
    actorEmail: "admin@example.test",
    targetId: "kemi",
    targetRole: "ADMIN",
  });
  assert(!adminDenied.ok, "ADMIN cannot impersonate");

  const allowed = assertCanImpersonateTarget({
    actorId: "nony",
    actorRole: "SUPER_ADMIN",
    actorEmail: "nony@example.test",
    targetId: "kemi",
    targetRole: "ADMIN",
  });
  assert(allowed.ok, "Super Admin can view as ADMIN");

  const payload = {
    actorId: "nony",
    actorEmail: "nony@example.test",
    targetId: "kemi",
    targetEmail: "kemi@example.test",
    targetName: "Kemi",
    targetRole: "ADMIN",
    exp: Date.now() + IMPERSONATE_TTL_MS,
  };
  const cookie = signImpersonationPayload(payload);
  const parsed = parseImpersonationCookie(cookie);
  assert(parsed?.targetId === "kemi", "signed impersonation cookie round-trips");
  assert(parsed?.actorId === "nony", "cookie keeps the impersonator");
  assert(impersonationRemainingMs(parsed!) > 0, "fresh session has time left");

  const expired = signImpersonationPayload({ ...payload, exp: Date.now() - 1000 });
  assert(parseImpersonationCookie(expired) === null, "expired impersonation ends by itself");

  const loggerSrc = routeSource("lib/logger.ts");
  assert(loggerSrc.includes("impersonatedUserId"), "activity log writes both identities");
  assert(loggerSrc.includes("actorId"), "log actor is the impersonator");

  const transportSrc = routeSource("lib/email-transport.ts");
  assert(!transportSrc.includes("SMTP_PASSWORD"), "legacy SMTP transport does not read env");

  const mw = routeSource("middleware.ts");
  assert(mw.includes("View as user is read-only"), "middleware blocks writes while impersonating");
  assert(mw.includes("settings/developer"), "middleware blocks developer credentials while impersonating");

  const navHrefs = ADMIN_NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.href.split("?")[0]));
  assert(navHrefs.includes("/admin/settings/bank-accounts"), "bank accounts is in the nav");
  assert(navHrefs.includes("/admin/referrals"), "referrals is in the nav");
  assert(navHrefs.includes("/admin/alterations"), "alterations is in the nav");
  assert(navHrefs.includes("/admin/content/email-templates"), "email templates is in the nav");
  assert(!navHrefs.includes("/admin/team"), "team is not a nav row");
  assert(!navHrefs.includes("/admin/customers"), "customers list is not a nav row");

  const customersPage = routeSource("app/(admin)/admin/customers/page.tsx");
  assert(customersPage.includes('redirect("/admin/clients")'), "customers redirects to clients");
  const teamPage = routeSource("app/(admin)/admin/team/page.tsx");
  assert(teamPage.includes('redirect("/admin/settings/users")'), "team redirects to users");

  assert(
    roleMayAccessAdminPath("FINANCE_MANAGER", "/admin/settings/bank-accounts", null, {
      grants: ["settings.bank-accounts"],
    }),
    "finance with bank grant reaches bank accounts",
  );

  const owners = ADMIN_PAGE_OWNERS.map((p) => p.path);
  assert(owners.includes("/admin/settings/developer"), "page table includes developer settings");
  assert(owners.includes("/admin/settings/bank-accounts"), "page table includes bank accounts");

  const changed = new Date();
  assert(
    jwtIssuedBeforePasswordChange(Math.floor(changed.getTime() / 1000) - 10, changed),
    "force sign-out via passwordChangedAt invalidates older JWTs",
  );

  assert(IMPERSONATE_TTL_MS === 30 * 60 * 1000, "impersonation lasts 30 minutes");

  const devClient = routeSource("components/admin/DeveloperSettingsClient.tsx");
  assert(devClient.includes("ENV_SOURCE_LABEL"), "developer UI names the env source");
  assert(devClient.includes("Save environment keys into the dashboard"), "adopt-from-env is offered");

  console.log("slice-u: ok");
}

main();
