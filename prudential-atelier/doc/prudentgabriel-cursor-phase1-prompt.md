# CURSOR AI — PRUDENTGABRIEL.COM
## Full Business Management System — Phase 1 Prompt
### Prepared by SonsHub Media Ltd (Nony — Okafor Chinonso Daniel)

---

## CRITICAL INSTRUCTIONS — READ BEFORE WRITING A SINGLE LINE

1. This is a **FULL RESTART** of prudentgabriel.com. The previous codebase existed but is being rebuilt from scratch with a completely new design system, new architecture, and expanded scope.
2. **DO NOT** reference, import, or carry over any design decisions, color variables, font choices, or component styles from the previous build. The old system used Bodoni Moda, Jost, and an olive/white palette. **That is gone.**
3. Read this entire prompt before writing any code.
4. Build exactly what is specified. Do not improvise features not listed in this phase.
5. Complete every section fully before moving to the next. Do not scaffold and leave empty.
6. Every component must be production-grade, fully typed in TypeScript, and visually match the design system defined below.
7. This is a **₦7,500,000 commercial project**. The code quality, design fidelity, and attention to detail must reflect that.

---

## PROJECT IDENTITY

- **Project:** prudentgabriel.com — Prudential Atelier
- **Type:** Luxury Fashion House — Full Business Management System
- **Owner:** Mrs. Prudent Gabriel-Okopi
- **Developer:** SonsHub Media Ltd (Nony)
- **Repo:** github.com/Nonyd/prudentgabriel
- **Subfolder:** `prudential-atelier/`
- **Live URL:** prudentgabriel.com

---

## TECH STACK

```
Framework:      Next.js 14 (App Router, TypeScript strict mode)
Styling:        Tailwind CSS + CSS custom properties
Database:       PostgreSQL via Prisma ORM
Auth:           NextAuth.js v5 (Credentials + Google OAuth)
Animation:      Framer Motion + Lenis smooth scroll
Rich Text:      TipTap (for blog editor)
File Storage:   Cloudinary
Email:          Nodemailer (custom SMTP via Namecheap cPanel)
Payments:       Paystack · Flutterwave · Stripe · Monnify · Bank Transfer
State:          Zustand
Forms:          React Hook Form + Zod
Icons:          Lucide React
PDF:            @react-pdf/renderer
Package Mgr:    pnpm
```

### Tailwind Config — extend with these exact values:

```js
theme: {
  extend: {
    colors: {
      'choc':      '#442913',
      'nut':       '#5C3422',
      'lightbr':   '#98755B',
      'cream':     '#E2D1C2',
      'sand':      '#D4BBAC',
      'ivory':     '#F7F2EC',
      'bg':        '#F0E8DD',
    },
    fontFamily: {
      serif:  ['Cormorant', 'serif'],
      sans:   ['Montserrat', 'sans-serif'],
    },
  },
},
```

---

## DESIGN SYSTEM — THE SINGLE SOURCE OF TRUTH

> This design system overrides everything from the previous build. There is no other design reference.

### Colour Palette

| Name           | Hex       | Usage |
|----------------|-----------|-------|
| Dark Chocolate | `#442913` | Primary dark, hero backgrounds, sidebar, nav text on light |
| Nut Brown      | `#5C3422` | CTAs, hover states, active states, accents |
| Light Brown    | `#98755B` | Eyebrows, labels, secondary accents, icons |
| Cream          | `#E2D1C2` | Text on dark backgrounds, card text on dark |
| Sand           | `#D4BBAC` | Dividers, borders, input borders, subtle backgrounds |
| Ivory          | `#F7F2EC` | Primary page background (light sections) |
| Warm Background| `#F0E8DD` | Admin/dashboard page background |

### Typography

```css
/* Google Fonts import — add to layout.tsx */
@import url('https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Montserrat:wght@300;400;500;600&display=swap');

/* Rules */
--font-display: 'Cormorant', serif;      /* All headings, brand name, prices */
--font-body:    'Montserrat', sans-serif; /* All UI text, body copy, labels */
```

**Typography scale:**
- Hero headline: Cormorant, 56–72px, weight 500, line-height 1.05
- Section title: Cormorant, 36–42px, weight 500
- Card title: Cormorant, 18–22px, weight 500
- Eyebrow label: Montserrat, 10px, weight 500, letter-spacing 0.2em, uppercase
- Body text: Montserrat, 13–14px, weight 300–400, line-height 1.8
- UI label: Montserrat, 11–12px, weight 500
- Micro label: Montserrat, 9–10px, weight 500–600, letter-spacing 0.14em, uppercase

### CSS Variables (globals.css)

```css
:root {
  --choc:     #442913;
  --nut:      #5C3422;
  --lightbr:  #98755B;
  --cream:    #E2D1C2;
  --sand:     #D4BBAC;
  --ivory:    #F7F2EC;
  --bg:       #F0E8DD;

  --text-dark:  #2A1A0E;
  --text-mid:   #6B4C35;
  --text-light: #A08060;

  --success: #2D7D4F;
  --warning: #B87333;
  --danger:  #8B2020;
  --info:    #1A5C8B;

  --radius-sm: 2px;
  --radius-md: 4px;
  --radius-lg: 6px;
  --radius-xl: 8px;

  --border: 0.5px solid var(--sand);
  --border-dark: 0.5px solid rgba(152, 117, 91, 0.3);
}
```

