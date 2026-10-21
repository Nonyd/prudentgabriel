/**
 * Admin → Clients → New client: what the onboarding form may send, the
 * placeholder email for a client without one, and which stages can be "where
 * she is now". Unit checks only; nothing touches a database.
 *
 *   pnpm test:client-onboarding
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { BespokeStage } from "@prisma/client";
import { EMAIL_COPY_RECORDS } from "../src/lib/admin-email-change";
import { onboardSchema, isPlaceholderEmail, PLACEHOLDER_EMAIL_DOMAIN } from "../src/lib/atelier/manual-onboarding";
import { RECORDABLE_TARGETS } from "../src/lib/atelier/record-progress";
import { isUndeliverableAddress } from "../src/lib/email-outbox";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const base = {
  client: { name: "Mrs Azazi", email: "", phone: "", country: "Nigeria", city: "Lagos" },
  commission: { title: "Birthday dress", occasion: "Birthday", description: "Long dress with a train", orderDate: "2026-09-02", deliveryDate: "2026-10-15" },
  money: { price: 8_000_000, payments: [{ amount: 5_600_000, date: "2026-09-02", method: "BANK_TRANSFER" }] },
  progress: { currentStage: BespokeStage.BEADING_FINISHING },
};

const ok = onboardSchema.safeParse(base);
assert(ok.success, `a client with no email is accepted (${ok.success ? "" : ok.error.issues[0]?.message})`);
assert(ok.data.client.email === null, "an empty email becomes null, so a placeholder is made");

const real = onboardSchema.safeParse({ ...base, client: { ...base.client, email: " Ada@Example.com " } });
assert(real.success && real.data.client.email === "ada@example.com", "a real email is trimmed and lower-cased");

assert(!onboardSchema.safeParse({ ...base, client: { ...base.client, email: "not-an-email" } }).success, "a malformed email is refused");
assert(!onboardSchema.safeParse({ ...base, client: { ...base.client, name: " " } }).success, "a name is required");

const overpaid = onboardSchema.safeParse({ ...base, money: { price: 1000, payments: [{ amount: 1500, date: "2026-09-02", method: "MANUAL" }] } });
assert(!overpaid.success && overpaid.error.issues.some((i) => i.path.join(".") === "money.payments"), "paying more than the price is refused");

assert(!onboardSchema.safeParse({ ...base, money: { ...base.money, price: 0 } }).success, "a zero price is refused");
assert(!onboardSchema.safeParse({ ...base, commission: { ...base.commission, orderDate: "2999-01-01" } }).success, "a future order date is refused");
assert(
  !onboardSchema.safeParse({ ...base, money: { price: 100, payments: [{ amount: 10, date: "2999-01-01", method: "MANUAL" }] } }).success,
  "a future payment is refused",
);

for (const early of [BespokeStage.CONSULTATION_BOOKING, BespokeStage.PAYMENT_CONFIRMATION]) {
  assert(!onboardSchema.safeParse({ ...base, progress: { currentStage: early } }).success, `${early} cannot be "where she is now"`);
  assert(!RECORDABLE_TARGETS.includes(early), `${early} is not a recordable target`);
}
assert(RECORDABLE_TARGETS[0] === BespokeStage.SKETCHING_CONCEPT, "targets start at Sketching (intake is done at convert)");
assert(RECORDABLE_TARGETS.includes(BespokeStage.DELIVERY), "Delivery can be the stage she is waiting at");

const placeholder = `client-mrs-azazi-a1b2c3@${PLACEHOLDER_EMAIL_DOMAIN}`;
assert(isPlaceholderEmail(placeholder), "the placeholder is recognised");
assert(isUndeliverableAddress(placeholder), "the outbox never mails the placeholder");
assert(!isPlaceholderEmail("ada@example.com"), "a real email is not a placeholder");

// A changed email follows her onto every record that keeps a copy of it. Each table
// with an email column is either moved by changeUserEmail or left alone on purpose,
// so a new table that copies a client's email cannot be forgotten.
const MOVED = [
  "BespokeOrder",
  "Quotation",
  "Invoice",
  "Order",
  "ConsultationBooking",
  "ConsultationEnquiry",
  "BespokeRequest",
  "CheckoutSession",
  "CouponUsage",
  "LoyaltyCorrectionNotice",
  "EmailMessage",
];
const LEFT_ALONE = [
  "User", // the change itself
  "EmailPreference", // consent belongs to the address
  "NewsletterSubscriber", // consent belongs to the address
  "SavedPaymentMethod", // the payment provider's record
  "ActivityLog", // history
  "ContactMessage", // history
  "ChatConversation", // history
  "JobApplication", // not a client record
  "TeamInvitation", // not a client record
];
const schema = readFileSync(path.resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
const withEmail = new Set<string>();
let model = "";
for (const line of schema.split("\n")) {
  const m = /^model (\w+) \{/.exec(line);
  if (m) model = m[1];
  else if (/^\}/.test(line)) model = "";
  else if (model && /^\s+(\w*[eE]mail\w*|to)\s+String\b/.test(line) && !/^\s+userEmail|impersonatedEmail|supervisorEmail/.test(line)) withEmail.add(model);
}
assert(withEmail.size >= MOVED.length, `the schema scan found the email tables (${withEmail.size})`);
for (const m of withEmail) assert(MOVED.includes(m) || LEFT_ALONE.includes(m), `${m} stores an email: move it in changeUserEmail or list it in LEFT_ALONE`);
const changeSource = readFileSync(path.resolve(process.cwd(), "src/lib/admin-email-change.tsx"), "utf8");
for (const m of MOVED) {
  const accessor = m[0].toLowerCase() + m.slice(1);
  assert(changeSource.includes(`tx.${accessor}.updateMany`), `changeUserEmail moves ${m}`);
}
assert(EMAIL_COPY_RECORDS.length === MOVED.length, "every moved table is counted in EMAIL_COPY_RECORDS");
assert(!/status:\s*\{\s*in:\s*OPEN_/.test(changeSource), "past records move too, not only open ones");

console.log("OK test-client-onboarding");
