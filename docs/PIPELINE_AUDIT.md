# Prudential Atelier â€” 13-Stage Pipeline Audit

**Repo:** `github.com/Nonyd/prudentgabriel` â†’ `prudential-atelier/`  
**Mode:** READ-ONLY  
**Audit date:** 2026-08-07  
**Scope root:** `prudential-atelier/`

Verdict vocabulary: `BUILT` | `PARTIAL` | `MISSING` | `UNCLEAR`

---

## Section 1 â€” Inventory

### 1.1 Canonical stage enum (verbatim order)

Source: `prudential-atelier/prisma/schema.prisma:1204-1218` and mirror `prudential-atelier/src/lib/bespoke-stages.ts:2-17`.

| # | ENUM_NAME | Display label (`STAGE_LABELS`) |
|---|---|---|
| 1 | `CONSULTATION_BOOKING` | 1. Consultation Booking |
| 2 | `CONSULTATION_SESSION` | 2. Consultation Session |
| 3 | `INVOICE_ISSUANCE` | 3. Invoice Issuance |
| 4 | `PAYMENT_CONFIRMATION` | 4. Payment Confirmation |
| 5 | `SKETCHING_CONCEPT` | 5. Sketching & Concept |
| 6 | `FABRIC_SOURCING` | 6. Fabric Sourcing |
| 7 | `DESIGN_APPROVAL` | 7. Design Approval |
| 8 | `TAILORING` | 8. Tailoring / Construction |
| 9 | `FIRST_FITTING` | 9. First Fitting |
| 10 | `ALTERATIONS` | 10. Alterations |
| 11 | `BEADING_FINISHING` | 11. Beading & Finishing |
| 12 | `FINAL_FITTING` | 12. Final Fitting |
| 13 | `DELIVERY` | 13. Delivery / Collection |

### 1.2 Core models (schema excerpts)

**ConsultationBooking** â€” `prudential-atelier/prisma/schema.prisma:118`  
Fields include: `userId?`, `sessionNotes`, `moodboardImages`, `meetingLink`, payment fields, `status ConsultationStatus`.

**ConsultationStatus** â€” `prudential-atelier/prisma/schema.prisma:210-221`  
`PENDING_PAYMENT | PENDING_CONFIRMATION | CONFIRMED | SCHEDULED | IN_SESSION | RESCHEDULED | COMPLETED | CANCELLED_BY_CLIENT | CANCELLED_BY_ADMIN | NO_SHOW`

**Invoice** â€” `prudential-atelier/prisma/schema.prisma:539`  
Links: `bespokeRequestId?`, `consultationId?`. Fields: `depositRequired`, `depositPaid`, `balanceDue`, `paymentTerms`, `paymentHistory` JSON. **No `quotationId` field.**

**InvoiceStatus** â€” `prudential-atelier/prisma/schema.prisma:606-614`  
`DRAFT | SENT | VIEWED | PARTIALLY_PAID | PAID | OVERDUE | CANCELLED`

**OrderStatus** â€” `prudential-atelier/prisma/schema.prisma:1089-1097`  
`PENDING | CONFIRMED | PROCESSING | SHIPPED | DELIVERED | CANCELLED | REFUNDED`  
(Used by both RTW `Order` and `BespokeOrder.status`)

**PaymentStatus** â€” `prudential-atelier/prisma/schema.prisma:1099-1104`  
`PENDING | PAID | FAILED | REFUNDED`

**PaymentGateway** â€” `prudential-atelier/prisma/schema.prisma:1106-1112`  
`PAYSTACK | FLUTTERWAVE | STRIPE | MONNIFY | BANK_TRANSFER`

**BespokeStatus** â€” `prudential-atelier/prisma/schema.prisma:1114-1122`  
`PENDING | REVIEWED | CONFIRMED | IN_PROGRESS | READY | DELIVERED | CANCELLED`  
(Used by legacy `BespokeRequest`, not the 13-stage `BespokeOrder`)

**QuoteStatus** â€” `prudential-atelier/prisma/schema.prisma:1246-1252`  
`DRAFT | SENT | APPROVED | REJECTED | CONVERTED`

**BespokeOrder** â€” `prudential-atelier/prisma/schema.prisma:1344-1395`  
`currentStage BespokeStage`, `stageHistory`, `assignments`, `materials`, `quotationId?`, `consultationId?`, payment fields (`amountPaid`, `totalAmount`, `balance`, `paymentReceiptUrl`), consultation context copies (`sessionNotes`, `moodboardImages`, `occasionDetails`, `outfitBrief`), `trackingToken`, `status OrderStatus`.

**StageUpdate** (per-stage media + audit) â€” `prudential-atelier/prisma/schema.prisma:1397-1414`  
`stage`, `notes`, `images[]`, `videos[]`, `completedBy`, `completedByName`, `emailSent`, `emailSentAt`, `completedAt`.

**OrderAssignment** â€” `prudential-atelier/prisma/schema.prisma:1416-1432`  
`staffProfileId`, `role`, `stage?`, `assignedAt`, `completedAt?`.

**Material** â€” `prudential-atelier/prisma/schema.prisma:1434-1447`  
Order-level materials (not stage-scoped).

**Quotation** â€” `prudential-atelier/prisma/schema.prisma:1540-1576`  
`approvalToken`, `expiresAt`, `pdfUrl`, `consultationId?`, `bespokeOrders[]`. **No version / parentQuote fields.**

**Payment model:** No dedicated `Payment` model exists in `schema.prisma` (grep for `^model Payment ` returns none). Payments live as fields on `Order`, `ConsultationBooking`, `BespokeOrder`, and `Invoice.paymentHistory` JSON.

**Media/attachment model for stages:** No separate Media model. Stage media is `StageUpdate.images` / `StageUpdate.videos` (`schema.prisma:1404-1405`). Consultation moodboard is `ConsultationBooking.moodboardImages` / `BespokeOrder.moodboardImages`.

### 1.3 API routes (atelier / stages / quotations / consultations / payments / media)

