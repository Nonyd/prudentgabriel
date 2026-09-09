# Atelier Workflow Audit

**Repo:** `github.com/Nonyd/prudentgabriel` → `prudential-atelier/`
**Branch:** `staging`
**Date:** 2026-09-09
**Mode:** READ-ONLY. No code changes in this pass.
**Question:** If Mrs. Prudent took a commission tomorrow, where would it break?

Verdicts: `BUILT` | `PARTIAL` | `MISSING` | `UNCLEAR`

Actors in this document:

| Actor | Code mapping |
|---|---|
| Client | Storefront + `/account` |
| Staff member | `Role.STAFF` on `/staff` (`prudential-atelier/src/lib/bespoke-roles.ts:4-10`) |
| Mrs. Prudent | `Role.ADMIN` — “General Admin (Mrs. Prudent + deputies)” (`prudential-atelier/src/lib/roles.ts:45-66`) |

`BESPOKE_MANAGER` is a third admin role (`prudential-atelier/src/lib/roles.ts:83`). Where that role cannot reach a screen Mrs. Prudent can, the table says so.

Known operating facts (given, not re-proven here): production has 0 bespoke orders and 1 consultation; `atelier_bookings_enabled` is off; `OrderStageMedia` has zero rows; `test:stage-walk` requires `ALLOW_FIXTURES=true`.

---

## 1. Walk one commission end to end

Canonical write path: `ConsultationBooking` → `Quotation` (`consultationId`) → convert → `BespokeOrder` + draft `Invoice` → deposit `Payment` → `productionUnlockedAt` → 13 `BespokeStage`s → delivery → receipt → `ARCHIVED`.

There is no Prisma model named `Consultation`. The row is `ConsultationBooking` (`prudential-atelier/prisma/schema.prisma:132`; linked from `BespokeOrder.consultationId` at `prudential-atelier/prisma/schema.prisma:1918-1919` and `Quotation.consultationId` at `prudential-atelier/prisma/schema.prisma:2314-2315`). Convert copies the link (`prudential-atelier/src/lib/quotation-convert.ts:154-173`).

No code path creates a `BespokeOrder` from a consultation without a quotation (`prudential-atelier/src/lib/quotation-convert.ts:65-188` is the convert writer).

### 1.1 Consultation booked

**Verdict: `BUILT` (blocked in production by the bookings flag — §5)**

| | Client | Staff member | Mrs. Prudent |
|---|---|---|---|
| Screen | `/consultation` wizard (`prudential-atelier/src/app/(storefront)/consultation/page.tsx:26-48`) | `MISSING` — no `/staff` consultation UI | `/admin/consultations` |
| Email | None at create. `notifyNewConsultation` in-app only (`prudential-atelier/src/app/api/consultations/create/route.ts:176`) | `MISSING` | Admin in-app `NEW_CONSULTATION`; Prudent types also insert `CONSULTATION_BOOKED_PRUDENT` (`prudential-atelier/src/lib/notifications.ts:75-85`) |

`POST /api/consultations/create` writes `PENDING_PAYMENT` (`prudential-atelier/src/app/api/consultations/create/route.ts:34-36` gate; `:170-171` status). With `atelier_bookings_enabled !== "true"` this returns 403 (`prudential-atelier/src/lib/atelier-bookings.ts:18-27`).

Admin `GET /api/admin/consultations` is list-only (`prudential-atelier/src/app/api/admin/consultations/route.ts:21`). Admin does not create the public booking through this route.

### 1.2 Consultation paid

**Verdict: `BUILT`**

| | Client | Staff member | Mrs. Prudent |
|---|---|---|---|
| Screen | Gateway redirect or `/payment/pending` (bank) then `/consultation/success` | `MISSING` | `/admin/payments` confirm can call `fulfillPaidConsultationBooking` |
| Email | `sendConsultationConfirmedEmail` or pending (`prudential-atelier/src/lib/consultation-payment.ts:122`; senders `prudential-atelier/src/lib/email.tsx:1116`, `:1157`) | `MISSING` | `sendAdminConsultationNotification` after payment (`prudential-atelier/src/lib/consultation-payment.ts:153`) |

If `userId` is empty, `autoOnboardClient` runs (`prudential-atelier/src/lib/consultation-payment.ts:93-100`). Bank-transfer pay is intentionally not gated by the bookings flag (`prudential-atelier/src/app/api/consultations/bank-transfer/route.ts:20`).

### 1.3 Consultation held

**Verdict: `BUILT`**

| | Client | Staff member | Mrs. Prudent |
|---|---|---|---|
| Screen | `/account/consultations/[id]`; Join only if `meetingLink` is set | `MISSING` | `/admin/consultations/[id]` — status machine `PATCH /api/admin/consultations/[id]` (`prudential-atelier/src/app/api/admin/consultations/[id]/route.ts:95-108`) |
| Email | Meeting-link email only after admin `POST .../send-link` (`prudential-atelier/src/app/api/admin/consultations/[id]/send-link/route.ts:53-70`) | `MISSING` | None for “session started” |

Allowed hold states from `CONFIRMED`: `SCHEDULED`, `IN_SESSION`, `COMPLETED`, `CANCELLED_BY_ADMIN`, `NO_SHOW` (`prudential-atelier/src/app/api/admin/consultations/[id]/route.ts:99-103`).

### 1.4 Outcome recorded

**Verdict: `BUILT` (session notes); `PARTIAL` (`adminFeedback` has no UI)**

| | Client | Staff member | Mrs. Prudent |
|---|---|---|---|
| Screen | Session-summary email; account consultation list | `MISSING` | Same detail page; `PATCH /api/admin/consultations/[id]/session` (`prudential-atelier/src/app/api/admin/consultations/[id]/session/route.ts:19-49`) |
| Email | `sendConsultationSessionSummaryEmail` from `/session` (`prudential-atelier/src/app/api/admin/consultations/[id]/session/route.ts:68`) | `MISSING` | In-app `CONSULTATION_COMPLETED` (`:86-91`) |

Completing without notes is rejected (`:42-49` and main PATCH `prudential-atelier/src/app/api/admin/consultations/[id]/route.ts:126-133`). Completing via main PATCH does not send the summary email; `/session` does.

`adminFeedback` exists on the model and PATCH schema. `AdminConsultationDetail.tsx` does not reference it.

### 1.5 Measurements captured

**Verdict: `PARTIAL`**

`Measurement` is 1:1 with `ClientProfile`, not with `ConsultationBooking` (`prudential-atelier/prisma/schema.prisma:1748`, `:1758-1761`). Completing a consultation does not write measurements.