### Component Design Rules

**Buttons:**
```css
/* Primary */
background: var(--choc); color: var(--cream);
font: Montserrat 10px/600, letter-spacing 0.16em, uppercase;
padding: 13px 28px; border-radius: 2px;

/* Ghost (on dark) */
border: 0.5px solid var(--lightbr); color: var(--cream);
same font; background: transparent;

/* Ghost (on light) */
border: 0.5px solid var(--nut); color: var(--nut);
same font; background: transparent;
```

**Cards:**
```css
background: var(--ivory);
border: 0.5px solid var(--sand);
border-radius: 6px;
```

**Inputs:**
```css
background: var(--bg);
border: 0.5px solid var(--sand);
border-radius: 3px;
font-family: Montserrat; font-size: 12px;
color: var(--text-dark);
padding: 10px 12px;
```

**Navbar (public):**
- Background: `var(--ivory)`, border-bottom: `var(--border)`
- Height: 64px, padding: 0 40px
- Logo: Cormorant 20px, weight 500, letter-spacing 0.12em — "Prudent" in `var(--choc)`, "Gabriel" in `var(--lightbr)`
- Nav links: Montserrat 11px, weight 500, letter-spacing 0.14em, uppercase, color `var(--text-mid)`
- Sticky on scroll, no glass effect — solid ivory background

**Admin Sidebar:**
- Background: `var(--choc)`, width: 228px
- Section labels: Montserrat 9px, weight 600, letter-spacing 0.2em, uppercase, color `rgba(152,117,91,0.5)`
- Nav items: Montserrat 11px, weight 400, color `rgba(226,209,194,0.65)`
- Active state: background `rgba(152,117,91,0.18)`, border-right `2px solid var(--lightbr)`, color `var(--cream)`

### Animation Principles

```tsx
// Standard page section reveal
initial={{ opacity: 0, y: 40 }}
whileInView={{ opacity: 1, y: 0 }}
transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
viewport={{ once: true, margin: '-80px' }}

// Staggered children
transition={{ duration: 0.6, delay: index * 0.1 }}

// Hover lift on cards
whileHover={{ y: -4 }}
transition={{ duration: 0.2 }}

// Button hover — CSS only
transition: background 0.2s, color 0.2s, border-color 0.2s;
```

Lenis smooth scroll: initialise in a `<SmoothScroll>` client component wrapping the layout.

---

## PROJECT STRUCTURE