**Bespoke / stages**
- `POST/GET /api/bespoke` â€” `src/app/api/bespoke/route.ts`
- `GET/PATCH/DELETE /api/bespoke/[orderId]` â€” `src/app/api/bespoke/[orderId]/route.ts`
- `POST /api/bespoke/[orderId]/complete-stage` â€” `src/app/api/bespoke/[orderId]/complete-stage/route.ts`
- `POST/DELETE /api/bespoke/[orderId]/assign-staff` â€” `src/app/api/bespoke/[orderId]/assign-staff/route.ts`
- `POST /api/bespoke/[orderId]/bank-transfer` â€” `src/app/api/bespoke/[orderId]/bank-transfer/route.ts`
- `POST /api/bespoke/[orderId]/initialize-payment` â€” `src/app/api/bespoke/[orderId]/initialize-payment/route.ts`
- `GET /api/bespoke/[orderId]/verify-payment` â€” `src/app/api/bespoke/[orderId]/verify-payment/route.ts`
- `GET/PATCH /api/admin/bespoke/[id]` â€” `src/app/api/admin/bespoke/[id]/route.ts`
- `GET/POST /api/admin/bespoke` â€” `src/app/api/admin/bespoke/route.ts`
- `POST /api/admin/bespoke/manual` â€” `src/app/api/admin/bespoke/manual/route.ts`
- `GET /api/staff/orders/[orderId]` â€” `src/app/api/staff/orders/[orderId]/route.ts`

**Quotations**
- `GET/POST /api/quotations` â€” `src/app/api/quotations/route.ts`
- `GET/PATCH/DELETE /api/quotations/[id]` â€” `src/app/api/quotations/[id]/route.ts`
- `POST /api/quotations/[id]/send` â€” `src/app/api/quotations/[id]/send/route.ts`
- `POST /api/quotations/[id]/approve` â€” `src/app/api/quotations/[id]/approve/route.ts`
- `POST /api/quotations/[id]/convert` â€” `src/app/api/quotations/[id]/convert/route.ts`

**Consultations**
- `POST /api/consultations/create` â€” `src/app/api/consultations/create/route.ts`
- `POST /api/consultations/bank-transfer` â€” `src/app/api/consultations/bank-transfer/route.ts`
- `POST /api/consultations/upload` â€” `src/app/api/consultations/upload/route.ts`
- Payment initiate/verify under `src/app/api/consultations/payment/{paystack,flutterwave,stripe,monnify}/`
- `GET/PATCH /api/admin/consultations/[id]` â€” `src/app/api/admin/consultations/[id]/route.ts`
- `PATCH /api/admin/consultations/[id]/session` â€” `src/app/api/admin/consultations/[id]/session/route.ts`
- `POST /api/admin/consultations/[id]/send-link` â€” `src/app/api/admin/consultations/[id]/send-link/route.ts`
- `GET /api/admin/consultations` â€” `src/app/api/admin/consultations/route.ts`
- `GET /api/admin/consultations/search` â€” `src/app/api/admin/consultations/search/route.ts`

**Payments (admin bank-transfer queue)**
- `GET /api/admin/payments/pending` â€” `src/app/api/admin/payments/pending/route.ts`
- `POST /api/admin/payments/[id]/confirm` â€” `src/app/api/admin/payments/[id]/confirm/route.ts`
- `POST /api/admin/payments/[id]/reject` â€” `src/app/api/admin/payments/[id]/reject/route.ts`

**Invoices**
- `GET/POST /api/admin/invoices` â€” `src/app/api/admin/invoices/route.ts`
- `GET/PATCH /api/admin/invoices/[id]` â€” `src/app/api/admin/invoices/[id]/route.ts`
- `POST /api/admin/invoices/[id]/send` â€” `src/app/api/admin/invoices/[id]/send/route.ts`
- `POST /api/admin/invoices/[id]/mark-paid` â€” `src/app/api/admin/invoices/[id]/mark-paid/route.ts`
- `GET /api/admin/invoices/[id]/pdf` â€” `src/app/api/admin/invoices/[id]/pdf/route.ts`
- `GET /api/invoice/[token]` â€” `src/app/api/invoice/[token]/route.ts`

**Media uploads (relevant)**
- `POST /api/consultations/upload` â€” consultation moodboard
- `POST /api/admin/upload` â€” used by bespoke stage media UI
- `POST /api/upload/receipt` â€” bank transfer receipts
- `POST /api/account/upload` â€” account uploads

**Tracking**
- `GET /api/track/[token]` â€” `src/app/api/track/[token]/route.ts`

**Cron (related)**
- `GET /api/cron/balance-reminders` â€” `src/app/api/cron/balance-reminders/route.ts`
- `GET /api/cron/review-requests` â€” `src/app/api/cron/review-requests/route.ts` (RTW + consultation; excludes bespoke)

### 1.4 Admin / staff UI that mutates stage state

- Admin order detail: `src/app/(admin)/admin/bespoke/[orderId]/page.tsx` â†’ `src/components/admin/BespokeOrderDetailClient.tsx` (calls `POST /api/bespoke/[orderId]/complete-stage`, assign-staff, PATCH order)
- Admin pipeline list: `src/app/(admin)/admin/bespoke/page.tsx` â†’ `BespokePipelineClient.tsx`
- Staff: `src/app/(staff)/staff/page.tsx`; staff order API `src/app/api/staff/orders/[orderId]/route.ts` (read path present; stage complete remains under `/api/bespoke/.../complete-stage` with `BESPOKE_ROLES`)

### 1.5 Client account surfaces

Under `src/app/(account)/account/`:
- Dashboard, orders, bespoke pay (`orders/bespoke/[orderId]/pay`), consultations, measurements, moodboards, notifications, reviews, etc.
- Quote approval public page (not under `/account`): `src/app/quote/[approvalToken]/page.tsx`
- Public track: `src/app/(storefront)/track/[trackingToken]/page.tsx`

### 1.6 Server actions (`"use server"`)

Grep across `prudential-atelier/src` for `"use server"`: **zero matches**. Stage/order transitions are API route handlers only.

### 1.7 Shared guards / helpers