| | Client | Staff member | Mrs. Prudent |
|---|---|---|---|
| Screen | `/account/measurements` → `PATCH /api/account/measurements` | Read-only payload on `/staff/orders/[orderId]` (`prudential-atelier/src/app/(staff)/staff/orders/[orderId]/page.tsx:20`) | `ClientMeasurementsPanel` on consultation detail; optional save when completing bespoke stage `CONSULTATION_SESSION` (`prudential-atelier/src/components/admin/BespokeOrderDetailClient.tsx:202-204`) |
| Email | `MISSING` | `MISSING` | `MISSING` |

`PATCH /api/clients/[clientId]/measurements` is role-gated to `BESPOKE_ROLES` (includes `STAFF`, excludes `CONSULTATION_MANAGER`) (`prudential-atelier/src/lib/bespoke-roles.ts:4-19`).

### 1.6 Quotation drafted

**Verdict: `BUILT`**

| | Client | Staff member | Mrs. Prudent |
|---|---|---|---|
| Screen | `MISSING` (no draft UI) | `MISSING` | `/admin/quotations/new`, `/admin/quotations/[id]` |
| Email | None until send | `MISSING` | Cron `QUOTE_AWAITING` after 48h with no quote (`prudential-atelier/src/lib/cron/jobs/unsent-quote-alerts.ts`) |

`POST /api/quotations` (`prudential-atelier/src/app/api/quotations/route.ts:80-82`). One non-superseded quote per consultation (`:119-129`).

`BESPOKE_MANAGER` is denied this page: gate `perm("quotations")` (`prudential-atelier/src/lib/admin-route-access.ts:88`); role seed has no `quotations` (`prudential-atelier/src/lib/roles.ts:83`).

### 1.7 Quotation sent

**Verdict: `BUILT`**

| | Client | Staff member | Mrs. Prudent |
|---|---|---|---|
| Screen | Email + `/quote/[approvalToken]` (`prudential-atelier/src/app/quote/[approvalToken]/page.tsx:13-74`) | `MISSING` | Send action on quotation detail |
| Email | Inline HTML `template: "quote-sent"` (`prudential-atelier/src/app/api/quotations/[id]/send/route.ts:146-154`); in-app `QUOTE_READY` (`:177-182`) | `MISSING` | None |

### 1.8 Quotation approved

**Verdict: `BUILT`**

| | Client | Staff member | Mrs. Prudent |
|---|---|---|---|
| Screen | `/quote/[approvalToken]` Approve (`prudential-atelier/src/components/public/QuoteApprovalClient.tsx:44-72`) | `MISSING` | `/admin/quotations`; optional auto-convert |
| Email | None to client on approve | `MISSING` | Admin email from approve route; in-app `QUOTE_APPROVED` (`prudential-atelier/src/lib/notifications.ts:190`) |

`maybeAutoConvertApprovedQuote` runs only if `auto_convert_approved_quotes === "true"` (`prudential-atelier/src/lib/quotation-convert.ts:191-205`). Manual convert: `POST /api/quotations/[id]/convert`.

### 1.9 Deposit invoiced

**Verdict: `BUILT` (draft on convert; send is a second admin click)**

| | Client | Staff member | Mrs. Prudent |
|---|---|---|---|
| Screen | After send: `/invoice/[token]` (`prudential-atelier/src/app/invoice/[token]/page.tsx`) | `MISSING` | `/admin/invoices/[id]` |
| Email | `sendInvoiceEmail` (`prudential-atelier/src/app/api/admin/invoices/[id]/send/route.ts:16-40`); in-app `INVOICE_ISSUED` | `MISSING` | None |

Convert creates a **DRAFT** invoice with `depositRequired` from `bespoke_deposit_percent` (`prudential-atelier/src/lib/quotation-convert.ts:84-151`). Public invoice footer is Download PDF + Email me a copy — no gateway pay (`prudential-atelier/src/components/invoice/PublicInvoiceView.tsx:249`).

`BESPOKE_MANAGER` is denied invoices (`prudential-atelier/src/lib/admin-route-access.ts:87`; `prudential-atelier/src/lib/roles.ts:83`).

### 1.10 Deposit paid

**Verdict: `BUILT` (account pay / admin mark-paid; public invoice does not collect)**

| | Client | Staff member | Mrs. Prudent |
|---|---|---|---|
| Screen | `/account/orders/bespoke/[orderId]/pay` (`prudential-atelier/src/components/account/BespokePayClient.tsx:16-34`) | `MISSING` | `PATCH /api/admin/invoices/[id]/mark-paid` |
| Email | Payment-confirmed catalog mail on confirm | `MISSING` | `PRODUCTION_UNLOCKED` in-app when deposit satisfies (`prudential-atelier/src/lib/payments/ledger.ts:227-245`) |

`POST /api/bespoke/[orderId]/initialize-payment` requires a session (`prudential-atelier/src/app/api/bespoke/[orderId]/initialize-payment/route.ts:28-31`). Amount is capped to `order.balance` (`:56`). Ledger writer is `appendPayment` (`prudential-atelier/src/lib/payments/ledger.ts:348`).

Pay UI “deposit” is `order.balance * (pct / 100)` (`prudential-atelier/src/components/account/BespokePayClient.tsx:30-31`) — 70% of **remaining balance**, not 70% of `totalAmount` / remaining `depositRequired`.

### 1.11 Production unlocked

**Verdict: `BUILT`**

| | Client | Staff member | Mrs. Prudent |
|---|---|---|---|
| Screen | `MISSING` (no unlock screen; later stages become completable) | Sees assigned order on `/staff/orders/[orderId]` once it exists | `productionUnlockedAt` on `/admin/bespoke/[orderId]` |
| Email | `MISSING` | `MISSING` | In-app `PRODUCTION_UNLOCKED` (`prudential-atelier/src/lib/payments/ledger.ts:239-245`) |

`syncProductionUnlock` sets `productionUnlockedAt` when `depositSatisfied && confirmed > 0` (`:200-247`). Stages from `SKETCHING_CONCEPT` require that timestamp (`prudential-atelier/src/lib/atelier/stage-requirements.ts:14-20`, `:53-56`; gate `prudential-atelier/src/lib/atelier/can-complete-stage.ts:123-127`). Relock clears the timestamp and does not revert completed stages (`prudential-atelier/src/lib/payments/ledger.ts:249-267`).

### 1.12 Thirteen stages

**Verdict: `BUILT` (sequential; see §2 for skip/`START_CUTTING`)**

