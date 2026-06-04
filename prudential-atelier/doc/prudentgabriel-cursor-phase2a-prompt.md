# CURSOR AI — PRUDENTGABRIEL.COM
## Phase 2A: Bespoke Workflow Engine + Staff & HR System
### Prepared by SonsHub Media Ltd (Nony — Okafor Chinonso Daniel)

---

## CRITICAL INSTRUCTIONS — READ BEFORE WRITING A SINGLE LINE

1. This is **Phase 2A** of a 5-phase build. Phase 1 is complete and running on Vercel.
2. **DO NOT touch, rename, or remove any existing model** in `prisma/schema.prisma`. Only ADD new models and extend enums. The existing `BespokeRequest`, `Invoice`, `ConsultationBooking`, `Order`, `Product`, `User`, `SiteSetting` models are live in production and must remain untouched.
3. The existing `Role` enum has `CUSTOMER`, `ADMIN`, `SUPER_ADMIN`. Add new values to it — do not replace it.
4. The existing `BespokeRequest` model is a simple intake form. It stays. We are building a NEW `BespokeOrder` model alongside it — the full 13-stage production pipeline. These are two different things.
5. Read the entire prompt before writing any code.
6. Deploy target is **Vercel** with **Neon PostgreSQL**. All DB changes use `prisma db push` — no migration files.
7. After every schema change run `prisma generate` then `prisma db push`.
8. Design system is unchanged from Phase 1 — Cormorant + Montserrat, chocolate/cream palette. Every new UI surface must match exactly.

---

## DESIGN SYSTEM REMINDER

```css
--choc:    #442913;   /* Primary dark, sidebars, hero */
--nut:     #5C3422;   /* CTAs, active states */
--lightbr: #98755B;   /* Accents, labels, icons */
--cream:   #E2D1C2;   /* Text on dark */
--sand:    #D4BBAC;   /* Borders, dividers */
--ivory:   #F7F2EC;   /* Light page background */
--bg:      #F0E8DD;   /* Admin/dashboard background */
```

Fonts: `Cormorant` (headings/display) + `Montserrat` (body/UI/labels)

---

## SCHEMA ADDITIONS — ADD TO prisma/schema.prisma

Add the following **after** the last existing model. Do not move or edit anything above.