- Stage order helpers: `src/lib/bespoke-stages.ts` (`STAGE_ORDER`, `getNextStage`, `getPreviousStage`)
- Stage complete route: `src/app/api/bespoke/[orderId]/complete-stage/route.ts`
- Auth roles: `src/lib/api-auth.ts` (`BESPOKE_ROLES`, `requireRoles`)
- Quote convert: `src/lib/quotation-convert.ts`
- Payment fulfill (consultation): `src/lib/consultation-payment.ts`
- Bespoke payment helpers: `src/lib/bespoke-order-payment.ts` (if present â€” verified in Section 3)
- Email templates: `src/lib/email-templates/bespoke-stages.ts`, dispatch `src/lib/bespoke-email.ts`
- Client notifications: `src/lib/customer-notifications.ts` (`notifyClientBespokeStageComplete` â†’ type `ATELIER_STAGE_ADVANCED`)

---

## Section 2 â€” Stage-by-stage audit

**Shared transition mechanism:** Completing the *current* stage is exclusively via `POST /api/bespoke/[orderId]/complete-stage` (`complete-stage/route.ts:13-131`). It always completes `order.currentStage` then sets `currentStage` to `getNextStage(...)` (`complete-stage/route.ts:40-70`). `PATCH /api/bespoke/[orderId]` does **not** accept a stage field (`route.ts:82-99`).

**Notification pattern on stage *exit* (not entry):** On complete, email uses template subjects/intros keyed by the stage being completed (`email-templates/bespoke-stages.ts:16-59`), dispatched from `complete-stage/route.ts:85-86` via `sendBespokeStageEmail`. In-app: `notifyClientBespokeStageComplete` â†’ `ATELIER_STAGE_ADVANCED` (`customer-notifications.ts:64-85`, dispatched `complete-stage/route.ts:112-119`).

**Important:** Completing stage N advances `currentStage` to stage N+1 and notifies about stage N completion. There is no separate â€œon entryâ€ notifier for the new stage.
### Stage 1 — CONSULTATION_BOOKING (1. Consultation Booking)

| Check | Verdict | Evidence | Notes |
|---|---|---|---|
| Transition INTO this stage exists (route/action) | BUILT | `quotation-convert.ts:121-139`; schema default `schema.prisma:1361` | Order created with `currentStage` default `CONSULTATION_BOOKING`. No separate stage-entry route. |
| Server-side guard that previous stage is complete | N/A | `bespoke-stages.ts:76-78` | First stage; `getPreviousStage` returns null. |
| Role/permission check on the transition | BUILT | `complete-stage/route.ts:14-15`; `api-auth.ts:57` | Exit via complete-stage requires `BESPOKE_ROLES`. Create/convert uses admin/quote paths. |
| Staff assignment required/recorded | PARTIAL | `assign-staff/route.ts:22-40`; `schema.prisma:1416-1432` | Assignment optional (`stage` nullable); not required to exit stage. |
| Media upload required to exit stage | MISSING | `complete-stage/route.ts:25-31` | Only `notes` required; `images`/`videos` default to `[]`. |
| Client notified on entry (in-app bell) | MISSING | `complete-stage/route.ts:112-119`; `customer-notifications.ts:64-85` | Notifications fire on stage *completion*, not on entry into stage 1. |
| Client notified on entry (email template) | MISSING | `email-templates/bespoke-stages.ts:17`; `complete-stage/route.ts:85-86` | Email for this stage subject fires when this stage is *completed*, not on entry. Template id: `STAGE_SUBJECTS.CONSULTATION_BOOKING`. |
| Timestamp persisted for the transition | BUILT | `schema.prisma:1411`; `complete-stage/route.ts:52-62` | `StageUpdate.completedAt` default `now()` on exit. Entry time = `BespokeOrder.createdAt` (`schema.prisma:1388`). |
| Audit trail: who performed the transition | BUILT | `complete-stage/route.ts:59-60,95-104` | `completedBy` / `completedByName` + `logActivity` `STAGE_COMPLETE`. |
| Reversible / can stage be rolled back, and by whom | MISSING | `complete-stage/route.ts:64-70`; `bespoke/[orderId]/route.ts:82-99` | No rollback API; PATCH cannot set `currentStage`. |

### Stage 2 — CONSULTATION_SESSION (2. Consultation Session)

| Check | Verdict | Evidence | Notes |
|---|---|---|---|
| Transition INTO this stage exists (route/action) | BUILT | `complete-stage/route.ts:64-69`; `bespoke-stages.ts:67-69` | Entered when stage 1 is completed via `getNextStage`. |
| Server-side guard that previous stage is complete | PARTIAL | `complete-stage/route.ts:41-49` | Checks previous in `stageHistory` only if `stageHistory.length > 0`; empty history skips guard. |
| Role/permission check on the transition | BUILT | `complete-stage/route.ts:14-15`; `api-auth.ts:57` | `BESPOKE_ROLES`. |
| Staff assignment required/recorded | PARTIAL | `assign-staff/route.ts:22-40` | Optional; not gated on complete. |
| Media upload required to exit stage | MISSING | `complete-stage/route.ts:25-31` | Notes only. |
| Client notified on entry (in-app bell) | PARTIAL | `customer-notifications.ts:64-85` | In-app fires when *prior* stage completed (message: stage complete), which coincides with entry into this stage. Type: `ATELIER_STAGE_ADVANCED`. |
| Client notified on entry (email template) | PARTIAL | `email-templates/bespoke-stages.ts:18`; `complete-stage/route.ts:85-86` | Email for stage 1 completion is what the client receives when entering stage 2. No dedicated stage-2-entry email. |
| Timestamp persisted for the transition | BUILT | `schema.prisma:1411`; `complete-stage/route.ts:52-62` | Via prior stage's `StageUpdate.completedAt`. |
| Audit trail: who performed the transition | BUILT | `complete-stage/route.ts:59-60,95-104` | On exit of prior / this stage. |
| Reversible / can stage be rolled back, and by whom | MISSING | `bespoke/[orderId]/route.ts:82-99` | No stage rollback. |

### Stage 3 — INVOICE_ISSUANCE (3. Invoice Issuance)

