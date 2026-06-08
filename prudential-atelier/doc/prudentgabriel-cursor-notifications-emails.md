# CURSOR AI — PRUDENTGABRIEL.COM
## Feature: Full Notifications + Email System
### Prepared by SonsHub Media Ltd (Nony — Okafor Chinonso Daniel)

---

## CRITICAL INSTRUCTIONS

1. Read the entire prompt before writing any code.
2. ALL email templates use the system logo from SiteSetting.
3. ALL email template content (subject, body copy) is editable from the admin CMS.
4. Email transport uses the existing Nodemailer + Namecheap SMTP setup.
5. Run `pnpm exec tsc --noEmit` after each section.

---

## ARCHITECTURE OVERVIEW

### Three notification channels:

1. **Admin bell notifications** — in-app, shown in admin topbar bell dropdown
2. **Client dashboard notifications** — shown in client `/account` area
3. **Staff portal notifications** — shown in staff portal topbar

### Email system:
- All emails use branded React Email templates
- Logo pulled from `SiteSetting` key `logo_dark` (or fallback text wordmark)
- Each template has editable subject + body in admin CMS
- Nodemailer + Namecheap SMTP (existing setup)

---

## SECTION 1 — EMAIL TEMPLATE SYSTEM

### Base email template

Build `src/emails/base/BaseEmail.tsx`:

```tsx
// Shared wrapper for ALL emails
// Props: { children, previewText }

// Structure:
// - Header: logo (from SiteSetting logo_dark URL)
//   Falls back to "PRUDENTIAL ATELIER" text if no logo
// - Content: children
// - Footer: 
//   "Prudential Atelier · prudentgabriel.com"
//   "14 Bode Thomas Street, Surulere, Lagos, Nigeria"
//   "hello@prudentgabriel.com"
//   Divider
//   "Developed with love by SonsHub Media Ltd"

// Colours:
// Background: #F7F2EC (ivory)
// Header bg: #442913 (dark chocolate)
// Logo area: centred, white logo on chocolate
// Content area: white card, max-width 600px
// Footer bg: #1A0F08 (near-black)
// Footer text: rgba(226,209,194,0.6)
// CTA buttons: #442913 bg, #E2D1C2 text
// Accent/divider: #C9A84C (gold)
```

### CMS email editor

In `/admin/content/pages` → add **"Email Templates"** section:

For each email template, admin can edit:
- Subject line
- Heading text
- Body copy (paragraphs)
- CTA button label + link

Saves to SiteSetting keys: `email_[template_key]_subject`, `email_[template_key]_heading`, etc.

**DO NOT make the entire template editable** — only the text content. The layout and branding are fixed in code.

---

## SECTION 2 — ALL EMAIL TEMPLATES

Build each template in `src/emails/`:

---

### 2.1 Welcome + Credentials (`welcome-credentials.tsx`)

**Trigger:** Auto-onboarding after first purchase/consultation
**To:** New client

```
[Logo header]

Welcome to Prudential Atelier, [firstName].

Your account has been created so you can follow 
your journey with us.

──────────────────────────────────────
YOUR LOGIN DETAILS

Email: [email]
Temporary password: [WORD-1234]

[LOG IN TO YOUR ACCOUNT →]
──────────────────────────────────────

TRACK YOUR ORDER (no login needed)

Follow your commission at any time:

[TRACK MY ORDER →]
──────────────────────────────────────

Once you're logged in, you can:
✓ See your measurements saved forever
✓ View your moodboard and design references
✓ Earn loyalty points on every order
✓ Refer friends and earn store credit
✓ Book your next consultation in seconds

[Footer]
```

---

### 2.2 Consultation Booking Confirmed (`consultation-confirmed.tsx`)

**Trigger:** After consultation payment confirmed

