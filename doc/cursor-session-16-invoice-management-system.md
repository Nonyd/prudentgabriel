# CURSOR SESSION PROMPT — SESSION 16
## Invoice Management System — Prudential Atelier Bespoke
### Prudent Gabriel · prudentgabriel.com
### Prepared by Nony | SonsHub Media

---

> ## ⚠️ MANDATORY PRE-FLIGHT
>
> 1. **Never recreate files that exist.** Read File before creating.
> 2. **No `any` types.** All types derived from Prisma or explicit interfaces.
> 3. **This session adds new DB models** — run `npx prisma generate && npx prisma db push` after schema.
> 4. **PDF generation uses `@react-pdf/renderer`** — install if not present.
> 5. **All business details (address, bank, phone) are pulled from SiteSettings** — never hardcoded.
> 6. After every task: `npx tsc --noEmit` must pass.

---

## INSTALL DEPENDENCY

```bash
npm install @react-pdf/renderer
npm install --save-dev @types/react-pdf
```

---

## BUSINESS DETAILS — ALL CONFIGURABLE FROM ADMIN SETTINGS

All invoice header details come from `SiteSetting` records.
Add these to the settings seed:

**Add to `prisma/seed.ts`** under a new `INVOICE` group:

```typescript
// Add INVOICE to SettingGroup enum in schema.prisma first:
// enum SettingGroup {
//   ...existing...
//   INVOICE
// }

const invoiceSettings = [
  // Business Identity
  { key: 'invoice_business_name', value: 'Prudential Atelier', group: 'INVOICE', label: 'Business Name on Invoice', type: 'TEXT', isPublic: false, sortOrder: 1 },
  { key: 'invoice_tagline', value: 'A Division of Prudent Gabriel', group: 'INVOICE', label: 'Tagline (below business name)', type: 'TEXT', isPublic: false, sortOrder: 2 },
  { key: 'invoice_address_line1', value: '14 Atelier Close', group: 'INVOICE', label: 'Address Line 1', type: 'TEXT', isPublic: false, sortOrder: 3 },
  { key: 'invoice_address_line2', value: 'Victoria Island', group: 'INVOICE', label: 'Address Line 2', type: 'TEXT', isPublic: false, sortOrder: 4 },
  { key: 'invoice_city', value: 'Lagos, Nigeria', group: 'INVOICE', label: 'City / State / Country', type: 'TEXT', isPublic: false, sortOrder: 5 },
  { key: 'invoice_phone', value: '+234 000 000 0000', group: 'INVOICE', label: 'Phone Number', type: 'TEXT', isPublic: false, sortOrder: 6 },
  { key: 'invoice_email', value: 'hello@prudentgabriel.com', group: 'INVOICE', label: 'Invoice Email', type: 'TEXT', isPublic: false, sortOrder: 7 },
  { key: 'invoice_website', value: 'www.prudentgabriel.com', group: 'INVOICE', label: 'Website', type: 'TEXT', isPublic: false, sortOrder: 8 },
  { key: 'invoice_rc_number', value: 'RC 0000000', group: 'INVOICE', label: 'CAC/RC Number', type: 'TEXT', isPublic: false, sortOrder: 9 },
  { key: 'invoice_show_rc', value: 'false', group: 'INVOICE', label: 'Show RC Number on Invoice', type: 'BOOLEAN', isPublic: false, sortOrder: 10 },
  
  // Bank Details — NGN
  { key: 'invoice_bank_name_ngn', value: 'First Bank of Nigeria', group: 'INVOICE', label: 'Bank Name (NGN)', type: 'TEXT', isPublic: false, sortOrder: 20 },
  { key: 'invoice_account_name_ngn', value: 'Prudential Atelier Ltd', group: 'INVOICE', label: 'Account Name (NGN)', type: 'TEXT', isPublic: false, sortOrder: 21 },
  { key: 'invoice_account_number_ngn', value: '0000000000', group: 'INVOICE', label: 'Account Number (NGN)', type: 'TEXT', isPublic: false, sortOrder: 22 },
  
  // Bank Details — USD
  { key: 'invoice_bank_name_usd', value: 'Wise (TransferWise)', group: 'INVOICE', label: 'Bank Name (USD)', type: 'TEXT', isPublic: false, sortOrder: 23 },
  { key: 'invoice_account_name_usd', value: 'Prudential Atelier Ltd', group: 'INVOICE', label: 'Account Name (USD)', type: 'TEXT', isPublic: false, sortOrder: 24 },
  { key: 'invoice_account_number_usd', value: '0000000000', group: 'INVOICE', label: 'Account Number / IBAN (USD)', type: 'TEXT', isPublic: false, sortOrder: 25 },
  { key: 'invoice_sort_code_usd', value: '', group: 'INVOICE', label: 'Sort Code / Routing Number (USD)', type: 'TEXT', isPublic: false, sortOrder: 26 },
  
  // Bank Details — GBP
  { key: 'invoice_bank_name_gbp', value: 'Wise (TransferWise)', group: 'INVOICE', label: 'Bank Name (GBP)', type: 'TEXT', isPublic: false, sortOrder: 27 },
  { key: 'invoice_account_name_gbp', value: 'Prudential Atelier Ltd', group: 'INVOICE', label: 'Account Name (GBP)', type: 'TEXT', isPublic: false, sortOrder: 28 },
  { key: 'invoice_account_number_gbp', value: '0000000000', group: 'INVOICE', label: 'Account Number / IBAN (GBP)', type: 'TEXT', isPublic: false, sortOrder: 29 },
  { key: 'invoice_sort_code_gbp', value: '', group: 'INVOICE', label: 'Sort Code (GBP)', type: 'TEXT', isPublic: false, sortOrder: 30 },
  
  // Invoice Defaults
  { key: 'invoice_default_vat', value: '0', group: 'INVOICE', label: 'Default VAT % (0 = no VAT)', type: 'NUMBER', isPublic: false, sortOrder: 40 },
  { key: 'invoice_default_due_days', value: '7', group: 'INVOICE', label: 'Default Payment Due (days)', type: 'NUMBER', isPublic: false, sortOrder: 41 },
  { key: 'invoice_default_currency', value: 'NGN', group: 'INVOICE', label: 'Default Invoice Currency', type: 'SELECT', isPublic: false, sortOrder: 42 },
  { key: 'invoice_footer_note', value: 'Thank you for choosing Prudential Atelier. We look forward to creating something extraordinary for you.', group: 'INVOICE', label: 'Invoice Footer Note', type: 'TEXTAREA', isPublic: false, sortOrder: 43 },
  { key: 'invoice_deposit_terms', value: '50% deposit required to commence. Balance due before delivery.', group: 'INVOICE', label: 'Default Payment Terms', type: 'TEXTAREA', isPublic: false, sortOrder: 44 },
  { key: 'invoice_logo_url', value: '/images/atelier-logo.png', group: 'INVOICE', label: 'Invoice Logo URL', type: 'IMAGE', isPublic: false, sortOrder: 45 },
  { key: 'invoice_prefix', value: 'PA-INV', group: 'INVOICE', label: 'Invoice Number Prefix', type: 'TEXT', isPublic: false, sortOrder: 46 },
]

for (const s of invoiceSettings) {
  await prisma.siteSetting.upsert({
    where: { key: s.key },
    update: {},
    create: s,
  })
}
```

