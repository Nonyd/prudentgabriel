/**
 * Marketing opt-in, data export and account erasure (NDPA 2023 / GDPR).
 * DB-free: pure rules plus source checks on the routes.
 *
 *   pnpm test:marketing-consent
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  CONSENT_GATED_SOURCES,
  MARKETING_CONSENT_LABEL,
  dataExportFilename,
  deletedAccountEmail,
  isConsentGatedSource,
  keepConsented,
} from "../src/lib/marketing-consent-copy";
import { registerSchema } from "../src/validations/auth";
import { isMarketingTemplate } from "../src/lib/email-priority";

let passed = 0;
function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
  passed += 1;
}

function src(rel: string): string {
  return readFileSync(path.resolve(process.cwd(), rel), "utf8");
}

// Opt-in box copy.
assert(
  MARKETING_CONSENT_LABEL === "Send me news of new collections and private events. Unsubscribe any time.",
  "consent label wording",
);

// Promotional audiences are gated; service audiences are not.
for (const s of ["newsletter", "customers", "rtw_purchasers", "collection_buyers", "gold_platinum", "all"]) {
  assert(isConsentGatedSource(s), `${s} is gated on opt-in`);
}
for (const s of ["active_orders", "upcoming_consultations", "specific", "custom"]) {
  assert(!isConsentGatedSource(s), `${s} is service correspondence`);
}
assert(CONSENT_GATED_SOURCES.size === 6, "six gated sources");

// keepConsented: case-insensitive, keeps order, drops the rest.
const kept = keepConsented(["a@x.test", "B@X.test", "c@x.test"], new Set(["a@x.test", "b@x.test"]));
assert(kept.length === 2 && kept[0] === "a@x.test" && kept[1] === "B@X.test", "keepConsented filters");
assert(keepConsented(["a@x.test"], new Set()).length === 0, "nobody opted in → nobody");

// Behaviour-triggered reminders stay marketing templates (one-click unsubscribe applies).
for (const t of ["abandoned-cart", "abandoned-checkout", "uncollected-pickup", "prudent-points-expiry"]) {
  assert(isMarketingTemplate(t), `${t} carries unsubscribe`);
}

// Register: the box is optional and unticked by default.
const base = {
  firstName: "Ada",
  lastName: "O",
  email: "ada@example.test",
  phone: "08012345678",
  password: "Correct-Horse-9-battery",
  confirmPassword: "Correct-Horse-9-battery",
  acceptTerms: true,
};
const without = registerSchema.safeParse(base);
const withOptIn = registerSchema.safeParse({ ...base, marketingOptIn: true });
assert(without.success && without.data.marketingOptIn === undefined, "register works without the box");
assert(withOptIn.success && withOptIn.data.marketingOptIn === true, "register carries the opt-in");
assert(!registerSchema.safeParse({ ...base, marketingOptIn: "yes" }).success, "opt-in must be a boolean");
const modal = src("src/components/auth/AuthModal.tsx");
assert(/marketingOptIn: false/.test(modal), "modal box unticked by default");

// Export filename and deleted address.
assert(dataExportFilename(new Date("2026-10-19T23:59:00Z")) === "prudent-gabriel-data-2026-10-19.json", "filename");
assert(deletedAccountEmail("abc").endsWith("@prudentgabriel.local"), "deleted address is undeliverable");

// Export route: hers only, no secrets.
const exportRoute = src("src/app/api/account/export/route.ts");
assert(exportRoute.includes("provenEmail"), "export matches email records only once proven");
assert(exportRoute.includes("viewAs"), "export refused while viewing as");
assert(exportRoute.includes("checkRateLimit"), "export is rate limited");
assert(exportRoute.includes("attachment; filename="), "export is a download");
for (const banned of [
  "password:",
  "gatewayPayload",
  "adminNotes",
  "sessionNotes",
  "paystackAuthCode",
  "stripePaymentMethodId",
  "publicToken",
  "trackingToken",
  "restoreToken",
  "unsubscribeToken",
  "adminFeedback",
  "internal: true",
]) {
  assert(!exportRoute.includes(banned), `export never selects ${banned}`);
}

// Delete route: fuller erasure, financial records kept, no plaintext email in the log.
const deleteRoute = src("src/app/api/account/route.ts");
for (const table of [
  "address.deleteMany",
  "measurement.deleteMany",
  "moodboard.deleteMany",
  "eventDate.deleteMany",
  "wishlistItem.deleteMany",
  "savedPaymentMethod.deleteMany",
  "session.deleteMany",
  "account.deleteMany",
  "verificationToken.deleteMany",
  "chatConversation.deleteMany",
]) {
  assert(deleteRoute.includes(table), `delete erases ${table.split(".")[0]}`);
}
assert(!/tx\.(order|payment|invoice|bespokeOrder)\.(delete|update)/.test(deleteRoute), "financial records kept");
assert(deleteRoute.includes("$transaction"), "erasure runs in one transaction");
assert(!deleteRoute.includes("userEmail"), "activity log has no plaintext email");
assert(deleteRoute.includes("emailSha256"), "activity log keeps a hash only");
assert(deleteRoute.includes("marketingConsentAt: null"), "consent cleared on delete");

// Settings: toggle, download, honest delete copy.
const settings = src("src/components/account/SettingsClient.tsx");
assert(settings.includes("/api/account/marketing"), "settings has the marketing toggle");
assert(settings.includes("Download my data"), "settings has the export button");
assert(!settings.includes("Permanently deactivate"), "delete copy says what is erased");

console.log(`✓ marketing consent / export / erasure: ${passed} checks passed`);
