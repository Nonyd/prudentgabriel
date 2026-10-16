/**
 * Who is told: every house alert is either chosen by the Super Admin or goes
 * to the staff whose job it is, and only her screen can change the choice.
 *
 *   pnpm test:who-is-told
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AdminNotificationType } from "@prisma/client";
import {
  ALERT_KINDS,
  ALERT_RECIPIENTS_KEY,
  CHAT_NOTIFY_BELL_KEY,
  CHAT_NOTIFY_EMAIL_KEY,
  alertKindForType,
  cleanIdList,
  isWhoIsToldSettingKey,
} from "../src/lib/admin-alerts";
import { CHAT_NOTIFY_BELL_KEY as CHAT_BELL, CHAT_NOTIFY_EMAIL_KEY as CHAT_EMAIL } from "../src/lib/chat";
import { roleMayAccessAdminPath } from "../src/lib/admin-route-access";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (p: string) => readFileSync(join(root, p), "utf8");

/** Workflow rows for the staff doing the job; never rerouted to named admins. */
const STAFF_TYPES = new Set<AdminNotificationType>([
  "STAGE_COMPLETED",
  "STAGE_APPROVAL_RESPONSE",
  "PRODUCTION_UNLOCKED",
  "PRODUCTION_RELOCKED",
  "REQUISITION_PENDING",
]);

// Every bell type has exactly one home.
for (const type of Object.values(AdminNotificationType)) {
  const owners = ALERT_KINDS.filter((k) => k.bell.includes(type));
  if (STAFF_TYPES.has(type)) {
    assert(owners.length === 0, `${type} is staff work and must not be routable`);
  } else {
    assert(owners.length === 1, `${type} belongs to exactly one alert kind (found ${owners.length})`);
    assert(alertKindForType(type)?.id === owners[0]!.id, `${type} resolves to its kind`);
  }
}

// The user's list is all there.
for (const id of ["payments", "orders", "chat", "contact", "consultations"] as const) {
  assert(ALERT_KINDS.some((k) => k.id === id), `kind ${id} exists`);
}
assert(new Set(ALERT_KINDS.map((k) => k.id)).size === ALERT_KINDS.length, "kind ids are unique");
assert(ALERT_KINDS.every((k) => k.email || k.bell.length > 0), "every kind has a channel");

// Chat keeps one pair of keys, shared with Chat → Settings.
assert(CHAT_EMAIL === CHAT_NOTIFY_EMAIL_KEY && CHAT_BELL === CHAT_NOTIFY_BELL_KEY, "chat keys are the same keys");

// Only her screen writes these.
for (const key of [ALERT_RECIPIENTS_KEY, CHAT_NOTIFY_EMAIL_KEY, CHAT_NOTIFY_BELL_KEY]) {
  assert(isWhoIsToldSettingKey(key), `${key} is protected`);
}
assert(!isWhoIsToldSettingKey("store_name"), "ordinary settings are not");
assert(src("src/app/api/admin/settings/[group]/route.ts").includes("isWhoIsToldSettingKey"), "group settings refuse and hide them");
assert(src("src/app/api/admin/settings/route.ts").includes("isWhoIsToldSettingKey"), "settings list hides them");
assert(
  src("src/app/api/admin/settings/alert-recipients/route.ts").includes("requireSuperAdminApi()"),
  "the API is Super Admin only, and not while viewing as someone",
);
assert(roleMayAccessAdminPath("SUPER_ADMIN", "/admin/settings/alert-recipients"), "Super Admin opens the page");
assert(!roleMayAccessAdminPath("ADMIN", "/admin/settings/alert-recipients"), "an Admin does not");

// Nothing reaches for the alert mailbox directly any more.
for (const file of [
  "src/app/api/contact/route.ts",
  "src/app/api/quotations/[id]/approve/route.ts",
  "src/app/api/cron/daily-report/route.ts",
  "src/app/api/cron/weekly-report/route.ts",
  "src/app/api/cron/late-alert/route.ts",
  "src/lib/cron/jobs/restore-drill-reminder.ts",
  "src/lib/email.tsx",
]) {
  assert(!/resolve(Admin|Hr)AlertEmail\(/.test(src(file)), `${file} routes through Who is told`);
}

// Id lists: junk dropped, duplicates folded, empty means default.
assert(cleanIdList(["clabcdefghij", "clabcdefghij", 3, "x"])?.join() === "clabcdefghij", "id list cleaned");
assert(cleanIdList([]) === null && cleanIdList("nope") === null, "empty or junk is the default");

console.log("test-who-is-told: ok");