| Check | Verdict | Evidence | Notes |
|---|---|---|---|
| Transition INTO this stage exists (route/action) | BUILT | `complete-stage/route.ts:64-69` | Via completing stage 2. |
| Server-side guard that previous stage is complete | PARTIAL | `complete-stage/route.ts:41-49` | Same empty-history bypass. |
| Role/permission check on the transition | BUILT | `complete-stage/route.ts:14-15` | `BESPOKE_ROLES`. |
| Staff assignment required/recorded | PARTIAL | `assign-staff/route.ts:22-40` | Optional. |
| Media upload required to exit stage | MISSING | `complete-stage/route.ts:25-31` | Notes only. |
| Client notified on entry (in-app bell) | PARTIAL | `customer-notifications.ts:64-85` | Via prior stage completion notify. |
| Client notified on entry (email template) | PARTIAL | `email-templates/bespoke-stages.ts:19` | Stage-2 completion email; template subject `CONSULTATION_SESSION`. Separate quote email is `quotations/[id]/send/route.ts:120-158`. |
| Timestamp persisted for the transition | BUILT | `schema.prisma:1411` | `StageUpdate.completedAt`. |
| Audit trail: who performed the transition | BUILT | `complete-stage/route.ts:95-104` | `logActivity`. |
| Reversible / can stage be rolled back, and by whom | MISSING | `bespoke/[orderId]/route.ts:82-99` | No rollback. |

### Stage 4 — PAYMENT_CONFIRMATION (4. Payment Confirmation)

| Check | Verdict | Evidence | Notes |
|---|---|---|---|
| Transition INTO this stage exists (route/action) | BUILT | `complete-stage/route.ts:64-69` | Via completing stage 3. |
| Server-side guard that previous stage is complete | PARTIAL | `complete-stage/route.ts:41-49` | Empty-history bypass. |
| Role/permission check on the transition | BUILT | `complete-stage/route.ts:14-15` | `BESPOKE_ROLES` for complete-stage. Payment confirm uses finance/admin routes. |
| Staff assignment required/recorded | PARTIAL | `assign-staff/route.ts:22-40` | Optional. |
| Media upload required to exit stage | MISSING | `complete-stage/route.ts:25-31` | Notes only. |
| Client notified on entry (in-app bell) | PARTIAL | `customer-notifications.ts:64-85` | Prior-stage completion notify. |
| Client notified on entry (email template) | PARTIAL | `email-templates/bespoke-stages.ts:20` | On completing this stage: subject `PAYMENT_CONFIRMATION`. Payment confirm emails also from payment confirm path. |
| Timestamp persisted for the transition | BUILT | `schema.prisma:1411` | `StageUpdate`. |
| Audit trail: who performed the transition | BUILT | `complete-stage/route.ts:59-60,95-104` | On complete-stage. |
| Reversible / can stage be rolled back, and by whom | MISSING | `bespoke/[orderId]/route.ts:82-99` | No rollback. **Additional path:** `bespoke-order-payment.ts:32-45` jumps `PAYMENT_CONFIRMATION` → `SKETCHING_CONCEPT` when `balance <= 0` without creating a `StageUpdate` for stage 4. |

### Stage 5 — SKETCHING_CONCEPT (5. Sketching & Concept)

| Check | Verdict | Evidence | Notes |
|---|---|---|---|
| Transition INTO this stage exists (route/action) | BUILT | `complete-stage/route.ts:64-69`; `bespoke-order-payment.ts:32-45` | Via complete-stage from 4, or payment-fulfill jump when fully paid at stage 4. |
| Server-side guard that previous stage is complete | PARTIAL | `complete-stage/route.ts:41-49`; `bespoke-order-payment.ts:32-45` | Payment jump skips `StageUpdate` for stage 4; subsequent guard may be bypassed when history empty or incomplete. |
| Role/permission check on the transition | BUILT | `complete-stage/route.ts:14-15` | For staff complete. Payment path authenticated separately. |
| Staff assignment required/recorded | PARTIAL | `assign-staff/route.ts:22-40` | Optional. |
| Media upload required to exit stage | MISSING | `complete-stage/route.ts:25-31`; `BespokeOrderDetailClient.tsx:114-117,393-437` | UI allows upload; server does not require non-empty `images`/`videos`. |
| Client notified on entry (in-app bell) | PARTIAL | `customer-notifications.ts:64-85` | On prior stage complete only. |
| Client notified on entry (email template) | PARTIAL | `email-templates/bespoke-stages.ts:21` | Email on *exit* of this stage (subject `SKETCHING_CONCEPT`). |
| Timestamp persisted for the transition | BUILT | `schema.prisma:1411` | On exit via `StageUpdate`. |
| Audit trail: who performed the transition | BUILT | `complete-stage/route.ts:59-60,95-104` | On exit. |
| Reversible / can stage be rolled back, and by whom | MISSING | `bespoke/[orderId]/route.ts:82-99` | No rollback. |

### Stage 6 — FABRIC_SOURCING (6. Fabric Sourcing)

| Check | Verdict | Evidence | Notes |
|---|---|---|---|
| Transition INTO this stage exists (route/action) | BUILT | `complete-stage/route.ts:64-69` | Via completing stage 5. |
| Server-side guard that previous stage is complete | PARTIAL | `complete-stage/route.ts:41-49` | Empty-history bypass. |
| Role/permission check on the transition | BUILT | `complete-stage/route.ts:14-15` | `BESPOKE_ROLES`. |
| Staff assignment required/recorded | PARTIAL | `assign-staff/route.ts:22-40` | Optional. |
| Media upload required to exit stage | MISSING | `complete-stage/route.ts:25-31` | Not enforced server-side. |
| Client notified on entry (in-app bell) | PARTIAL | `customer-notifications.ts:64-85` | Prior complete. |
| Client notified on entry (email template) | PARTIAL | `email-templates/bespoke-stages.ts:22` | On exit: `FABRIC_SOURCING`. |
| Timestamp persisted for the transition | BUILT | `schema.prisma:1411` | `StageUpdate.completedAt`. |
| Audit trail: who performed the transition | BUILT | `complete-stage/route.ts:59-60,95-104` | Yes. |
| Reversible / can stage be rolled back, and by whom | MISSING | `bespoke/[orderId]/route.ts:82-99` | No rollback. |

