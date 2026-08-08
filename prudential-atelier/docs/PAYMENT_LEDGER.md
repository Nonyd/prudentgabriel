# Payment Ledger

Authoritative money record for Prudential Atelier. All confirmed receipts live in
the `Payment` table. `BespokeOrder.amountPaid` / `balance` and
`Invoice.depositPaid` / `balanceDue` are denormalised caches maintained only by
`recomputeOrderTotals` / `recomputeInvoiceTotals` in `src/lib/payments/ledger.ts`.

## Append-only rule

Never update `amount` (or other immutable columns) on an existing `Payment` row.
Corrections are new rows: a negative amount with the same `purpose`, or a
`REFUNDED` row.

### Immutable columns (DB trigger)

`amount`, `currency`, `purpose`, `reference`, `invoiceId`, `bespokeOrderId`,
`consultationId`, `orderId`, `clientId`, `createdAt`.

### Mutable columns (legitimate state transitions)

`status`, `confirmedAt`, `confirmedById`, `rejectedReason`, `receiptUrl`,
`gatewayPayload`, `updatedAt`.

`DELETE` on `Payment` is blocked outright.

### Escape hatch (humans only)

The trigger honours a **session-scoped** bypass. Application code must never set
this. For audited corrections at a `psql` prompt:

```sql
BEGIN;
SET LOCAL app.ledger_bypass = 'on';
-- corrective SQL (e.g. DELETE or UPDATE of an immutable column) --
COMMIT;
```

`SET LOCAL` ends with the transaction. Prefer inserting a correction row over
mutating history whenever possible.

## `clientId`

Not a foreign key. Prefer `User.id` when a user exists; otherwise the stable
placeholder `email:<lowercase>` for guests (`resolveClientId`). A FK to `User`
would reject guest placeholders and block customer deletes that should preserve
money history.

The append-only trigger makes `clientId` **immutable**. When a guest later
registers, older rows keep `email:<lowercase>` and newer rows carry `User.id`.
Never rewrite the column to reconcile the two.

**Read rule:** every client-scoped payment query must match **both** identifiers:

```ts
clientId: { in: await resolveClientIdentifiers({ userId, email }) }
```

Use `getClientPayments({ userId, email })` rather than querying `Payment` by a
single `clientId`. `/account/transactions` already does this.

## Parent deletes

`Payment` FKs to orders/invoices/consultations/RTW orders use `ON DELETE RESTRICT`.
Hard-delete routes return HTTP 409 with:

> This \<entity\> has payment records and cannot be deleted. Cancel it instead.

## Backfill

Default is **plan only** — nothing is written. Review the pairing table, then
re-run with `--apply`.

```bash
pnpm backfill:payments            # plan only
pnpm backfill:payments --apply    # write rows
```

An invoice payment fulfils its bespoke order — that is **one** payment, not two.
The script builds order↔invoice pairing **before** inserting:

1. Structural, strongest first: `quotationId` → `consultationId` → `bespokeRequestId`
   (1:1 matches only). Never pair on reference-string similarity (`ORD-2847` /
   `INV-2847`).
2. Human-confirmed pairs in `scripts/backfill-pairs.json`, keyed by `orderRef` +
   `invoiceNumber` with recorded evidence.
3. Same-client + same-total pairs with **no** structural link are printed as
   `SUSPECTED_DUPLICATE` and abort the run unless `--allow-suspected-duplicates`
   is passed (treats them as independent money).

A matched pair emits **one** row carrying both `invoiceId` and `bespokeOrderId`.
Unmatched orders / standalone invoices / consultations emit a single-FK row.
Each planned row prints `PAIRED` / `ORDER_ONLY` / `INVOICE_ONLY` /
`CONSULTATION` / `SUSPECTED_DUPLICATE`.

Deterministic references (per-row upsert, no entity-level skip):

- `BACKFILL-BO-<orderId>`
- `BACKFILL-INV-<invoiceId>-<n>` (one per `paymentHistory` entry, or `-1` from cache)
- `BACKFILL-CB-<consultationId>`

Idempotent: a run that dies halfway can be re-run; only missing references are
inserted. Exits non-zero on any cached-vs-ledger mismatch. Run on a Neon branch
before production.

### Consultation payments

**Included.** Paid `ConsultationBooking` rows (`paymentStatus = PAID`) are
backfilled with `purpose: CONSULTATION` so a revenue report that `SUM`s the
ledger does not silently miss consultation income. `getOrderPaymentSummary` /
`getInvoicePaymentSummary` never read them — they are scoped by
`bespokeOrderId` / `invoiceId`.

### RTW orders

Not backfilled in this sprint. Ready-to-wear already has a native `Order`
payment record (`paymentStatus` / `paymentRef`). Ledger rows for RTW are
written going forward (`purpose: RTW_ORDER`) when those confirm paths are
wired. Do not invent `BACKFILL-RTW-*` rows from `Order.total` — that would
treat every paid RTW order as new money without an itemised history to
reconcile against.
