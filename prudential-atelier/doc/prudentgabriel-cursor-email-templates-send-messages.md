# CURSOR AI — PRUDENTGABRIEL.COM
## Feature: Email Templates + Send Email + Messages Pages
### Prepared by SonsHub Media Ltd (Nony — Okafor Chinonso Daniel)

---

## CRITICAL INSTRUCTIONS

1. Read the entire prompt before writing any code.
2. All three pages are admin-only (ADMIN + SUPER_ADMIN).
3. Email sending uses the existing Nodemailer + Namecheap SMTP setup.
4. Run `pnpm exec tsc --noEmit` after all changes.

---

## ADMIN SIDEBAR UPDATE

Add three new links under the CONTENT section:

```
CONTENT
  Overview
  Page content
  Blog / Journal
  Reviews
  Portfolio gallery
  Media library
  Messages          ← new (1st)
  Email Templates   ← new (2nd)
  Send Email        ← new (3rd)
```

---

## PAGE 1 — EMAIL TEMPLATES (`/admin/content/email-templates`)

### Layout:

Two-column layout:
- Left sidebar (240px): grouped template list
- Right content area: selected template editor

### Left sidebar — template groups:

```
CLIENT EMAILS
  • Welcome & Credentials
  • Consultation Confirmed
  • Meeting Link
  • Session Summary
  • Atelier Stage Update
  • Invoice Issued
  • Quote for Approval
  • Payment Confirmed
  • Bank Transfer Received
  • Bank Transfer Confirmed
  • RTW Order Confirmed
  • RTW Order Shipped
  • RTW Order Delivered
  • Product Review Request
  • Consultation Review Request
  • Password Reset
  • Loyalty Tier Upgrade
  • Event Reminder
  • Referral Reward
  • Balance Reminder

ADMIN EMAILS
  • Daily Report
  • Weekly Report
  • New Contact Form
  • Low Stock Alert
  • Late Staff Alert
  • Job Application Received

STAFF EMAILS
  • Staff Invitation
  • Stage Assignment
```

Each item:
- Jost 12px, var(--text-mid)
- Active: background rgba(68,41,19,0.08), 
  border-left 2px solid var(--choc), var(--choc)
- "Last edited" date shown on hover as tooltip

### Right content area — template editor:

```
[Template Name]                    Last edited: [date]
────────────────────────────────────────────────────────

SUBJECT LINE
[________________________]

Available variables:
{{firstName}} {{lastName}} {{email}} {{orderRef}} 
{{outfitName}} {{amount}} {{date}} {{link}}

HEADING
[________________________]

BODY PARAGRAPH 1
[________________________________]
[________________________________]
[________________________________]

BODY PARAGRAPH 2 (optional)
[________________________________]
[________________________________]

CTA BUTTON LABEL
[________________________]

CTA BUTTON LINK
[________________________]

FOOTER NOTE (optional)
[________________________]

────────────────────────────────────────────────────────

SEND TEST EMAIL
To: [input — pre-filled with admin's own email]
[SEND TEST EMAIL →]

[SAVE TEMPLATE]
```

### SiteSetting keys pattern:

Each template saves these keys:
```
email_[template_key]_subject
email_[template_key]_heading
email_[template_key]_body_1
email_[template_key]_body_2
email_[template_key]_cta_label
email_[template_key]_cta_link
email_[template_key]_footer_note
```

### Template keys:

```typescript
export const EMAIL_TEMPLATE_KEYS = {
  // Client emails
  WELCOME_CREDENTIALS:           'welcome_credentials',
  CONSULTATION_CONFIRMED:        'consultation_confirmed',
  MEETING_LINK:                  'meeting_link',
  SESSION_SUMMARY:               'session_summary',
  ATELIER_STAGE_UPDATE:          'atelier_stage_update',
  INVOICE_ISSUED:                'invoice_issued',
  QUOTE_APPROVAL:                'quote_approval',
  PAYMENT_CONFIRMED:             'payment_confirmed',
  BANK_TRANSFER_RECEIVED:        'bank_transfer_received',
  BANK_TRANSFER_CONFIRMED:       'bank_transfer_confirmed',
  RTW_ORDER_CONFIRMED:           'rtw_order_confirmed',
  RTW_ORDER_SHIPPED:             'rtw_order_shipped',
  RTW_ORDER_DELIVERED:           'rtw_order_delivered',
  PRODUCT_REVIEW_REQUEST:        'product_review_request',
  CONSULTATION_REVIEW_REQUEST:   'consultation_review_request',
  PASSWORD_RESET:                'password_reset',
  LOYALTY_TIER_UPGRADE:          'loyalty_tier_upgrade',
  EVENT_REMINDER:                'event_reminder',
  REFERRAL_REWARD:               'referral_reward',
  BALANCE_REMINDER:              'balance_reminder',
  // Admin emails
  DAILY_REPORT:                  'daily_report',
  WEEKLY_REPORT:                 'weekly_report',
  CONTACT_FORM:                  'contact_form',
  LOW_STOCK:                     'low_stock',
  LATE_STAFF:                    'late_staff',
  JOB_APPLICATION:               'job_application',
  // Staff emails
  STAFF_INVITATION:              'staff_invitation',
  STAGE_ASSIGNMENT:              'stage_assignment',
} as const
```