| | Client | Staff member | Mrs. Prudent |
|---|---|---|---|
| Screen | `/track/[token]`; `/account/orders/bespoke/[orderId]`; stage emails | `/staff/orders/[orderId]` **read-only** (`prudential-atelier/src/app/(staff)/staff/orders/[orderId]/page.tsx:26-40`). API `POST /api/bespoke/[orderId]/complete-stage` allows `STAFF` (`prudential-atelier/src/lib/bespoke-roles.ts:4-10`) | `/admin/bespoke/[orderId]` complete / revert / media |
| Email | `sendBespokeStageEmail` per non-final complete (`prudential-atelier/src/lib/atelier/stage-actions.ts:247-271`); in-app `ATELIER_STAGE_ADVANCED` linking `/track/{token}` (`prudential-atelier/src/lib/customer-notifications.ts:65-86`) | Stage assignment email if assigned | In-app `STAGE_COMPLETED` (`prudential-atelier/src/lib/notifications.ts` / `stage-actions.ts:285-288`) |

Order of 13: `prudential-atelier/src/lib/bespoke-stages.ts:3-17`. Completing writes `StageUpdate` + live `OrderStageCompletion` and advances `currentStage` (`prudential-atelier/src/lib/atelier/stage-actions.ts:173-216`).

After quote convert, `currentStage` defaults to `CONSULTATION_BOOKING` (`prudential-atelier/prisma/schema.prisma:1896`). Staff still walk stages 1–4 on an order that already has a paid consultation, approved quote, and draft invoice.

### 1.13 Alterations

**Verdict: `BUILT` (two different objects)**

**A. Pipeline stage `ALTERATIONS`** — stage 10 (`prudential-atelier/src/lib/bespoke-stages.ts:13`; gate `prudential-atelier/src/lib/atelier/stage-requirements.ts:71`). Same complete UI as §1.12.

**B. Post-delivery `AlterationRequest`** (`prudential-atelier/prisma/schema.prisma:1982-1987`).

| | Client | Staff member | Mrs. Prudent |
|---|---|---|---|
| Screen | Account post-delivery UI; `POST /api/bespoke/[orderId]/alterations` | `MISSING` dedicated triage UI | `/admin/alterations` |
| Email | Chargeable path creates a draft `Quotation` | `MISSING` | `MISSING` as a dedicated type |

### 1.14 Delivery

**Verdict: `BUILT`**

| | Client | Staff member | Mrs. Prudent |
|---|---|---|---|
| Screen | Delivered email; `/receipt/[token]`; account confirm | Can call complete API if `STAFF` | Complete `DELIVERY` on order detail |
| Email | `sendBespokeDeliveredEmail` (`prudential-atelier/src/lib/atelier/stage-actions.ts:228-239`); receipt reminder cron; review request | `MISSING` | None |

Delivery gate: deposit + zero balance + ≥1 media (`prudential-atelier/src/lib/atelier/stage-requirements.ts:81-85`; `prudential-atelier/src/lib/atelier/can-complete-stage.ts:146-151`). Completing sets `OrderStatus.DELIVERED` + `deliveredAt` (`stage-actions.ts:208-215`). Client confirms via `confirmBespokeReceipt`; staff cannot confirm (`prudential-atelier/src/lib/bespoke-receipt.ts:30-32`).

### 1.15 Archive

**Verdict: `BUILT`**

| | Client | Staff member | Mrs. Prudent |
|---|---|---|---|
| Screen | Account shows archived | Hidden unless `showArchived` | Pipeline “Show archived” |
| Email | `MISSING` | `MISSING` | `MISSING` |

`maybeArchiveBespokeOrder` requires delivered, `receiptConfirmedAt`, `balance ≤ 0.01`, no open alterations (`prudential-atelier/src/lib/bespoke-archive.ts:8-37`).

### Parallel intake (not this walk)

`/bespoke` redirects to `/atelier` (`prudential-atelier/src/app/(storefront)/bespoke/page.tsx:1-4`). `POST /api/bespoke` non-admin still creates `BespokeRequest`. `POST /api/admin/bespoke/manual` creates `BespokeRequest` only. `BespokeOrder.bespokeRequestId` is never set by those create paths. Verdict: intake → pipeline link `MISSING`.

---

## 2. The thirteen stages

Source of truth: enum `prudential-atelier/prisma/schema.prisma:1677-1691`, order/labels `prudential-atelier/src/lib/bespoke-stages.ts:3-65`, gates `prudential-atelier/src/lib/atelier/stage-requirements.ts:48-86`.

`base()` sets `requiresNotes: true` on every stage (`:30-40`). `PRODUCTION_START_STAGE` is `SKETCHING_CONCEPT` (`:20`).

| # | Enum | Label | Media | Client approval | Deposit | Zero balance | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | `CONSULTATION_BOOKING` | 1. Consultation Booking | no | no | no | no | `BUILT` |
| 2 | `CONSULTATION_SESSION` | 2. Consultation Session | no | no | no | no | `BUILT` |
| 3 | `INVOICE_ISSUANCE` | 3. Invoice Issuance | no | no | no | no | `BUILT` |
| 4 | `PAYMENT_CONFIRMATION` | 4. Payment Confirmation | no | no | no | no | `BUILT` |
| 5 | `SKETCHING_CONCEPT` | 5. Sketching & Concept | ≥1 | no | yes | no | `BUILT` |
| 6 | `FABRIC_SOURCING` | 6. Fabric Sourcing | ≥1 | no | yes | no | `BUILT` |
| 7 | `DESIGN_APPROVAL` | 7. Design Approval | ≥1 | **yes** | yes | no | `BUILT` |
| 8 | `TAILORING` | 8. Tailoring / Construction | ≥1 | no | yes | no | `BUILT` |
| 9 | `FIRST_FITTING` | 9. First Fitting | no | no | yes | no | `BUILT` |
| 10 | `ALTERATIONS` | 10. Alterations | no | no | yes | no | `BUILT` |
| 11 | `BEADING_FINISHING` | 11. Beading & Finishing | ≥1 | no | yes | no | `BUILT` |
| 12 | `FINAL_FITTING` | 12. Final Fitting | ≥1 | **yes** | yes | no | `BUILT` |
| 13 | `DELIVERY` | 13. Delivery / Collection | ≥1 | no | yes | **yes** | `BUILT` |

Previous live completion is required (`prudential-atelier/src/lib/atelier/can-complete-stage.ts:97-103`). Jump is rejected (`WRONG_STAGE` / `PREVIOUS_STAGE_INCOMPLETE`). `scripts/test-stage-gate.ts` and `scripts/test-stage-walk.ts` assert this. Skip API: `MISSING`. Optional-stage flag: `MISSING`.