---

## PRISMA SCHEMA ADDITIONS

```prisma
// Add INVOICE to SettingGroup enum
// Add to existing enum:
// INVOICE

model Invoice {
  id              String        @id @default(cuid())
  invoiceNumber   String        @unique  // "PA-INV-2025-0042"
  
  // Linked to bespoke request
  bespokeRequestId String?
  bespokeRequest   BespokeRequest? @relation(fields: [bespokeRequestId], references: [id])
  
  // Client info (snapshot at time of invoice creation)
  clientName      String
  clientEmail     String
  clientPhone     String?
  clientAddress   String?
  clientCity      String?
  clientCountry   String        @default("Nigeria")
  clientInstagram String?
  
  // Invoice details
  currency        String        @default("NGN")  // NGN, USD, GBP
  exchangeRate    Float         @default(1)       // rate used at time of invoice
  
  status          InvoiceStatus @default(DRAFT)
  
  // Line items stored as JSON
  lineItems       Json          // InvoiceLineItem[]
  
  // Financials
  subtotal        Float         // sum of line items
  discountType    String?       // "PERCENTAGE" | "FIXED"
  discountValue   Float         @default(0)
  discountAmount  Float         @default(0)  // calculated
  vatEnabled      Boolean       @default(false)
  vatPercent      Float         @default(0)
  vatAmount       Float         @default(0)  // calculated
  total           Float         // final total
  
  // Deposits / Payments
  depositRequired Float         @default(0)  // e.g. 50% of total
  depositPaid     Float         @default(0)
  balanceDue      Float         @default(0)  // total - depositPaid
  
  // Payment info
  paymentTerms    String?       // "50% deposit, balance before delivery"
  dueDate         DateTime?
  paidAt          DateTime?
  paymentMethod   String?       // "Bank Transfer", "Paystack", "Cash"
  paymentRef      String?
  
  // Notes
  notes           String?       @db.Text  // internal admin notes
  clientNote      String?       @db.Text  // message shown to client on invoice
  
  // VAT toggle
  showVat         Boolean       @default(false)
  showRcNumber    Boolean       @default(false)
  
  // Tracking
  sentAt          DateTime?     // when email was sent to client
  viewedAt        DateTime?     // when client first viewed online
  viewCount       Int           @default(0)
  
  // Access
  publicToken     String        @unique @default(cuid())  // for /invoice/[token] public view
  
  createdBy       String?       // admin userId
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([status])
  @@index([clientEmail])
  @@index([bespokeRequestId])
  @@index([publicToken])
}

enum InvoiceStatus {
  DRAFT           // Being prepared
  SENT            // Emailed to client
  VIEWED          // Client opened the link
  PARTIALLY_PAID  // Deposit received
  PAID            // Fully paid
  OVERDUE         // Past due date, unpaid
  CANCELLED       // Cancelled/voided
}

// Add to BespokeRequest:
// invoices Invoice[]
```

