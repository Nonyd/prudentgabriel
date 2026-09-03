# Notifications Audit

**Repo:** `github.com/Nonyd/prudentgabriel` → `prudential-atelier/`  
**Mode:** READ-ONLY  
**Audit date:** 2026-09-03  
**Branch:** `staging`  
**Scope root:** `prudential-atelier/`

Verdict vocabulary: `BUILT` | `PARTIAL` | `MISSING` | `UNCLEAR`

Known state, confirmed in this pass:

- `AdminNotification` and `CustomerNotification` feed a top-bar bell on a 60-second poll (`prudential-atelier/src/components/admin/NotificationBell.tsx:87-90`, `prudential-atelier/src/components/account/CustomerNotificationBell.tsx:84-87`). Staff has a third table and the same poll (`prudential-atelier/src/components/staff/StaffNotificationBell.tsx:71-74`).
- Email is separate, through the Slice E outbox (`prudential-atelier/src/lib/email.tsx:52-68` → `prudential-atelier/src/lib/email-outbox.ts:59-124`) with retryable and terminal handling (`prudential-atelier/src/lib/email-outbox.ts:285-312`).
- `/admin/notifications` exists (`prudential-atelier/src/app/(admin)/admin/notifications/page.tsx:5-16`) and has no sidebar nav row (`prudential-atelier/src/lib/admin-route-access.ts:285`, nav sections at `prudential-atelier/src/lib/admin-route-access.ts:430-467`).

---

## 1. The inventory

Three Prisma models: `AdminNotification` (`prudential-atelier/prisma/schema.prisma:1183-1194`), `CustomerNotification` (`:1196-1209`), `StaffNotification` (`:1211-1224`). Enums: `AdminNotificationType` (`:1263-1281`), `CustomerNotificationType` (`:1283-1305`), `StaffNotificationType` (`:1307-1317`).

Admin rows have **no `userId`**. Customer and staff rows are per `userId`.

Creates go through:

- Admin: `createNotification` (`prudential-atelier/src/lib/notifications.ts:18-34`) and `createAdminNotification` (`prudential-atelier/src/lib/notify.ts:14-34`). The second accepts `targetRoles` and then discards it (`prudential-atelier/src/lib/notify.ts:32-33`).
- Customer: `createCustomerNotification` / `createClientNotification` (`prudential-atelier/src/lib/customer-notifications.ts:32-62`).
- Staff: `createStaffNotification` (`prudential-atelier/src/lib/staff-notifications.ts:5-23`).

Most admin inserts are fire-and-forget: `void createNotification(…).catch(() => {})` (`prudential-atelier/src/lib/notifications.ts:41-47` and the same pattern on the other helpers).

### 1.1 Admin types