A simple commission and a beaded bridal gown therefore execute the same 13 completes, including `BEADING_FINISHING` (media required) and both fittings.

### 2.1 “Start Cutting” → “Production in Progress” (7 Sep meeting)

Repo search for `Start Cutting`, `START_CUTTING`, and `Production in Progress` under `prudential-atelier/src`: **zero matches**.

The live “cutting” concept is **RTW made-to-order**, not atelier `TAILORING`.

| Location | What it says |
|---|---|
| `prudential-atelier/prisma/schema.prisma:1453-1456` | `OrderStatus.CUTTING` — comment “Made-to-order: fabric is being cut.” |
| `prudential-atelier/src/lib/order-status.ts:20-21,28-29` | `CONFIRMED → CUTTING → MAKING` |
| `prudential-atelier/src/components/admin/AdminOrderToolbar.tsx:30` | Admin action label **“Start production”** for `CUTTING` |
| `prudential-atelier/src/lib/rtw-tracker.ts:63` | Client status copy **“In production”** |
| `prudential-atelier/src/components/account/OrderTimeline.tsx:18-23` | MTO timeline label **“Production”** for `CUTTING` |
| `prudential-atelier/src/app/api/admin/orders/[id]/route.ts:294-299` | Entering `CUTTING` sends `sendOrderProductionStartedEmail` |
| `prudential-atelier/src/emails/OrderProductionStartedEmail.tsx` | Slice I production-started mail |
| `prudential-atelier/scripts/test-slice-r.ts:289` | Asserts production HTML does **not** contain `"start cutting"` |

String **“Production in Progress”**: `MISSING` everywhere searched.

### 2.2 `TAILORING` (atelier stage 8) — every label surface

| Location | String |
|---|---|
| `prudential-atelier/src/lib/bespoke-stages.ts:11,27,43,59` | enum member; `"8. Tailoring / Construction"`; description; short `"Tailoring"` |
| `prudential-atelier/src/lib/atelier/stage-requirements.ts:66-69` | gate |
| `prudential-atelier/prisma/schema.prisma:1685` | enum |
| `prudential-atelier/src/lib/email-templates/bespoke-stages.ts:26,49,131` | subject/intro; body uses `STAGE_LABELS` → numbered label |
| `prudential-atelier/src/lib/admin-email-catalog.ts:1235` | `ATELIER_STAGE_TAILORING` |
| `prudential-atelier/src/components/bespoke/BespokeStageTracker.tsx:74` | `STAGE_SHORT_LABELS` → `"Tailoring"` |
| `prudential-atelier/src/components/bespoke/BespokeStageTracker.tsx:76-79` | Active badge **“In progress”** (not “Production in Progress”) |

### 2.3 Revert after later stages completed

**Server: `BUILT`. Client timeline: `PARTIAL`.**

`revertOrderStage` (`prudential-atelier/src/lib/atelier/stage-actions.ts:303-371`):

- Admin-only + reason (`prudential-atelier/src/lib/atelier/can-complete-stage.ts:156-181`).
- Soft-reverts live completions for the target stage and every later stage (`stage-actions.ts:346-353`).
- Sets those stages’ approvals to `SUPERSEDED` (`:354-362`).
- Sets `currentStage = targetStage`, `status = PROCESSING` (`:364-370`).
- Does **not** delete `StageUpdate`, `OrderStageMedia`, or drafts.

Gate ignores `SUPERSEDED` approvals (`can-complete-stage.ts:202-206`). Walk test asserts prior design approvals are `SUPERSEDED` (`prudential-atelier/scripts/test-stage-walk.ts:249-256`).

Client `BespokeStageTracker` marks a stage done if **any** `stageHistory` (`StageUpdate`) row exists **or** `idx < currentIdx` (`prudential-atelier/src/components/bespoke/BespokeStageTracker.tsx:20-32`). After revert, later stages still show Completed with notes/images. `/track` selects `stageHistory` without filtering reverted completions (`prudential-atelier/src/app/(storefront)/track/[trackingToken]/page.tsx:36`). `getStageProgress` is `index(currentStage)+1` (`prudential-atelier/src/lib/bespoke-stages.ts:72-74`) — the `/13` counter does not use live completions.

Client approval UI only shows `PENDING` for the current stage (`prudential-atelier/src/components/account/BespokeApprovalClient.tsx:37-46`). A superseded approval is not offered.

---

## 3. Stage media — never used

`OrderStageMedia` (`prudential-atelier/prisma/schema.prisma:2073-2086`): `orderId`, required `stage`, `url`, `kind`, `uploadedById`. Zero rows in production is a given of this audit.

`test:stage-walk` is refused unless `ALLOW_FIXTURES=true` (`prudential-atelier/scripts/test-stage-walk.ts:5,25`; `prudential-atelier/scripts/fixture-guard.ts:53-56`). Script: `prudential-atelier/package.json:26`.

### 3.1 Upload path after Slice X3 — `BUILT`

Admin UI uploads **FormData / raw video**, then POSTs **URLs** as JSON to stage-media:

1. `uploadAdminAsset` / `uploadAdminVideo` (`prudential-atelier/src/lib/admin-upload-xhr.ts:84-117`) → `/api/admin/upload`.
2. `BespokeOrderDetailClient.handleUpload` (`prudential-atelier/src/components/admin/BespokeOrderDetailClient.tsx:171-188`) folders `bespoke-stages` / `bespoke-videos`.
3. `POST /api/bespoke/[orderId]/stage-media` accepts JSON `{ urls, kind }` (`prudential-atelier/src/app/api/bespoke/[orderId]/stage-media/route.ts:16-37`).

No `readAsDataURL` upload client remains under `src/`. Folders pass `permissionForUploadFolder` → `"bespoke"` (`prudential-atelier/src/lib/admin-upload-folder.ts:50-58`; asserted `prudential-atelier/scripts/test-slice-x.ts:62-63`).

`folderIsPrivate` does **not** include `bespoke-stages` (`admin-upload-folder.ts:83-91`). Stage files are public `/media/...` keys.

### 3.2 Where the client sees media