### Stage 7 — DESIGN_APPROVAL (7. Design Approval)

| Check | Verdict | Evidence | Notes |
|---|---|---|---|
| Transition INTO this stage exists (route/action) | BUILT | `complete-stage/route.ts:64-69` | Via completing stage 6. |
| Server-side guard that previous stage is complete | PARTIAL | `complete-stage/route.ts:41-49` | Empty-history bypass. |
| Role/permission check on the transition | BUILT | `complete-stage/route.ts:14-15` | Staff can complete without client approval. |
| Staff assignment required/recorded | PARTIAL | `assign-staff/route.ts:22-40` | Optional. |
| Media upload required to exit stage | MISSING | `complete-stage/route.ts:25-31` | Not enforced. |
| Client notified on entry (in-app bell) | PARTIAL | `customer-notifications.ts:64-85` | Prior complete notify; no dedicated approval-required type. |
| Client notified on entry (email template) | PARTIAL | `email-templates/bespoke-stages.ts:23,45-46` | Intro asks client to confirm; **no approve endpoint**. Dispatched on *exit* of this stage by staff. |
| Timestamp persisted for the transition | BUILT | `schema.prisma:1411` | On staff exit. |
| Audit trail: who performed the transition | BUILT | `complete-stage/route.ts:59-60` | Staff `completedBy` only — no client approval actor. |
| Reversible / can stage be rolled back, and by whom | MISSING | `bespoke/[orderId]/route.ts:82-99` | No rollback. **Client approval gate: MISSING** (see §3.2). |

### Stage 8 — TAILORING (8. Tailoring / Construction)

| Check | Verdict | Evidence | Notes |
|---|---|---|---|
| Transition INTO this stage exists (route/action) | BUILT | `complete-stage/route.ts:64-69` | Staff completing stage 7 advances here with no client gate. |
| Server-side guard that previous stage is complete | PARTIAL | `complete-stage/route.ts:41-49` | No client-approval check. |
| Role/permission check on the transition | BUILT | `complete-stage/route.ts:14-15` | `BESPOKE_ROLES`. |
| Staff assignment required/recorded | PARTIAL | `assign-staff/route.ts:22-40` | Optional. |
| Media upload required to exit stage | MISSING | `complete-stage/route.ts:25-31` | Not enforced. |
| Client notified on entry (in-app bell) | PARTIAL | `customer-notifications.ts:64-85` | Prior complete. |
| Client notified on entry (email template) | PARTIAL | `email-templates/bespoke-stages.ts:24` | On exit: `TAILORING`. |
| Timestamp persisted for the transition | BUILT | `schema.prisma:1411` | Yes. |
| Audit trail: who performed the transition | BUILT | `complete-stage/route.ts:59-60,95-104` | Yes. |
| Reversible / can stage be rolled back, and by whom | MISSING | `bespoke/[orderId]/route.ts:82-99` | No rollback. |

### Stage 9 — FIRST_FITTING (9. First Fitting)

| Check | Verdict | Evidence | Notes |
|---|---|---|---|
| Transition INTO this stage exists (route/action) | BUILT | `complete-stage/route.ts:64-69` | Via completing stage 8. |
| Server-side guard that previous stage is complete | PARTIAL | `complete-stage/route.ts:41-49` | Empty-history bypass. |
| Role/permission check on the transition | BUILT | `complete-stage/route.ts:14-15` | `BESPOKE_ROLES`. |
| Staff assignment required/recorded | PARTIAL | `assign-staff/route.ts:22-40` | Optional. |
| Media upload required to exit stage | MISSING | `complete-stage/route.ts:25-31` | Not enforced. |
| Client notified on entry (in-app bell) | PARTIAL | `customer-notifications.ts:64-85` | Prior complete. |
| Client notified on entry (email template) | PARTIAL | `email-templates/bespoke-stages.ts:25` | On exit: `FIRST_FITTING`. |
| Timestamp persisted for the transition | BUILT | `schema.prisma:1411` | Yes. |
| Audit trail: who performed the transition | BUILT | `complete-stage/route.ts:59-60,95-104` | Yes. |
| Reversible / can stage be rolled back, and by whom | MISSING | `bespoke/[orderId]/route.ts:82-99` | No rollback. |

### Stage 10 — ALTERATIONS (10. Alterations)

| Check | Verdict | Evidence | Notes |
|---|---|---|---|
| Transition INTO this stage exists (route/action) | BUILT | `complete-stage/route.ts:64-69` | Via completing stage 9. |
| Server-side guard that previous stage is complete | PARTIAL | `complete-stage/route.ts:41-49` | Empty-history bypass. |
| Role/permission check on the transition | BUILT | `complete-stage/route.ts:14-15` | `BESPOKE_ROLES`. |
| Staff assignment required/recorded | PARTIAL | `assign-staff/route.ts:22-40` | Optional. |
| Media upload required to exit stage | MISSING | `complete-stage/route.ts:25-31` | Not enforced. |
| Client notified on entry (in-app bell) | PARTIAL | `customer-notifications.ts:64-85` | Prior complete. |
| Client notified on entry (email template) | PARTIAL | `email-templates/bespoke-stages.ts:26` | On exit: `ALTERATIONS`. |
| Timestamp persisted for the transition | BUILT | `schema.prisma:1411` | Yes. |
| Audit trail: who performed the transition | BUILT | `complete-stage/route.ts:59-60,95-104` | Yes. |
| Reversible / can stage be rolled back, and by whom | MISSING | `bespoke/[orderId]/route.ts:82-99` | No rollback. **Note:** this is pipeline stage 10 only — not a post-delivery alteration request flow (see §3.6). |

### Stage 11 — BEADING_FINISHING (11. Beading & Finishing)