| Type | Trigger | In-app? | Email? | Who receives it | Actionable? | Verdict |
|---|---|---|---|---|---|---|
| `NEW_ORDER` | Order created (paid or not), including guest-custom copy | Yes — `notifyNewOrder` `prudential-atelier/src/lib/notifications.ts:36-48` from `prudential-atelier/src/app/api/orders/create/route.ts:647-650` | No admin email on this path. Customer order-confirmation email fires later on fulfilment (`prudential-atelier/src/lib/order-payment.ts:333-365`) | Shared admin pool (every portal role; §2) | Yes — `/admin/orders/{id}` | `BUILT` in-app. Email mismatch: admin in-app only at create. Guest custom is the same type with a title/message change (`:41-44`) |
| `NEW_ORDER` (reuse) | Bank-transfer receipt uploaded | Yes — `notifyBankTransferReceipt` `prudential-atelier/src/lib/notifications.ts:168-182` from checkout / bespoke / consult bank-transfer routes | Yes — `sendBankTransferAdminNotification` to `ORDERS_ADMIN_EMAIL` or `orders@prudentgabriel.com` (`prudential-atelier/src/lib/email.tsx:137-159`) | Shared admin pool in-app; **one mailbox** for email | Yes — caller-supplied link | `BUILT` both channels. Type reuse: same enum as paid/unpaid RTW orders |
| `NEW_BESPOKE` | Website / admin-manual bespoke request | Yes — `notifyNewBespoke` `prudential-atelier/src/lib/notifications.ts:50-58` | Yes — `sendAdminNotificationEmail` to `ADMIN_EMAIL` (`prudential-atelier/src/app/api/bespoke/route.ts:171-182`, `prudential-atelier/src/lib/email.tsx:963-980`) | Shared admin pool in-app; **one mailbox** (`ADMIN_EMAIL`) | Yes — `/admin/bespoke/{id}` | `BUILT` both. If `ADMIN_EMAIL` is unset, email is `console.log` only (`:968-971`) |
| `NEW_BESPOKE` (reuse) | Quote approved | Yes — `notifyQuoteApproved` `prudential-atelier/src/lib/notifications.ts:184-192` from `prudential-atelier/src/app/api/quotations/[id]/approve/route.ts:87` | Yes — `quote-approved-admin` to `ORDERS_EMAIL` (`orders@prudentgabriel.com`) (`:77-85`, `prudential-atelier/src/lib/email-transport.ts:4`) | Shared admin pool; **third mailbox** (`ORDERS_EMAIL`) | Yes — `/admin/quotations` (list, not the quote row) | `BUILT` both. Type reuse |
| `NEW_BESPOKE` (reuse) | Production stage completed | Yes — `notifyStageAdvanced` `prudential-atelier/src/lib/notifications.ts:194-206` from `prudential-atelier/src/lib/atelier/stage-actions.ts:279-283` | No admin email. Customer gets `sendBespokeStageEmail` / delivery email (`:231-265`) | Shared admin pool | Yes — `/admin/bespoke/{orderId}` | `PARTIAL`: in-app yes, admin email no. Type reuse hides stage-advanced inside “new bespoke” |
| `NEW_BESPOKE` (reuse) | Production unlocked (deposit satisfied) | Yes — `prudential-atelier/src/lib/payments/ledger.ts:239-245` | No | Shared admin pool | Yes — `/admin/bespoke/{id}` | `PARTIAL`: in-app only. Type reuse |
| `NEW_CONSULTATION` | Booking created (pending payment) | Yes — `notifyNewConsultation` `prudential-atelier/src/lib/notifications.ts:60-69` from `prudential-atelier/src/app/api/consultations/create/route.ts:176` | Admin email is **not** on create. It fires after payment: `sendAdminConsultationNotification` (`prudential-atelier/src/lib/consultation-payment.ts:153-162`) | Shared admin pool | Yes — `/admin/consultations/{id}` | `PARTIAL`: in-app at create; admin email after payment |
| `NEW_CONSULTATION` (reuse) | Consultation marked completed | Yes — `prudential-atelier/src/app/api/admin/consultations/[id]/session/route.ts:85-91` | Customer session-summary email (`:67-74`). No extra admin email | Shared admin pool | Yes — `/admin/consultations/{id}` | `PARTIAL`: in-app reuse of “new consultation” for a completed session |
| `CONSULTATION_BOOKED_PRUDENT` | Same create path when offering is `PHYSICAL_PRUDENT_TEAM` or `VIRTUAL_PRUDENT_TEAM` | Yes — second insert `prudential-atelier/src/lib/notifications.ts:71-82` | No extra email; the paid-path admin email is the generic consultation one | Shared admin pool (not a Mrs. Prudent-only inbox) | Yes — same consultation link | `PARTIAL`: second in-app row; still the shared pool |
| `REVIEW_PENDING` | Product / consultation review submitted | Yes — `notifyReviewPending` / `notifyReviewSubmitted` / `notifyConsultationReviewSubmitted` (`prudential-atelier/src/lib/notifications.ts:85-122`) | No | Shared admin pool | Yes — `/admin/reviews` (and `?tab=consultation`) | `PARTIAL`: in-app only |
| `TESTIMONIAL_SUBMITTED` | Account testimonial POST | Yes — `notifyTestimonialSubmitted` `prudential-atelier/src/lib/notifications.ts:124-136` | No | Shared admin pool | Yes — `/admin/reviews?tab=testimonials` | `PARTIAL`: in-app only |
| `LOW_STOCK` | Helper defined | **Never called.** `notifyLowStock` exists only at `prudential-atelier/src/lib/notifications.ts:138-146`. Setting `notify_low_stock` is seeded (`prudential-atelier/prisma/seed.ts:513`) and never read in `src/` | No email sender | n/a | n/a (would link `/admin/products`) | **Dead type.** `MISSING` |
| `PAYMENT_FAILED` | Paystack/Stripe `charge.failed` on an RTW order | Yes — `notifyPaymentFailed` `prudential-atelier/src/lib/notifications.ts:148-156` from `prudential-atelier/src/app/api/payment/paystack/webhook/route.ts:113-122` and Stripe `…/stripe/webhook/route.ts:134` | No admin email. No customer in-app. Consultation/bespoke `charge.failed` updates status only (`paystack/webhook/route.ts:125-137`) with **no** notify | Shared admin pool | Yes — `/admin/orders/{id}` | `PARTIAL`: RTW in-app only. Consult/bespoke card-fail: `MISSING` |
| `PAYMENT_FAILED` (reuse) | RTW oversell at fulfilment | Yes — `prudential-atelier/src/lib/order-payment.ts:247-256` | Yes — customer + admin `sendRtwFulfilmentRefusedEmails` (`:258-266`, `prudential-atelier/src/lib/email.tsx:263-306`) | Shared admin pool in-app; admin email to `resolveAdminAlertEmail` (`prudential-atelier/src/lib/admin-alert-email.ts:18-34`) | Yes — `/admin/orders?attention=refund-required` | `BUILT` both channels. Type reuse: oversell shares `PAYMENT_FAILED` with card-decline |
| `NEW_CUSTOMER` | `/api/auth/register` | Yes — `notifyNewCustomer` `prudential-atelier/src/lib/notifications.ts:158-166` from `prudential-atelier/src/app/api/auth/register/route.ts:89` | Customer `sendWelcomeEmail` (`:97`). No admin email. Auto-onboard (`client-onboarding.ts`) does **not** call `notifyNewCustomer` | Shared admin pool | Partial — `/admin/customers` list, not the user | `PARTIAL`: in-app for self-register only |
| `COUPON_EXPIRING` | Enum + UI filter/icon only | **Never created.** UI: `NotificationBell.tsx:40`, `NotificationsPageClient.tsx:38-53` | No | n/a | n/a | **Dead type.** `MISSING` |
| `CONTACT_FORM` | Contact POST | Yes — `prudential-atelier/src/app/api/contact/route.ts:65-70` | Yes — `contact-admin` to CMS `contact_notification_email` or `ADMIN_EMAIL` (`:36-39`, `:72-89`) | Shared admin pool; email to a fourth configurable address | Yes — `/admin/content/messages` | `BUILT` both |
| `JOB_APPLICATION` | Career apply | Yes — `notifyJobApplication` `prudential-atelier/src/lib/notifications.ts:208-220` | Yes — `sendJobApplicationAdminEmail` via `sendAdminNotificationEmail` (`prudential-atelier/src/lib/email.tsx:1327-1350`) | Shared admin pool; `ADMIN_EMAIL` | Yes — `/admin/careers/applications/{id}` | `BUILT` both |
| `STAGE_APPROVAL_RESPONSE` | Client approves or requests changes | Yes — `prudential-atelier/src/lib/atelier/stage-actions.ts:614-628` | Staff email on changes only (`sendStageChangesRequestedEmail`, `:604-611`). No admin email | Shared admin pool; assigned staff also get `ORDER_UPDATE` (`:596-602`) | Yes — `/admin/bespoke/{id}` | `PARTIAL`: in-app for both decisions; email only on changes, and only to assigned staff |
| `PRODUCTION_RELOCKED` | Deposit no longer satisfied | Yes — `prudential-atelier/src/lib/payments/ledger.ts:249-267` | No. Activity log `PRODUCTION_RELOCK` (`:254-260`) | Shared admin pool | Yes — `/admin/bespoke/{id}` | `PARTIAL`: in-app only |
| `QUOTE_AWAITING` | Cron: completed consultation, no quote, 48h | Yes — `createAdminNotification` `prudential-atelier/src/lib/cron/jobs/unsent-quote-alerts.ts:76-82` | Yes — `sendAdminNotificationEmail` (`:84-90`) plus consultant `sendEmail` if a non-customer user name-matches (`:92-117`) | Shared admin pool **and** one staff user by name match (`:11-18`) | Yes — `/admin/consultations/{id}` | `BUILT` admin both. Staff targeting is name-equality, not a role |
| `EMAIL_DEAD` | Outbox `markDead` | Yes — `prudential-atelier/src/lib/email-outbox.ts:172-178` | The original email is already `DEAD`. No second email | Shared admin pool | Yes — `/admin/system/emails` with `entityId` = message id | `BUILT` in-app after terminal email failure |
| `EMAIL_PROVIDER_AUTH` | Provider auth or config error | Yes — `alertAuth` / `alertProviderConfig` (`:181-201`), process-local dedupe via `authAlerted` Set (`:48`, `:182-183`) | No | Shared admin pool | Yes — `/admin/system/emails`; auth alert has no `entityId` | `PARTIAL`: in-app; dedupe is in-memory (resets on restart) |