```
prudential-atelier/
├── app/
│   ├── (public)/
│   │   ├── layout.tsx           ← Public layout with Navbar + Footer
│   │   ├── page.tsx             ← Homepage
│   │   ├── shop/
│   │   │   ├── page.tsx         ← RTW shop listing
│   │   │   └── [slug]/page.tsx  ← Product detail
│   │   ├── bespoke/page.tsx     ← Bespoke showcase
│   │   ├── bridal/page.tsx      ← Bridal gallery
│   │   ├── kids/page.tsx        ← Kids collection
│   │   ├── consultation/
│   │   │   ├── page.tsx         ← Booking page
│   │   │   └── success/page.tsx ← Post-booking confirmation
│   │   ├── track/[orderId]/page.tsx ← Public order tracker
│   │   ├── journal/
│   │   │   ├── page.tsx         ← Blog listing
│   │   │   └── [slug]/page.tsx  ← Blog post
│   │   ├── account/
│   │   │   ├── layout.tsx       ← Client dashboard layout
│   │   │   ├── page.tsx         ← Dashboard home
│   │   │   ├── orders/page.tsx
│   │   │   ├── measurements/page.tsx
│   │   │   ├── moodboards/page.tsx
│   │   │   ├── consultations/page.tsx
│   │   │   ├── loyalty/page.tsx
│   │   │   ├── wishlist/page.tsx
│   │   │   ├── referrals/page.tsx
│   │   │   ├── style-profile/page.tsx
│   │   │   └── settings/page.tsx
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   │
│   ├── (admin)/
│   │   ├── admin-login/page.tsx
│   │   ├── admin/
│   │   │   ├── layout.tsx        ← Admin shell: sidebar + topbar
│   │   │   ├── page.tsx          ← Admin dashboard
│   │   │   ├── bespoke/
│   │   │   │   ├── page.tsx      ← Pipeline list
│   │   │   │   └── [orderId]/page.tsx ← Order detail + stage manager
│   │   │   ├── consultations/page.tsx
│   │   │   ├── invoices/page.tsx
│   │   │   ├── quotations/page.tsx
│   │   │   ├── shop/
│   │   │   │   ├── products/page.tsx
│   │   │   │   └── orders/page.tsx
│   │   │   ├── clients/
│   │   │   │   ├── page.tsx      ← CRM list
│   │   │   │   └── [clientId]/page.tsx ← Client profile
│   │   │   ├── staff/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [staffId]/page.tsx
│   │   │   ├── attendance/page.tsx
│   │   │   ├── finance/page.tsx
│   │   │   ├── reports/page.tsx
│   │   │   ├── content/
│   │   │   │   ├── blog/page.tsx
│   │   │   │   └── pages/page.tsx
│   │   │   ├── logs/
│   │   │   │   ├── activity/page.tsx
│   │   │   │   └── errors/page.tsx
│   │   │   └── settings/
│   │   │       ├── page.tsx      ← General settings
│   │   │       └── developer/page.tsx ← Super admin only
│   │
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── products/route.ts
│       ├── orders/route.ts
│       ├── bespoke/route.ts
│       ├── consultations/route.ts
│       ├── payments/
│       │   ├── paystack/route.ts
│       │   ├── flutterwave/route.ts
│       │   ├── stripe/route.ts
│       │   ├── monnify/route.ts
│       │   └── bank-transfer/route.ts
│       ├── clients/route.ts
│       ├── staff/route.ts
│       ├── attendance/route.ts
│       ├── invoices/route.ts
│       ├── blog/route.ts
│       ├── upload/route.ts
│       └── webhooks/
│           ├── paystack/route.ts
│           └── flutterwave/route.ts
│
├── components/
│   ├── public/
│   │   ├── Navbar.tsx
│   │   ├── Footer.tsx
│   │   ├── HeroSection.tsx
│   │   ├── CategoryGrid.tsx
│   │   ├── BestSellers.tsx
│   │   ├── ConsultationWidget.tsx
│   │   ├── LoyaltyStrip.tsx
│   │   ├── BlogPreview.tsx
│   │   ├── ProductCard.tsx
│   │   ├── StageTracker.tsx
│   │   └── SmoothScroll.tsx
│   ├── account/
│   │   ├── AccountSidebar.tsx
│   │   ├── MeasurementVault.tsx
│   │   ├── BespokeOrderCard.tsx
│   │   └── LoyaltyCard.tsx
│   ├── admin/
│   │   ├── AdminSidebar.tsx
│   │   ├── AdminTopbar.tsx
│   │   ├── KPICard.tsx
│   │   ├── PipelineTable.tsx
│   │   ├── StaffRow.tsx
│   │   └── PaymentConfirmCard.tsx
│   └── ui/
│       ├── Button.tsx
│       ├── Input.tsx
│       ├── Select.tsx
│       ├── Badge.tsx
│       ├── Modal.tsx
│       ├── Table.tsx
│       ├── Pagination.tsx
│       ├── BulkSelectTable.tsx  ← Reusable table with multi-select + bulk delete
│       └── Toast.tsx
│
├── lib/
│   ├── prisma.ts
│   ├── auth.ts
│   ├── cloudinary.ts
│   ├── email.ts               ← Nodemailer SMTP transport
│   ├── email-templates/       ← All React Email / HTML templates
│   ├── payments/
│   │   ├── paystack.ts
│   │   ├── flutterwave.ts
│   │   ├── stripe.ts
│   │   └── monnify.ts
│   ├── roles.ts               ← RBAC definitions
│   ├── logger.ts              ← Activity + error logging
│   └── utils.ts
│
├── prisma/
│   └── schema.prisma
│
├── hooks/
│   ├── useToast.ts
│   ├── useBulkSelect.ts
│   └── useDebounce.ts
│
├── store/
│   ├── cartStore.ts
│   └── uiStore.ts
│
├── types/
│   └── index.ts
│
└── middleware.ts              ← Route protection by role
```

---

## DATABASE SCHEMA (Prisma — Full Schema)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── ENUMS ────────────────────────────────────────────

enum UserRole {
  SUPER_ADMIN
  GENERAL_ADMIN
  BESPOKE_MANAGER
  RTW_MANAGER
  CONTENT_MANAGER
  FINANCE_MANAGER
  HR_MANAGER
  CONSULTATION_MANAGER
  CLIENT
  STAFF
}

enum EmploymentType {
  EMPLOYEE
  FREELANCER
}

enum StaffDepartment {
  TAILOR
  BEADER
  DESIGNER
  PATTERN_CUTTER
  GENERAL
}

enum OrderStatus {
  PENDING
  CONFIRMED
  IN_PRODUCTION
  READY
  DELIVERED
  CANCELLED
}

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

enum ConsultationType {
  VIRTUAL
  IN_PERSON_PRUDENT
  IN_PERSON_TEAM
}

enum VirtualMedium {
  ZOOM
  GOOGLE_MEET
  WHATSAPP_CALL
  WHATSAPP_VIDEO
}

enum ConsultationStatus {
  PENDING
  CONFIRMED
  COMPLETED
  CANCELLED
  RESCHEDULED
}

enum PaymentMethod {
  PAYSTACK
  FLUTTERWAVE
  STRIPE
  MONNIFY
  BANK_TRANSFER
}

enum PaymentStatus {
  PENDING
  CONFIRMED
  FAILED
  REFUNDED
}

enum QuoteStatus {
  DRAFT
  SENT
  APPROVED
  REJECTED
  CONVERTED
}

enum InvoiceStatus {
  DRAFT
  SENT
  PARTIALLY_PAID
  PAID
  OVERDUE
}

enum BlogStatus {
  DRAFT
  SCHEDULED
  PUBLISHED
}

enum LoyaltyTier {
  BRONZE
  SILVER
  GOLD
  PLATINUM
}

enum ActivityAction {
  CREATE
  UPDATE
  DELETE
  LOGIN
  LOGOUT
  PAYMENT_CONFIRM
  STAGE_COMPLETE
  ORDER_CREATE
  INVOICE_SEND
  QUOTE_SEND
  STAFF_CLOCK_IN
  STAFF_CLOCK_OUT
}

