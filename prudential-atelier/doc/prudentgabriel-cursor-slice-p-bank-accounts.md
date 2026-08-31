# Slice P — Bank Accounts by Currency and Business Line

**Branch:** `staging` (not merged to `main`)
**Amends:** Slice K’s K8 (one NGN account, one USD account, GBP card-only)

Bank transfer is now a `BankAccount` row per **currency × business line**, not a pile of settings keys. GBP can take a transfer. EUR exists as an account and as a quotation/invoice currency, not as a storefront checkout currency.

---

## P3 — Recommendation: (a), not (b)

**Built (a).** EUR is for manual invoices and quotations — European atelier clients Mrs. Prudent quotes by hand. She can store an EUR Atelier account, pick EUR on a quotation or invoice, and the PDF / public invoice show that account when it is active. The storefront switcher stays **NGN / USD / GBP**.

**(b) — full storefront EUR — is a later slice.** Adding the account row is trivial; making euros a browse-and-checkout currency is everything Slice L did for USD and GBP. The model is already currency-agnostic (`BankAccountCurrency` includes EUR; the resolver takes any of those four), so (b) is configuration plus storefront work, not a remodel.

What (b) would still require:

1. Add `EUR` to the storefront `Currency` enum (`Order.currency`, cart, product prices).
2. FX feed: ingest a NGN→EUR rate on the same schedule as USD/GBP.
3. Lock the EUR rate on the order at checkout (Slice L’s rate-lock).
4. Per-product EUR override, same shape as the USD/GBP overrides.
5. Extend the payment bind so card gateways that actually settle EUR are offered, and so a EUR cart cannot bind to a NGN-only processor.
6. Currency switcher, price formatting, emails, and `getPublicPaymentConfig` / `getSupportedGateways` EUR branches.
7. Tests covering a EUR cart’s gateways, rate lock, and a shipping top-up in EUR.

Until that slice, a EUR cart cannot exist, so there is no path that offers EUR bank transfer on the RTW storefront. An EUR Atelier account only surfaces on quotations and invoices.

---

## Behaviour

- **One resolver.** `resolveBankAccount(currency, businessLine)` is the only lookup. RTW checkout, RTW shipping top-up, consultation, bespoke deposit/balance, quotation, and invoice all pass a line.
- **No account, no method.** If there is no *active, usable* row for that currency and line, `BANK_TRANSFER` is omitted. Dummy numbers (`0123456789`, `0000000000`) do not count as usable. Same defect Slice D fixed for empty Paystack keys.
- **GBP** is no longer card-only. An active GBP RTW account makes bank transfer appear on a GBP cart.
- **Wire fees.** Each account can set who bears fees (`CUSTOMER` / `HOUSE` / `SHARED`) and a **fee tolerance**. The transfer screen says both. Confirm may send an arrived amount; a shortfall larger than the tolerance is rejected so Slice K’s ship gate cannot mark an unpaid shortfall as shipped. The ledger still writes the **expected** amount — confirmation does not change `appendPayment`.
- **Payment reference** is on every currency’s transfer screen, not only NGN.
- **Admin** `/admin/settings/bank-accounts` is a 4×2 matrix (add / edit / retire / activate), same idea as Lagos locations. Pending transfers show currency, business line, and the expected account so a domiciliary statement can be matched.
- **Migration** copies existing PAYMENTS `bank_*` keys into RTW NGN/USD and INVOICE `invoice_bank_*` into Atelier NGN/USD/GBP, skipping dummies. If Atelier NGN/USD are still empty after that, they copy from the new RTW rows so consultations do not lose bank transfer.
- **Bookings flag** is untouched. Atelier accounts are configurable while bookings stay closed.

---

## Verification

| Check | Result |
| --- | --- |
| `pnpm exec tsc --noEmit` | clean |
| `pnpm test:slice-p` | pass (GBP RTW account; NGN Atelier consultation; inactive GBP Atelier hides transfer; USD shipping top-up resolves to the order’s RTW account; fee-tolerance helper) |
| Existing slice / authz / quotation / payment-bind / cron / email-outbox scripts | green |
| `pnpm test:stage-walk` | refused without `ALLOW_FIXTURES=true` (pre-existing; not a Slice P failure) |

Not verified in the browser on staging in this pass — the branch has not been pushed.

---

## Changed files

### New

| File | Why |
| --- | --- |
| `prisma/migrations/20260831_slice_p_bank_accounts/migration.sql` | Create `BankAccount` + enums, add `Quotation.currency`, copy existing NGN/USD (and invoice GBP) settings into rows. |
| `src/lib/payments/bank-account.ts` | Single resolver, public shape, fee-tolerance helpers, dummy-number filter. |
| `src/app/api/admin/bank-accounts/route.ts` | List and create accounts (`settings` permission). |
| `src/app/api/admin/bank-accounts/[id]/route.ts` | Edit / retire / reactivate without a deploy. |
| `src/app/(admin)/admin/settings/bank-accounts/page.tsx` | 4×2 admin matrix page. |
| `src/components/admin/BankAccountsAdminClient.tsx` | Add, edit, retire UI (Lagos-locations pattern). |
| `src/components/payment/BankTransferDetails.tsx` | Render only populated SWIFT/IBAN/sort/routing/intermediary/instructions, fee copy, and the payment reference on every currency. |
| `scripts/test-slice-p.ts` | Spec tests for GBP RTW, NGN Atelier, hidden transfer, shipping top-up, tolerance. |

### Schema, seed, config

