/**
 * The founder's note: words, timing and every way a client account is made.
 *
 *   pnpm test:founder-note
 */
import "./preload-test-env";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_FOUNDER_NOTE,
  FOUNDER_NOTE_DELAY_MS,
  FOUNDER_NOTE_SUBJECT,
  founderNoteParagraphs,
} from "../src/lib/founder-note";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
  console.log(`  ok   ${message}`);
}
const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

assert(FOUNDER_NOTE_SUBJECT === "Mrs Prudent Gabriel-Okopi has a word for you", "the subject is the house's");
assert(FOUNDER_NOTE_DELAY_MS === 10 * 60 * 1000, "sent ten minutes after the account is made");

const paras = founderNoteParagraphs("Hello {{firstName}}.\n\nSecond line\nstill second.\n\n\n Third. ", "Adaeze");
assert(paras.length === 3, "blank lines split paragraphs");
assert(paras[0] === "Hello Adaeze.", "{{firstName}} becomes her first name");
assert(paras[1] === "Second line\nstill second.", "a single line break stays inside its paragraph");
assert(founderNoteParagraphs(DEFAULT_FOUNDER_NOTE, "A").length >= 3, "the suggested letter has paragraphs");

// Every way a client account is created schedules it; team accounts do not.
assert(src("src/app/api/auth/register/route.ts").includes("scheduleFounderNote"), "sign-up schedules it");
assert(src("src/lib/client-onboarding.ts").includes("scheduleFounderNote"), "first paid order, consultation or commission schedules it");
assert(/createUser\([\s\S]{0,200}scheduleFounderNote/.test(src("src/lib/auth.ts")), "first Google sign-in schedules it");
for (const team of ["src/app/api/admin/users/route.ts", "src/app/api/staff/route.ts", "src/app/api/auth/accept-invite/route.ts"]) {
  assert(!src(team).includes("scheduleFounderNote"), `${team} (team account) does not`);
}

const lib = src("src/lib/founder-note.tsx");
assert(lib.includes("idempotencyKey: `founder-note:${user.id}`"), "once per account");
assert(lib.includes("sendAt:"), "held by the outbox until its time");
assert(src("src/lib/email-outbox.ts").includes("params.sendAt"), "the outbox honours sendAt");
assert(src("src/app/api/admin/founder-note/route.ts").includes("requireSuperAdminApi"), "only a Super Admin edits the words");

console.log("OK — test-founder-note");