| Check | Verdict | Evidence | Notes |
|---|---|---|---|
| Transition INTO this stage exists (route/action) | BUILT | `complete-stage/route.ts:64-69` | Via completing stage 10. |
| Server-side guard that previous stage is complete | PARTIAL | `complete-stage/route.ts:41-49` | Empty-history bypass. |
| Role/permission check on the transition | BUILT | `complete-stage/route.ts:14-15` | `BESPOKE_ROLES`. |
| Staff assignment required/recorded | PARTIAL | `assign-staff/route.ts:22-40` | Optional. |
| Media upload required to exit stage | MISSING | `complete-stage/route.ts:25-31` | Not enforced. |
| Client notified on entry (in-app bell) | PARTIAL | `customer-notifications.ts:64-85` | Prior complete. |
| Client notified on entry (email template) | PARTIAL | `email-templates/bespoke-stages.ts:27` | On exit: `BEADING_FINISHING`. |
| Timestamp persisted for the transition | BUILT | `schema.prisma:1411` | Yes. |
| Audit trail: who performed the transition | BUILT | `complete-stage/route.ts:59-60,95-104` | Yes. |
| Reversible / can stage be rolled back, and by whom | MISSING | `bespoke/[orderId]/route.ts:82-99` | No rollback. |

### Stage 12 — FINAL_FITTING (12. Final Fitting)

| Check | Verdict | Evidence | Notes |
|---|---|---|---|
| Transition INTO this stage exists (route/action) | BUILT | `complete-stage/route.ts:64-69` | Via completing stage 11. |
| Server-side guard that previous stage is complete | PARTIAL | `complete-stage/route.ts:41-49` | Empty-history bypass. |
| Role/permission check on the transition | BUILT | `complete-stage/route.ts:14-15` | Staff completes without client approval. |
| Staff assignment required/recorded | PARTIAL | `assign-staff/route.ts:22-40` | Optional. |
| Media upload required to exit stage | MISSING | `complete-stage/route.ts:25-31` | Not enforced. |
| Client notified on entry (in-app bell) | PARTIAL | `customer-notifications.ts:64-85` | Prior complete; no approval-required type. |
| Client notified on entry (email template) | PARTIAL | `email-templates/bespoke-stages.ts:28,55-56` | Copy assumes fitting approved; no client approve endpoint. Dispatched on staff exit. |
| Timestamp persisted for the transition | BUILT | `schema.prisma:1411` | On staff exit. |
| Audit trail: who performed the transition | BUILT | `complete-stage/route.ts:59-60` | Staff only. |
| Reversible / can stage be rolled back, and by whom | MISSING | `bespoke/[orderId]/route.ts:82-99` | No rollback. **Client approval gate: MISSING** (see §3.2). |

### Stage 13 — DELIVERY (13. Delivery / Collection)

| Check | Verdict | Evidence | Notes |
|---|---|---|---|
| Transition INTO this stage exists (route/action) | BUILT | `complete-stage/route.ts:64-69` | Via completing stage 12; **no balance check**. |
| Server-side guard that previous stage is complete | PARTIAL | `complete-stage/route.ts:41-49` | Empty-history bypass; no client final-fitting approval. |
| Role/permission check on the transition | BUILT | `complete-stage/route.ts:14-15` | `BESPOKE_ROLES`. |
| Staff assignment required/recorded | PARTIAL | `assign-staff/route.ts:22-40` | Optional. |
| Media upload required to exit stage | MISSING | `complete-stage/route.ts:25-31` | Delivery photo not required. Completing stage 13 sets `status: DELIVERED` when `getNextStage` is null (`complete-stage/route.ts:64-70`). |
| Client notified on entry (in-app bell) | PARTIAL | `customer-notifications.ts:64-85` | Prior complete. On exit of DELIVERY: same `ATELIER_STAGE_ADVANCED`. `notifyOrderDelivered` is RTW-only (`customer-notifications.ts:260-273`). |
| Client notified on entry (email template) | PARTIAL | `email-templates/bespoke-stages.ts:29,57-58` | On completing DELIVERY: subject `DELIVERY` / \"Your outfit is ready\". |
| Timestamp persisted for the transition | BUILT | `schema.prisma:1411`; `complete-stage/route.ts:52-62` | `StageUpdate.completedAt`. |
| Audit trail: who performed the transition | BUILT | `complete-stage/route.ts:59-60,95-104` | Yes. |
| Reversible / can stage be rolled back, and by whom | MISSING | `bespoke/[orderId]/route.ts:82-99` | No rollback. Balance block on delivery: **MISSING** (`complete-stage/route.ts` has no `balance` reference). |


## Section 3 — Cross-cutting rules

### 3.1 Sequential integrity

| Check | Verdict | Evidence | Notes |
|---|---|---|---|
| Can order jump stage 3 → 9 via API? | PARTIAL | `complete-stage/route.ts:40-70`; `bespoke/[orderId]/route.ts:82-99` | `complete-stage` only advances one step via `getNextStage`. PATCH does not accept `currentStage`. **However** `fulfillBespokeOrderBalance` (`bespoke-order-payment.ts:32-45`) can set `currentStage` to `SKETCHING_CONCEPT` from `PAYMENT_CONFIRMATION` without a `StageUpdate`. Filter query uses `stage as BespokeStage` (`bespoke/route.ts:25`) for listing only — not a write. |
| Can order move backwards? | MISSING | `complete-stage/route.ts:64-70`; `bespoke/[orderId]/route.ts:82-99` | No rollback / previous-stage write path found. |
| Single source of truth for legal transitions? | PARTIAL | `bespoke-stages.ts:2-17,67-78` | `STAGE_ORDER` + `getNextStage`/`getPreviousStage` is the map used by complete-stage. Payment fulfill bypasses it with a hardcoded jump (`bespoke-order-payment.ts:32-35`). Logic not a full state machine; scattered. |
| Unguarded arbitrary stage transition endpoint? | BUILT (absent) | `bespoke/[orderId]/route.ts:82-99` | PATCH does not accept arbitrary stage. Complete-stage does not accept a target stage body field (`complete-stage/route.ts:18`). |

### 3.2 Client approval gates