Seeded admin email flags `notify_new_order`, `notify_new_bespoke`, `notify_new_consultation`, `notify_low_stock` (`prudential-atelier/prisma/seed.ts:510-513`) are **not referenced** under `prudential-atelier/src/` except that seed. Verdict: `MISSING` (flags do not gate anything).

### 1.2 Customer types

Creates skip silently when no `User` resolves (`prudential-atelier/src/lib/customer-notifications.ts:73-74` and the same `if (!userId) return` on the other helpers).

| Type | Trigger | In-app? | Email? | Who receives it | Actionable? | Verdict |
|---|---|---|---|---|---|---|
| `CONSULTATION_CONFIRMED` | Paid-and-confirmed, or admin confirm | Yes — `notifyConsultationConfirmed` (`:88-106`) from `consultation-payment.ts:164-170` and `admin/consultations/[id]/route.ts:172` | Yes — `sendConsultationConfirmedEmail` | That customer (`userId` or email lookup) | Yes — `/account/consultations` | `BUILT` both if a User exists |
| `MEETING_LINK_SENT` | Admin send-link | Yes — `notifyMeetingLinkSent` (`:108-126`) from `send-link/route.ts:72-77` | Yes — `sendConsultationMeetingLinkEmail` (`:62-70`) | That customer | Yes — `/account/consultations` | `BUILT` both |
| `ATELIER_STAGE_ADVANCED` | Stage complete | Yes — `notifyClientBespokeStageComplete` (`:64-86`) from `stage-actions.ts:285-292` | Yes — `sendBespokeStageEmail` / delivered email (`stage-actions.ts:231-265`) | That customer | Yes — `/track/{token}` | `BUILT` both |
| `MOODBOARD_READY` | Session complete with images | Yes — `notifyMoodboardReady` (`:128-146`) from `session/route.ts:76-82` | Session summary email always (`:67-74`); in-app only if images exist | That customer | Yes — `/account/consultations` | `PARTIAL`: in-app gated on images |
| `INVOICE_ISSUED` | Admin send invoice | Yes — `notifyInvoiceIssued` (`:148-166`) | Yes — `sendInvoiceEmail` | That customer (email lookup) | Yes — `/invoice/{token}` | `BUILT` both |
| `QUOTE_READY` | Admin send quotation | Yes — `notifyQuoteReady` (`:168-186`) from `quotations/[id]/send/route.ts:177-182` | Yes — `quote-sent` (`:146-154`) | That customer | Yes — `/quote/{token}` | `BUILT` both |
| `PAYMENT_CONFIRMED` | RTW fulfil / admin confirm payment | Yes — `notifyPaymentConfirmed` (`:188-207`) | Yes — order confirmation and/or `sendPaymentConfirmedEmail` | That customer | Yes — caller link | `BUILT` both when `userId` exists. Guest RTW: auto-onboard then both (`order-payment.ts:293-381`) |
| `BALANCE_REMINDER` | Cron, 14-day delivery window | Yes — `notifyBalanceReminder` (`:290-310`) from `balance-reminders.ts:87-94` | Yes — `balance-reminder` (`:70-85`) | That customer | Yes — `/track/{token}` | `BUILT` both |
| `ORDER_SHIPPED` | Admin sets `SHIPPED` | Yes — `notifyOrderShipped` (`:245-258`) from `admin/orders/[id]/route.ts:237-243` | Yes — `sendOrderShippedEmail` (`:228-236`) | That customer if `userId` | Yes — `/account/orders` | `BUILT` both for logged-in; guest is email-only |
| `ORDER_DELIVERED` | Admin sets `DELIVERED` | Yes — `notifyOrderDelivered` (`:260-273`) from `admin/orders/[id]/route.ts:246-258` | Yes — `sendRtwOrderDeliveredEmail` | Same as shipped | Yes — `/account/orders` | `BUILT` both for logged-in; guest email-only |
| `REVIEW_REQUEST` | RTW review cron; bespoke `maybeSendBespokeReviewRequest` | Yes — `notifyReviewRequest` (`:275-288`) from `review-requests.ts:57-62` and `bespoke-review.ts` | Yes — product / bespoke review emails | That customer | Yes — `/account/orders` | `PARTIAL`: consultation review cron sends email (`review-requests.ts:90-98`) and **does not** create in-app |
| `LOYALTY_TIER_UPGRADE` | Points tier change | Yes — `points.ts:132-138` | Yes — `sendLoyaltyTierUpgradeEmail` (`:125-130`) | That customer | Yes — `/account/loyalty` | `BUILT` both |
| `EVENT_REMINDER` | Cron `event-reminders` | Yes — `notifyEventReminder` (`:312-325`) from `api/cron/event-reminders/route.ts:65-69` | Yes — `event-reminder` (`:45-58`) | That customer | Yes — `/consultation` (generic, not the event) | `PARTIAL`: first matching day among 60/30/14 sets `notified: true` (`:28`, `:60-63`), so later days do not run. Pref `eventReminders` is not read |
| `REFERRAL_REWARD` | Referral credit | Yes — `points.ts:610-617` | Yes — `sendReferralRewardEmail` (`:600-608`) | Referrer | Yes — `/account/loyalty` | `BUILT` both |
| `ORDER_CONFIRMED` | RTW fulfil | Yes — `notifyOrderConfirmed` (`:230-243`) from `order-payment.ts:377-381` | Yes — `sendOrderConfirmationEmail` (`:335-365`) | That customer | Yes — `/account/orders` | `BUILT` both. Doubled in-app with `PAYMENT_CONFIRMED` on the same fulfil (`:368-381`) |
| `BANK_TRANSFER_CONFIRMED` | Admin confirm transfer | Yes — `notifyBankTransferConfirmed` (`:209-228`) from `admin/payments/[id]/confirm/route.ts` | Yes — `sendPaymentConfirmedEmail` on the same handler | That customer | Yes — caller link | `BUILT` both. Doubled in-app with `PAYMENT_CONFIRMED` on that confirm path |
| `STAGE_APPROVAL_REQUESTED` | Request + 72h reminder cron | Yes — `stage-actions.ts:500-508`, `stage-approval-reminders.ts:64-72` | Yes — request + reminder emails | That customer | Yes — `/account/orders/bespoke/{id}` | `BUILT` both |
| `STAGE_CHANGES_REQUESTED` | Enum only | **Never created.** Email of this name goes to **staff** (`sendStageChangesRequestedEmail`, `stage-actions.ts:604-611`) | Staff, not customer | n/a | n/a | **Dead customer type.** `MISSING` |
| `RECEIPT_CONFIRMATION_REQUESTED` | Receipt reminder cron (7 days) | Yes — `receipt-reminders.ts:57-64` | Yes — `sendReceiptReminderEmail` (`:36-41`) | That customer | Yes — `/account/orders/bespoke/{id}` | `BUILT` both |
| `RECEIPT_CONFIRMED` | Client confirms receipt | Yes — `bespoke/[orderId]/confirm-receipt/route.ts:24-31` and `receipt/[token]/confirm/route.ts` | No | That customer | Yes — bespoke order link | `PARTIAL`: in-app only |
| `ALTERATION_UPDATE` | Enum only | **Never created** (no `src/` match) | No | n/a | n/a | **Dead type.** `MISSING` |