```prisma
// ─── EXTEND ROLE ENUM ─────────────────────────────────
// Add to existing Role enum — append these values:
// BESPOKE_MANAGER
// RTW_MANAGER
// CONTENT_MANAGER
// FINANCE_MANAGER
// HR_MANAGER
// CONSULTATION_MANAGER
// STAFF

// Updated Role enum (replace the existing enum block only):
enum Role {
  CUSTOMER
  ADMIN
  SUPER_ADMIN
  BESPOKE_MANAGER
  RTW_MANAGER
  CONTENT_MANAGER
  FINANCE_MANAGER
  HR_MANAGER
  CONSULTATION_MANAGER
  STAFF
}

// ─── NEW ENUMS ────────────────────────────────────────

enum BespokeStage {
  CONSULTATION_BOOKING
  CONSULTATION_SESSION
  INVOICE_ISSUANCE
  PAYMENT_CONFIRMATION
  SKETCHING_CONCEPT
  FABRIC_SOURCING
  DESIGN_APPROVAL
  TAILORING
  FIRST_FITTING
  ALTERATIONS
  BEADING_FINISHING
  FINAL_FITTING
  DELIVERY
}

enum StaffDepartment {
  TAILOR
  BEADER
  DESIGNER
  PATTERN_CUTTER
  GENERAL
}

enum EmploymentType {
  EMPLOYEE
  FREELANCER
}

enum LoyaltyTier {
  BRONZE
  SILVER
  GOLD
  PLATINUM
}

enum BlogStatus {
  DRAFT
  SCHEDULED
  PUBLISHED
}

enum QuoteStatus {
  DRAFT
  SENT
  APPROVED
  REJECTED
  CONVERTED
}

// ─── NEW MODELS ───────────────────────────────────────

model ClientProfile {
  id     String @id @default(cuid())
  userId String @unique
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Style profile (from onboarding quiz)
  preferredSilhouettes String[]
  preferredColors      String[]
  occasions            String[]
  budgetRange          String?

  // Loyalty
  loyaltyPoints Int         @default(0)
  loyaltyTier   LoyaltyTier @default(BRONZE)
  totalSpend    Float       @default(0)

  // Referral
  referredBy String?

  // Relations
  measurements  Measurement?
  bespokeOrders BespokeOrder[]
  moodboards    Moodboard[]
  eventDates    EventDate[]
  adminNotes    ClientNote[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Measurement {
  id       String        @id @default(cuid())
  clientId String        @unique
  client   ClientProfile @relation(fields: [clientId], references: [id], onDelete: Cascade)

  bust          Float?
  waist         Float?
  hips          Float?
  shoulderWidth Float?
  sleeveLength  Float?
  dressLength   Float?
  thigh         Float?
  inseam        Float?
  neck          Float?
  armhole       Float?
  unit          String  @default("inches")
  notes         String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Moodboard {
  id       String        @id @default(cuid())
  clientId String
  client   ClientProfile @relation(fields: [clientId], references: [id], onDelete: Cascade)

  title        String
  images       String[]
  notes        String?
  bespokeOrderId String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([clientId])
}

model EventDate {
  id       String        @id @default(cuid())
  clientId String
  client   ClientProfile @relation(fields: [clientId], references: [id], onDelete: Cascade)

  label    String
  date     DateTime
  notified Boolean  @default(false)

  createdAt DateTime @default(now())
}

model ClientNote {
  id       String        @id @default(cuid())
  clientId String
  client   ClientProfile @relation(fields: [clientId], references: [id], onDelete: Cascade)

  note      String
  addedBy   String  // admin userId
  addedByName String?

  createdAt DateTime @default(now())

  @@index([clientId])
}

// The full 13-stage production pipeline
// (separate from the existing BespokeRequest intake form)
model BespokeOrder {
  id       String @id @default(cuid())
  orderRef String @unique

  // Client link — ties to ClientProfile (new) AND User (existing)
  clientProfileId String?
  clientProfile   ClientProfile? @relation(fields: [clientProfileId], references: [id])
  clientName      String
  clientEmail     String
  clientPhone     String?

  // Order details
  outfitDescription String?  @db.Text
  occasionType      String?
  eventLocation     String?
  clientLocation    String?
  deliveryDate      DateTime?
  notes             String?  @db.Text

  // Pipeline state
  currentStage  BespokeStage @default(CONSULTATION_BOOKING)
  stageHistory  StageUpdate[]
  assignments   OrderAssignment[]
  materials     Material[]

  // Finance
  quotationId String?
  quotation   Quotation? @relation(fields: [quotationId], references: [id])
  amountPaid  Float      @default(0)
  totalAmount Float      @default(0)
  balance     Float      @default(0)

  // Converted from BespokeRequest?
  bespokeRequestId String?

  // Public tracking (no login required)
  trackingToken String @unique @default(cuid())

  status OrderStatus @default(PENDING)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([trackingToken])
  @@index([clientEmail])
  @@index([status])
}

model StageUpdate {
  id      String       @id @default(cuid())
  orderId String
  order   BespokeOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)

  stage       BespokeStage
  notes       String?  @db.Text
  images      String[]
  videos      String[]
  completedBy String   // admin userId
  completedByName String?
  emailSent   Boolean  @default(false)
  emailSentAt DateTime?

  completedAt DateTime @default(now())

  @@index([orderId])
}

model OrderAssignment {
  id      String       @id @default(cuid())
  orderId String
  order   BespokeOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)

  staffProfileId String
  staffProfile   StaffProfile @relation(fields: [staffProfileId], references: [id])

  role        String   // "TAILOR" | "BEADER" | "DESIGNER"
  assignedAt  DateTime @default(now())
  completedAt DateTime?

  @@index([orderId])
  @@index([staffProfileId])
}

model Material {
  id      String       @id @default(cuid())
  orderId String
  order   BespokeOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)

  name      String
  quantity  String?
  unitCost  Float?
  totalCost Float?
  supplier  String?
  notes     String?

  createdAt DateTime @default(now())
}

model StaffProfile {
  id     String @id @default(cuid())
  userId String @unique
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  department     StaffDepartment
  employmentType EmploymentType  @default(EMPLOYEE)
  skillTags      String[]
  isActive       Boolean         @default(true)

  // Performance scores (auto-computed nightly)
  ordersCompleted Int    @default(0)
  avgStageHours   Float?
  attendanceScore Float?

  attendanceLogs AttendanceLog[]
  assignments    OrderAssignment[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model AttendanceLog {
  id      String       @id @default(cuid())
  staffId String
  staff   StaffProfile @relation(fields: [staffId], references: [id], onDelete: Cascade)

  clockIn   DateTime?
  clockOut  DateTime?
  taskNote  String?
  totalHours Float?
  date       DateTime @default(now()) @db.Date

  createdAt DateTime @default(now())

  @@index([staffId])
  @@index([date])
}

model QRCode {
  id        String   @id @default(cuid())
  code      String   @unique
  expiresAt DateTime
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())

  @@index([isActive])
}

model Quotation {
  id       String @id @default(cuid())
  quoteRef String @unique

  clientName  String
  clientEmail String
  clientPhone String?

  lineItems Json   // [{ description, quantity, unitPrice, total }]
  subtotal  Float
  tax       Float  @default(0)
  discount  Float  @default(0)
  total     Float

  notes     String?    @db.Text
  status    QuoteStatus @default(DRAFT)

  approvalToken String   @unique @default(cuid())
  approvedAt    DateTime?
  expiresAt     DateTime?
  pdfUrl        String?
  sentAt        DateTime?

  bespokeOrders BespokeOrder[]

  createdBy String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([status])
  @@index([clientEmail])
  @@index([approvalToken])
}

model BlogPost {
  id    String @id @default(cuid())
  title String
  slug  String @unique

  excerpt      String?
  content      String    @db.Text
  featuredImage String?
  category     String?
  tags         String[]

  status      BlogStatus @default(DRAFT)
  publishedAt DateTime?
  scheduledAt DateTime?

  metaTitle String?
  metaDesc  String?
  ogImage   String?

  authorId   String
  authorName String?
  readTime   Int?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([slug])
  @@index([status, publishedAt])
}

model LoyaltyRule {
  id       String  @id @default(cuid())
  action   String  @unique  // "PURCHASE", "REFERRAL", "SIGNUP", "REVIEW"
  points   Int
  isActive Boolean @default(true)
}
```