| Check | Verdict | Evidence | Notes |
|---|---|---|---|
| Stage 7 client approve/reject action | MISSING | Grep for client design-approve routes/UI under `src/app/api` and `src/app/(account)`: no matches. | Email copy asks to confirm (`email-templates/bespoke-stages.ts:45-46`) only. |
| Server refuses advance past stage 7 without approval | MISSING | `complete-stage/route.ts:40-70` | No approval field check. Staff completing `DESIGN_APPROVAL` advances to `TAILORING`. |
| Stage 12 client approve/reject action | MISSING | Same — no approve API/page for final fitting. | Email assumes approved (`email-templates/bespoke-stages.ts:55-56`). |
| Server refuses advance past stage 12 without approval | MISSING | `complete-stage/route.ts:40-70` | Staff can advance to `DELIVERY`. |
| Where approval persisted | MISSING | `schema.prisma:1344-1414` | No client-approval field on `BespokeOrder` or `StageUpdate`. |
| Client notified when approval required + reminded | MISSING | `customer-notifications.ts` | No approval-required notification type; no approval reminder cron. |

### 3.3 Media requirements

| Stage | Server-enforced? | UI-only? | Evidence |
|---|---|---|---|
| 5 `SKETCHING_CONCEPT` | MISSING | PARTIAL (optional upload UI) | `complete-stage/route.ts:25-31`; `BespokeOrderDetailClient.tsx:91-117,414-437` |
| 6 `FABRIC_SOURCING` | MISSING | PARTIAL | Same paths |
| 7 `DESIGN_APPROVAL` | MISSING | PARTIAL | Same paths |
| 8 `TAILORING` | MISSING | PARTIAL | Same paths |
| 11 `BEADING_FINISHING` | MISSING | PARTIAL | Same paths |

Media linkage: **per-stage** via `StageUpdate.images` / `videos` (`schema.prisma:1402-1405`). Per-stage requirement *could* be enforced on that record; currently is not.

Cloudinary upload path:
- Auth: `admin/upload/route.ts:17-18` via `requireAdminApi`.
- Type/size: images JPEG/PNG/WebP max 5MB; video max 50MB (`admin/upload/route.ts:6-7,44-59`).
- Upload used by stage UI: `BespokeOrderDetailClient.tsx` → `/api/admin/upload`.

### 3.4 Payment coupling

| Check | Verdict | Evidence | Notes |
|---|---|---|---|
| Delivery blocked when `balance > 0` | MISSING | `complete-stage/route.ts` (no `balance` reference) | Staff can complete through `DELIVERY` with unpaid balance. Balance reminders exist separately: `cron/balance-reminders/route.ts`. |
| 70/30 deposit threshold computed where? | PARTIAL | Client pay UI: `BespokePayClient.tsx:23,125-127` (`order.balance * 0.7`). Invoice form preset: `InvoiceFormPage.tsx:18-26,465`. Quote convert: `quotation-convert.ts:80` uses `depositPercent: 50`. | Not a single server rule. |
| Which stage requires deposit confirmed? | PARTIAL | `bespoke-order-payment.ts:32-35` | Full pay (`newBalance <= 0`) at `PAYMENT_CONFIRMATION` auto-advances to `SKETCHING_CONCEPT`. Partial deposit does not auto-advance. No check that 70% is paid before stage 5 via complete-stage. |
| Payment confirmations authoritative vs manual | BUILT (both paths) | Gateway verify: `bespoke/[orderId]/verify-payment`; bank transfer admin confirm: `admin/payments/[id]/confirm/route.ts` → `fulfillBespokeOrderBalance`. Invoice mark-paid: `admin/invoices/[id]/mark-paid/route.ts:16-99` (manual staff; does **not** create/advance `BespokeOrder`). | |

### 3.5 Quotation lifecycle

| Check | Verdict | Evidence | Notes |
|---|---|---|---|
| Quote expiry field set | BUILT | `schema.prisma:1559`; form + create in quotations API | `expiresAt` on model. |
| Expired quote rejected at accept | BUILT | `quotations/[id]/approve/route.ts:39-41` | Returns 400 `Quotation has expired`. |
| Quote versioning / prior retained | MISSING | `schema.prisma:1540-1576` | No version/parent fields; no revise flow. |
| Client approve from `/account` | PARTIAL | `notifyQuoteReady` links to `/quote/{token}` (`customer-notifications.ts:168-185`). `AccountDashboard` has no quotation approve UI (no matches). Approve API: `quotations/[id]/approve/route.ts`. | Portal notification → public quote page, not in-dashboard approve. |
| Acceptance creates/advances atelier order | PARTIAL | `approve/route.ts:58` → `maybeAutoConvertApprovedQuote` (`quotation-convert.ts:158-172`) only if setting `auto_convert_approved_quotes` === `true`. Manual: `quotations/[id]/convert`. | Convert creates `BespokeOrder` + draft `Invoice` (`quotation-convert.ts:93-147`). Default `currentStage` = `CONSULTATION_BOOKING`. Invoice **not** FK-linked to quotation. |
| Consultation → Quotation → Order chain | BUILT (manual hops) | Create quote from consultation: `AdminConsultationDetail` button → `quotations/new?consultationId=`. `Quotation.consultationId` set. Convert copies consultation fields onto order (`quotation-convert.ts:125-135`). | Quote creation and convert are admin/manual (or auto-convert setting). |

### 3.6 Post-delivery

| Check | Verdict | Evidence | Notes |
|---|---|---|---|
| Alteration request flow (model/route/UI) | MISSING | `ALTERATIONS` is stage enum only (`schema.prisma:1214`). No post-delivery alteration model/API. | |
| Terminal state | BUILT | `complete-stage/route.ts:64-70` | Last stage complete → `status: OrderStatus.DELIVERED`. |
| Editable after terminal? | PARTIAL | `bespoke/[orderId]/route.ts:82-99` | PATCH still updates client/payment/material fields with no DELIVERED guard. DELETE still allowed (`route.ts:112-122`). No archive flag. |
| Confirm receipt | MISSING | No confirm-receipt route/UI found. | |
| Bespoke review request after delivery | MISSING | `cron/review-requests/route.ts:23` filters `isBespoke: false`. | |

### 3.7 Scheduling