### 1.3 Staff types

| Type | Trigger | In-app? | Email? | Who receives it | Actionable? | Verdict |
|---|---|---|---|---|---|---|
| `STAGE_ASSIGNED` | Assign staff on a stage | Yes — `notifyStaffStageAssigned` `prudential-atelier/src/lib/staff-notifications.ts:25-56` from `bespoke/[orderId]/assign-staff/route.ts:53` | Yes — `sendStageAssignmentEmail` (`:47-54`) | That staff `userId` | Yes — `/staff/orders/{orderId}` | `BUILT` both |
| `JOB_ASSIGNED` | Helper defined | **Never called.** `notifyStaffJobAssigned` only at `staff-notifications.ts:58-81` | No | n/a | n/a | **Dead helper.** `MISSING` |
| `ORDER_UPDATE` | Client requested changes | Yes — `notifyStaffOrderUpdate` (`:83-98`) from `stage-actions.ts:596-602` | Yes — `sendStageChangesRequestedEmail` | Assigned staff on that order | Yes — `/staff/orders/{orderId}` | `BUILT` both |
| `QUOTE_AWAITING` | Same cron as admin | Yes — `unsent-quote-alerts.ts:94-101` | Yes — `unsent-quote-alert` (`:103-117`) | Staff user whose **name** equals consultant name | Yes — consultation admin URL | `PARTIAL`: targeting is name match |
| `STAGE_REASSIGNED` | Enum + icon | **Never created** (`StaffNotificationBell.tsx:18`) | No | n/a | n/a | **Dead type.** `MISSING` |
| `TASK_ASSIGNED` | Enum + icon | **Never created.** No `staffTask.create` in `src/` | No | n/a | n/a | **Dead type.** `MISSING` |
| `SCHEDULE` | Enum + icon | **Never created** (`StaffNotificationBell.tsx:24-25`) | No | n/a | n/a | **Dead type.** `MISSING` |
| `LATE_ALERT` | Enum | **Never created.** Cron emails HR only (`prudential-atelier/src/app/api/cron/late-alert/route.ts:55-65`) | Yes — `late-alert` to `HR_MANAGER_EMAIL` | HR mailbox, not staff in-app | Email has no deep link | `PARTIAL`: email-only; staff enum unused |
| `GENERAL` | Enum | **Never created** | No | n/a | n/a | **Dead type.** `MISSING` |

### 1.4 Events that email and do not notify in-app (selected)

No file comments state intent. Verdict on intent: `UNCLEAR`. Facts:

| Event | Email | In-app | Citation |
|---|---|---|---|
| Pickup ready | `sendPickupReadyEmail` | None | `admin/orders/[id]/route.ts:212-226` |
| International shipping quote | `sendShippingQuoteEmail` | None | `admin/orders/[id]/shipping-quote/route.ts:84` |
| Points expiry | `sendPointsExpiryEmail` | None | `cron/jobs/prudent-points.ts` + `email.tsx:669` |
| Abandoned cart / checkout | templates `abandoned-cart`, `abandoned-checkout` | None | `cron/catalog.ts:15-24`; marketing family `email-priority.ts:16-25` |
| Welcome / credentials / password reset / account-exists | Yes | None (admin `NEW_CUSTOMER` is register-only) | `email.tsx:71-83`, `register/route.ts:97` |
| Consultation pending (pre-confirm) | `sendConsultationPendingEmail` | None | `consultation-payment.ts:138-150` |
| Payment rejected (admin reject) | `sendPaymentRejectedEmail` | None | `admin/payments/[id]/reject/route.ts:79` |
| Daily / weekly report | Yes | None | `api/cron/daily-report/route.ts:134-141`, `weekly-report/route.ts:119-126` |
| Late clock-in | Yes to HR | No `StaffNotification` / no admin row | `api/cron/late-alert/route.ts:55-65` |
| Consultation review request | Yes | None | `review-requests.ts:90-98` |
| `sendBackInStockEmail` | Function exists | Never called | `email.tsx:742` |

### 1.5 Events that notify in-app and do not email

