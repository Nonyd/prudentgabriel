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

### RTW Prudent Points (Slice Q)

The programme name is **Prudent Points**. Redemption is a `Payment` row
(`method: POINTS`, `purpose: POINTS_REDEMPTION`, `status: CONFIRMED`) for the
naira value locked at checkout. `Order.total` is the true total (subtotal +
shipping − coupon). Outstanding = total − confirmed (including the points row).
A later change to the naira-per-point rate does not rewrite
`Order.pointsRateLocked` or the Payment amount.

A piece bought entirely with points earns no points. Each award expires after
24 months; returns after that window get a fresh 24 months on a new
`RETURNED` row.

`User.pointsBalance` is a denormalised cache. Writer: `src/lib/points.ts` only.

`fulfillPaidOrder` can refuse fulfilment when stock cannot be decremented. The
order is stored as **`paymentStatus = PAID`** (money at the PSP) and
**`status = CANCELLED`** (do not ship). A `CONFIRMED` ledger row already exists.
The admin list **Orders → Refund required** (`/admin/orders?attention=refund-required`)
is the queue.

Application code must **not** rewrite that `CONFIRMED` amount. After you refund
in Paystack (or the PSP), record the correction as a **new** `Payment` row
(negative amount, same `purpose` / `orderId` / `clientId`, `status = REFUNDED`,
new `reference` such as `<original>-refund`). Then set the order
`paymentStatus` to `REFUNDED`.

If you must edit an immutable column (you almost never should), humans only:

```sql
-- Staging example. Production: same, on pa_prod, after the PSP refund exists.
BEGIN;
SET LOCAL app.ledger_bypass = 'on';
-- Prefer INSERT of a correction row. Bypass is for true mistakes only.
COMMIT;
```

Gap 7 (in-app refund/cancel ledger) stays post-launch. This procedure is the
bridge for the G3 oversell case.

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

## `productionUnlockedAt`

Set by `recomputeOrderTotals` → `syncProductionUnlock` when confirmed receipts
first cover the deposit (`depositSatisfied` and confirmed > 0).

**Relock:** if a later `CONFIRMED → REJECTED` transition or a negative correction
row drops confirmed below the deposit, `productionUnlockedAt` is cleared. That
write is accompanied by an `ActivityLog` (`PRODUCTION_RELOCK`) and an admin
notification (`PRODUCTION_RELOCKED`). Do not silently unset a flag staff were
told about.

The 13-stage evaluator reads **`productionUnlockedAt`**, not a freshly derived
`depositSatisfied`. One source of truth; the same flag that is cleared.

Completed stages stay completed. Relock only blocks *further* production stages
(5+) until the deposit is restored. No auto-revert — a payment-processing hiccup
must not rewrite atelier history.

## Production smoke E2E (maintenance window)

After Sprint B deploys, prove the ledger + unlock path on production **while
maintenance is still on**, then leave zero fixture money behind:

```bash
# Point DATABASE_URL / DIRECT_URL at production (direct host preferred).
ALLOW_PROD_E2E=true pnpm exec tsx scripts/e2e-quote-convert.ts
```

That script always runs `cleanupE2eRows()` (which sets `app.ledger_bypass`)
before creating rows and again in `finally`. Confirm afterward:

```sql
SELECT COUNT(*) FROM "Payment";
SELECT COUNT(*) FROM "BespokeOrder";
SELECT COUNT(*) FROM "Invoice" WHERE "clientEmail" = 'e2e.quote.convert@example.com';
```

All must be zero (or free of the E2E email). Do **not** flip maintenance off
until this cleanup is verified. Prefer this controlled bypass use over discovering
an `ORD-*` with ₦350,000 on the finance dashboard at handover.

Scope is the existing quote-convert chain (consultation → deposit unlock), not a
full 13-stage walk on production.

### RTW orders

Not backfilled in this sprint. Ready-to-wear already has a native `Order`
payment record (`paymentStatus` / `paymentRef`). Ledger rows for RTW are
written going forward (`purpose: RTW_ORDER`) when those confirm paths are
wired. Do not invent `BACKFILL-RTW-*` rows from `Order.total` — that would
treat every paid RTW order as new money without an itemised history to
reconcile against.