```
[Logo header]

Your consultation is confirmed, [firstName].

──────────────────────────────────────
TYPE: [Physical/Virtual] with [Mrs. Prudent + 
      Creative Team / The Creative Team]
[If virtual]: PLATFORM: [Zoom / Google Meet / 
              WhatsApp Video]
DATE: [Day, Date]
TIME: [Time]
REFERENCE: [bookingRef]
──────────────────────────────────────

[If physical]:
Our Lagos Atelier:
14 Bode Thomas Street, Surulere, Lagos

[If virtual]:
Your meeting link will be sent to you 
1 hour before your session.

We look forward to meeting you.

[Footer]
```

---

### 2.3 Meeting Link (`consultation-meeting-link.tsx`)

**Trigger:** Admin sends meeting link

```
[Logo header]

Your consultation is about to begin, [firstName].

Your [Zoom / Google Meet / WhatsApp Video] link 
is ready.

DATE: [Date]
TIME: [Time]

[JOIN YOUR CONSULTATION →]
→ [meeting link]

[If WhatsApp]:
Tap the button above to start the WhatsApp 
video call at your scheduled time.

[If Zoom/Meet]:
Click the button above to join at the 
scheduled time.

See you soon,
Prudential Atelier

[Footer]
```

---

### 2.4 Consultation Session Summary (`consultation-session-summary.tsx`)

**Trigger:** Admin marks consultation as COMPLETED

```
[Logo header]

Thank you for sitting with us, [firstName].

It was a pleasure getting to know your vision.

[If moodboard uploaded]:
YOUR MOODBOARD IS READY

Our creative team has prepared your moodboard 
and inspiration references from today's session.

[VIEW YOUR MOODBOARD →]

[Session notes from admin (if any)]:
──────────────────────────────────────
A NOTE FROM YOUR CONSULTANT

[session notes text]
──────────────────────────────────────

WHAT HAPPENS NEXT

[If next step is atelier commission]:
Your invoice will be prepared and sent to 
you shortly for your review and approval.

[Begin your commission CTA]:
[BEGIN YOUR COMMISSION →]

[Footer]
```

---

### 2.5 Atelier Stage Emails (×13) (`atelier-stage-[n].tsx`)

**Trigger:** Each of the 13 stages completed

Build ONE reusable template `atelier-stage-update.tsx` with dynamic content:

```
[Logo header]

[Stage-specific heading — editable per stage]

[firstName], [stage-specific message]

──────────────────────────────────────
YOUR COMMISSION: [outfitName]
ORDER: [orderRef]
STAGE: [stageNumber] of 13
──────────────────────────────────────

[Stage notes from admin]

[If stage has images]:
[Image gallery — up to 3 images shown]

[Progress bar showing 13 stages — 
 current stage highlighted in gold]

[TRACK YOUR COMMISSION →]

──────────────────────────────────────
ESTIMATED DELIVERY: [deliveryDate]
──────────────────────────────────────

[Footer]
```

Stage-specific headings (editable from CMS):

| Stage | Default heading |
|-------|----------------|
| 1 | "Your consultation is booked" |
| 2 | "Your session summary is ready" |
| 3 | "Your invoice is ready for review" |
| 4 | "Payment confirmed — work begins" |
| 5 | "Your design concept is ready" |
| 6 | "Your fabrics have been sourced" |
| 7 | "Your design is ready for approval" |
| 8 | "Your outfit is being crafted" |
| 9 | "Your first fitting summary" |
| 10 | "Alterations are complete" |
| 11 | "Embellishments are being applied" |
| 12 | "Final fitting — your outfit is approved" |
| 13 | "Your outfit is ready for collection" |

---

### 2.6 Invoice Issued (`invoice-issued.tsx`)

```
[Logo header]

Your invoice is ready, [firstName].

──────────────────────────────────────
INVOICE: [invoiceRef]
DATE: [issuedDate]
DUE: [dueDate]

[Line items table]:
Item | Qty | Price | Total
[items]
─────────────────
TOTAL: ₦[amount]
──────────────────────────────────────

[If 70/30 payment terms]:
PAYMENT OPTIONS:
○ Pay 70% deposit now: ₦[70%]
  Balance of ₦[30%] due before delivery
○ Pay in full: ₦[total]

[PAY NOW →]
OR
Bank transfer to:
Bank: [bankName]
Account: [accountNumber]
Name: [accountName]
Amount: ₦[amount]
Reference: [invoiceRef]

[Footer]
```

