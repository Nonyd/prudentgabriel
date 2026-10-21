/**
 * Admin → Clients → New client: what the onboarding form may send, the
 * placeholder email for a client without one, and which stages can be "where
 * she is now". Unit checks only; nothing touches a database.
 *
 *   pnpm test:client-onboarding
 */
import { BespokeStage, InvoiceStatus, OrderStatus, QuoteStatus } from "@prisma/client";
import { OPEN_COMMISSION_STATUSES, OPEN_INVOICE_STATUSES, OPEN_QUOTATION_STATUSES } from "../src/lib/admin-email-change";
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

// A real email added later moves onto her open records only.
for (const s of [OrderStatus.PENDING, OrderStatus.PROCESSING]) assert(OPEN_COMMISSION_STATUSES.includes(s), `a ${s} commission follows her new email`);
for (const s of [OrderStatus.DELIVERED, OrderStatus.CANCELLED, OrderStatus.REFUNDED]) assert(!OPEN_COMMISSION_STATUSES.includes(s), `a ${s} commission keeps its email`);
assert(OPEN_QUOTATION_STATUSES.includes(QuoteStatus.APPROVED), "an approved quotation follows her new email");
for (const s of [QuoteStatus.CONVERTED, QuoteStatus.REJECTED, QuoteStatus.SUPERSEDED]) assert(!OPEN_QUOTATION_STATUSES.includes(s), `a ${s} quotation keeps its email`);
for (const s of [InvoiceStatus.DRAFT, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE]) assert(OPEN_INVOICE_STATUSES.includes(s), `a ${s} invoice follows her new email`);
for (const s of [InvoiceStatus.PAID, InvoiceStatus.CANCELLED]) assert(!OPEN_INVOICE_STATUSES.includes(s), `a ${s} invoice keeps its email`);

console.log("OK test-client-onboarding");