| Surface | What she sees | Verdict |
|---|---|---|
| Stage-complete email | Up to 4 images + video links (`prudential-atelier/src/lib/atelier/stage-actions.ts:163-169,248-263`; `prudential-atelier/src/lib/email-templates/bespoke-stages.ts:94-115,144-145`) | `BUILT` |
| Approval-request email | `imageUrls` from current-stage media (`stage-actions.ts:482-495`) | `BUILT` |
| Logged-in account | Current-stage media on `BespokeApprovalClient` (`prudential-atelier/src/app/(account)/account/orders/bespoke/[orderId]/page.tsx:39-62`; `prudential-atelier/src/components/account/BespokeApprovalClient.tsx:83-88`). Full `stageHistory` images on the tracker when not `compact` (`BespokeStageTracker.tsx:97-105`) | `BUILT` |
| Public `/track` | Timeline only — `stageHistory` select is `stage` + `completedAt`, **no images** (`track/[trackingToken]/page.tsx:36`) | `MISSING` |
| Admin | Current-stage media + history (`BespokeOrderDetailClient.tsx`) | `BUILT` |

There is no share flag on `OrderStageMedia`. Sharing is implicit: emails + approval UI + non-compact history.

**Pipeline promise.** Copy on `/track` is “Crafted by our atelier team with care at each stage” (`track/[trackingToken]/page.tsx:98-99`). Stage emails can carry photos; the public tracker cannot. With zero `OrderStageMedia` rows, emails also go out with empty image grids. Until staff upload and complete, the “documented and shared with you at each step” promise is **not kept**. Verdict: `MISSING` as an operating fact; code to share exists on email + account only.

---

## 4. Quotations, invoices and money

### 4.1 Ledger path — `BUILT`

`Payment` is append-only (`prudential-atelier/prisma/schema.prisma:2402-2424`). `BespokeOrder.amountPaid` / `balance` are caches written only by `recomputeOrderTotals` (`schema.prisma:1907-1911`; `prudential-atelier/src/lib/payments/ledger.ts:275-284`).

1. Quote convert creates Invoice (`depositRequired` from CMS %) + `BespokeOrder` (`totalAmount`/`balance` = quote total) (`quotation-convert.ts:84-173`).
2. Confirmed `Payment` rows with `bespokeOrderId` and/or `invoiceId`.
3. `getOrderPaymentSummary` derives balance from confirmed rows (`ledger.ts:134-163`).
4. `syncProductionUnlock` (`:210-268`).

`bespoke_deposit_percent` default 70 (`ledger.ts:54-59`; `prudential-atelier/prisma/seed.ts:395`).

### 4.2 Balance collection and delivery block — `BUILT` (collection); delivery-only gate

Collect:

- Logged-in `initialize-payment` (`initialize-payment/route.ts:56-62`).
- Admin mark-paid.
- Cron `balance-reminders.ts` — CTA is `/track/{token}` (`:68`), which has **no pay control**.

Unpaid balance blocks **only** `DELIVERY` (`stage-requirements.ts:81-85`; `can-complete-stage.ts:146-151`). Stages 5–12 advance with deposit alone.

### 4.3 `SUPERSEDED` quotation — `BUILT`

Revise clones a new DRAFT and marks the previous `SUPERSEDED` (`prudential-atelier/src/lib/quotation-versioning.ts:24-80`). Client hitting the old token sees “This quotation was revised” plus a link to the latest (`prudential-atelier/src/app/quote/[approvalToken]/page.tsx:22-47`). Approve/convert/send reject `SUPERSEDED` (`quotation-convert.ts:69-70`; `quotations/[id]/send/route.ts:102-103`).

If she already approved v1 and convert ran, revise throws `CONVERTED` (`quotation-versioning.ts:43-45`). Revising after convert is `MISSING`.

### 4.4 Quotation PDF — render path `BUILT` outside tests; production open `UNCLEAR`

Runtime (not tests):

- `GET /api/admin/quotations/[id]/pdf` (`prudential-atelier/src/app/api/admin/quotations/[id]/pdf/route.ts:7-24`)
- `GET /api/quote/[token]/pdf` (`prudential-atelier/src/app/api/quote/[token]/pdf/route.ts:6-21`)
- Send sets `pdfUrl` to the public PDF URL (`prudential-atelier/src/app/api/quotations/[id]/send/route.ts:111,161-162`)

Pipeline: `buildQuotationPdfModel` → `renderQuotationPdfBuffer` → `@react-pdf` (`prudential-atelier/src/lib/quotation-pdf-data.ts:29-32`; `prudential-atelier/src/lib/render-quotation-pdf.tsx:4-5`). Whether a PDF has ever been generated on production is not recorded in this repo. Verdict: `UNCLEAR` for “ever opened”; `BUILT` for a live render path.

### 4.5 Multi-currency — `PARTIAL`

| Layer | What the code does |
|---|---|
| `Quotation.currency` | String, default NGN; EUR allowed (`schema.prisma:2295-2296`) |
| Admin form | NGN / USD / GBP / EUR (`QuotationFormClient.tsx:373-388`) |
| PDF | Uses `quote.currency` (`quotation-pdf-data.ts:30-32`) |
| Convert → Invoice | Copies currency; **`exchangeRate: 1`** (`quotation-convert.ts:132-133`) |
| Client HTML quote | **`formatPrice(..., "NGN")` hardcoded** (`QuoteApprovalClient.tsx:130-147`). `QuoteApprovalData` has no `currency` field (`:18-32`) |
| Quote-sent email | `formatCurrency` locked to `NGN` (`quotations/[id]/send/route.ts:20-26`) |
| `BespokeOrder` | **No currency column** (`schema.prisma:1879-1947`). Account list formats NGN (`AccountOrdersClient.tsx:91-94`) |
| Client pay | Gateway currency NGN/USD/GBP; book amount is `payAmountNGN` from `order.balance` (`initialize-payment/route.ts:23,56`) |
| Slice L locked FX | `lockedFxFromOrder` is used on **RTW `Order`** payment routes (`prudential-atelier/src/lib/fx.ts:123`; e.g. `api/payment/stripe/initiate/route.ts:7,53`). **Not** called from atelier quote/invoice/bespoke pay |

A diaspora bridal quote in USD/GBP stores the number correctly on the quote/PDF and shows **naira** on the approval page and in the send email. Invoice `exchangeRate` is 1. There is no atelier locked-FX snapshot.

---

## 5. Consultations

### 5.1 Four types — `BUILT`

Keys (`prudential-atelier/src/lib/consultation-types.ts:6-11`):

`PHYSICAL_PRUDENT_TEAM` | `PHYSICAL_TEAM_ONLY` | `VIRTUAL_PRUDENT_TEAM` | `VIRTUAL_TEAM_ONLY`