### TypeScript interface for line items (in `src/types/invoice.ts`):
```typescript
export interface InvoiceLineItem {
  id: string           // nanoid
  description: string  // "Custom Bridal Gown — Ivory Duchess Satin"
  details?: string     // "With cathedral train, hand-beaded bodice, removable sleeves"
  quantity: number     // usually 1 for bespoke
  unitPrice: number    // in invoice currency
  amount: number       // quantity * unitPrice
}

export interface InvoiceBusinessDetails {
  businessName: string
  tagline: string
  addressLine1: string
  addressLine2: string
  city: string
  phone: string
  email: string
  website: string
  rcNumber: string
  showRc: boolean
  logoUrl: string
  footerNote: string
}

export interface InvoiceBankDetails {
  currency: 'NGN' | 'USD' | 'GBP'
  bankName: string
  accountName: string
  accountNumber: string
  sortCode?: string
}
```

---

## TASK A — INVOICE NUMBER GENERATOR

**Add to `src/lib/invoice.ts`** (new file):

```typescript
import { prisma } from './prisma'
import { getSettings } from './settings'

// generateInvoiceNumber(): Promise<string>
//   Get prefix from settings: invoice_prefix (default "PA-INV")
//   Get current year: new Date().getFullYear()
//   Count existing invoices this year + 1
//   Format: "PA-INV-2025-0042" (4-digit padded)

// getInvoiceSettings(): Promise<InvoiceBusinessDetails>
//   Fetch all INVOICE group settings
//   Return as structured InvoiceBusinessDetails object

// getBankDetails(currency: 'NGN'|'USD'|'GBP'): Promise<InvoiceBankDetails>
//   Fetch bank settings for the given currency
//   Return structured InvoiceBankDetails

// calculateInvoiceTotals(params: {
//   lineItems: InvoiceLineItem[]
//   discountType?: 'PERCENTAGE' | 'FIXED'
//   discountValue?: number
//   vatEnabled?: boolean
//   vatPercent?: number
//   depositPercent?: number  // e.g. 50 for 50%
// }): {
//   subtotal: number
//   discountAmount: number
//   vatAmount: number
//   total: number
//   depositRequired: number
//   balanceDue: number
// }

// formatInvoiceCurrency(amount: number, currency: 'NGN'|'USD'|'GBP'): string
//   NGN: "₦1,500,000"
//   USD: "$1,000"
//   GBP: "£800"
```

---

## TASK B — INVOICE API ROUTES

### B1 — Admin Invoice APIs

**`src/app/api/admin/invoices/route.ts`** (GET, POST):
```typescript
// GET: paginated invoices
//   Query: status, search (client name/email/invoice#), page, limit (20)
//   Include: bespokeRequest (requestNumber, occasion)
//   OrderBy: createdAt desc
//   Return: { invoices, total, page, totalPages }

// POST: Create new invoice
//   Body: CreateInvoiceInput (see schema below)
//   generateInvoiceNumber()
//   calculateInvoiceTotals()
//   Create Invoice record
//   Return: created invoice
```

**`src/app/api/admin/invoices/[id]/route.ts`** (GET, PATCH, DELETE):
```typescript
// GET: full invoice with bespokeRequest
// PATCH: update any field, recalculate totals if lineItems/discount/vat changed
// DELETE: only if status === DRAFT
```

**`src/app/api/admin/invoices/[id]/send/route.ts`** (POST):
```typescript
// Send invoice email to client
// Build invoice HTML email using InvoiceEmailTemplate
// Send via Resend/Brevo
// Update: sentAt: new Date(), status: SENT (if was DRAFT)
// Return: { success: true }
```

**`src/app/api/admin/invoices/[id]/pdf/route.ts`** (GET):
```typescript
// Generate PDF using @react-pdf/renderer
// Return as application/pdf with Content-Disposition: attachment
// Filename: "[invoiceNumber].pdf"
```

**`src/app/api/admin/invoices/[id]/mark-paid/route.ts`** (PATCH):
```typescript
// Body: { amount: number, method: string, reference?: string, fullPayment: boolean }
// If fullPayment: status → PAID, paidAt: new Date(), balanceDue: 0
// If partial (deposit): status → PARTIALLY_PAID, depositPaid += amount, recalculate balanceDue
// Return: updated invoice
```

### B2 — Public Invoice View API

**`src/app/api/invoice/[token]/route.ts`** (GET — public, no auth):
```typescript
// Fetch invoice by publicToken
// If not found: 404
// If found: increment viewCount, set viewedAt if first view
// Return: safe invoice data (exclude internal notes, createdBy)
// Include: businessDetails from settings
```

---

## TASK C — INVOICE PDF TEMPLATE