Also add these relations to the existing `User` model by appending them inside the model block:
```prisma
// Add to User model:
clientProfile  ClientProfile?
staffProfile   StaffProfile?
```

---

## PHASE 2A DELIVERABLES

### 1. BESPOKE ORDER PIPELINE — Admin Side

**Route:** `/admin/bespoke`

**Pipeline List Page** (`/admin/bespoke/page.tsx`)
- Full `BulkSelectTable` with columns:
  - Order Ref (e.g. `ORD-2847`)
  - Client name + email
  - Current stage (pill badge with stage name)
  - Progress bar (stage number / 13, filled with `var(--lightbr)`)
  - Delivery date (red if overdue, amber if within 7 days, green otherwise)
  - Status pill (On Track / Watch / Urgent)
  - Actions: View, Edit
- Filter bar: by stage, by status, by date range, search by client name/ref
- "New Bespoke Order" button — opens a modal to create order manually
- Bulk delete with confirmation modal
- Empty state: "No bespoke orders yet" with a CTA

**Order Detail Page** (`/admin/bespoke/[orderId]/page.tsx`)

Left column (wider):
- Order header: ref number, client name, tracking link (`/track/[trackingToken]`)
- Current stage highlighted on a visual 13-step stepper (horizontal, collapses to vertical on mobile)
- Stage history: list of completed stages with timestamp, who completed it, notes, image/video thumbnails
- **Stage Completion Panel** (only visible to `BESPOKE_MANAGER`, `GENERAL_ADMIN`, `SUPER_ADMIN`):
  - Textarea: stage notes (required)
  - Image upload: multiple, via Cloudinary (drag-and-drop)
  - Video upload: multiple, via Cloudinary
  - "Mark Stage Complete" button → confirms → marks stage done → fires email → advances `currentStage`
  - Cannot mark a stage complete if the previous stage is not done
  - Confirmation modal: "This will send an email to [clientName]. Proceed?"

Right column:
- Client card: name, email, phone, location, event date
- Materials list: add/edit/delete material line items
- Staff assignments: assign tailor and/or beader from `StaffProfile` list
  - Smart suggestion shown: "Tunde Kareem — 2 active orders" vs "Emeka Obi — 4 active orders"
- Payment summary: total, amount paid, balance outstanding
  - "Record Payment" button (Finance Manager / General Admin only)
- Moodboard thumbnails (from `Moodboard` model linked to this order)
- Quick link to invoice