### API routes:

```
GET  /api/admin/email-templates
  Returns all template SiteSetting values as a map
  { [key]: { subject, heading, body_1, body_2, cta_label, cta_link, footer_note } }

PATCH /api/admin/email-templates/[key]
  Body: { subject?, heading?, body_1?, body_2?, 
          cta_label?, cta_link?, footer_note? }
  Upserts the SiteSetting keys for this template

POST /api/admin/email-templates/[key]/test
  Body: { to: string }
  Sends a test email to `to` using the template
  Replaces variables with demo values:
    {{firstName}} → "Amaka"
    {{orderRef}} → "ORD-2847"
    {{amount}} → "₦325,000"
    {{outfitName}} → "Custom Asoebi Gown"
    {{date}} → current date formatted
    {{link}} → "https://prudentgabriel.vercel.app"
  Returns: { success: true, messageId }
```

### Default template content:

Seed default content for all 28 templates via
`scripts/seed-email-templates.ts`:

```typescript
// Add to package.json:
"seed:email-templates": "tsx scripts/seed-email-templates.ts"

// Seeds sensible defaults for all template keys
// Uses upsert so running again won't overwrite customisations
// Only creates if key doesn't exist
```

---

## PAGE 2 — SEND EMAIL (`/admin/content/send-email`)

### Layout:

Single-column, max-width 720px, centered.

```
COMPOSE EMAIL
──────────────────────────────────────────────────

TO
○ Specific client
  [Search client by name or email]
  Shows: avatar + name + email in dropdown

○ All clients (registered users with CUSTOMER role)
  "[X] recipients"

○ Gold + Platinum members only
  "[X] recipients"

○ Clients with active atelier orders
  "[X] recipients"

○ Clients with upcoming consultations
  "[X] recipients"

○ Custom email address
  [input: email address]

──────────────────────────────────────────────────

USE TEMPLATE (optional)
[Select a template ▾]
When selected: auto-fills subject and body below.

──────────────────────────────────────────────────

SUBJECT
[________________________]

MESSAGE
[TipTap rich text editor]
Toolbar: Bold · Italic · Heading · Link · 
         Bulleted list · Numbered list

──────────────────────────────────────────────────

[PREVIEW]  [SEND EMAIL →]
```

### Preview modal:

Shows the email rendered inside the BaseEmail 
template with the logo — exactly as the client 
will receive it.

### Send button behaviour:

For single recipient: send immediately.
For bulk (All clients etc.):
- Show progress bar
- Process in batches of 50
- Poll `GET /api/admin/send-email/[jobId]/status`
- Show: "Sending... 45 / 200 sent"
- On complete: "✓ Email sent to 200 recipients"

### API routes:

```
POST /api/admin/send-email
Body: {
  recipientType: 'specific' | 'all' | 'gold_platinum' | 
                 'active_orders' | 'upcoming_consultations' | 'custom'
  specificUserId?: string
  customEmail?: string
  subject: string
  body: string  // HTML from TipTap
  templateKey?: string
}

Response: { jobId: string, recipientCount: number }

Logic:
1. Build recipient list based on recipientType
2. For single: send immediately, return { success: true }
3. For bulk: create a background job, return jobId
4. Log to ActivityLog: EMAIL_SENT, 
   meta: { subject, recipientCount, recipientType }

GET /api/admin/send-email/[jobId]/status
Returns: { total, sent, failed, status: 'pending'|'sending'|'done'|'failed' }
```

Access: ADMIN and SUPER_ADMIN only.

---

## PAGE 3 — MESSAGES (`/admin/content/messages`)

### Schema addition:

```prisma
model ContactMessage {
  id         String   @id @default(cuid())
  name       String
  email      String
  phone      String?
  subject    String
  message    String   @db.Text
  isRead     Boolean  @default(false)
  isReplied  Boolean  @default(false)
  repliedAt  DateTime?
  repliedBy  String?  // admin userId
  replyNote  String?  // internal note about reply
  ipAddress  String?  // for spam detection
  createdAt  DateTime @default(now())

  @@index([isRead, createdAt])
}
```