**Create `src/components/invoice/InvoicePDF.tsx`**:

```typescript
// Uses @react-pdf/renderer
// import { Document, Page, Text, View, Image, StyleSheet, Font } from '@react-pdf/renderer'

// Register fonts:
// Font.register({ family: 'Jost', src: '/fonts/Jost-Regular.ttf' })
// (Use system fonts as fallback if custom fonts not available)

// A4 page, portrait

// DESIGN — clean, elegant, minimal:
```

```
PAGE LAYOUT (A4, 595 × 842pt, padding 48pt all sides):

── HEADER (flex row, justify-between):
  
  LEFT:
    Logo image (120pt wide, auto height)
    Business name (16pt, bold, #0A0A0A, mt-8)
    Tagline (9pt, #8A8A85, mt-2)
  
  RIGHT (text-right):
    "INVOICE" (28pt, bold, #0A0A0A, letter-spacing 4)
    Invoice number (11pt, #37392d, mt-4): "PA-INV-2025-0042"
    Status badge:
      DRAFT:   bg #F2F2F0, text #6B6B68
      SENT:    bg #E8F4FF, text #1A5FAD
      PAID:    bg #E8F5E9, text #1B5E20
      OVERDUE: bg #FDECEA, text #8B1A1A

── THIN DIVIDER (1pt, #E8E8E4, mt-16, mb-16)

── DATE + DUE DATE ROW (flex, gap between):
  "Date Issued:" label (8pt uppercase tracking, #A8A8A4)
  Value (10pt, #0A0A0A)
  |  divider  |
  "Due Date:" label
  Value (10pt, #0A0A0A, bold if overdue)
  |  divider  |
  "Invoice #:" label
  Value (10pt, #37392d)

── BILLING SECTION (flex row, gap 40pt, mt-20):
  
  FROM (left):
    "FROM" label (7pt uppercase tracking, #A8A8A4, mb-6)
    Business name (11pt bold, #0A0A0A)
    Address line 1 (9pt, #6B6B68)
    Address line 2 (9pt, #6B6B68)
    City (9pt, #6B6B68)
    Phone (9pt, #6B6B68)
    Email (9pt, #37392d)
    Website (9pt, #6B6B68)
    RC Number (9pt, #6B6B68) — only if showRc
  
  TO (right):
    "BILL TO" label (7pt uppercase tracking, #A8A8A4, mb-6)
    Client name (11pt bold, #0A0A0A)
    Client email (9pt, #6B6B68)
    Client phone (9pt, #6B6B68)
    Client address (9pt, #6B6B68)
    Client city/country (9pt, #6B6B68)

── LINE ITEMS TABLE (mt-24):
  
  TABLE HEADER (bg #37392d, padding 8pt 12pt):
    "DESCRIPTION"  (8pt uppercase, white, flex-1)
    "QTY"          (8pt uppercase, white, width 40pt, text-center)
    "UNIT PRICE"   (8pt uppercase, white, width 80pt, text-right)
    "AMOUNT"       (8pt uppercase, white, width 80pt, text-right)
  
  ROWS (alternating bg: white / #FAFAF8):
    Description (10pt, #0A0A0A, flex-1)
    Details (9pt, #8A8A85, italic, mt-2) — if present
    Qty (10pt, #0A0A0A, width 40pt, text-center)
    Unit Price (10pt, #0A0A0A, width 80pt, text-right)
    Amount (10pt, #0A0A0A bold, width 80pt, text-right)
    
    Bottom border each row: 0.5pt #F0F0EE
  
  TOTALS SECTION (right-aligned, mt-12):
    Row: "Subtotal"    value (10pt each)
    Row: "Discount [X%] / [Fixed]"  value (olive text) — if discount > 0
    Row: "VAT [X%]"   value — if vatEnabled
    ────────────────── (1pt divider)
    Row: "TOTAL"       value (12pt BOLD, #0A0A0A)
    
    If deposit:
    ────────────────── (0.5pt divider, mt-8)
    Row: "Deposit Required (50%)"  value (10pt, #37392d)
    Row: "Deposit Paid"            value (10pt, green if paid)
    Row: "BALANCE DUE"             value (11pt BOLD, #8B1A1A if > 0, green if 0)

── PAYMENT TERMS (mt-20, bg-[#FAFAF8], padding 12pt):
  "PAYMENT TERMS" label (7pt uppercase, #A8A8A4, mb-4)
  Terms text (9pt, #6B6B68)

── BANK DETAILS (mt-12, flex row, gap-24):
  (Show bank details for invoice currency)
  "PAYMENT DETAILS" label (7pt uppercase, #A8A8A4, mb-6)
  
  For NGN:
    Bank Name: value
    Account Name: value
    Account Number: value (bold)
  
  For USD/GBP:
    Bank Name: value
    Account Name: value
    Account/IBAN: value (bold)
    Sort Code: value — if set

── CLIENT NOTE (mt-16, if clientNote set):
  "NOTE" label (7pt uppercase, #A8A8A4)
  Note text (9pt italic, #6B6B68)

── FOOTER (absolute bottom-0, full width):
  Thin divider
  Left: footer note text (8pt, #A8A8A4)
  Right: "Page 1 of 1" (8pt, #A8A8A4)
  Center: website URL (8pt, #37392d)
```