| File | Why |
| --- | --- |
| `prisma/schema.prisma` | `BankAccount` model, `BankAccountCurrency` / `BusinessLine` / `WireFeeBearer`, `Quotation.currency`. Storefront `Currency` stays NGN/USD/GBP. |
| `prisma/seed.ts` | Stop seeding the old `bank_*` settings keys. |
| `prisma/seed-fixtures.ts` | Same — fixtures must not recreate the discarded keys. |
| `src/lib/payment-settings-bootstrap.ts` | Same — bootstrap no longer plants dummy bank numbers. |
| `src/lib/payments/config.ts` | `getSupportedGateways` / `getBankTransferDetails` / public config take a business line and hide bank transfer when the resolver returns nothing. GBP may include `BANK_TRANSFER`. |
| `src/lib/payments/index.ts` | Deprecated sync stubs no longer offer `BANK_TRANSFER` or dummy `0123456789`. |
| `src/lib/payments/ledger.ts` | Format EUR amounts in deposit payment terms (invoice/quote path). |
| `src/types/invoice.ts` | Invoice currency includes EUR; bank details carry international fields and fee policy. |
| `package.json` | `test:slice-p` script. |

### Money paths (resolver)

| File | Why |
| --- | --- |
| `src/app/api/payments/public-config/route.ts` | `?line=RTW\|ATELIER`; no-store. |
| `src/app/api/orders/create/route.ts` | RTW: reject a gateway not in `getSupportedGateways(currency, "RTW")`. |
| `src/app/api/consultations/create/route.ts` | Atelier gateways; accept a client-generated `paymentRef` so the transfer screen can show it. |
| `src/validations/consultation.ts` | Optional `paymentRef` on create. |
| `src/app/api/bespoke/[orderId]/initialize-payment/route.ts` | Atelier gateways for the order currency. |
| `src/app/api/bespoke/[orderId]/bank-transfer/route.ts` | Resolve the Atelier account for the body currency. |
| `src/app/api/admin/orders/[id]/shipping-quote/route.ts` | Top-up uses RTW account in the **original order’s** currency. |
| `src/lib/invoice.ts` | `getBankDetails` goes through the Atelier resolver (empty if no active account). |
| `src/app/api/quotations/route.ts` | Persist quotation currency, including EUR. |
| `src/app/api/quotations/[id]/route.ts` | Same on patch. |
| `src/lib/quotation-versioning.ts` | New versions keep currency. |
| `src/lib/quotation-convert.ts` | Invoice created from a quote inherits currency. |
| `src/lib/quotation-pdf-data.ts` | Quote PDF bank block from the Atelier resolver. |
| `src/app/api/admin/invoices/route.ts` | Allow EUR as invoice currency. |
| `src/app/api/admin/invoices/[id]/route.ts` | Same on update. |
| `src/app/api/admin/invoices/[id]/send/route.ts` | Bank block on send uses the resolver. |
| `src/app/api/invoice/[token]/route.ts` | Public invoice bank details from the resolver. |
| `src/app/api/invoice/[token]/email-copy/route.ts` | Same for the emailed copy. |
| `src/lib/invoice-pdf-data.ts` | PDF data uses the richer bank shape. |

### Transfer UI and emails

| File | Why |
| --- | --- |
| `src/components/checkout/PaymentMethodSelector.tsx` | Requires `businessLine`; hides bank transfer when public-config has no account; shows `BankTransferDetails` + reference. |
| `src/components/checkout/CheckoutClient.tsx` | Passes `businessLine="RTW"`. |
| `src/components/consultation/ConsultationBookingFlow.tsx` | Passes `ATELIER`; generates and displays a payment reference. |
| `src/components/account/BespokePayClient.tsx` | Passes `ATELIER`. |
| `src/components/payment/PaymentPendingClient.tsx` | Pending receipt screen uses `BankTransferDetails` and the reference for every currency. |
| `src/components/invoice/InvoicePDF.tsx` | International fields, instructions, fee copy — blanks omitted. |
| `src/components/invoice/PublicInvoiceView.tsx` | Same on the public invoice. |
| `src/components/quotation/QuotationPDF.tsx` | Same on the quote PDF. |
| `src/components/admin/InvoiceFormPage.tsx` | EUR selectable on manual invoices. |
| `src/components/admin/InvoiceDetailAdmin.tsx` | Display EUR. |
| `src/components/admin/InvoicesClient.tsx` | List EUR. |
| `src/components/admin/QuotationFormClient.tsx` | EUR selectable; note that euro is not a storefront currency. |
| `src/emails/ShippingQuoteEmail.tsx` | Shipping top-up transfer block uses populated international fields + reference. |
| `src/lib/email.tsx` | Shipping-quote email payload carries the richer bank shape. |

### Admin matching and settings cleanup

| File | Why |
| --- | --- |
| `src/app/api/admin/payments/pending/route.ts` | Pending list includes currency, business line, and expected account. |
| `src/app/api/admin/payments/[id]/confirm/route.ts` | Optional `arrivedAmount`; reject if shortfall exceeds account tolerance; ledger write unchanged. |
| `src/components/admin/AdminPendingBankTransfers.tsx` | Show currency, line, expected account; optional arrived amount on confirm. |
| `src/app/(admin)/admin/settings/page.tsx` | Card linking to Bank accounts. |
| `src/components/admin/AdminSidebar.tsx` | Sidebar link. |
| `src/components/admin/AdminSettingsGroupClient.tsx` | Hide old PAYMENTS `bank_*` keys; point at the new page. |
| `src/components/admin/DeveloperSettingsClient.tsx` | Hide leftover bank keys from developer settings. |
| `src/components/admin/settings/InvoiceSettingsPageClient.tsx` | Hide `invoice_bank_*`; point at Bank accounts. |

---

## Out of scope (deliberate)

- Production / `main`
- Atelier bookings open/closed flag
- A second receipt-upload or confirm flow
- Changing what `appendPayment` writes
- Storefront EUR (P3b)