**Stage Completion Logic** (`lib/bespoke-stages.ts`):
```typescript
export const STAGE_ORDER: BespokeStage[] = [
  'CONSULTATION_BOOKING',
  'CONSULTATION_SESSION',
  'INVOICE_ISSUANCE',
  'PAYMENT_CONFIRMATION',
  'SKETCHING_CONCEPT',
  'FABRIC_SOURCING',
  'DESIGN_APPROVAL',
  'TAILORING',
  'FIRST_FITTING',
  'ALTERATIONS',
  'BEADING_FINISHING',
  'FINAL_FITTING',
  'DELIVERY',
];

export const STAGE_LABELS: Record<BespokeStage, string> = {
  CONSULTATION_BOOKING:  '1. Consultation Booking',
  CONSULTATION_SESSION:  '2. Consultation Session',
  INVOICE_ISSUANCE:      '3. Invoice Issuance',
  PAYMENT_CONFIRMATION:  '4. Payment Confirmation',
  SKETCHING_CONCEPT:     '5. Sketching & Concept',
  FABRIC_SOURCING:       '6. Fabric Sourcing',
  DESIGN_APPROVAL:       '7. Design Approval',
  TAILORING:             '8. Tailoring / Construction',
  FIRST_FITTING:         '9. First Fitting',
  ALTERATIONS:           '10. Alterations',
  BEADING_FINISHING:     '11. Beading & Finishing',
  FINAL_FITTING:         '12. Final Fitting',
  DELIVERY:              '13. Delivery / Collection',
};

export function getNextStage(current: BespokeStage): BespokeStage | null {
  const idx = STAGE_ORDER.indexOf(current);
  return idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1] : null;
}

export function getStageProgress(current: BespokeStage): number {
  return STAGE_ORDER.indexOf(current) + 1; // 1–13
}
```

---

### 2. PUBLIC ORDER TRACKING PAGE

**Route:** `/track/[trackingToken]`

- No login required — fully public
- Fetches `BespokeOrder` by `trackingToken`
- If not found: elegant "Order not found" page — branded, with contact CTA
- Page layout:
  - Top: Navbar (public) — no auth actions, just the logo and a "Back to site" link
  - Order header card: order ref, client first name only (privacy), outfit type, delivery date
  - Visual 13-step progress tracker:
    - Completed stages: filled circle in `var(--lightbr)`, connected line in `var(--lightbr)`
    - Active stage: filled circle in `var(--nut)` with a subtle pulse animation, label in bold
    - Pending stages: empty circle in `var(--sand)`
    - Each completed stage shows: stage name, completion date, notes preview (truncated to 2 lines), thumbnail of first image if any
  - "Want to book another piece?" CTA at the bottom
- This page is a Server Component — fetches fresh data on every request (`no-store` cache)
- Meta title: "Order [ORD-XXXX] — Prudential Atelier"

---

### 3. BESPOKE STAGE EMAIL TEMPLATES

Build in `lib/email-templates/bespoke-stages.ts`.

Each template is a function that returns an HTML string. All share the same branded wrapper:
- Header: Prudential Atelier logo text + gold divider line
- Footer: "Prudential Atelier · prudentgabriel.com · Developed with love by SonsHub Media Ltd"
- Background: `#F7F2EC` (ivory)
- Accent colour: `#98755B` (light brown)
- Body font: Georgia/serif fallback (email-safe)

```typescript
export interface StageEmailData {
  clientName: string;
  orderRef: string;
  stageName: string;
  stageNumber: number;
  notes: string;
  images: string[];      // Cloudinary URLs
  videos: string[];      // Cloudinary URLs
  trackingUrl: string;   // full URL to /track/[token]
  deliveryDate?: string;
}

export function getBespokeStageEmail(stage: BespokeStage, data: StageEmailData): string
```

Each stage has distinct messaging. Write all 13:

| Stage | Subject line | Key message |
|-------|-------------|-------------|
| CONSULTATION_BOOKING | "Your consultation is confirmed — Prudential Atelier" | Booking confirmed, date/time, what to expect |
| CONSULTATION_SESSION | "Your consultation summary — [orderRef]" | Summary of session, next steps, design direction noted |
| INVOICE_ISSUANCE | "Your quote is ready for review — [orderRef]" | Quote attached, approval link, payment instructions |
| PAYMENT_CONFIRMATION | "Payment received — your order begins now" | Payment confirmed, order officially started, expected timeline |
| SKETCHING_CONCEPT | "Your design concept is ready — [orderRef]" | Initial sketches/concept created, notes from designer |
| FABRIC_SOURCING | "Your fabrics have been sourced — [orderRef]" | Fabrics selected, photos if available |
| DESIGN_APPROVAL | "Please review your final design — [orderRef]" | Final design plan ready, client to review and confirm |
| TAILORING | "Your outfit is being crafted — [orderRef]" | Tailoring has begun, progress update |
| FIRST_FITTING | "Your first fitting summary — [orderRef]" | Fitting notes, adjustments recorded, what was discussed |
| ALTERATIONS | "Alterations complete — [orderRef]" | What was altered, how it was corrected |
| BEADING_FINISHING | "The finishing touches are underway — [orderRef]" | Embellishment details, photos if available |
| FINAL_FITTING | "Final fitting approved — [orderRef]" | Outfit approved, final notes |
| DELIVERY | "Your outfit is ready — [orderRef]" | Ready for collection/delivery, delivery details, review request link |