---

### 2.7 Quote for Approval (`quote-for-approval.tsx`)

```
[Logo header]

Your quotation is ready, [firstName].

Please review and approve the quotation 
for your [outfitName] commission.

──────────────────────────────────────
QUOTATION: [quoteRef]
TOTAL: ₦[amount]
VALID UNTIL: [expiryDate]
──────────────────────────────────────

[REVIEW & APPROVE QUOTATION →]

Once approved, your invoice will be 
generated and production begins.

[Footer]
```

---

### 2.8 Payment Confirmed (`payment-confirmed.tsx`)

```
[Logo header]

Payment confirmed, [firstName].

We've received your payment of ₦[amount].

──────────────────────────────────────
AMOUNT: ₦[amount]
METHOD: [paymentMethod]
REFERENCE: [paymentRef]
DATE: [paidAt]
──────────────────────────────────────

[If atelier order]:
Your commission is now active. 
[TRACK YOUR COMMISSION →]

[If consultation]:
Your consultation is confirmed.

[If RTW order]:
Your order is being prepared.
[VIEW YOUR ORDER →]

[Footer]
```

---

### 2.9 Bank Transfer Received (`bank-transfer-received.tsx`)

```
[Logo header]

We've received your payment receipt, [firstName].

Our finance team will verify your payment 
within 2–4 business hours.

AMOUNT: ₦[amount]
REFERENCE: [paymentRef]

You'll receive a confirmation email once 
your payment has been verified.

[Footer]
```

---

### 2.10 Bank Transfer Confirmed (`bank-transfer-confirmed.tsx`)

```
[Logo header]

Payment confirmed, [firstName].

Your bank transfer of ₦[amount] has been 
verified and confirmed.

[TRACK YOUR ORDER →] or [VIEW YOUR ACCOUNT →]

[Footer]
```

---

### 2.11 RTW Order Confirmed (`rtw-order-confirmed.tsx`)

```
[Logo header]

Order confirmed, [firstName].

Thank you for your purchase.

──────────────────────────────────────
ORDER: [orderRef]
DATE: [date]

[Order items]:
[Product image] [Product name] × [qty] — ₦[price]

TOTAL: ₦[total]
──────────────────────────────────────

DELIVERY ADDRESS:
[address]

Estimated delivery: [estimatedDelivery]

[TRACK YOUR ORDER →]

[Footer]
```

---

### 2.12 RTW Order Shipped (`rtw-order-shipped.tsx`)

```
[Logo header]

Your order is on its way, [firstName]!

──────────────────────────────────────
ORDER: [orderRef]
[Items summary]
──────────────────────────────────────

[If tracking number available]:
TRACKING: [trackingNumber]

Estimated delivery: [estimatedDelivery]

[Footer]
```

---

### 2.13 RTW Order Delivered (`rtw-order-delivered.tsx`)

```
[Logo header]

Your order has been delivered, [firstName].

We hope you love your new piece.

[24 hours later, a follow-up triggers the 
review request — see 2.15]

[LEAVE A REVIEW →]

[Footer]
```

---

### 2.14 Product Review Request (`product-review-request.tsx`)

```
[Logo header]

How was your [productName]?

Hi [firstName], your [productName] was 
delivered recently. We'd love to hear 
how you're feeling about it.

[SHARE YOUR REVIEW →]
(Takes less than 2 minutes)

[Footer]
```

---

### 2.15 Consultation Review Request (`consultation-review-request.tsx`)

```
[Logo header]

How was your consultation?

Hi [firstName], thank you for sitting 
with us. We'd love to hear about your 
experience.

[SHARE YOUR EXPERIENCE →]

[Footer]
```

---