| Event | In-app | Email | Citation |
|---|---|---|---|
| RTW order **created** (unpaid included) | `NEW_ORDER` | No admin email | `orders/create/route.ts:647-650` |
| Card `charge.failed` | `PAYMENT_FAILED` | No | paystack/stripe webhooks |
| New customer (register) | `NEW_CUSTOMER` | No admin email | `auth/register/route.ts:89` |
| Review / testimonial | `REVIEW_PENDING` / `TESTIMONIAL_SUBMITTED` | No | `notifications.ts:85-136` |
| Production relock / unlock | `PRODUCTION_RELOCKED` / `NEW_BESPOKE` | No | `ledger.ts:239-267` |
| Stage advanced (admin) | `NEW_BESPOKE` | No admin email | `stage-actions.ts:279-283` |
| Email DEAD / provider auth | those types | Original mail already failed | `email-outbox.ts:172-201` |
| Receipt confirmed | `RECEIPT_CONFIRMED` | No | confirm-receipt routes |

---

## 2. Routing and ownership

**Verdict: `MISSING` for admin targeting. `BUILT` for customer/staff per-user rows. `MISSING` for assignment/acknowledgement.**

### 2.1 One pool

Every `AdminNotification` insert writes type/title/message/link/`entityId` only (`prudential-atelier/src/lib/notifications.ts:25-33`, `prudential-atelier/prisma/schema.prisma:1183-1194`). There is no recipient, role, or permission column.

The list and count APIs gate on `requireAdminPortalApi` (`prudential-atelier/src/app/api/admin/notifications/route.ts:6-8`, `count/route.ts:5-9`). That gate is “any non-empty permission set” (`prudential-atelier/src/lib/admin-auth.ts:102-110`, `prudential-atelier/src/lib/roles.ts:118-125`).

Slice T roles with a non-empty seed (`prudential-atelier/src/lib/roles.ts:46-89`):

- `FINANCE_MANAGER`: `invoices`, `quotations`, `finance`, `payments`
- `BESPOKE_MANAGER`: `bespoke`, `consultations`, `clients.view`
- `RTW_MANAGER`, `CONTENT_MANAGER`, `HR_MANAGER`, `CONSULTATION_MANAGER`, `STAFF_ADMIN`, `ADMIN`, `SUPER_ADMIN`

`STAFF` seeds to `[]` (`:89`) and does not pass the portal gate unless a user GRANT adds a permission. Floor staff use `StaffNotification` instead (`requireStaffPortal` on `api/staff/notifications/route.ts:5-7`).

A Finance Manager with the default seed therefore loads the same `NEW_BESPOKE` stage-advanced rows as a Bespoke Manager. A Bespoke Manager loads `EMAIL_PROVIDER_AUTH` and `PAYMENT_FAILED`. A Content Manager with `content.blog` / `content.pages` (`:85`) still polls `/api/admin/notifications/count` from `AdminTopbar` (`prudential-atelier/src/components/admin/AdminTopbar.tsx:6`, `:54`).

Page access for `/admin/notifications` is portal-wide (`prudential-atelier/src/lib/admin-route-access.ts:45`).

### 2.2 Could routing follow permissions today?

Directory of holders: `RolePermission` (`schema.prisma:2067-2076`) and `UserPermission` GRANT/REVOKE (`:2078-2089`). Catalog includes `payments`, `bespoke`, `shop.orders`, `settings` (`prudential-atelier/src/lib/permission-catalog.ts:5-31`).

Notification row: cannot store a permission key or user id.

`createAdminNotification` accepts `targetRoles` and a `ROLE_TO_SYSTEM` map (`prudential-atelier/src/lib/notify.ts:4-12`, `:20`) and then `void params.targetRoles; void ROLE_TO_SYSTEM;` (`:32-33`). The only caller (`unsent-quote-alerts.ts:76-82`) does not pass `targetRoles`.

**Verdict: `PARTIAL` for “we know who holds `payments`.” `MISSING` for “a `payments` notification is delivered only to those people.” Wiring that without a schema change would require filtering at read time; the read APIs do not filter (`admin/notifications/route.ts:10-13`).**

### 2.3 Assignment / acknowledgement

No `assignedTo`, `acknowledgedBy`, or handler field on any of the three models (`schema.prisma:1183-1224`).

Two admins seeing the same `PAYMENT_FAILED` oversell row: nothing in the data model stops both acting or neither. The order page link is the only coordination surface.

Staff `QUOTE_AWAITING` plus admin `QUOTE_AWAITING` is a **double channel** to two audiences (`unsent-quote-alerts.ts:76-117`), not an assignment lock.

### 2.4 Dismiss

Admin mark-one and mark-all write `isRead: true` on the **shared** row (`prudential-atelier/src/app/api/admin/notifications/read/route.ts:21-30`). Mark-all is `updateMany` with `where: { isRead: false }` — every portal user. One “Mark all ✓” in the bell (`NotificationBell.tsx:119-127`) clears the badge for everyone.

Customer and staff mark-all are scoped to `userId` (`account/notifications/read/route.ts:22-26`, `staff/notifications/read/route.ts:22-26`).

There is no delete/dismiss distinct from read. There is no per-user read state for admin rows.

---

## 3. The bell

**Verdict: `BUILT` for unread badge + dropdown + full page. `PARTIAL` for scale (cap, `9+`, SYSTEM filter). Admin page has no nav row.**

### 3.1 Poll and cost

Admin: `setInterval(..., 60_000)` calling `GET /api/admin/notifications/count` (`NotificationBell.tsx:64-71`, `:87-90`). That handler is `prisma.adminNotification.count({ where: { isRead: false } })` (`count/route.ts:9`).

Customer and staff: same 60s interval (`CustomerNotificationBell.tsx:84-87`, `StaffNotificationBell.tsx:71-74`) against their count routes (indexed `userId, isRead, createdAt` — `schema.prisma:1208`, `:1223`). Admin index is `[isRead, createdAt]` (`:1193`).

Cost: **one `COUNT` per open admin tab per minute**, plus the same per account tab and per staff tab. Opening the dropdown adds `GET` list (`take: 50`, `admin/notifications/route.ts:10-13`) then `slice(0, 10)` (`NotificationBell.tsx:80`).

Example: 8 portal users × 1 tab = 8 count queries/minute. 8 users × 2 tabs = 16/minute. The query is a single indexed count, not a full table scan of messages.

### 3.2 Full page

`/admin/notifications` loads `take: 500` then client-paginates `pageSize: 20` (`admin/notifications/page.tsx:3-15`, `NotificationsPageClient.tsx:63-74`). Rows past 500 are not on the page.

`/account/notifications` loads `take: 100` (`account/notifications/page.tsx:11-15`). No sidebar link (`AccountSidebar.tsx:34-53`); entry is the bell “View all” (`CustomerNotificationBell.tsx:224`).