---

## TASK D — PUBLIC INVOICE PAGE

**`src/app/invoice/[token]/page.tsx`** (public — no auth required):

```typescript
// Server component
// Fetch invoice by publicToken via /api/invoice/[token]
// If not found: show "Invoice not found" page
// Metadata: "Invoice [invoiceNumber] | Prudential Atelier"
```

**`src/components/invoice/PublicInvoiceView.tsx`** (client component):

```
DESIGN: Clean, premium, matches PDF layout but as HTML

HEADER BAR (bg-[#37392d], white text, padding 16px 32px):
  Left: "PRUDENTIAL ATELIER" (Jost 11px uppercase tracking)
  Right: Invoice # (Jost 12px weight-500)

STATUS BANNER (below header):
  DRAFT:        bg-[#F2F2F0], charcoal text: "This is a draft invoice"
  SENT:         bg-[#E8F4FF], blue text: "Invoice sent — awaiting payment"
  PARTIALLY_PAID: bg-[#FFF8E7], amber text: "Deposit received — balance due"
  PAID:         bg-[#E8F5E9], green text: "✓ Paid in full — Thank you!"
  OVERDUE:      bg-[#FDECEA], red text: "⚠ This invoice is overdue"

MAIN CONTENT (max-w-3xl, mx-auto, px-6, py-12):
  
  TOP ROW:
    LEFT: Logo image (120px) + business name + tagline
    RIGHT: 
      "INVOICE" (Bodoni Moda italic, 48px, black)
      Invoice number (Jost 13px, olive, mt-1)
      Status badge
  
  DIVIDER (olive, 2px, mt-6)
  
  DATE ROW (3-col grid, mt-8):
    Date Issued | Due Date | Invoice #
    Each: label (Jost 10px uppercase, dark-grey) + value (Jost 14px, black)
  
  BILLING (2-col, mt-10):
    FROM block | TO block
    (same content as PDF)
  
  LINE ITEMS TABLE (mt-10):
    Clean table, olive header
    Same structure as PDF
    Mobile: cards instead of table
  
  TOTALS (right-aligned, mt-6)
  
  PAYMENT TERMS (bg-[#FAFAF8], border 1px #EBEBEA, p-5, mt-8)
  
  BANK DETAILS (mt-6)
    Shows details for invoice currency
    Account number in large monospace: olive color
    [Copy] button next to account number (copies to clipboard, toast)
  
  CLIENT NOTE (if set, italic, mt-6)
  
  FOOTER NOTE (text-center, dark-grey, mt-10, Bodoni Moda italic 18px)

ACTION BAR (sticky bottom, bg-white, border-top 1px #EBEBEA, padding 16px 32px):
  [⬇ Download PDF] button (olive, downloads /api/invoice/[token]/pdf)
  [✉ Email Me a Copy] button (outlined)
    → sends PDF to client email on file
  
  Right: "Secured by Prudential Atelier"
```

**`src/app/api/invoice/[token]/pdf/route.ts`** (GET — public):
```typescript
// Fetch invoice by publicToken
// Generate PDF via @react-pdf/renderer
// Return as downloadable PDF
```

---

## TASK E — ADMIN INVOICE MANAGEMENT

### E1 — Invoices List Page

**`src/app/(admin)/admin/invoices/page.tsx`** (Server Component)

Add to AdminSidebar under CATALOGUE (after Bespoke Requests):
```typescript
// Icon: FileText (Lucide)
// Label: "Invoices"
// Href: /admin/invoices
```

**`src/components/admin/InvoicesClient.tsx`**:

```
PAGE HEADER:
  "Invoices" (Bodoni Moda 24px)
  Subtitle: "Prudential Atelier Bespoke"
  [+ Create Invoice] button (olive, right)

STATS ROW (4 cards):
  Total Invoiced (all time) | Outstanding (sent + unpaid) | Overdue | Paid This Month

STATUS TABS:
  All | Draft | Sent | Partially Paid | Paid | Overdue | Cancelled

FILTER ROW:
  Search (client name / email / invoice #)
  Currency filter: All | NGN | USD | GBP
  Date range

INVOICES TABLE:
  Columns:
    Invoice # (olive, Jost 12px monospace)
    Client (name + email)
    Bespoke Ref (if linked, links to /admin/bespoke/[id])
    Currency + Total
    Balance Due (red if > 0)
    Status badge
    Due Date (red if past)
    Sent (checkmark if sentAt set)
    Actions: [View] [Send] [PDF] [Mark Paid] [Delete]

ROW ACTIONS:
  [View] → /admin/invoices/[id]
  [Send] → POST /api/admin/invoices/[id]/send (confirm dialog)
  [PDF] → GET /api/admin/invoices/[id]/pdf (downloads)
  [Mark Paid] → opens MarkPaidModal
  [Delete] → only for DRAFT, confirm dialog
```