### 2.16 Password Reset (`password-reset.tsx`)

```
[Logo header]

Reset your password

You requested a password reset for 
your Prudential Atelier account.

[RESET MY PASSWORD →]
(This link expires in 1 hour)

If you didn't request this, 
ignore this email.

[Footer]
```

---

### 2.17 Loyalty Tier Upgrade (`loyalty-tier-upgrade.tsx`)

```
[Logo header]

Congratulations, [firstName]!

You've reached [GOLD] status.

✦ [NEW TIER BADGE]

YOUR NEW PERKS:
✓ [Perk 1]
✓ [Perk 2]
✓ [Perk 3]

[VIEW YOUR REWARDS →]

[Footer]
```

---

### 2.18 Event Reminder (`event-reminder.tsx`)

```
[Logo header]

Your [event name] is in 8 weeks, [firstName].

You saved this date:
[EVENT NAME] — [Date]

It's the perfect time to begin your 
commission or browse our collection.

[BEGIN A COMMISSION →]  [BROWSE COLLECTION →]

[Footer]
```

---

### 2.19 Referral Reward (`referral-reward.tsx`)

```
[Logo header]

You've earned a referral reward, [firstName]!

Your friend just made their first purchase 
with Prudential Atelier.

₦5,000 store credit has been added 
to your account.

[VIEW YOUR ACCOUNT →]

[Footer]
```

---

### 2.20 Staff Invitation (`staff-invitation.tsx`)

```
[Logo header — staff portal version]

You've been added to the Prudential Atelier 
operations system.

──────────────────────────────────────
YOUR LOGIN DETAILS

Portal: prudentgabriel.com/staff-login
Email: [email]
Temporary password: [WORD-1234]
──────────────────────────────────────

You'll be asked to set a new password 
when you first log in.

— Prudential Atelier

[Footer]
```

---

### 2.21 Stage Assignment (`stage-assignment.tsx`)

```
[Logo header — staff portal version]

You've been assigned to a new commission.

ORDER: [orderRef]
PIECE: [outfitName]
YOUR ROLE: [stage name] — Stage [n]
DELIVERY DATE: [date]

[VIEW IN STAFF PORTAL →]

[Footer]
```

---

### 2.22 Contact Form Auto-Reply (`contact-auto-reply.tsx`)

```
[Logo header]

We've received your message, [firstName].

We'll be in touch within 24 hours.

YOUR MESSAGE:
Subject: [subject]
──────────────────────────────────────
[message excerpt — first 200 chars]
──────────────────────────────────────

[Footer]
```

---

### 2.23 New Contact Form (to admin) (`admin-contact-notification.tsx`)

```
New contact form submission

Name: [name]
Email: [email]
Phone: [phone]
Subject: [subject]
Message: [full message]

[VIEW IN ADMIN →]
```

---

### 2.24 Daily Report (`daily-report.tsx`)

```
[Logo header]

DAILY REPORT — [Day, Date]

Good [morning/afternoon], Mrs. Prudent.

──────────────────────────────────────
TODAY'S SUMMARY

Orders advanced: [n]
Deliveries today: [n]
Payments received: ₦[amount]
Pending confirmations: [n]
New clients: [n]
Consultations today: [n]

STAFF ATTENDANCE
On the clock: [n]
Late: [n]
Absent: [n]

UPCOMING DELIVERIES (next 7 days)
[list of orders with delivery dates]

PENDING BANK TRANSFERS
[list of unconfirmed transfers]
──────────────────────────────────────

[VIEW FULL DASHBOARD →]

[Footer]
```

---

### 2.25 Weekly Report (`weekly-report.tsx`)

```
[Logo header]

WEEKLY REPORT — Week of [date]

──────────────────────────────────────
REVENUE THIS WEEK

Total: ₦[amount]
  Atelier: ₦[amount]
  RTW: ₦[amount]
  Consultations: ₦[amount]

vs last week: [+/-]%

PRODUCTION
Active commissions: [n]
Stages completed: [n]
Overdue orders: [n] ← red if > 0

CONSULTATIONS
Booked: [n]
Completed: [n]

NEW CLIENTS
Registered: [n]

STAFF
Top performer: [name]
Best attendance: [name]
──────────────────────────────────────

[VIEW FULL REPORT →]

[Footer]
```