| | Physical vs Virtual | Mrs. Prudent vs Team |
|---|---|---|
| Price | Per-type CMS / defaults (`:51-98`, `:133-135`) | Prudent defaults higher (₦150k / ₦60k vs ₦75k / ₦40k) |
| Duration copy | CMS `duration` | Same mechanism |
| Slots | Team: calendar. Prudent: `isOfferingTypeManual` (`:147-149`) — preferred dates, 3-day lead | Flagship consultant returns `[]` slots (`prudential-atelier/src/lib/consultation.ts:119`) |
| Meeting | Virtual requires `virtualPlatform` (`prudential-atelier/src/app/api/consultations/create/route.ts:73`) | Same picker |
| After pay | — | Manual → `PENDING_CONFIRMATION`; team → `CONFIRMED` (`prudential-atelier/src/lib/consultation-payment.ts:58-66`) |
| Extra notify | — | Prudent types insert `CONSULTATION_BOOKED_PRUDENT` (`notifications.ts:75-85`) |

Charged fee is CMS type `priceNgn`, stored as `feeNGN` (`prudential-atelier/src/app/api/consultations/create/route.ts:166`), not `ConsultantOffering.feeNGN`.

### 5.2 Virtual meeting link — `BUILT` (paste); auto-send `MISSING`

Admin pastes a URL and `POST /api/admin/consultations/[id]/send-link` (`send-link/route.ts:10-70`). Confirm email shows the link if already set, else “Your meeting link will be sent separately” (`prudential-atelier/src/emails/ConsultationConfirmedEmail.tsx:76-81`).

Wizard copy: “A link will be sent to you 1 hour before your session” (`ConsultationBookingFlow.tsx:515`). No cron implements that. If never pasted: booking still proceeds (`meetingLink` nullable); Join buttons stay hidden (`prudential-atelier/src/components/account/ConsultationBookingActions.tsx:50-51`).

### 5.3 Fee refundable? Credit against commission? — `MISSING`

Legal copy: “Consultation fees are non-refundable” (`prudential-atelier/scripts/legal-content.ts:141,160`). Client cancel flips status only (`prudential-atelier/src/app/api/account/consultations/[id]/route.ts:104-116`). Quotation create does not subtract `feeNGN`. Invoice-from-consultation prefills a **positive** consultation-fee line (`prudential-atelier/src/app/api/admin/invoices/route.ts:241-255`). `prudential-atelier/src/components/bespoke/BespokeForm.tsx:180` checkbox “₦10,000 (refundable on order)” is a separate intake form, not wired to `ConsultationBooking.feeNGN`.

### 5.4 No-show — `PARTIAL`

Admin may set `CONFIRMED → NO_SHOW` (`prudential-atelier/src/app/api/admin/consultations/[id]/route.ts:103`). Emails in that route fire for `CONFIRMED` (`:160-174`) — **not** `NO_SHOW`. Payment is unchanged. No rebook helper.

### 5.5 `atelier_bookings_enabled` — `BUILT` as a public new-booking gate

Fail-closed: only `"true"` enables (`atelier-bookings.ts:4-27`). Seed default `"false"` (`prisma/seed.ts:378`).

| Location | When off |
|---|---|
| `/consultation` | Closed banner; cards not selectable; steps 2–3 hidden (`prudential-atelier/src/components/consultation/ConsultationBookingFlow.tsx:418-549,661`; page passes `bookingsEnabled` at `consultation/page.tsx:47`) |
| `POST /api/consultations/create` | 403 (`create/route.ts:35-36`) |
| `POST /api/consultations/upload` | 403 (`upload/route.ts:16-17`) — **also used by admin moodboard upload** on the consultation detail page |
| Payment initiate/verify + bank-transfer | Not gated |
| Account list/detail/cancel | Unchanged |
| Admin screens | Toggle copy: “Admin screens are unchanged” (`GeneralSettingsClient.tsx:235-237`) |

When turned **on**: public wizard works; create + public upload accept; existing pay paths unchanged. Unfinished behind the flag:

- “1 hour before” meeting-link copy has no job (`MISSING`).
- Admin consultation stills upload hits the **public** gated route (`PARTIAL` / operational break while flag is off).
- Legacy `consult_*` price fields in general settings toast-save only (`PARTIAL`).

---

## 6. What the platform changed underneath it

### 6.1 Slice T permissions

**`BESPOKE_MANAGER` × `quotations` — confirmed denied.** Seed: `["bespoke", "consultations", "clients.view"]` (`roles.ts:83`). Page/API: `perm("quotations")` / `requireAdminApi("quotations")` (`admin-route-access.ts:88`; `api/quotations/route.ts:80-82`). Catalog proposal `t3-quotations-bespoke` is `kind: "regression"` and **unapplied** (`permission-catalog.ts:230-237`).

**`clients` / CRM — confirmed blocked.** `clients.view` description: “Unused until a page is wired to it” (`permission-catalog.ts:98-102`). `/admin/clients` requires `clients` (`admin-route-access.ts:94`). Proposals `t3-clients-bespoke` / `t3-clients-consultation` unapplied (`:211-228`).

Other atelier fallout:

| Surface | BESPOKE_MANAGER | CONSULTATION_MANAGER |
|---|---|---|
| `/admin/bespoke` | allow (`bespoke`) | deny |
| `/admin/consultations` | allow | allow |
| `/admin/quotations` | **deny** | deny |
| `/admin/invoices` | **deny** | deny |
| `/admin/clients` | **deny** | deny |
| Moodboards / measurements APIs | allow via `BESPOKE_ROLES` | **deny** (not in list, `bespoke-roles.ts:4-10`) |

Mrs. Prudent (`ADMIN`) holds `quotations`, `invoices`, `clients` (`roles.ts:50-66`). A commission tomorrow that she runs herself does not hit the manager denials. A commission she delegates to Bespoke Manager stalls at quote and CRM.

### 6.2 Slice X media — `PARTIAL`

Writes: local store `public/` or `private/`; URL `/media/${key}`. Consultation upload `private: true`, folder `prudential-atelier/consultations` (`consultations/upload/route.ts:45-50`). `folderIsPrivate` includes `/consultations` (`admin-upload-folder.ts:83-91`).

Public `/media/[...key]` sets `allowPrivate: false` (`media/[...key]/route.ts:11-13`) — private keys 404. Admin rewrite `adminReceiptSrc` is used for receipts (`media/admin-receipt-src.ts:3-10`). Consultation moodboards render `Image src={url}` raw (`AdminConsultationDetail.tsx:453-455`). Same pattern on quotation form reference images (`QuotationFormClient.tsx:397-403`). Private consultation stills **do not display** in those screens.

Stage media folders are public, so admin/client `<Image src={url}>` works once a row exists.

### 6.3 Slice W notifications — `BUILT` (permission-routed)

`ADMIN_NOTIFICATION_TARGETS` (`admin-notification-access.ts:20-43`):