### E2 — Invoice Create/Edit Form

**`src/app/(admin)/admin/invoices/new/page.tsx`** (Server Component)
**`src/app/(admin)/admin/invoices/[id]/edit/page.tsx`** (Server Component)

Both render `InvoiceFormPage`:

**`src/components/admin/InvoiceFormPage.tsx`** (client component):

```
HEADER:
  Back ← Invoices
  "New Invoice" / "Edit Invoice #[number]"
  
  RIGHT ACTIONS (for edit mode):
    [Preview] → opens /invoice/[token] in new tab
    [Send to Client] button (olive)
    [Download PDF] button (outlined)

TWO-COLUMN LAYOUT (65% left + 35% right):

─── LEFT COLUMN ───

SECTION 1 — "Client Information":
  
  LINK TO BESPOKE (optional):
    Search/select a BespokeRequest:
      Typeahead: GET /api/admin/bespoke?search=X
      Shows: #BQ-XXXX | Client Name | Occasion
      On select: auto-fills all client fields below
    OR: "Create standalone invoice (no bespoke link)"
  
  CLIENT FIELDS (all editable, auto-filled from bespoke if linked):
    Full Name (Input, required)
    Email (Input, required)
    Phone (Input)
    Address (Input)
    City (Input)
    Country (Select, default Nigeria)
    Instagram (Input, optional)

SECTION 2 — "Invoice Details":
  
  Currency (radio cards):
    ₦ NGN | $ USD | £ GBP
    Selected: olive border
  
  Invoice Date (date input, default today)
  Due Date (date input)
    Quick buttons: [+7 days] [+14 days] [+30 days]
  
  Payment Terms (textarea, pre-filled from settings default):
    "50% deposit required to commence. Balance due before delivery."

SECTION 3 — "Line Items":
  
  Label: "What are you invoicing for?"
  
  LINE ITEMS TABLE:
    Column headers: Description | Details | Qty | Unit Price (in currency) | Amount
    
    Each row:
      Description: Input (required) — "Custom Bridal Gown"
      Details: Input (optional) — "Cathedral train, beaded bodice"
      Qty: Number input (default 1, min 1)
      Unit Price: Number input (₦/$/£)
      Amount: auto-calculated (qty × price, read-only, bold)
      [×] delete row button (red, only if > 1 row)
    
    [+ Add Line Item] button below table (ghost, Jost 11px)
    
    Preset line items (quick-add chips):
      [Gown Design] [Fabric] [Beadwork] [Alterations] [Rush Fee] [Fitting]
      Clicking: adds a new row with that description pre-filled
  
  SUBTOTAL (right-aligned, mt-4, auto-calculated): "Subtotal: [amount]"

SECTION 4 — "Adjustments":
  
  DISCOUNT:
    Toggle: "Apply Discount"
    If on:
      Radio: % Percentage | ₦/$/£ Fixed Amount
      Value input
      Shows: "Discount: -[amount]" (olive text)
  
  VAT:
    Toggle: "Apply VAT"
    If on:
      VAT %: number input (default from settings)
      Shows: "VAT ([X]%): +[amount]"
  
  DEPOSIT SECTION:
    "Deposit required:"
    Radio: 50% | 30% | Custom %
    Custom: number input
    Shows:
      "Deposit required: [amount]"
      "Balance due: [amount]"

SECTION 5 — "Notes":
  
  Client Note (textarea):
    "Visible to client on invoice"
    Placeholder: "Thank you for choosing Prudential Atelier..."
  
  Internal Notes (textarea):
    "Internal only — not shown to client"

─── RIGHT COLUMN (sticky) ───

INVOICE PREVIEW CARD (bg-[#FAFAF8], border 1px #EBEBEA, p-5):
  "Invoice Summary"
  
  Thin branded header (bg-olive, white, p-3):
    "PRUDENTIAL ATELIER" left | Invoice # right
  
  Client: [name] / [email]
  Currency: [NGN/USD/GBP] flag
  
  Line items (compact):
    Each: description (truncated) | amount
  
  ──────────────────
  Subtotal: [amount]
  Discount: -[amount] (if set)
  VAT: +[amount] (if set)
  ══════════════════
  TOTAL: [amount] (bold, large)
  
  Deposit required: [amount] (olive)
  Balance due: [amount] (charcoal)
  
  Due date: [date]

STATUS CARD (mt-4):
  Current status badge (large)
  
  If DRAFT:
    [Save as Draft] (outlined, full-width)
    [Save & Send Now] (olive, full-width)
      Confirm dialog: "Send to [email]?"
  
  If SENT/VIEWED:
    [Resend Invoice] (outlined)
    [Mark as Paid] (olive)
  
  Sent: [date] (if sentAt)
  Viewed: [viewCount] times (if viewedAt)

VAT + RC TOGGLES (mt-4):
  Show VAT on invoice: toggle
  Show RC Number: toggle
```