`/staff/notifications` loads via the list API `take: 50` (`staff/notifications/route.ts:11-14`, page `staff/notifications/page.tsx:14-20`) with **no pagination**.

### 3.3 Badge accuracy

Poll uses total unread (`count/route.ts:9` → `{ count }`). Badge is unread, not total (`NotificationBell.tsx:143`, `:156`). Display caps at `"9+"` (`:143`).

After the dropdown loads, unread is overwritten with `unreadCount` computed from the **last 50 rows** (`admin/notifications/route.ts:15`, `NotificationBell.tsx:81`). Unread older than those 50 still increment the poll badge until the panel is opened.

### 3.4 A hundred unread

Dropdown: 10 rows, scroll `max-h-[480px]` (`NotificationBell.tsx:80`, `:191`). Page: 20 per page of the in-memory 500 (`NotificationsPageClient.tsx:73-74`). Not a single unpaginated wall on the page; the dropdown is a 10-item slice of mixed types.

`SYSTEM` filter is `row.type === "NEW_CUSTOMER"` only (`NotificationsPageClient.tsx:54`). `EMAIL_DEAD`, `EMAIL_PROVIDER_AUTH`, `PRODUCTION_RELOCKED`, `JOB_APPLICATION`, `CONTACT_FORM` do not match `SYSTEM` (or the other named tabs except ALL/UNREAD).

---

## 4. Delivery, and what happens when it fails

**Verdict: in-app insert is `BUILT` as a direct write with silent catch. Outbox is `BUILT` for email only. Coupling of the two channels is `MISSING`.**

### 4.1 In-app is not an outbox

`createNotification` / `createCustomerNotification` / `createStaffNotification` are a single `prisma.*.create`. No status, retry, or `DEAD`. Failures on the helpers are `.catch(() => {})` (`notifications.ts:47`) or `.catch((e) => console.warn(...))` (`order-payment.ts:256`). A failed insert leaves no row and no bell.

### 4.2 Email outbox

`sendEmail` is `queueEmail` (`email.tsx:68`). Queue writes `EmailStatus.QUEUED` and, unless `defer`, fire-and-forget `deliverEmail` (`email-outbox.ts:119-121`). Cron `email-outbox` runs `* * * * *` with a 90s budget (`cron/catalog.ts:117-123`).

Retryable failures go `FAILED` with backoff 1m / 5m / 30m / 2h / 12h (`email-outbox-types.ts:132-144`, `email-outbox.ts:305-312`). Terminal or `attempts >= maxAttempts` (default 5, `schema.prisma:2471`) calls `markDead` (`email-outbox.ts:157-178`, `:300-302`).

Auth failures alert in-app then continue to the next provider (`:285-287`). They do not by themselves mark the message `DEAD`.

### 4.3 Email `DEAD` vs in-app for the same event

Order of operations for a typical customer event (quote send): outbox row first (`quotations/[id]/send/route.ts:146-154`), then `notifyQuoteReady` (`:177-182`). Quote is marked `SENT` once the outbox row exists (`:134-135`, `:156-163`).

If that outbox row later becomes `DEAD`, `markDead` inserts a **separate** `EMAIL_DEAD` admin notice (`email-outbox.ts:172-178`). The customer in-app row (if created) stays. The original admin notice for that event (if any) is unchanged. There is no flag on `CustomerNotification` that the email died.

Bad case, stated as a fact: a guest with no `User` gets no in-app (`customer-notifications.ts:73-74`). If their email is `DEAD`, they have no in-app and the only staff signal is `EMAIL_DEAD` in the shared pool, titled with template and address (`:174-175`), link `/admin/system/emails`.

### 4.4 Oversell — under an hour

Path:

1. `fulfillPaidOrder` stock failure → `refuseFulfilmentForStock` (`order-payment.ts:229-245`).
2. If `recorded && notify !== false`: `createNotification` type `PAYMENT_FAILED`, title `RTW oversell — refund required`, link `/admin/orders?attention=refund-required` (`:247-256`).
3. If `clientEmail`: `sendRtwFulfilmentRefusedEmails` — customer refund copy + admin `Refund required — RTW oversell` to `resolveAdminAlertEmail` (`:258-266`, `email.tsx:263-306`). Never `admin@prudentgabriel.com` (`admin-alert-email.ts:1-16`).

How a human sees it in &lt; 1 hour:

- Admin tab open: next 60s poll increments unread (`NotificationBell.tsx:87-90`). Title is oversell; **type is `PAYMENT_FAILED`**, so it sits in the Orders filter with card-declines (`NotificationsPageClient.tsx:48`).
- Admin tab closed: customer and admin **emails** via outbox (immediate deliver unless deferred). If those emails `DEAD`, the in-app oversell row still exists from step 2; `EMAIL_DEAD` is an extra row.
- Daily report (`api/cron/daily-report/route.ts:33-124`) lists revenue, stages, attendance, consultations, upcoming deliveries, pending payments. It does **not** list oversell / refund-required.

There is no SMS, Slack send (setting `slack_webhook_url` is stored, not sent from notification helpers), or push.

---

## 5. The customer side

**Verdict: `CustomerNotification` is `BUILT` and read. Preferences are `PARTIAL` (saved, not applied). Marketing unsubscribe is `BUILT`. Transactional opt-out is `MISSING`.**

### 5.1 What `CustomerNotification` does

It is written by `createCustomerNotification` (`customer-notifications.ts:32-49`) and read by:

- Bell in account chrome (`AccountShell.tsx:47`, `CustomerNotificationBell.tsx`)
- `GET /api/account/notifications` (`take: 50`, `route.ts:11-15`) and count
- Page `/account/notifications` (`take: 100`, `page.tsx:11-17`)

It is not listed in `AccountSidebar` (`AccountSidebar.tsx:34-53`).

### 5.2 Email-only customer events vs login visibility

Email-only (no `CustomerNotification`): pickup ready, shipping quote, points expiry, abandoned cart/checkout, welcome, password reset, consultation pending, consultation review request, payment rejected (§1.4). Those are invisible in `/account` except insofar as the underlying order/consultation/points data is already on other pages.

In-app without email: `RECEIPT_CONFIRMED` (§1.5).