| Type | Needs |
|---|---|
| `NEW_BESPOKE`, `STAGE_COMPLETED`, `PRODUCTION_UNLOCKED`, `PRODUCTION_RELOCKED`, `STAGE_APPROVAL_RESPONSE` | `bespoke` |
| `NEW_CONSULTATION`, `CONSULTATION_COMPLETED`, `CONSULTATION_BOOKED_PRUDENT` | `consultations` |
| `QUOTE_APPROVED`, `QUOTE_AWAITING` | `quotations` |
| `NEW_CUSTOMER` | `clients` or `clients.view` |

BESPOKE_MANAGER sees floor/production/stage events and **does not** see quote notifications. CONSULTATION_MANAGER sees consultation events only. Customer atelier events: `customer-notifications.ts:65-86` (stage), `:90` (consultation confirmed), meeting link / moodboard / invoice / quote helpers in the same file.

### 6.4 Made-to-order RTW vs atelier commission

| | MTO RTW | Atelier commission |
|---|---|---|
| Model | Shop `Order` / `OrderItem`, `sizeMode: CUSTOM`, `fulfilmentKind` `MADE_TO_ORDER`/`MIXED` | `BespokeOrder` + 13 stages, quotations, deposit unlock, `StageApproval` |
| Stock | `shouldDecrementStock` false for custom (`custom-size.ts:161-163`) | No variant stock |
| Lead time | Setting default **21** days (`custom-settings.ts:50-54`); storefront product page fallback 21 (`shop/[slug]/page.tsx:218`); hero copy **“7-12 days”** (`cms-config.ts:791,798`; `rtw-hero.ts:4-6`) | `deliveryDate` on the commission (`schema.prisma:1893`) |
| Measurements | Product measurement fields / cart snapshot | Client-profile measurements + consultation notes |
| Tracker | Account RTW tab + `/checkout/success`; `/track` explicitly bespoke-only (`atelier-storefront.ts:1-19`) | `/track`, account Atelier tab |
| Money | Slice L locked FX on `Order` | NGN-centric ledger on `BespokeOrder` |

What still distinguishes a commission: the 13-stage record, quotation/deposit machine, design/final-fitting approvals, and atelier emails. MTO is a catalogue line cut to measurements with `CUTTING`/`MAKING`. If the house treats both as “made for you in Lagos in days,” that is a **business** overlap, not a missing enum.

### 6.5 Slice AG stock — atelier dependency `MISSING`

No `stock` / `inventory` / `StockItem` / `sku` under atelier/bespoke/consultation/quotation/material paths. `Material` is name/qty/cost/supplier (`schema.prisma:2135-2147`). Removing RTW stock does not call into the commission pipeline.

---

## 7. The client's experience

### 7.1 `/track` — `BUILT` (bespoke-only); media/pay `MISSING` on this page

She types order ref `ORD-…` (`track/page.tsx:29-42`; placeholder in `TrackSearchForm`). Lookup redirects to `/track/{trackingToken}`. Token is `@default(cuid())` (`schema.prisma:1925`). Email is not an input.

She sees: orderRef, outfit line, first name, est. delivery, `stagesComplete/13`, compact timeline (`track/[trackingToken]/page.tsx:76-96`). No photos, no amounts, no pay.

RTW uses `rtw-tracker.ts` on account + checkout success, not `/track`.

### 7.2 Emails, start to finish

Slice I = React `src/emails/*` and/or catalog. Old = `email-templates/` or ad-hoc HTML.

| # | Event | System |
|---|---|---|
| 1 | Consultation pending | Slice I `ConsultationPendingEmail` / `consultation_pending` |
| 2 | Consultation confirmed | Slice I `ConsultationConfirmedEmail` |
| 3 | Meeting link | Slice I `meeting_link` |
| 4 | Reschedule / cancel | Slice I |
| 5 | Session summary | Slice I |
| 6 | Quote sent | **Old** inline HTML `quote-sent` (`send/route.ts:146-154`). Catalog `quote_approval` exists (`admin-email-catalog.ts:38`) and is **not** used here |
| 7 | Invoice issued | Slice I `InvoiceEmail` |
| 8 | Welcome credentials (onboard) | Slice I |
| 9 | Each stage 1–12 | **PARTIAL**: catalog copy + old HTML wrapper `getBespokeStageEmail` (`bespoke-email.ts:16-40`; `email-templates/bespoke-stages.ts:121-152`) |
| 10 | Stage approval request / 72h reminder / changes-requested | Slice I catalog |
| 11 | Balance reminder | **Old** inline HTML (`balance-reminders.ts:71`) |
| 12 | Delivered / receipt reminder / bespoke review | Slice I |
| 13 | Consultation review cron | Slice I email; in-app review notify `MISSING` on that cron path |

### 7.3 Logged-in commission after Slice Z3 — `BUILT`

`/account/orders` tabs: **Atelier Orders** / **Ready-to-Wear** (`AccountOrdersClient.tsx:40-52`). Default: atelier if any commission, else RTW (`rtw-tracker.ts:54-57`). Detail: `/account/orders/bespoke/[orderId]`. Pay: `.../pay`.

Slice Z3 (`scripts/test-slice-z3.ts:1-4`) is RTW “find the order after refresh,” not a `/track` rewrite.

### 7.4 Approvals — two systems, both `BUILT`

| | Quotation | Stage (`DESIGN_APPROVAL`, `FINAL_FITTING`) |
|---|---|---|
| How | Token page `/quote/{token}` — no login | Logged-in `/account/orders/bespoke/{id}` (`stage-actions.ts:481`) |
| If never | Quote stays `SENT` | Complete fails `CLIENT_APPROVAL_PENDING` (`can-complete-stage.ts:130-143`); pipeline block `CLIENT_APPROVAL` (`stage-requirements.ts:104-112`) |
| Reminders | No client quote-approval cron | Cron after 72h (`cron/jobs/stage-approval-reminders.ts:10-18`; catalog `:89-92`) |

Request-changes on the quote page opens a `mailto:` (`QuoteApprovalClient.tsx:75-80`). Stage changes-requested emails assigned staff (`prudential-atelier/src/lib/atelier/stage-actions.ts:612`).

---

## 8. Gap register

Judged against **a real commission completes without anyone calling Nony**. Est. is engineering hours, not calendar.