| Check | Verdict | Evidence | Notes |
|---|---|---|---|
| Double-booking prevention on consultation create | BUILT | `consultations/create/route.ts:106-108`; `consultation.ts:104-168` | `getAvailableSlots` excludes overlap with `CONFIRMED` / `PENDING_CONFIRMATION` bookings for consultant/day; create returns 409 if slot missing. Does not include `PENDING_PAYMENT` in busy set (`consultation.ts:149`). |

### 3.8 Data integrity

| Check | Verdict | Evidence | Notes |
|---|---|---|---|
| Consultation detail Date serialization | BUILT | `admin/consultations/[id]/page.tsx:8-13,58-79` | Explicit `toIso()` before passing to `AdminConsultationDetail` client. Fix present on HEAD. |
| Bespoke order detail Date serialization | PARTIAL | `admin/bespoke/[orderId]/page.tsx:38-48` passes Prisma `order` (Date fields) directly to `BespokeOrderDetailClient`. `formatDate` accepts `Date \| string` (`utils.ts:16-18`). | No explicit ISO map like consultation page. Relies on RSC flight serialization. |
| `as` casts on stage/status | PARTIAL | `bespoke/route.ts:25-26`: `stage as BespokeStage`, `status as OrderStatus` on query filters (read). Consultation page: `status as ConsultationStatus` (`consultations/[id]/page.tsx:50`). | Filter casts are unchecked against enum. |

---

## Section 4 — Gap register

| # | Gap | Severity | Blast radius | Files to touch | Est. complexity |
|---|---|---|---|---|---|
| 1 | No client approval gate for stage 7 (`DESIGN_APPROVAL`) before stage 8 | CRITICAL | Construction can start without recorded client sign-off | `complete-stage/route.ts`, schema, account UI, notifications | L |
| 2 | No client approval gate for stage 12 (`FINAL_FITTING`) before stage 13 | CRITICAL | Delivery can proceed without final fitting sign-off | same as #1 | L |
| 3 | Delivery (stage 13) not blocked when `BespokeOrder.balance > 0` | CRITICAL | Unpaid commissions can be marked delivered | `complete-stage/route.ts` | S |
| 4 | Media not required server-side for stages 5/6/7/8/11 (and delivery photo) | HIGH | Stage exits without proof media | `complete-stage/route.ts`, possibly UI | M |
| 5 | Sequential guard bypass when `stageHistory.length === 0`; payment jump skips `StageUpdate` | HIGH | Stage history / sequential integrity can be inconsistent | `complete-stage/route.ts`, `bespoke-order-payment.ts` | M |
| 6 | Invoice mark-paid does not create or advance `BespokeOrder` | HIGH | Paying invoice alone does not drive atelier pipeline | `mark-paid/route.ts`, convert/payment coupling | M |
| 7 | Quote convert uses 50% deposit; 70/30 only in client pay UI / invoice form preset | HIGH | Deposit terms inconsistent across quote→invoice→pay | `quotation-convert.ts`, invoice defaults, `BespokePayClient.tsx` | M |
| 8 | No `Payment` ledger model; bespoke receipt fields overwritten | HIGH | Cannot audit full payment history per atelier order | schema + payment routes + admin UI | L |
| 9 | Invoice not FK-linked to Quotation (and convert omits `consultationId` on invoice) | HIGH | Broken quote→invoice lineage for reporting | `schema.prisma`, `quotation-convert.ts` | M |
| 10 | Quotation `pdfUrl` stores approval URL, not a PDF | MEDIUM | No branded quotation PDF deliverable | send route + new PDF renderer | L |
| 11 | No quotation versioning | MEDIUM | Revisions overwrite/lose prior commercial terms | schema + quote flows | L |
| 12 | No post-delivery confirm-receipt / alteration / bespoke review | MEDIUM | Post-delivery client loop absent | new models/routes + cron | L |
| 13 | Staff assignment not required per stage | MEDIUM | Stages can complete with no assignee | `complete-stage` + assign-staff | M |
| 14 | No stage rollback; DELETE order still allowed after DELIVERED | MEDIUM | Ops cannot correct mistakes safely; delivered orders deletable | bespoke order routes | M |
| 15 | Notifications/emails fire on stage *exit*, not entry; no approval-required reminders | MEDIUM | Client messaging timing/semantics mismatch with pipeline rules | notify + email templates + cron | M |
| 16 | `PENDING_PAYMENT` bookings excluded from slot busy set | LOW | Slot can be held by unpaid booking without blocking availability until confirmed statuses | `consultation.ts:146-154` | S |
| 17 | Bespoke admin detail passes unsanitized Date props (unlike consultation `toIso`) | LOW | Potential RSC serialization edge cases | `admin/bespoke/[orderId]/page.tsx` | S |
| 18 | NO_SHOW missing from admin consultation status dropdown (schema/API support it) | LOW | Admins cannot mark no-show via UI | `AdminConsultationDetail.tsx` | S |

---

## Section 5 — Open questions

1. Should `fulfillBespokeOrderBalance` writing `currentStage: SKETCHING_CONCEPT` also insert a `StageUpdate` for `PAYMENT_CONFIRMATION`?
2. Is production meant to start at stage 5 only after ≥70% deposit, or only after full payment (current auto-advance requires `balance <= 0`)?
3. Should invoice `mark-paid` advance or create a `BespokeOrder`, or is quote-convert the sole creation path by design?
4. For stages 7 and 12, is email copy alone intentional, or must a recorded client approval exist before staff can complete those stages?
5. Should completing stage 13 require `balance === 0` even if admin overrides?
6. Is `docs/` (this file) the canonical audit location vs existing `doc/` folder?
7. Should `PENDING_PAYMENT` consultation bookings block calendar slots?
8. After `DELIVERED`, should PATCH/DELETE on `BespokeOrder` be forbidden?
9. Is there an intended archive flag for delivered commissions beyond `OrderStatus.DELIVERED`?
10. Should quotation auto-convert (`auto_convert_approved_quotes`) default on or off in production?

---

## Audit metadata

- Application code modified: **none**
- Only file created: `docs/PIPELINE_AUDIT.md`
- `"use server"` stage actions found: **0**
- Dedicated `Payment` model: **absent**
- Stage transition write paths found: `POST .../complete-stage`, `fulfillBespokeOrderBalance` (payment jump)