### E3 — Invoice Detail Page (admin view)

**`src/app/(admin)/admin/invoices/[id]/page.tsx`** (Server Component)

**`src/components/admin/InvoiceDetailAdmin.tsx`**:

```
HEADER:
  Back ← Invoices
  Invoice # (Bodoni Moda 24px, olive)
  Status badge (large, right)
  
  ACTION BUTTONS (right):
    [Edit Invoice] → /admin/invoices/[id]/edit
    [Preview Public Link ↗] → /invoice/[token] new tab
    [Send to Client] (olive)
    [Download PDF]
    [Mark as Paid] — if not PAID
    [Cancel Invoice] — if DRAFT/SENT

TIMELINE (top horizontal):
  Created → Sent → Viewed → Deposit Paid → Paid
  Each step: date + icon
  Completed steps: olive, active step: pulsing dot

TWO-COLUMN:

LEFT — Invoice Content:
  Same visual as public invoice view but in admin style (white bg, #EBEBEA borders)
  Shows all line items, totals, bank details, notes

RIGHT — Activity & Actions:
  
  PAYMENT HISTORY CARD:
    Timeline of payments:
      Each: date + amount + method + reference
    [Record Payment] button:
      Opens modal: amount, method (Bank Transfer/Cash/Paystack/Stripe), reference, date
      → PATCH mark-paid endpoint
  
  EMAIL HISTORY CARD:
    "Sent to [email] on [date]" (with resend button)
    "Viewed [N] times, last on [date]" (if viewedAt)
  
  BESPOKE LINK CARD (if linked):
    Bespoke request # with link to /admin/bespoke/[id]
    Occasion, status, client name

MARK PAID MODAL:
  Full payment toggle:
    ON: "Mark as fully paid"
    OFF: "Record partial payment (deposit)"
  
  Amount (₦/$/£ number input)
  Payment method (Select: Bank Transfer | Cash | Paystack | Stripe | Wise | Other)
  Reference/Transaction ID (Input, optional)
  Payment Date (date input, default today)
  
  [Record Payment] button (olive)
```

---

## TASK F — AUTO-GENERATE INVOICE FROM BESPOKE

When a bespoke request is confirmed, offer to auto-generate an invoice:

**Update `/admin/bespoke/[id]`** page:

```typescript
// Add "Generate Invoice" button to bespoke detail page
// Shows when:
//   - Bespoke status is CONFIRMED or IN_PROGRESS
//   - No invoice exists yet for this bespoke request
//
// Button: [📄 Generate Invoice] (olive, outlined)
// onClick: POST /api/admin/invoices with bespokeRequestId
//   Auto-fills:
//     clientName: bespoke.clientName
//     clientEmail: bespoke.clientEmail
//     clientPhone: bespoke.clientPhone
//     lineItems: [{ description: bespoke.occasion + " — Bespoke Piece", 
//                   details: bespoke.description (truncated to 100 chars),
//                   quantity: 1,
//                   unitPrice: bespoke.agreedPrice || 0 }]
//     currency: NGN (default)
//     depositRequired: 50% of total
//   Redirect to: /admin/invoices/[newId]/edit (to review before sending)
```

---

## TASK G — INVOICE EMAIL TEMPLATE

**`src/emails/InvoiceEmail.tsx`** (React Email template):

```typescript
// Props: {
//   invoiceNumber: string
//   clientName: string
//   businessName: string
//   total: string  // formatted e.g. "₦1,500,000"
//   currency: string
//   dueDate?: string
//   depositRequired?: string
//   publicLink: string  // full URL to /invoice/[token]
//   clientNote?: string
//   footerNote?: string
// }
//
// Subject: "Invoice [invoiceNumber] from Prudential Atelier — [total]"

// EMAIL DESIGN:
// Header: olive bg, white "PRUDENTIAL ATELIER" text
// Body:
//   "Dear [clientName],"
//   "Please find your invoice attached below."
//   Invoice summary box (olive border):
//     Invoice #: [invoiceNumber]
//     Total: [total]
//     Due Date: [dueDate] (if set)
//     Deposit Required: [depositRequired] (if set)
//   clientNote (if set, italic, grey)
//   [VIEW & DOWNLOAD INVOICE] button → publicLink (olive, large, centered)
//   "You can also download the PDF directly from the link above."
//   footerNote (italic, grey, centered)
// Footer: business details, olive divider
```

**Wire into `src/lib/email.tsx`**:
```typescript
// sendInvoiceEmail(params: {
//   to: string, clientName: string, invoiceNumber: string,
//   total: string, currency: string, dueDate?: string,
//   depositRequired?: string, publicLink: string,
//   clientNote?: string
// }): Promise<void>
```

---

## TASK H — ADMIN SETTINGS: INVOICE TAB

**Add to `/admin/settings` overview page**:
```typescript
// New card: 💰 Invoice Settings → /admin/settings/invoice
// Description: "Business details, bank accounts, VAT, invoice numbering"
```

**Create `src/app/(admin)/admin/settings/invoice/page.tsx`**:

```
Page fetches all INVOICE group settings
Renders InvoiceSettingsForm

SECTIONS:

1. "Business Identity"
   Business Name, Tagline, Address L1, Address L2, City,
   Phone, Email, Website
   Logo Upload (image picker)
   RC Number (text) + "Show on invoices" toggle
   [Save]

2. "Bank Details"
   3 sub-sections (NGN / USD / GBP):
   Each: Bank Name, Account Name, Account Number, Sort Code (if USD/GBP)
   [Save]

3. "Invoice Defaults"
   Default Currency (select)
   Default VAT % (number, 0 = disabled)
   Default Payment Due Days (number)
   Invoice Number Prefix (text, e.g. "PA-INV")
   Default Payment Terms (textarea)
   Footer Note (textarea)
   [Save]

PREVIEW (right sidebar, sticky):
  Mini invoice preview card showing how the header will look with current settings
  Updates live as admin types
```

---

## TASK I — SEED DEFAULT INVOICE

**Add to `prisma/seed.ts`** — create one demo invoice:

```typescript
// Create demo invoice linked to first bespoke request
const demoBespoke = await prisma.bespokeRequest.findFirst({
  orderBy: { createdAt: 'asc' }
})

if (demoBespoke) {
  await prisma.invoice.upsert({
    where: { invoiceNumber: 'PA-INV-2025-0001' },
    update: {},
    create: {
      invoiceNumber: 'PA-INV-2025-0001',
      bespokeRequestId: demoBespoke.id,
      clientName: 'Mrs. Amara Okafor',
      clientEmail: 'amara@example.com',
      clientPhone: '+234 801 234 5678',
      clientCity: 'Lagos, Nigeria',
      clientCountry: 'Nigeria',
      currency: 'NGN',
      status: 'SENT',
      lineItems: [
        {
          id: 'item-001',
          description: 'Custom White Wedding Gown',
          details: 'Cathedral train, hand-beaded bodice, French lace overlay, removable sleeves',
          quantity: 1,
          unitPrice: 850000,
          amount: 850000,
        },
        {
          id: 'item-002',
          description: 'Traditional Attire — Iro & Buba',
          details: 'Embroidered gold aso-oke with matching gele and ipele',
          quantity: 1,
          unitPrice: 350000,
          amount: 350000,
        },
        {
          id: 'item-003',
          description: 'Fitting Sessions (3)',
          details: 'Three in-atelier fitting sessions included',
          quantity: 3,
          unitPrice: 25000,
          amount: 75000,
        },
      ],
      subtotal: 1275000,
      discountType: null,
      discountValue: 0,
      discountAmount: 0,
      vatEnabled: false,
      vatPercent: 0,
      vatAmount: 0,
      total: 1275000,
      depositRequired: 637500,
      depositPaid: 637500,
      balanceDue: 637500,
      paymentTerms: '50% deposit required to commence. Balance due 3 days before delivery.',
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      clientNote: 'Thank you for choosing Prudential Atelier for your special day. We are honoured to dress you.',
      status: 'PARTIALLY_PAID',
      sentAt: new Date(),
    },
  })
}
```

---

## FINAL CHECKS

```bash
npx prisma generate
npx prisma db push
npx prisma db seed
npx tsc --noEmit
npx next build
```

Verify:
```
/admin/invoices                  → table with 1 demo invoice
/admin/invoices/new              → full invoice creation form
/admin/invoices/new              → select a bespoke request → client auto-fills
/admin/invoices/new              → add line items, totals calculate live
/admin/invoices/new              → deposit toggle → shows deposit/balance split
/admin/invoices/[id]/edit        → edit form pre-filled
/admin/invoices/[id]             → detail view with timeline, payment history
/admin/invoices/[id] (Send)      → sends email to client
/admin/invoices/[id] (PDF)       → downloads PDF
/invoice/[token]                 → public invoice view (no login needed)
/invoice/[token]                 → Download PDF button works
/admin/bespoke/[id]              → [Generate Invoice] button appears
/admin/settings/invoice          → all placeholder settings configurable
AdminSidebar                     → Invoices link under Bespoke Requests
```

---

## SESSION END FORMAT

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SESSION 16 COMPLETE — INVOICE SYSTEM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Task A — Invoice library (number generator, calculations, formatters)
✅ Task B — Invoice API routes (admin CRUD + send + PDF + mark paid + public view)
✅ Task C — PDF template (@react-pdf/renderer, A4, elegant design)
✅ Task D — Public invoice page /invoice/[token] (view online + download + copy account)
✅ Task E — Admin invoice management (list, create/edit form, detail page)
✅ Task F — Auto-generate from bespoke request
✅ Task G — Invoice email template + sendInvoiceEmail()
✅ Task H — Admin settings: Invoice tab (all placeholders configurable)
✅ Task I — Seed: 1 demo invoice

Build: ✅ passes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

*Prudent Gabriel · Session 16 — Invoice Management System*
*Prepared by Nony | SonsHub Media*