| # | Gap | Severity | What breaks | Files | Est. |
|---|---|---|---|---|---|
| 1 | `atelier_bookings_enabled` is `"false"` | **P0** | Client cannot create a booking. Tomorrow’s commission has no public front door until the toggle is on. | `atelier-bookings.ts:18-27`; `seed.ts:378`; `consultation/page.tsx:38-47` | 0 (ops) |
| 2 | Admin moodboard upload uses public `/api/consultations/upload`, which the flag 403s | **P0** | Even after a manual/admin booking, stills cannot be uploaded while the flag is off. | `consultations/upload/route.ts:16-17`; `AdminConsultationDetail.tsx:199-204` | 2h |
| 3 | Private consultation stills 404 in admin (and quote form) | **P0** | Session moodboards written `private: true` are not rewritten through `/api/admin/media/file/...`. Staff cannot see the references they uploaded. | `upload/route.ts:45-50`; `media/[...key]/route.ts:11-13`; `AdminConsultationDetail.tsx:453-455`; `admin-receipt-src.ts:3-10` | 4h |
| 4 | Public invoice has no pay; deposit is account-only | **P0** | Email/invoice link cannot collect the 70%. She must log in and hit `/pay`. Guest-without-session cannot `initialize-payment`. | `PublicInvoiceView.tsx:249`; `initialize-payment/route.ts:28-31`; `BespokePayClient.tsx:16` | 8h |
| 5 | USD/GBP quote shows as NGN to the client | **P0** | Diaspora bridal client approves a naira figure. Email is also NGN. PDF is the only honest document. | `QuoteApprovalClient.tsx:130-147`; `quotations/[id]/send/route.ts:20-26`; `quotation-convert.ts:132-133` | 6h |
| 6 | `BESPOKE_MANAGER` cannot open quotations (or invoices, or Client CRM) | **P1** | Delegated run of the pipeline stops at quote. Unapplied `t3-quotations-bespoke` / `t3-clients-*`. | `roles.ts:83`; `admin-route-access.ts:87-94`; `permission-catalog.ts:211-237` | 1h (seed) |
| 7 | All 13 stages mandatory; no skip | **P1** | A simple commission still requires Beading & Finishing (with photo), both fittings, and re-walking stages 1–4 after consult+quote already happened. | `can-complete-stage.ts:97-103`; `stage-requirements.ts:48-86` | 12h |
| 8 | Client timeline ignores revert | **P1** | After an admin revert, `/track` and account still show later stages as Completed. | `BespokeStageTracker.tsx:20-32`; `stage-actions.ts:346-370`; `track/[trackingToken]/page.tsx:36` | 4h |
| 9 | “Documented at each step” not on `/track`; media never used | **P1** | Public tracker has no photos. Zero `OrderStageMedia` rows. Promise is email+account only, and email grids are empty until first upload. | `track/[trackingToken]/page.tsx:36,96`; `email-templates/bespoke-stages.ts:94-115` | 6h |
| 10 | Meeting link is manual; copy promises 1 hour before | **P1** | Virtual session with no pasted URL: she has no Join button and no cron. | `send-link/route.ts:53-70`; `ConsultationBookingFlow.tsx:515` | 4h |
| 11 | Pay “deposit” = 70% of remaining `balance` | **P1** | After any partial, the Deposit option is not the CMS deposit remainder. Unlock uses `invoice.depositRequired`, so UI and gate disagree. | `BespokePayClient.tsx:30-31`; `ledger.ts:108-127` | 3h |
| 12 | Balance reminder CTA is `/track` (no pay) | **P1** | She is sent somewhere she cannot pay. | `balance-reminders.ts:68` | 1h |
| 13 | No atelier locked FX | **P1** | USD/GBP gateway charge on a commission uses live convert from NGN balance; quote `exchangeRate` is 1. Slice L does not cover this. | `initialize-payment/route.ts:56`; `fx.ts:123`; `quotation-convert.ts:133` | 10h |
| 14 | Staff have no complete-stage UI | **P2** | Floor `STAFF` is API-capable and screen-read-only. Completes happen in admin, i.e. Mrs. Prudent or a manager with `bespoke`. | `staff/orders/[orderId]/page.tsx:26-40`; `bespoke-roles.ts:4-10` | 8h |
| 15 | Stage emails are old HTML; quote-sent ignores catalog `quote_approval` | **P2** | Slice I design system is not the quote or stage bodies the client actually gets. | `bespoke-email.ts:16-40`; `send/route.ts:146-154`; `admin-email-catalog.ts:38` | 8h |
| 16 | Consultation fee never credits the commission | **P2** | She pays twice if the invoice also lists the fee. Refund path `MISSING` (policy says non-refundable). | `legal-content.ts:141`; `quotations/route.ts`; `invoices/route.ts:241-255` | 6h |
| 17 | `NO_SHOW` is status-only | **P2** | No email, no refund, no rebook. Fee stays captured. | `admin/consultations/[id]/route.ts:103,160-203` | 4h |
| 18 | Measurements not bound to the consultation | **P2** | Session can complete with empty profile measurements. Capture is a later optional PATCH. | `schema.prisma` Measurement 1:1 ClientProfile; `session/route.ts:42-49` | 6h |
| 19 | `BespokeRequest` intake does not become `BespokeOrder` | **P2** | Website/manual “bespoke” creates a request. Pipeline never links `bespokeRequestId`. | `api/bespoke/route.ts`; `admin/bespoke/manual`; `schema.prisma:1916` | 8h |
| 20 | Quote revise after convert `MISSING` | **P2** | Price change mid-commission has no versioned quote path (`CONVERTED` throw). | `quotation-versioning.ts:43-45` | 8h |

---

## 9. Open questions

Cap 10. Each is answerable in one sentence.

1. Will tomorrow’s commission start by flipping `atelier_bookings_enabled` to `"true"`, or by Mrs. Prudent creating a quotation with no public booking?
2. Who writes quotations — Mrs. Prudent (`ADMIN`) or a `BESPOKE_MANAGER` who currently cannot open `/admin/quotations`?
3. Must every commission walk all 13 stages, including `BEADING_FINISHING` and re-completing booking/session/invoice/payment after those already happened?
4. Is the 7 Sep “Start Cutting” → “Production in Progress” rename for RTW `OrderStatus.CUTTING` (already labelled “Start production” / “In production”), or for atelier `TAILORING` (no such strings exist)?
5. For a USD quotation, is the PDF the document of record, given the approval page and send email format NGN?
6. Should the public invoice collect the deposit, or is `/account/.../pay` the only intended till?
7. Are consultation stills meant to be private (current upload) even though admin UI cannot render private `/media` URLs?
8. Does a paid consultation fee ever reduce `depositRequired`, or is double-charging the accepted policy?
9. When a virtual link is never pasted, is the session still considered held, or is that an incomplete booking?
10. Has any quotation PDF been opened outside local/admin testing? (Repo records a live render route; it does not record a production hit.)