Guests: in-app helpers return when no User exists. Email still sends to `guestEmail` / `clientEmail`.

### 5.3 Preferences

Account settings expose four booleans: `orderStage`, `newCollections`, `wishlistRestock`, `eventReminders` (`SettingsClient.tsx:7-12`, `:180-183`). Stored as `siteSetting` key `notification_prefs_{userId}` (`account-helpers.ts:85-124`). PATCH via `api/account/profile/merged/route.ts:139-141`.

`getNotificationPrefs` is not called from `customer-notifications.ts`, `email.tsx`, `event-reminders`, or stage email. Toggling `eventReminders` off does not stop `api/cron/event-reminders/route.ts`. Toggling `orderStage` off does not stop `notifyClientBespokeStageComplete` or `sendBespokeStageEmail`.

UI copy for events is “8 weeks” (`SettingsClient.tsx:183`); cron uses 60 / 30 / 14 days (`event-reminders/route.ts:10`).

### 5.4 Unsubscribe

`EmailPreference` holds `unsubscribedAt` / `bounceAt` (`schema.prisma:507-518`). `queueEmail` applies suppression and List-Unsubscribe **only** when `isMarketingTemplate` (`email-outbox.ts:63-75`, `email-priority.ts:16-31`). Transactional templates (order confirmation, stage, invoice, quote-sent, admin-notification, rtw-fulfilment-refused, etc.) are not in `MARKETING_TEMPLATES` and are not suppressed by unsubscribe.

---

## 6. Noise

**Verdict: `PARTIAL`. Live admin stream mixes operational alerts with routine stage ticks. Digest crons exist and overlap stage/revenue text, not oversell.**

### 6.1 Volume (working rate)

No production counters in-repo. Arithmetic below uses an explicit working rate: **12 paid RTW orders/week, 20 RTW orders created/week (includes unpaid), 4 consultations, 3 active commissions, 2 stage completions per commission per week, 2 self-registers, 1 contact, 1 job application.**

| Source | Per week at that rate | Why |
|---|---|---|
| `NEW_ORDER` (create) | 20 | One per `orders/create` (`:647`), including unpaid |
| `NEW_ORDER` (bank receipt) | depends on transfer share | Extra rows, same type |
| `PAYMENT_CONFIRMED` + `ORDER_CONFIRMED` | 24 customer rows | Both fire on fulfil (`order-payment.ts:368-381`) |
| `NEW_BESPOKE` (true new request) | small | One per request |
| `NEW_BESPOKE` (stage complete) | 6 | `notifyStageAdvanced` reuses type |
| `ATELIER_STAGE_ADVANCED` | 6 customer | Pair of the above |
| `NEW_CUSTOMER` | 2 | Register only |
| `EMAIL_DEAD` | failure-driven | One admin row per dead outbox message |
| Daily report email | 7 to each of `GENERAL_ADMIN_EMAIL` / `SUPER_ADMIN_EMAIL` | `daily-report/route.ts:129-141` |
| Weekly report email | 1 | `weekly-report/route.ts:114-126` |
| Abandoned-checkout emails | up to every 15 min per session | `cron/catalog.ts:21-24` — marketing, not the admin bell |

Highest-frequency **admin bell** types at this rate: `NEW_ORDER` (unpaid+paid) and `NEW_BESPOKE` (because it absorbs stage-complete and unlock). Highest-frequency **customer bell** types: `PAYMENT_CONFIRMED`+`ORDER_CONFIRMED` pair, then stage-advanced.

### 6.2 Ignore-within-a-fortnight

A bell that stays red: unpaid `NEW_ORDER` plus every stage tick as `NEW_BESPOKE`, plus `NEW_CUSTOMER`, with a global `isRead`. One person marking all read clears the oversell row for everyone (§2.4). Badge `9+` (`NotificationBell.tsx:143`) stops distinguishing 10 from 100.

`CONSULTATION_BOOKED_PRUDENT` duplicates `NEW_CONSULTATION` on the same booking (`notifications.ts:63-82`).

### 6.3 Digest vs live

`daily-report` (`api/cron/daily-report/route.ts:70-125`): revenue today, stages completed that day, attendance, completed consultations, deliveries in 7 days, count of pending payments. Recipients: `GENERAL_ADMIN_EMAIL`, `SUPER_ADMIN_EMAIL` (`:129-132`). No in-app. Overlaps live `notifyStageAdvanced` (same stage list, different channel and audience).

`weekly-report` (`weekly-report/route.ts:72-110`): week revenue, production progress (30 active, 10 shown), overdue orders, new clients, consultation revenue, RTW sales. Same two mailboxes. Overlaps `NEW_CUSTOMER` / client counts; overdue list is **not** duplicated as an in-app type.

Neither digest contains oversell, `PRODUCTION_RELOCKED`, `EMAIL_DEAD`, or `QUOTE_AWAITING`.

---

## 7. Gap register

Judged against **“the right person finds out in time to act.”**

