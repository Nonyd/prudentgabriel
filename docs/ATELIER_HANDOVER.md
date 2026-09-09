# Atelier handover

**Branch:** `staging` (do not merge to `main` without being asked).  
**Walked:** consultation → quotation → invoice → Paystack → 13 stages → delivery → receipt → alteration (AN–AP, Sept 2026).  
**Public:** https://staging.prudentgabriel.com

---

## What works

A guest can book (when bookings are on), pay a consultation, sit a session, receive a quotation, convert to a commission, pay the invoice, and be walked through thirteen gated stages. Design approval and receipt confirmation are public token links — she does not need the auto-created account password for those. Completing delivery sends *Your outfit is ready* and asks her to confirm receipt; that confirm **opens** a 30-day FIT/WORKMANSHIP window and does **not** archive the file. Archive is a noon cron (`archive-expired-warranty`) plus first-read of admin/account detail, only after the window has elapsed, the balance is cleared (₦1 tolerance, same as the deposit gate), and nothing is open. The house triages post-delivery requests at `/admin/alterations`. FX commissions can persist kobo; Paystack is integer kobo; the delivery gate uses the ₦1 rule and prints kobo, not a rounded ₦0.

Staging Docker migrate applied `archivedAt` / `archivedReason` on 9 Sept 2026 (AO).

---

## What still needs a developer

| Item | How often | Notes |
|---|---|---|
| ORD-9590 is archived under the **old** rule | Once | Confirmed receipt 9 Sept 19:22, archived the same minute. `archivedAt`/`archivedReason` are null. Cron leaves it alone. To give Adaeze the window AO promised: set status `DELIVERED`, leave `receiptConfirmedAt`, do not write archive fields. Do not do this silently. |
| Client alteration form does not say FIT/WORKMANSHIP are free | Every post-delivery request | She picks a reason; the house sees *Policy default: FREE*. She will telephone about cost. |
| Email names “30 days”, not a calendar date | Every delivery | Date appears only **after** confirm (`You have until 9 October 2026…`). `body_2` (“After you confirm, you have N days…”) is in the catalog and not rendered. |
| Review email lands on `/account/orders/bespoke/{id}` | Every confirm | That route needs a session. Token receipt does not. She will hit a login wall for the review. |
| Admin GET for alteration pricing ignores `receiptConfirmedAt` | Rare | Falls back to `deliveredAt`. Wrong if those dates diverge by more than the warranty. |
| Archived admin still shows Record payment / Add material | Daily on closed files | Complete/Revert are hidden; money and materials inputs are not. API should refuse writes. |
| Alteration form toast-only success | Occasional | Description does not always clear; easy to double-submit. |
| Consultation fee vs commission deposit | Every convert | Stage 4 is the consultation fee. The commission deposit is a separate invoice payment. They are easy to confuse in the pipeline labels. |
| `BespokeRequest` vs pipeline | Occasional | Storefront request rows are not the commission. Convert is quotation → `BespokeOrder`. |
| Quote revision after convert | When she changes her mind | Convert freezes the quotation. A new version is a new quote, not an edit of the converted one. |
| Measurements vs consultation | Every first fitting | Measurements live on `ClientProfile`, not bound to the booking that produced them. |
| No-show | When she misses the slot | Consultation status can be `NO_SHOW`; there is no fee/rebook policy wired through. |
| Stage emails still off the Slice I design system | Every stage complete | Wording was patched (AO5); layout/redesign is deferred. |
| Staff complete-stage UI | Daily | Notes/media gates are real. Completing delivery now hides the empty form; other stages can still look “open” after complete until reload. |

---

## AN5 leftovers — cost of leaving them

- **Staff complete-stage UI** — house wastes a minute per stage wondering if the form took. Delivery is fixed; the rest is irritation, not a lost gown.
- **Stage emails not on Slice I** — looks like two houses. Clients still get the facts.
- **Consultation fees not crediting the commission** — correct in the ledger, confusing in conversation. She will ask why the ₦X consultation is not on the gown invoice.
- **Measurements not bound to the consultation** — wrong size on a later commission for the same client if nobody re-measures.
- **No quote revision after convert** — house will screenshot and type a new quote. Do not “edit” the converted row.
- **No no-show handling** — slot sits `CONFIRMED` until someone remembers. Lost calendar, not lost money, until you invent a fee.
- **`BespokeRequest` not linked** — a request in the inbox is not a pipeline card. Convert from the quotation or you will hunt.

---

## Operational facts

- **Bookings on/off:** Admin → Settings → General → `atelier_bookings_enabled`. Missing or not `"true"` is off. Staging was turned on for the walks; production is typically off.
- **Terms:** Admin → Settings → Invoice. Keys `invoice_term_delivery` / `changes` / `shipping` / `refunds`. Printed on quote and invoice PDFs.
- **Validity:** same Invoice settings page, `invoice_default_validity_days` (default 14). Copied onto the quotation; convert copies `expiresAt` onto the invoice.
- **Deposit percent:** default is Payments → `bespoke_deposit_percent` (70). **The quotation’s own percent wins** and is what the invoice `depositRequired` uses. Production unlocks from that figure, not from the CMS default.
- **Paystack on staging:** test cards decline large naira. Use **Bank Authentication** (or a manual confirm) for FX/bridal totals. Do not “fix” Paystack by rounding the locked total.
- **Cron:** host crontab `/etc/cron.d/prudentgabriel` (or `deploy/cron.d/prudentgabriel`). `archive-expired-warranty` is `0 12 * * *`. Staging fire: `CRON_ENV_FILE=.../.env.staging CRON_APP_URL=https://staging.prudentgabriel.com /opt/prudentgabriel/deploy/cron-fire.sh <job>`.
- **DB:** staging is VPS Postgres (`prudentgabriel-staging-postgres`), not Neon. Local `.env` is Neon `local-scratch`. Do not confuse them.
- **Deploy:** push `staging` → GHCR `staging` → VPS `compose.staging.yaml` recreates the app and runs migrate. Do not push `main` for this work.

---

## Learn the hard way

- Confirming receipt used to archive. AO stopped that. Old archived rows (ORD-9590) were not rewritten.
- Display rounding is not the gate. If the checklist ever prints ₦0 while Delivery is closed, that is a bug — the gate is in kobo.
- Balance Paystack payments after a satisfied deposit are `BALANCE`, not `DEPOSIT`.
- Guest invoice pay still auto-creates an account. Welcome mail now says what it is for. Approval and receipt are different links.
- A commission is “active” for the client until receipt is confirmed **and** the window has closed — not merely until stage DELIVERY.
- `test:stage-walk` needs `ALLOW_FIXTURES=true` and hits whatever `DATABASE_URL` is local. Do not run it against production.
- Host crontab must match the job registry (`pnpm test:cron`). Adding a job in code without regenerating `deploy/cron.d/prudentgabriel` means it never fires.