enum ErrorSeverity {
  INFO
  WARNING
  CRITICAL
}

// ─── USER & AUTH ─────────────────────────────────────

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  passwordHash  String?
  role          UserRole  @default(CLIENT)
  name          String?
  phone         String?
  avatar        String?
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  clientProfile   ClientProfile?
  staffProfile    StaffProfile?
  adminProfile    AdminProfile?
  accounts        Account[]
  sessions        Session[]
  activityLogs    ActivityLog[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime
  @@unique([identifier, token])
}

// ─── CLIENT ──────────────────────────────────────────

model ClientProfile {
  id              String    @id @default(cuid())
  userId          String    @unique
  user            User      @relation(fields: [userId], references: [id])

  // Style profile
  preferredSilhouettes  String[]
  preferredColors       String[]
  occasions             String[]
  budgetRange           String?

  // Loyalty
  loyaltyPoints   Int           @default(0)
  loyaltyTier     LoyaltyTier   @default(BRONZE)
  totalSpend      Float         @default(0)

  // Referral
  referralCode    String        @unique @default(cuid())
  referredBy      String?

  // Event dates
  eventDates      EventDate[]

  // Relations
  measurements    Measurement?
  bespokeOrders   BespokeOrder[]
  rtwOrders       RTWOrder[]
  consultations   Consultation[]
  moodboards      Moodboard[]
  wishlist        WishlistItem[]
  reviews         Review[]
  payments        Payment[]
  adminNotes      ClientNote[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model Measurement {
  id              String        @id @default(cuid())
  clientId        String        @unique
  client          ClientProfile @relation(fields: [clientId], references: [id])

  bust            Float?
  waist           Float?
  hips            Float?
  shoulderWidth   Float?
  sleeveLength    Float?
  dressLength     Float?
  thigh           Float?
  inseam          Float?
  neck            Float?
  armhole         Float?
  unit            String        @default("inches")
  notes           String?

  updatedAt       DateTime @updatedAt
  createdAt       DateTime @default(now())
}

model EventDate {
  id          String        @id @default(cuid())
  clientId    String
  client      ClientProfile @relation(fields: [clientId], references: [id])
  label       String
  date        DateTime
  notified    Boolean       @default(false)
  createdAt   DateTime      @default(now())
}

model ClientNote {
  id          String        @id @default(cuid())
  clientId    String
  client      ClientProfile @relation(fields: [clientId], references: [id])
  note        String
  addedBy     String
  createdAt   DateTime      @default(now())
}

model Moodboard {
  id          String        @id @default(cuid())
  clientId    String
  client      ClientProfile @relation(fields: [clientId], references: [id])
  title       String
  images      String[]
  notes       String?
  orderId     String?
  createdAt   DateTime      @default(now())
}

// ─── STAFF ───────────────────────────────────────────

model StaffProfile {
  id              String          @id @default(cuid())
  userId          String          @unique
  user            User            @relation(fields: [userId], references: [id])

  department      StaffDepartment
  employmentType  EmploymentType  @default(EMPLOYEE)
  skillTags       String[]
  isActive        Boolean         @default(true)

  // Performance (auto-computed)
  ordersCompleted Int             @default(0)
  avgStageTime    Float?
  attendanceScore Float?

  attendanceLogs  AttendanceLog[]
  assignments     OrderAssignment[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model AdminProfile {
  id          String    @id @default(cuid())
  userId      String    @unique
  user        User      @relation(fields: [userId], references: [id])
  permissions String[]
  isProtected Boolean   @default(false)  // true for Mrs. Prudent — cannot be removed
  createdAt   DateTime  @default(now())
}

model AttendanceLog {
  id          String        @id @default(cuid())
  staffId     String
  staff       StaffProfile  @relation(fields: [staffId], references: [id])
  clockIn     DateTime?
  clockOut    DateTime?
  taskNote    String?
  totalHours  Float?
  date        DateTime      @default(now())
  createdAt   DateTime      @default(now())
}

model QRCode {
  id          String    @id @default(cuid())
  code        String    @unique
  expiresAt   DateTime
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())
}

// ─── PRODUCTS & SHOP ─────────────────────────────────

model Product {
  id              String    @id @default(cuid())
  name            String
  slug            String    @unique
  description     String?   @db.Text
  price           Float
  comparePrice    Float?
  currency        String    @default("NGN")
  images          String[]
  category        String
  tags            String[]
  sizes           String[]
  stock           Json      // { "S": 3, "M": 5, "L": 0 }
  lowStockThreshold Int     @default(2)
  isBestSeller    Boolean   @default(false)
  orderCount      Int       @default(0)
  bestSellerThreshold Int   @default(10)
  isPublished     Boolean   @default(true)
  isFeatured      Boolean   @default(false)
  collection      String?

  orders          RTWOrderItem[]
  wishlistItems   WishlistItem[]
  reviews         Review[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model RTWOrder {
  id              String        @id @default(cuid())
  orderRef        String        @unique @default(cuid())
  clientId        String
  client          ClientProfile @relation(fields: [clientId], references: [id])
  items           RTWOrderItem[]
  total           Float
  status          OrderStatus   @default(PENDING)
  paymentMethod   PaymentMethod?
  paymentStatus   PaymentStatus @default(PENDING)
  shippingAddress Json?
  trackingNumber  String?
  notes           String?
  payments        Payment[]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model RTWOrderItem {
  id          String    @id @default(cuid())
  orderId     String
  order       RTWOrder  @relation(fields: [orderId], references: [id])
  productId   String
  product     Product   @relation(fields: [productId], references: [id])
  quantity    Int
  size        String?
  price       Float
}

model WishlistItem {
  id          String        @id @default(cuid())
  clientId    String
  client      ClientProfile @relation(fields: [clientId], references: [id])
  productId   String
  product     Product       @relation(fields: [productId], references: [id])
  createdAt   DateTime      @default(now())
  @@unique([clientId, productId])
}

model Review {
  id          String        @id @default(cuid())
  clientId    String
  client      ClientProfile @relation(fields: [clientId], references: [id])
  productId   String?
  product     Product?      @relation(fields: [productId], references: [id])
  orderId     String?
  rating      Int
  comment     String?       @db.Text
  isPublic    Boolean       @default(false)
  isVerified  Boolean       @default(false)
  createdAt   DateTime      @default(now())
}

// ─── BESPOKE ─────────────────────────────────────────

model BespokeOrder {
  id              String        @id @default(cuid())
  orderRef        String        @unique
  clientId        String
  client          ClientProfile @relation(fields: [clientId], references: [id])

  // Order details
  outfitDescription  String?   @db.Text
  occasionType       String?
  eventLocation      String?
  clientLocation     String?
  deliveryDate       DateTime?
  notes              String?   @db.Text

  // Production
  currentStage    BespokeStage  @default(CONSULTATION_BOOKING)
  stageHistory    StageUpdate[]
  assignments     OrderAssignment[]

  // Financials
  quotationId     String?
  invoiceId       String?
  quotation       Quotation?    @relation(fields: [quotationId], references: [id])
  invoice         Invoice?      @relation(fields: [invoiceId], references: [id])
  amountPaid      Float         @default(0)
  totalAmount     Float         @default(0)
  balance         Float         @default(0)
  payments        Payment[]

  // Materials
  materials       Material[]

  // Tracking
  trackingToken   String        @unique @default(cuid())
  status          OrderStatus   @default(PENDING)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model StageUpdate {
  id          String        @id @default(cuid())
  orderId     String
  order       BespokeOrder  @relation(fields: [orderId], references: [id])
  stage       BespokeStage
  notes       String?       @db.Text
  images      String[]
  videos      String[]
  completedBy String
  completedAt DateTime      @default(now())
  emailSent   Boolean       @default(false)
}

model OrderAssignment {
  id          String        @id @default(cuid())
  orderId     String
  order       BespokeOrder  @relation(fields: [orderId], references: [id])
  staffId     String
  staff       StaffProfile  @relation(fields: [staffId], references: [id])
  role        String        // "TAILOR" | "BEADER" | "DESIGNER"
  assignedAt  DateTime      @default(now())
  completedAt DateTime?
}

model Material {
  id          String        @id @default(cuid())
  orderId     String
  order       BespokeOrder  @relation(fields: [orderId], references: [id])
  name        String
  quantity    String?
  unitCost    Float?
  totalCost   Float?
  supplier    String?
  notes       String?
}

// ─── CONSULTATIONS ────────────────────────────────────

model Consultation {
  id              String              @id @default(cuid())
  clientId        String
  client          ClientProfile       @relation(fields: [clientId], references: [id])

  type            ConsultationType
  virtualMedium   VirtualMedium?
  meetingLink     String?
  linkSentAt      DateTime?

  scheduledAt     DateTime
  duration        Int                 @default(60) // minutes
  status          ConsultationStatus  @default(PENDING)
  assignedTo      String?

  notes           String?             @db.Text
  clientNotes     String?             @db.Text

  price           Float
  paymentStatus   PaymentStatus       @default(PENDING)
  paymentMethod   PaymentMethod?
  payments        Payment[]

  bespokeOrderId  String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

// ─── FINANCE ─────────────────────────────────────────

model Quotation {
  id              String        @id @default(cuid())
  quoteRef        String        @unique
  clientId        String
  lineItems       Json
  subtotal        Float
  tax             Float         @default(0)
  discount        Float         @default(0)
  total           Float
  notes           String?       @db.Text
  status          QuoteStatus   @default(DRAFT)
  approvedAt      DateTime?
  expiresAt       DateTime?
  pdfUrl          String?
  bespokeOrders   BespokeOrder[]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model Invoice {
  id              String        @id @default(cuid())
  invoiceRef      String        @unique
  clientId        String
  lineItems       Json
  subtotal        Float
  tax             Float         @default(0)
  discount        Float         @default(0)
  total           Float
  amountPaid      Float         @default(0)
  balance         Float         @default(0)
  notes           String?       @db.Text
  status          InvoiceStatus @default(DRAFT)
  dueDate         DateTime?
  pdfUrl          String?
  publicToken     String        @unique @default(cuid())
  bespokeOrders   BespokeOrder[]
  payments        Payment[]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model Payment {
  id              String        @id @default(cuid())
  reference       String        @unique
  clientId        String
  client          ClientProfile @relation(fields: [clientId], references: [id])

  amount          Float
  currency        String        @default("NGN")
  method          PaymentMethod
  status          PaymentStatus @default(PENDING)

  receiptUrl      String?       // bank transfer receipt
  confirmedBy     String?
  confirmedAt     DateTime?

  invoiceId       String?
  invoice         Invoice?      @relation(fields: [invoiceId], references: [id])
  bespokeOrderId  String?
  bespokeOrder    BespokeOrder? @relation(fields: [bespokeOrderId], references: [id])
  rtwOrderId      String?
  rtwOrder        RTWOrder?     @relation(fields: [rtwOrderId], references: [id])
  consultationId  String?
  consultation    Consultation? @relation(fields: [consultationId], references: [id])

  gatewayResponse Json?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

// ─── BLOG ─────────────────────────────────────────────

model BlogPost {
  id              String      @id @default(cuid())
  title           String
  slug            String      @unique
  excerpt         String?
  content         String      @db.Text
  featuredImage   String?
  category        String?
  tags            String[]
  status          BlogStatus  @default(DRAFT)
  publishedAt     DateTime?
  scheduledAt     DateTime?
  metaTitle       String?
  metaDesc        String?
  ogImage         String?
  authorId        String
  readTime        Int?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

// ─── SYSTEM ───────────────────────────────────────────

model ActivityLog {
  id          String          @id @default(cuid())
  userId      String?
  user        User?           @relation(fields: [userId], references: [id])
  userEmail   String?
  userRole    String?
  action      ActivityAction
  module      String
  description String
  recordId    String?
  recordType  String?
  ipAddress   String?
  createdAt   DateTime        @default(now())
}

model ErrorLog {
  id          String          @id @default(cuid())
  severity    ErrorSeverity   @default(INFO)
  errorType   String
  message     String          @db.Text
  stack       String?         @db.Text
  userId      String?
  orderId     String?
  url         String?
  resolved    Boolean         @default(false)
  resolvedBy  String?
  resolvedAt  DateTime?
  resolveNote String?
  createdAt   DateTime        @default(now())
}

model SiteSetting {
  id          String    @id @default(cuid())
  key         String    @unique
  value       String    @db.Text
  isEncrypted Boolean   @default(false)
  group       String    @default("general")
  updatedAt   DateTime  @updatedAt
  updatedBy   String?
}

model LoyaltyRule {
  id          String    @id @default(cuid())
  action      String    @unique
  points      Int
  isActive    Boolean   @default(true)
}
```

---

## ROLE-BASED ACCESS CONTROL (RBAC)

Define in `lib/roles.ts`:

```typescript
export const ROLE_PERMISSIONS = {
  SUPER_ADMIN: ['*'],  // Everything including /admin/settings/developer

  GENERAL_ADMIN: [
    'dashboard', 'bespoke', 'consultations', 'invoices', 'quotations',
    'shop', 'clients', 'staff', 'attendance', 'finance', 'reports',
    'content', 'logs', 'settings'
  ],

  BESPOKE_MANAGER: [
    'bespoke', 'consultations', 'clients.view', 'staff.view'
  ],

  RTW_MANAGER: [
    'shop.products', 'shop.orders'
  ],

  CONTENT_MANAGER: [
    'content.blog', 'content.pages'
  ],

  FINANCE_MANAGER: [
    'invoices', 'quotations', 'finance', 'payments'
  ],

  HR_MANAGER: [
    'staff', 'attendance', 'reports.staff'
  ],

  CONSULTATION_MANAGER: [
    'consultations', 'clients.view'
  ],
} as const;

// Protected admin accounts — cannot be deleted/demoted
export const PROTECTED_ACCOUNTS = [
  process.env.SUPER_ADMIN_EMAIL,    // Nony — SonsHub Media
  process.env.GENERAL_ADMIN_EMAIL,  // Mrs. Prudent Gabriel-Okopi
];
```

**Middleware** (`middleware.ts`) — protect routes:
- `/admin/*` requires any admin role
- `/admin/settings/developer` requires `SUPER_ADMIN` only
- `/account/*` requires `CLIENT` role (or any authenticated user)
- All API routes validate session and role server-side

---

## EMAIL SYSTEM

Using **Nodemailer** with custom SMTP. No Brevo, no Resend.

```typescript
// lib/email.ts
import nodemailer from 'nodemailer';

export const transporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST,       // mail.prudentgabriel.com (Namecheap)
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,     // noreply@prudentgabriel.com
    pass: process.env.SMTP_PASSWORD,
  },
  family: 4,                         // Force IPv4 — required for cPanel SMTP
});

export const EMAIL_FROM = '"Prudential Atelier" <noreply@prudentgabriel.com>';
export const ORDERS_EMAIL = 'orders@prudentgabriel.com';
export const FINANCE_EMAIL = 'finance@prudentgabriel.com';
```

All 13 bespoke stage emails are dynamic HTML templates that accept:
- `clientName`, `orderRef`, `stageName`, `stageNotes`, `images[]`, `videos[]`
- Build as functions in `lib/email-templates/bespoke-stage.ts`

---

## ENVIRONMENT VARIABLES (.env.local)

```env
# Database
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...

# Auth
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Email (Namecheap SMTP)
SMTP_HOST=mail.prudentgabriel.com
SMTP_PORT=465
SMTP_USER=noreply@prudentgabriel.com
SMTP_PASSWORD=

# Cloudinary
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Payments
PAYSTACK_SECRET_KEY=
PAYSTACK_PUBLIC_KEY=
FLUTTERWAVE_SECRET_KEY=
FLUTTERWAVE_PUBLIC_KEY=
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
MONNIFY_API_KEY=
MONNIFY_SECRET_KEY=
MONNIFY_CONTRACT_CODE=

# Admin protection
SUPER_ADMIN_EMAIL=nony@sonshubmedia.com
GENERAL_ADMIN_EMAIL=prudent@prudentgabriel.com

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
ENCRYPTION_KEY=  # 32-char key for AES-256 encrypted settings
```

---

## PHASE 1 BUILD SCOPE

> Build only what is listed here. Do not build Phase 2, 3, or 4 features yet.

### PHASE 1 DELIVERABLES:

**1. Project Setup**
- [ ] Initialise Next.js 14 project with TypeScript strict mode in `prudential-atelier/`
- [ ] Install all dependencies listed above
- [ ] Configure Tailwind with the exact design system tokens above
- [ ] Set up `globals.css` with all CSS variables
- [ ] Set up Google Fonts import in `layout.tsx`
- [ ] Set up Prisma with full schema above — run `prisma generate` and `prisma db push`
- [ ] Set up NextAuth v5 with Credentials + Google providers
- [ ] Configure Lenis smooth scroll in a client `<SmoothScroll>` wrapper
- [ ] Set up Cloudinary upload utility
- [ ] Set up Nodemailer SMTP transport
- [ ] Set up Zustand stores
- [ ] Build all reusable UI primitives: Button, Input, Select, Badge, Modal, Toast, BulkSelectTable

**2. Public Layout & Navigation**
- [ ] `Navbar.tsx` — exactly matching the design specification above
  - Sticky, solid ivory, 64px height
  - Logo: "Prudent" in `#442913` + "Gabriel" in `#98755B`, Cormorant 20px
  - Nav links: Shop, Bespoke, Bridal, Kids, Journal, About
  - Right actions: search icon, wishlist icon, account icon, "Book Consultation" CTA button
  - Mobile: hamburger menu with slide-out drawer
- [ ] `Footer.tsx` — four-column layout as designed
  - Brand column: logo, tagline, social icons (Instagram, TikTok, Facebook, WhatsApp)
  - Shop column, Atelier column, Client column
  - Bottom bar: copyright + "Developed with love by SonsHub Media Ltd"
  - Background: `#442913`, text: `#D4BBAC`

**3. Homepage**
- [ ] Cinematic hero section — dark chocolate background, two-column layout
  - Left: eyebrow + hero headline (Cormorant 58px) + subtext + two buttons
  - Right: full-height image placeholder (Cloudinary-ready) with a stat badge overlay
  - Framer Motion staggered entrance animation
- [ ] Category grid — 4 cards: RTW, Bespoke, Bridal, Kids
  - Each card: image area + dark overlay label with name and sub-label
  - Hover: subtle scale + brightness lift
- [ ] Best Sellers section — dark chocolate background
  - 3 product cards with "Best Seller" tag badge
  - Auto-populated from products where `isBestSeller = true` (server component)
  - If no best sellers yet, fetch top 3 by `orderCount`
- [ ] Consultation booking widget embedded in the homepage
  - Select: type (3 options), date picker, virtual medium selector
  - "Proceed to Payment" button — links to `/consultation` page
  - Left side: warm sand background with consultation types + prices
  - Right side: dark chocolate booking form card
- [ ] Loyalty tier strip — 4 tiers: Bronze, Silver, Gold, Platinum
  - Each with icon, tier name, key perk
- [ ] Blog preview section — 1 featured + 2 mini posts
  - Server component fetching latest 3 published posts from DB
  - Falls back gracefully to empty state with "Coming soon" if no posts
- [ ] All sections use Framer Motion `whileInView` entrance animations

**4. Authentication**
- [ ] `/login` page — split layout (brand image left, form right)
  - Email + password login
  - Google OAuth button
  - "Forgot password" link
  - Link to register
- [ ] `/register` page — same split layout
  - Name, email, phone, password, confirm password
  - Google OAuth option
  - On success: redirect to `/account`
- [ ] Password reset flow (forgot password → email token → reset form)
- [ ] NextAuth session with role stored in JWT token
- [ ] Middleware protecting `/account/*` and `/admin/*` routes

**5. Admin Login**
- [ ] `/admin-login` — standalone page, no public navbar/footer
  - Clean centered card on dark chocolate background
  - Email + password only (no Google OAuth for admin)
  - On success: redirect to `/admin`

**6. Admin Shell**
- [ ] `AdminSidebar.tsx` — exactly matching the design above
  - Logo + "Operations Suite" sub-label
  - User avatar + name + role badge
  - Full nav structure as specified in the project structure above
  - Badge counts on: Orders Pipeline, Consultations, RTW Orders, Payments
  - Active state with right border in `#98755B`
- [ ] `AdminTopbar.tsx`
  - Page title (Cormorant 18px)
  - Search input, notification bell (with dot), mail icon, avatar
- [ ] `/admin` dashboard page
  - 5 KPI cards: Today's Revenue, Active Bespoke, Staff On Clock, Pending Payments, Consultations Today
  - Bespoke pipeline table (top 5 orders): order ref, client, progress bar, stage, due date, status pill
  - Staff attendance today (top 4): avatar, name, role, clock status, time
  - Daily summary panel: revenue, stages completed, upcoming delivery, attendance
  - Today's consultations panel: time block, client name, type, paid status, "Send link" action

**7. Settings (Foundational)**
- [ ] `/admin/settings` — General settings page
  - Site name, contact email, phone, address
  - Social media links
  - Consultation prices (3 types)
  - Low stock threshold default
  - Best seller threshold
  - Loyalty tier thresholds
  - All saved to `SiteSetting` model
- [ ] `/admin/settings/developer` — Super Admin only (SUPER_ADMIN role gate)
  - Payment gateway toggles + API key fields (AES-256 encrypted in DB)
  - SMTP configuration fields
  - System utilities: clear cache button, test email button
  - This page is invisible to all other roles — returns 404 if accessed

---

## BULK DELETE PATTERN

Every admin list page must use the `BulkSelectTable` component:

```typescript
// components/ui/BulkSelectTable.tsx
// Props: columns, data, onBulkDelete, onRowClick
// - Checkbox in first column header (select all)
// - Checkbox per row
// - When 1+ rows selected: floating action bar appears at bottom
//   "X selected" + "Delete Selected" button (red) + "Deselect All"
// - onBulkDelete receives array of selected IDs
// - DELETE API call with confirmation modal before executing
```

Apply this to: Products, RTW Orders, Bespoke Orders, Clients, Staff, Blog Posts, Invoices, Quotations, Activity Logs, Error Logs.

---

## LOGGING SYSTEM

All meaningful actions must be logged automatically. Build `lib/logger.ts`:

```typescript
export async function logActivity(params: {
  userId?: string;
  userEmail?: string;
  userRole?: string;
  action: ActivityAction;
  module: string;
  description: string;
  recordId?: string;
  recordType?: string;
  ipAddress?: string;
}): Promise<void>

export async function logError(params: {
  severity: ErrorSeverity;
  errorType: string;
  message: string;
  stack?: string;
  userId?: string;
  orderId?: string;
  url?: string;
}): Promise<void>
```

Wrap all API routes with error catching that calls `logError` on any unhandled exception. Critical errors (payment failures, auth errors) also trigger an email alert to `SUPER_ADMIN_EMAIL`.

---

## CODING STANDARDS

- **TypeScript:** Strict mode. No `any`. All props and return types explicitly typed.
- **Server vs Client:** Default to Server Components. Only add `'use client'` when needed (interactivity, hooks, browser APIs).
- **Data fetching:** Server Components fetch directly via Prisma. Client Components use API routes.
- **Error handling:** Every API route wrapped in try/catch. Returns consistent `{ success, data, error }` shape.
- **Loading states:** Every async operation has a skeleton loader or spinner. Never show empty/broken UI.
- **Empty states:** Every list has a designed empty state — not a blank page.
- **Images:** Always use `next/image` with proper `width`, `height`, and `alt` attributes.
- **Forms:** React Hook Form + Zod schema validation. Show inline field-level errors.
- **Toast notifications:** Every create/update/delete action shows a toast. Use the `Toast.tsx` component.
- **Responsive:** All public pages must be fully responsive (375px → 1440px). Admin is desktop-first but tablet-functional.
- **Accessibility:** Semantic HTML, aria labels on icon buttons, keyboard navigable.
- **Comments:** No inline comments on obvious code. Comment only complex logic or non-obvious decisions.

---

## DEPLOYMENT TARGET

- **Platform:** Webuzo VPS (or Coolify — TBD)
- **Process manager:** PM2
- **Reverse proxy:** Nginx
- **Auto-deploy:** GitHub webhook on push to `main`
- **Email hosting:** Separate Namecheap cPanel (do not host on VPS)
- Write a `deploy.sh` script that is self-healing (does not break if paths shift):
  ```bash
  #!/bin/bash
  cd /path/to/prudential-atelier
  git pull origin main
  pnpm install
  pnpm prisma generate
  pnpm build
  pm2 restart prudentgabriel || pm2 start npm --name prudentgabriel -- start
  echo "Deploy complete."
  ```

---

## START HERE

Begin with this exact sequence:

1. `pnpm create next-app@14 prudential-atelier --typescript --tailwind --app --src-dir no --import-alias "@/*"`
2. Install all dependencies
3. Set up `tailwind.config.ts` with design tokens
4. Set up `globals.css` with all CSS variables
5. Set up `prisma/schema.prisma` with the full schema above
6. Run `prisma generate` and `prisma db push`
7. Set up `lib/auth.ts` with NextAuth v5
8. Build all UI primitives in `components/ui/`
9. Build Navbar and Footer
10. Build Homepage section by section
11. Build auth pages (login, register, admin-login)
12. Build admin shell (sidebar + topbar + dashboard)
13. Build settings pages
14. Run, test, fix until every Phase 1 item is working perfectly

Do not move to Phase 2 until Phase 1 is complete, running, and visually matching the design system exactly.

---

*Prepared by SonsHub Media Ltd for Prudential Atelier — prudentgabriel.com*
*₦7,500,000 engagement · Phase 1 of 5*