Run `prisma db push`.

**Update `POST /api/contact`** to save to 
`ContactMessage` model instead of (or in addition to)
just sending email.

### Messages page layout:

```
MESSAGES
──────────────────────────────────────────────────
[X] unread messages                    [Mark all read]

Filters: [All ▾]  [Unread]  [Read]  [Replied]

Search: [________________________]

┌──────────────────────────────────────────────────────────┐
│ ● Kemi Adesanya                      June 7, 2026        │
│   Book a Consultation                                    │
│   "I would love to book a consultation for my..."       │
│                                              [View]      │
├──────────────────────────────────────────────────────────┤
│   Tunde Williams                     June 6, 2026        │
│   General Enquiry                                        │
│   "I saw your work at an event and I'm interested..."   │
│                                              [View]      │
└──────────────────────────────────────────────────────────┘
```

Unread messages: bold name, filled dot indicator
Read messages: normal weight, no dot

### Message detail (right panel or modal):

```
Kemi Adesanya                        June 7, 2026 · 2:34 PM
kemi.adesanya@gmail.com
+234 803 456 7890

SUBJECT: Book a Consultation

MESSAGE:
"I would love to book a consultation for my 
 daughter's wedding in December. Please advise 
 on the best option for me."

──────────────────────────────────────────────────

REPLY OPTIONS

○ Send email reply
  [TipTap editor — reply body]
  [SEND REPLY →]
  → Sends email via Nodemailer
  → Marks message as isReplied: true

○ Log reply note (internal — no email sent)
  [textarea — internal note]
  [SAVE NOTE]
  → Records replyNote without sending email
  → Marks isReplied: true

──────────────────────────────────────────────────

[← Back to messages]  [Mark as unread]  [Delete]
```

### When message is opened:
- Mark `isRead: true` automatically
- Update unread count in admin sidebar badge

### Sidebar badge:
Show unread message count on "Messages" link 
in admin sidebar (same pattern as consultation badge).

### API routes:

```
GET    /api/admin/messages
  Query params: filter, search, page
  Returns paginated ContactMessage list
  Includes unread count

GET    /api/admin/messages/[id]
  Returns single message
  Marks isRead: true on fetch

PATCH  /api/admin/messages/[id]
  Body: { isRead?, isReplied?, replyNote? }

POST   /api/admin/messages/[id]/reply
  Body: { replyBody: string }
  Sends email reply to message.email
  Marks isReplied: true, repliedAt: now(), repliedBy: session.user.id
  Logs to ActivityLog

DELETE /api/admin/messages/[id]
  Hard deletes the message
```

---

## EXECUTION ORDER

1. Add `ContactMessage` model to schema → `prisma db push`
2. Update `POST /api/contact` to save ContactMessage
3. Build Messages page (`/admin/content/messages`)
4. Build Messages API routes
5. Add unread badge to sidebar Messages link
6. Build Email Templates page (`/admin/content/email-templates`)
7. Build email templates API routes (GET, PATCH, test)
8. Create `scripts/seed-email-templates.ts` with defaults
9. Run `pnpm run seed:email-templates`
10. Build Send Email page (`/admin/content/send-email`)
11. Build send email API routes
12. Update admin sidebar with all 3 new links
13. `pnpm exec tsc --noEmit` — must pass
14. Commit and push

---

## COMPLETION CHECKLIST

- [ ] `ContactMessage` model in schema and pushed to Neon
- [ ] Contact form submissions save to ContactMessage
- [ ] `/admin/content/messages` loads with message list
- [ ] Unread messages show bold with dot indicator
- [ ] Opening a message marks it as read
- [ ] Admin can reply via email from message detail
- [ ] Admin can log internal reply note
- [ ] Unread count badge on sidebar Messages link
- [ ] `/admin/content/email-templates` loads
- [ ] All 28 templates listed in left sidebar
- [ ] Selecting a template loads its editable fields
- [ ] Saving a template updates SiteSetting keys
- [ ] "Send test email" sends a test with dummy variables
- [ ] Default template content seeded
- [ ] `/admin/content/send-email` loads
- [ ] Recipient type selector works
- [ ] Template selector pre-fills subject and body
- [ ] Single email sends correctly
- [ ] Bulk email shows progress
- [ ] All sends logged to ActivityLog
- [ ] `pnpm build` passes with zero TypeScript errors

---

*Prepared by SonsHub Media Ltd for Prudential Atelier — prudentgabriel.com*
*₦7,500,000 engagement · Email Templates + Send Email + Messages*