The email body dynamically includes:
- The `notes` field from `StageUpdate` (the Bespoke Manager's typed update)
- A grid of up to 4 image thumbnails (if `images.length > 0`)
- A note about video links (if `videos.length > 0`): "View progress videos: [link]"
- A "Track your order" button linking to `trackingUrl`

Build the email send function in `lib/email.ts`:
```typescript
export async function sendBespokeStageEmail(
  stage: BespokeStage,
  data: StageEmailData,
  toEmail: string
): Promise<void>
```

---

### 4. STAGE COMPLETION API

**Route:** `POST /api/bespoke/[orderId]/complete-stage`

Request body:
```typescript
{
  notes: string;         // required
  images: string[];      // Cloudinary URLs (already uploaded)
  videos: string[];      // Cloudinary URLs (already uploaded)
}
```

Logic:
1. Validate session — must be `BESPOKE_MANAGER`, `GENERAL_ADMIN`, or `SUPER_ADMIN`
2. Fetch order by `orderId`
3. Determine current stage and next stage
4. Create `StageUpdate` record with notes, images, videos, completedBy
5. Advance `BespokeOrder.currentStage` to next stage
6. If final stage (DELIVERY): set `status = DELIVERED`
7. Send stage email via `sendBespokeStageEmail`
8. Mark `emailSent = true` on the `StageUpdate`
9. Log to `ActivityLog`: action `STAGE_COMPLETE`, module `bespoke`
10. Return updated order

---

### 5. STAFF & HR MANAGEMENT — Admin Side

**Route:** `/admin/staff`

**Staff List Page** (`/admin/staff/page.tsx`)
- `BulkSelectTable` with columns: Avatar initials, Name, Role/Department, Employment Type, Active Orders (count), Skill Tags, Clock Status (today), Actions
- Filter by: department, employment type, active/inactive
- "Add Staff Member" button — links to `/admin/staff/new` or opens modal
- Bulk delete with confirmation

**Staff Profile Page** (`/admin/staff/[staffId]/page.tsx`)
- Left: Staff info card — name, email, phone, department, employment type, skill tags (editable chips), active/inactive toggle
- Right top: Performance card
  - Orders completed: `staffProfile.ordersCompleted`
  - Avg stage time: `staffProfile.avgStageHours` hours
  - Attendance score: `staffProfile.attendanceScore`%
  - Client rating: pulled from reviews linked to their completed orders
- Right bottom: Current assignments — list of active `BespokeOrder` assignments
- Bottom: Attendance history table — date, clock in, clock out, hours, task note

**Add/Edit Staff Form:**
- Name, email (creates a `User` with role `STAFF`)
- Department (select: Tailor, Beader, Designer, Pattern Cutter, General)
- Employment type (Employee / Freelancer)
- Skill tags (multi-input chips: e.g. "bridal", "beading", "embroidery")
- Freelancers: no clock-in required (flag on profile)

---

### 6. ATTENDANCE SYSTEM

**Route:** `/admin/attendance`

**Attendance Dashboard Page:**
- Today's summary: cards — Clocked In, Late, Absent, Freelancer (not tracked)
- Staff grid: each staff card showing name, department, clock status, clock-in time
- Full attendance table: date range filter, sortable by name/date/hours
- Export to CSV button

**QR Code System:**

`lib/qr-attendance.ts`:
```typescript
// Generate a new QR code valid for 24 hours
export async function generateDailyQR(): Promise<string>

// Validate a QR scan and clock in the staff member
export async function processQRScan(
  qrCode: string,
  userId: string,
  taskNote: string
): Promise<{ success: boolean; message: string; alreadyClockedIn: boolean }>
```

**Clock In API:** `POST /api/attendance/clock-in`
```typescript
// Body: { qrCode: string; taskNote: string }
// 1. Validate QR code exists and not expired
// 2. Check if staff already clocked in today
// 3. Create AttendanceLog with clockIn timestamp
// 4. Log to ActivityLog: STAFF_CLOCK_IN
// 5. Return success
```

**Clock Out API:** `POST /api/attendance/clock-out`
```typescript
// Body: { userId: string }
// 1. Find today's open AttendanceLog for this user
// 2. Set clockOut = now()
// 3. Calculate totalHours
// 4. Log to ActivityLog: STAFF_CLOCK_OUT
```

**QR Rotation:** Build a cron-compatible function `lib/qr-attendance.ts:rotateDailyQR()` that:
- Deactivates all current active QR codes
- Generates a new one valid for the next 24 hours
- Can be called from a Vercel cron job (`/api/cron/rotate-qr`)

**Staff-facing clock-in page:** `/clock-in`
- Accessible to logged-in `STAFF` role users
- Shows today's QR code (fetched from active QRCode record)
- QR code displayed as a scannable image (use `qrcode` npm package to render)
- "I'm starting work" confirmation flow — textarea for task note
- Shows current clock-in status: "Clocked in at 8:02am" or "Not yet clocked in"
- Simple, mobile-optimised page (staff will use phones)

**Late Resumption Alert:**
- If a staff member has not clocked in by `RESUMPTION_TIME` (from `SiteSetting` key `hr_resumption_time`, default `09:00`), fire an email to the HR Manager
- Build this as a Vercel cron function: `/api/cron/late-alert` — runs daily at the configured resumption time

---

### 7. QUOTATION SYSTEM

**Route:** `/admin/quotations`

**Quotation List Page:**
- `BulkSelectTable`: Quote Ref, Client, Total, Status pill, Created date, Actions
- Filter by status
- "New Quotation" button

**Create/Edit Quotation Form** (`/admin/quotations/new` and `/admin/quotations/[id]/edit`):
- Client info: name, email, phone (auto-fill from `ClientProfile` if email matches)
- Line items builder: dynamic rows — description, quantity, unit price → auto-calculates total
- Tax field (optional %)
- Discount field (optional %)
- Notes to client (rich text, TipTap lite — just bold/italic/lists)
- Expiry date picker
- "Save as Draft" and "Send to Client" buttons
- On send: generates PDF (via `@react-pdf/renderer`), emails client, sets status to `SENT`

**Client Quote Approval Page** (`/quote/[approvalToken]`):
- Public page, no login required
- Shows branded quotation PDF view
- "Approve this Quote" button → POST `/api/quotations/[id]/approve`
- On approval: status → `APPROVED`, `approvedAt` set, Bespoke Manager gets email notification
- "Request Changes" button → opens a textarea → sends email to `orders@prudentgabriel.com`

**Convert Quote to Order** (admin action on approved quote):
- Button on quotation detail: "Convert to Bespoke Order"
- Creates a `BespokeOrder` from the quotation data
- Sets quotation status to `CONVERTED`
- Redirects to new bespoke order

---

### 8. ADMIN CRM — CLIENT MANAGEMENT

**Route:** `/admin/clients`

**Client List Page:**
- `BulkSelectTable`: Avatar initials, Name, Email, Phone, Total Orders, Total Spend, Loyalty Tier badge, Last Order date, Actions
- Search by name/email/phone
- Filter by loyalty tier
- Bulk delete with confirmation

**Client Profile Page** (`/admin/clients/[clientId]/page.tsx`):

This is the CRM view. Sections:

1. **Header:** Avatar initials circle, name, email, phone, loyalty tier badge, total spend, join date
2. **Measurements:** Display all measurement fields in a clean grid. "Edit Measurements" button (modal)
3. **Bespoke Orders:** Table of all bespoke orders with stage and status
4. **RTW Orders:** Table of RTW orders from existing `Order` model (filter by `userId`)
5. **Consultations:** Table of `ConsultationBooking` records for this client
6. **Moodboards:** Image grid of uploaded moodboards
7. **Payment History:** All payments across all order types
8. **Admin Notes:** Chronological list of `ClientNote` entries. "Add Note" button. Each note shows text, who added it, and when. Notes are read-only once saved (no edit/delete — audit trail).
9. **Quick Actions bar:** "Create Bespoke Order", "Book Consultation", "Send Invoice"

---

### 9. BLOG SYSTEM

**Admin side:**

**Route:** `/admin/content/blog`

- `BulkSelectTable`: Title, Category, Status pill, Publish date, Author, Actions
- "New Post" button

**Blog Post Editor** (`/admin/content/blog/new` and `/admin/content/blog/[id]/edit`):
- Title input (auto-generates slug)
- Featured image upload (Cloudinary)
- Category select (manage categories from settings)
- Tags input (chips)
- TipTap rich text editor:
  - Toolbar: Heading 1/2/3, Bold, Italic, Blockquote, Bullet list, Numbered list, Link, Image embed, Divider
  - Full-width, clean editorial styling matching the site palette
- SEO section (collapsible): Meta title, meta description, OG image
- Sidebar: Status (Draft/Scheduled/Published), Publish date picker, Author, Read time (auto-calculated), Preview button
- "Save Draft", "Schedule", "Publish Now" buttons

**Public side:**

**Blog Listing Page** (`/journal/page.tsx`):
- Server Component — fetches published posts
- Header: eyebrow "The Journal", title "Style & Stories"
- Grid: 1 featured post (large) + remaining posts in a 3-column grid
- Filter by category (client-side filter via URL params)
- Pagination: 9 posts per page

**Blog Post Page** (`/journal/[slug]/page.tsx`):
- Server Component with `generateStaticParams` for published posts
- Full article layout: featured image, category pill, title (Cormorant 42px), author + date + read time, body content
- Related posts (same category, 3 posts)
- Social share row: WhatsApp, copy link, Twitter/X, Facebook
- Back to Journal link

---

### 10. SYSTEM LOG PAGES — Admin Side

**Activity Log** (`/admin/logs/activity/page.tsx`):
- Table: Timestamp, User (name + role), Action badge, Module, Description, Record link
- Filter by: date range, action type, module, role
- Search by user email or description
- Export to CSV button
- Pagination: 50 per page
- Read-only — no delete, no edit

**Error Log** (`/admin/logs/errors/page.tsx`):
- Table: Timestamp, Severity badge (Info=blue, Warning=amber, Critical=red), Error Type, Message (truncated), Affected user/order, Resolved status
- Click row → expand to show full stack trace
- "Mark Resolved" button per row → opens notes modal → saves `resolvedBy`, `resolvedAt`, `resolveNote`
- Filter by: severity, resolved/unresolved, date range
- Export to CSV
- Both log pages are accessible to `GENERAL_ADMIN` and `SUPER_ADMIN` only (middleware check)

---

### 11. API ROUTES TO BUILD

```
POST   /api/bespoke                           Create new BespokeOrder
GET    /api/bespoke                           List all (admin)
GET    /api/bespoke/[orderId]                 Get single order
PATCH  /api/bespoke/[orderId]                 Update order details
POST   /api/bespoke/[orderId]/complete-stage  Complete current stage + fire email
POST   /api/bespoke/[orderId]/assign-staff    Assign tailor/beader
DELETE /api/bespoke/[orderId]                 Delete (bulk supported)

GET    /api/track/[token]                     Public — fetch order by trackingToken

POST   /api/staff                             Create staff member + User
GET    /api/staff                             List all staff
GET    /api/staff/[staffId]                   Get staff profile
PATCH  /api/staff/[staffId]                   Update staff
DELETE /api/staff/[staffId]                   Delete (bulk supported)
GET    /api/staff/suggestions?orderId=        Smart assignment suggestions

POST   /api/attendance/clock-in               QR clock in
POST   /api/attendance/clock-out              Clock out
GET    /api/attendance                        List logs (admin)
GET    /api/attendance/today                  Today's summary

GET    /api/qr/current                        Get active QR code
POST   /api/cron/rotate-qr                    Rotate QR (cron, secret-protected)
POST   /api/cron/late-alert                   Late resumption alert (cron)

POST   /api/quotations                        Create quotation
GET    /api/quotations                        List (admin)
GET    /api/quotations/[id]                   Get single
PATCH  /api/quotations/[id]                   Update
POST   /api/quotations/[id]/send              Generate PDF + email + mark SENT
POST   /api/quotations/[id]/approve           Public — client approval
POST   /api/quotations/[id]/convert           Convert to BespokeOrder

GET    /api/clients                           List all ClientProfiles (admin CRM)
GET    /api/clients/[clientId]                Full client profile
PATCH  /api/clients/[clientId]                Update profile
POST   /api/clients/[clientId]/notes          Add admin note
PATCH  /api/clients/[clientId]/measurements   Update measurements

POST   /api/blog                              Create post
GET    /api/blog                              List posts (admin — all statuses)
GET    /api/blog/[id]                         Get by ID (admin)
PATCH  /api/blog/[id]                         Update post
DELETE /api/blog/[id]                         Delete (bulk supported)
GET    /api/blog/public                       List published (public)
GET    /api/blog/public/[slug]                Get published post by slug

GET    /api/logs/activity                     List activity logs (paginated)
GET    /api/logs/errors                       List error logs (paginated)
PATCH  /api/logs/errors/[id]/resolve          Mark error resolved

POST   /api/moodboards                        Create moodboard
GET    /api/moodboards?clientId=              List for client
DELETE /api/moodboards/[id]                   Delete
```

---

### 12. MIDDLEWARE UPDATE

Update `middleware.ts` to handle the new roles:

```typescript
// Routes and required roles:
// /admin/bespoke/*        → BESPOKE_MANAGER, GENERAL_ADMIN (ADMIN), SUPER_ADMIN
// /admin/staff/*          → HR_MANAGER, ADMIN, SUPER_ADMIN
// /admin/attendance/*     → HR_MANAGER, ADMIN, SUPER_ADMIN
// /admin/quotations/*     → FINANCE_MANAGER, BESPOKE_MANAGER, ADMIN, SUPER_ADMIN
// /admin/clients/*        → BESPOKE_MANAGER, ADMIN, SUPER_ADMIN
// /admin/content/*        → CONTENT_MANAGER, ADMIN, SUPER_ADMIN
// /admin/logs/*           → ADMIN, SUPER_ADMIN
// /admin/settings/developer → SUPER_ADMIN only
// /clock-in               → STAFF, ADMIN, SUPER_ADMIN (any authenticated)
// /track/*                → PUBLIC (no auth required)
// /quote/*                → PUBLIC (no auth required)
// /journal/*              → PUBLIC (no auth required)
```

---

## CODING STANDARDS (same as Phase 1 — enforced)

- TypeScript strict mode — no `any`
- Server Components by default, `'use client'` only when needed
- Every API route: try/catch → `logError()` on exception
- Every meaningful admin action: call `logActivity()`
- Every list page: `BulkSelectTable` with multi-select delete
- Every async action: loading state + toast on success/error
- Every empty list: designed empty state, not a blank page
- Forms: React Hook Form + Zod validation, inline field errors
- Images: `next/image` with proper dimensions and alt text
- All new UI must match the chocolate/cream design system exactly

---

## EXECUTION ORDER

Build in this exact sequence:

1. Add new models/enums to `prisma/schema.prisma` → `prisma generate` → `prisma db push`
2. Build `lib/bespoke-stages.ts` (stage order, labels, helpers)
3. Build `lib/email-templates/bespoke-stages.ts` (all 13 email templates)
4. Build `lib/qr-attendance.ts` (QR generation and validation)
5. Build all API routes
6. Build `/admin/bespoke` list page + order detail page
7. Build `/track/[trackingToken]` public page
8. Build `/admin/staff` list + profile pages
9. Build `/admin/attendance` page + `/clock-in` staff page
10. Build `/admin/quotations` + `/quote/[approvalToken]` public page
11. Build `/admin/clients` CRM list + profile page
12. Build `/admin/content/blog` admin pages
13. Build `/journal` and `/journal/[slug]` public pages
14. Build `/admin/logs/activity` and `/admin/logs/errors`
15. Update `middleware.ts` with new role guards
16. Run full build — fix all TypeScript errors — verify Vercel deployment

---

## ENVIRONMENT VARIABLES TO ADD

Add these to Vercel environment variables and `.env.local`:

```env
# Cron job protection
CRON_SECRET=your-random-secret-here

# HR settings (can also be managed via SiteSetting)
RESUMPTION_TIME=09:00
HR_MANAGER_EMAIL=hr@prudentgabriel.com
```

Add a Vercel cron job in `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/rotate-qr",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cron/late-alert",
      "schedule": "0 9 * * 1-6"
    }
  ]
}
```

Each cron route validates `Authorization: Bearer ${CRON_SECRET}` header before executing.

---

## AFTER PHASE 2A IS COMPLETE

Confirm the following before calling Phase 2A done:

- [ ] `pnpm build` passes with zero TypeScript errors
- [ ] `prisma db push` ran successfully on Neon — all new tables created
- [ ] `/admin/bespoke` loads and displays orders
- [ ] Stage completion flow works end-to-end: mark stage → email fires → tracking page updates
- [ ] `/track/[token]` loads with no auth required
- [ ] `/admin/staff` loads, new staff can be added
- [ ] `/clock-in` loads for STAFF role users, QR scan works
- [ ] `/admin/quotations` loads, quotation can be created and sent
- [ ] `/quote/[token]` loads publicly, client can approve
- [ ] `/admin/clients` loads full CRM
- [ ] `/admin/content/blog` loads, post can be created and published
- [ ] `/journal` and `/journal/[slug]` render published posts
- [ ] Log pages load with data

When all boxes are checked, report back and Phase 2B prompt will be written.

---

*Prepared by SonsHub Media Ltd for Prudential Atelier — prudentgabriel.com*
*₦7,500,000 engagement · Phase 2A of 5*