| # | Gap | Severity | What is missed | Files | Est. |
|---|---|---|---|---|---|
| 1 | Admin notifications are an unowned shared pool; Slice T roles all poll the same rows | High | Finance sees stage-advanced; Bespoke/Content see provider-auth and oversell; nobody is the owner | `schema.prisma:1183-1194`; `notify.ts:14-33`; `roles.ts:46-89`; `admin-auth.ts:102-110`; `admin/notifications/route.ts:6-13` | L |
| 2 | Mark-all-read is global on admin rows | High | One click clears oversell / relock / DEAD for every portal user | `api/admin/notifications/read/route.ts:21-23`; `NotificationBell.tsx:119-127` | S |
| 3 | No assignment or acknowledgement | High | Two people can both act or neither; no “I am handling this” | `schema.prisma:1183-1224` | M |
| 4 | Oversell is typed `PAYMENT_FAILED` and sits in the unpaid-decline pile | High | Refund-required money event is not a distinct bell type; daily report omits it | `order-payment.ts:247-256`; `NotificationsPageClient.tsx:48`; `daily-report/route.ts:70-125` | S |
| 5 | `targetRoles` / `ROLE_TO_SYSTEM` are unused | High | The only targeting hook in code is a no-op | `notify.ts:4-12`, `:32-33` | S |
| 6 | `PRODUCTION_RELOCKED` is in-app only, shared pool, no digest | High | Production stop on a commission if nobody has the admin tab and nobody opens the bell | `ledger.ts:249-267`; `daily-report/route.ts` | M |
| 7 | Guest / unresolved User: email DEAD ⇒ no customer in-app | High | Customer never sees the event in `/account`; admin sees a generic `EMAIL_DEAD` | `customer-notifications.ts:73-74`; `email-outbox.ts:172-178` | M |
| 8 | In-app insert has no retry; errors swallowed | Medium | Event happens, bell stays empty, outbox may still send (or not) | `notifications.ts:41-47`; `email.tsx:68` | M |
| 9 | Type reuse: `NEW_BESPOKE` / `NEW_ORDER` / `PAYMENT_FAILED` / `NEW_CONSULTATION` | Medium | Filters and icons cannot separate stage ticks, unlocks, receipts, oversell, completed sessions | `notifications.ts:36-206`; `ledger.ts:239-245`; `session/route.ts:85-91` | M |
| 10 | `LOW_STOCK` helper + `notify_low_stock` setting never run | Medium | Stock-outs are not on the bell (oversell is the late signal) | `notifications.ts:138-146`; `seed.ts:513` | M |
| 11 | Card fail on consultation/bespoke: no admin in-app | Medium | RTW decline notifies; consult/bespoke decline does not | `paystack/webhook/route.ts:113-137` | S |
| 12 | Customer prefs saved and not applied | Medium | Settings toggles do not change email or in-app | `account-helpers.ts:85-124`; `SettingsClient.tsx:180-183`; send paths do not call `getNotificationPrefs` | M |
| 13 | Event reminder: `notified=true` after first day; UI says 8 weeks | Medium | 30- and 14-day mails do not send; pref ignored | `event-reminders/route.ts:10`, `:28`, `:60-63`; `SettingsClient.tsx:183` | S |
| 14 | Pickup ready / shipping quote / points expiry / consult review: email only | Medium | Logged-in customer does not see them in the bell | `admin/orders/[id]/route.ts:212-226`; `review-requests.ts:90-98`; `prudent-points.ts` | S |
| 15 | `SYSTEM` tab hides DEAD/auth/relock | Medium | Full page filter does not surface the time-critical system types | `NotificationsPageClient.tsx:54` | S |
| 16 | `/admin/notifications` has no nav row | Low | Inbox is bell-only; known and confirmed | `admin-route-access.ts:285`, `:430-467` | S |
| 17 | Dead enums: `COUPON_EXPIRING`, `ALTERATION_UPDATE`, `STAGE_CHANGES_REQUESTED` (customer), staff `STAGE_REASSIGNED` / `TASK_ASSIGNED` / `SCHEDULE` / `GENERAL` / unused `JOB_ASSIGNED` | Low | UI implies types that are never written | schema enums `:1263-1317`; helpers cited in §1 | S |
| 18 | Admin email split across `ADMIN_EMAIL`, `ORDERS_ADMIN_EMAIL`, `ORDERS_EMAIL`, `resolveAdminAlertEmail`, `GENERAL_ADMIN_EMAIL` | Medium | Oversell, bespoke, bank transfer, and daily report do not share one inbox | `email.tsx:143`, `:968`; `email-transport.ts:4`; `admin-alert-email.ts:18-34`; `daily-report/route.ts:129-132` | M |
| 19 | `QUOTE_AWAITING` staff target is name equality | Low | Consultant rename/mismatch ⇒ staff in-app/email skipped; admin pool still gets the row | `unsent-quote-alerts.ts:11-18`, `:92-117` | S |
| 20 | Doubled customer rows on pay (`PAYMENT_CONFIRMED` + `ORDER_CONFIRMED` / bank confirm pair) | Low | Two unread for one payment | `order-payment.ts:368-381`; `admin/payments/[id]/confirm/route.ts` | S |

---

## 8. Open questions

Cap 10. Each is answerable in one sentence.

1. Is `createAdminNotification`'s `targetRoles` unfinished Slice T work, or a discarded experiment (`notify.ts:20`, `:32-33`)?
2. Are seeded `notify_new_order` / `notify_low_stock` flags meant to gate email, in-app, both, or neither (`seed.ts:510-513`)?
3. Is oversell intended to share `PAYMENT_FAILED` with `charge.failed` (`order-payment.ts:251` vs `paystack/webhook/route.ts:122`)?
4. Is stage-complete intended to share `NEW_BESPOKE` with new requests (`notifications.ts:50-58` vs `:194-206`)?
5. Which mailbox is canonical for operational alerts: `ADMIN_EMAIL`, `ORDERS_ADMIN_EMAIL`, `ORDERS_EMAIL`, or `resolveAdminAlertEmail`?
6. Should `EMAIL_DEAD` on a customer transactional template page someone, or is the shared bell the whole design (`email-outbox.ts:172-178`)?
7. For guests without a `User`, is email-only the product rule, including when the outbox row is `DEAD` (`customer-notifications.ts:73-74`)?
8. Should account `notificationPrefs` ever be read at send time, or is the settings UI storage-only (`account-helpers.ts:85-107`)?
9. Is the event cron supposed to fire once (60/30/14 collapsed by `notified`) or on each of those days (`event-reminders/route.ts:10`, `:60-63`)?
10. Is `/admin/notifications` staying bell-only with no nav row (`admin-route-access.ts:285`)?

---

## Appendix — channel map (admin mailboxes)

| Mailbox / resolver | Used for |
|---|---|
| `process.env.ADMIN_EMAIL` | `sendAdminNotificationEmail` (bespoke, job application, unsent-quote admin, consultation admin) `email.tsx:963-980` |
| `ORDERS_ADMIN_EMAIL` or `orders@prudentgabriel.com` | Bank-transfer admin `email.tsx:143` |
| `ORDERS_EMAIL` (`orders@prudentgabriel.com`) | Quote approved `quotations/[id]/approve/route.ts:6`, `:77-85` |
| `resolveAdminAlertEmail` | Oversell admin `email.tsx:289-305` |
| `GENERAL_ADMIN_EMAIL` + `SUPER_ADMIN_EMAIL` | Daily / weekly reports |
| `HR_MANAGER_EMAIL` | Late-alert cron |
| CMS `contact_notification_email` | Contact form |

---

*End of audit. No code was changed.*