---

### 2.26 Low Stock Alert (`admin-low-stock.tsx`)

```
[Logo header]

Low stock alert

The following products are running low:

[Product name] — [X] remaining (threshold: [n])
[Product name] — [X] remaining

[VIEW PRODUCTS →]
```

---

### 2.27 Late Staff Alert (`admin-late-staff.tsx`)

```
[Logo header]

Staff not clocked in

The following staff have not clocked in 
by [resumption time]:

[Name] — [Job title]
[Name] — [Job title]

[VIEW ATTENDANCE →]
```

---

### 2.28 Job Application Received (`admin-job-application.tsx`)

```
New job application

Position: [job title]
Applicant: [name]
Email: [email]
Experience: [n] years
[If PFA]: PFA Student — [regNumber] ✓ Verified

[VIEW APPLICATION →]
```

---

### 2.29 Balance Reminder (`balance-reminder.tsx`)

```
[Logo header]

A reminder about your outstanding balance

Hi [firstName],

You have an outstanding balance of 
₦[balance] on your commission.

COMMISSION: [outfitName]
ORDER: [orderRef]
OUTSTANDING: ₦[balance]
DELIVERY: [deliveryDate]

[PAY OUTSTANDING BALANCE →]

[Footer]
```

---

## SECTION 3 — CLIENT NOTIFICATIONS

Build a client notification system in the account dashboard.

### Schema:

```prisma
model ClientNotification {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  
  type      String
  title     String
  message   String
  link      String?
  isRead    Boolean  @default(false)
  
  createdAt DateTime @default(now())
  
  @@index([userId, isRead])
}
```

Run `prisma db push`.

### Client notification bell

In the client account shell (`AccountShell.tsx`), 
add a notification bell in the topbar:

- Badge: unread count
- Dropdown: same design as admin notification bell
- Each notification: icon by type, title, message, time ago
- Click: marks as read + navigates to link
- "Mark all read" button

### Notification types to create:

```typescript
export type ClientNotificationType =
  | 'CONSULTATION_CONFIRMED'
  | 'MEETING_LINK_SENT'
  | 'ATELIER_STAGE_ADVANCED'
  | 'MOODBOARD_READY'
  | 'INVOICE_ISSUED'
  | 'QUOTE_READY'
  | 'PAYMENT_CONFIRMED'
  | 'BALANCE_REMINDER'
  | 'ORDER_SHIPPED'
  | 'ORDER_DELIVERED'
  | 'REVIEW_REQUEST'
  | 'LOYALTY_TIER_UPGRADE'
  | 'EVENT_REMINDER'
  | 'REFERRAL_REWARD'
```

### Helper function:

```typescript
// src/lib/client-notify.ts

export async function createClientNotification(params: {
  userId: string
  type: ClientNotificationType
  title: string
  message: string
  link?: string
}): Promise<void>
```

---

## SECTION 4 — STAFF NOTIFICATIONS

In staff portal topbar, add a notification bell:

```typescript
export type StaffNotificationType =
  | 'STAGE_ASSIGNED'
  | 'STAGE_REASSIGNED'
  | 'LATE_ALERT'
  | 'ORDER_UPDATE'
```

Trigger `STAGE_ASSIGNED` when admin assigns staff to a stage.
Trigger `LATE_ALERT` via cron if staff hasn't clocked in by resumption time.

---

## SECTION 5 — WIRE ALL TRIGGERS

Go through every API route and wire the notifications and emails:

### Consultation routes:
```
POST /api/consultations/initialize-payment
  → On payment success: send consultation-confirmed email
  → Create ClientNotification CONSULTATION_CONFIRMED
  → Create AdminNotification (CONSULTATION_BOOKED or CONSULTATION_BOOKED_PRUDENT)

POST /api/admin/consultations/[id]/send-link
  → Send consultation-meeting-link email
  → Create ClientNotification MEETING_LINK_SENT

PATCH /api/admin/consultations/[id]/session (status=COMPLETED)
  → Send consultation-session-summary email
  → If moodboard images: create ClientNotification MOODBOARD_READY
  → Send consultation-review-request email (after 1 hour delay via cron)
```

### Atelier/Bespoke routes:
```
POST /api/bespoke/[orderId]/initialize-payment (on success)
  → Create AdminNotification ATELIER_ORDER_CREATED

PATCH /api/admin/bespoke/[orderId]/stages/[stage]/complete
  → Send atelier-stage-update email (stage-specific)
  → Create ClientNotification ATELIER_STAGE_ADVANCED
  → If stage 13 (DELIVERY): create ClientNotification + send rtw-order-delivered

POST /api/invoices/[id]/send
  → Send invoice-issued email
  → Create ClientNotification INVOICE_ISSUED

POST /api/quotes/[id]/send
  → Send quote-for-approval email
  → Create ClientNotification QUOTE_READY
```

### Payment routes:
```
GET /api/checkout/verify (on success)
  → Send payment-confirmed email
  → Create ClientNotification PAYMENT_CONFIRMED
  → Create AdminNotification RTW_ORDER_PLACED

POST /api/checkout/bank-transfer
  → Send bank-transfer-received email

PATCH /api/admin/payments/[id]/confirm
  → Send bank-transfer-confirmed email
  → Create ClientNotification PAYMENT_CONFIRMED
```

### Client/Auth routes:
```
Auto-onboarding (src/lib/client-onboarding.ts)
  → Send welcome-credentials email

POST /api/auth/reset-password
  → Send password-reset email
```

### Reviews/Testimonials:
```
POST /api/products/[slug]/reviews
  → Create AdminNotification REVIEW_SUBMITTED

POST /api/account/testimonials
  → Create AdminNotification TESTIMONIAL_SUBMITTED
```

### Careers:
```
POST /api/careers/[slug]/apply
  → Send contact-auto-reply email to applicant
  → Send admin-job-application email to admin
  → Create AdminNotification JOB_APPLICATION
```

### Loyalty:
```
// In points calculation after purchase:
// If tier changes:
  → Send loyalty-tier-upgrade email
  → Create ClientNotification LOYALTY_TIER_UPGRADE
```

### Cron jobs:
```
/api/cron/daily-report (11pm daily)
  → Send daily-report email to General Admin email

/api/cron/weekly-report (7am Monday)
  → Send weekly-report email to General Admin email

/api/cron/review-requests (9am daily)
  → Send product-review-request to eligible clients

/api/cron/event-reminders (8am daily)
  → Check EventDate records 56 days (8 weeks) away
  → Send event-reminder email
  → Create ClientNotification EVENT_REMINDER

/api/cron/balance-reminders (9am daily)
  → Find BespokeOrders where balance > 0 
    AND deliveryDate within 14 days
    AND no reminder sent in last 7 days
  → Send balance-reminder email
  → Create ClientNotification BALANCE_REMINDER

/api/cron/late-staff-alert (runs at resumption time)
  → Find staff not clocked in
  → Send admin-late-staff email to HR Manager
  → Create AdminNotification STAFF_LATE
```

---

## SECTION 6 — ADMIN EMAIL TEMPLATE EDITOR

In `/admin/content/pages` → **"Email Templates"** section:

List of all editable templates grouped by category:

```
CLIENT EMAILS
  ○ Welcome & Credentials
  ○ Consultation Confirmed
  ○ Meeting Link
  ○ Session Summary
  ○ Atelier Stage Emails (×13)
  ○ Invoice Issued
  ○ Quote for Approval
  ○ Payment Confirmed
  ○ Bank Transfer Received
  ○ Bank Transfer Confirmed
  ○ RTW Order Confirmed
  ○ RTW Order Shipped
  ○ RTW Delivered
  ○ Review Request — Product
  ○ Review Request — Consultation
  ○ Password Reset
  ○ Loyalty Tier Upgrade
  ○ Event Reminder
  ○ Referral Reward
  ○ Outstanding Balance Reminder

ADMIN EMAILS
  ○ Daily Report
  ○ Weekly Report
  ○ New Contact Form
  ○ Low Stock Alert
  ○ Late Staff Alert
  ○ Job Application Received

STAFF EMAILS
  ○ Staff Invitation
  ○ Stage Assignment
```

Each template editor shows:
```
Template: [Consultation Confirmed]
──────────────────────────────────

Subject line:
[Your consultation is confirmed — Prudential Atelier]

Heading:
[Your consultation is confirmed, {{firstName}}.]

Body paragraph 1:
[textarea]

Body paragraph 2:
[textarea]

CTA Button label:
[View consultation details]

Preview: [SEND TEST EMAIL →]
  Sends a test to the currently logged-in admin's email

[SAVE TEMPLATE]
```

Available variables shown below each field:
`{{firstName}}`, `{{email}}`, `{{orderRef}}`, etc.

Saves to SiteSetting keys:
`email_consultation_confirmed_subject`,
`email_consultation_confirmed_heading`, etc.

---

## SECTION 7 — EMAIL SENDER UTILITY UPDATE

Update `src/lib/email.ts` (or equivalent):

```typescript
// Central email sender that:
// 1. Reads template content from SiteSetting (with defaults)
// 2. Reads logo URL from SiteSetting
// 3. Renders the React Email template
// 4. Sends via Nodemailer

export async function sendTemplatedEmail(params: {
  to: string
  templateKey: string
  variables: Record<string, string>
  attachments?: EmailAttachment[]
}): Promise<void>

// Logo helper:
export async function getEmailLogo(): Promise<string | null> {
  const setting = await prisma.siteSetting.findUnique({
    where: { key: 'logo_dark' }
  })
  return setting?.value || null
}
```

---

## EXECUTION ORDER

1. Build `BaseEmail.tsx` with logo from SiteSetting
2. Build all 29 email templates in `src/emails/`
3. Add `ClientNotification` schema → `prisma db push`
4. Build `src/lib/client-notify.ts` helper
5. Add client notification bell to AccountShell
6. Add staff notification bell to staff portal
7. Wire all consultation triggers
8. Wire all atelier/bespoke triggers
9. Wire all payment triggers
10. Wire all client/auth triggers
11. Wire all review/testimonial triggers
12. Wire all career triggers
13. Wire all loyalty triggers
14. Wire all cron jobs (event reminders, balance reminders)
15. Build admin email template editor in CMS
16. Update `src/lib/email.ts` to use SiteSetting content
17. `pnpm exec tsc --noEmit` — must pass
18. Commit and push

---

## COMPLETION CHECKLIST

- [ ] BaseEmail.tsx uses logo from SiteSetting
- [ ] All 29 email templates built with consistent branding
- [ ] ClientNotification model in schema
- [ ] Client notification bell works in account dashboard
- [ ] Staff notification bell works in staff portal
- [ ] All consultation emails fire correctly
- [ ] All 13 atelier stage emails fire correctly
- [ ] All payment emails fire correctly
- [ ] Welcome email fires on auto-onboarding
- [ ] Daily report email fires at 11pm via cron
- [ ] Weekly report email fires Monday 7am via cron
- [ ] Event reminder email fires 8 weeks before event
- [ ] Balance reminder fires 14 days before delivery
- [ ] Admin email template editor works for all templates
- [ ] Test email sends from admin CMS
- [ ] Logo shows correctly in all emails
- [ ] `pnpm build` passes with zero TypeScript errors

---

*Prepared by SonsHub Media Ltd for Prudential Atelier — prudentgabriel.com*
*₦7,500,000 engagement · Full Notifications + Email System*
