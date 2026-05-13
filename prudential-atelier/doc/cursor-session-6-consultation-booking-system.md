# CURSOR SESSION PROMPT — SESSION 6
## Sophisticated Consultation Booking System
### Prudential Atelier · prudentgabriel.com
### Prepared by Nony | SonsHub Media

---

> ## ⚠️ MANDATORY PRE-FLIGHT — READ EVERY WORD
>
> 1. **Never recreate files that exist.** Read File before creating anything.
> 2. **No `any` types.** Derive all types from Prisma or define explicit interfaces.
> 3. **All multi-table writes use `prisma.$transaction([])`.**
> 4. **Two completely separate booking flows exist:**
>    - Mrs. Prudent's sessions → MANUAL confirmation by admin (never auto-confirm)
>    - All other consultants → LIVE calendar, auto-confirmed immediately on payment
> 5. **Consultation fees are STANDALONE payments.** They are never automatically
>    refunded or credited at checkout. If admin wants to credit a client, they
>    do it manually via the existing wallet points adjustment in /admin/customers/[id].
>    Do NOT add any consultation credit logic to the checkout flow.
> 6. **Production domain is `prudentgabriel.com`** — use this in all email
>    templates, DEPLOYMENT.md, and any hardcoded URLs.
> 7. After every task: `npx tsc --noEmit` must pass before moving on.
> 8. Complete every function. No `// TODO` or placeholder returns.

---

## CONTEXT — WHAT EXISTS

### ✅ Already built (Sessions 1–5)
- Full storefront, shop, product detail, checkout (Paystack/Flutterwave/Stripe/Monnify)
- Account dashboard, admin dashboard (full)
- `/bespoke` page — 3-step inquiry form. **Keep this exactly as-is.**
  The consultation system is a NEW separate feature at `/consultation`
- `src/lib/email.tsx` — `sendEmail()`, all existing email helpers
- `src/lib/payments/paystack.ts`, `flutterwave.ts`, `stripe.ts`, `monnify.ts`
- `src/lib/order-number.ts` — `generateOrderNumber()`, `generateBespokeNumber()`
- Admin customers page: already has "Adjust Points" feature for manual wallet credits
- Wallet system: `PointsTransaction`, `pointsBalance` on User

### ❌ NOT YET BUILT (this session builds everything below)

---

## THE TWO FLOWS — UNDERSTAND BEFORE CODING

### FLOW A: Live Calendar (Senior Designer, Design Team, Style Consultant)
```
Client selects consultant
  → selects session type
  → calendar shows available slots (real-time from DB)
  → selects date + time
  → fills personal details + occasion
  → pays consultation fee (Paystack for NGN, Stripe/Flutterwave for USD/GBP)
  → INSTANT: booking status = CONFIRMED
  → INSTANT: confirmation email sent with:
      Virtual → Google Meet / Zoom link
      In-Person Atelier → atelier address + preparation guide
      Home Visit → "Our team will contact you to confirm your address"
```

### FLOW B: Request (Mrs. Prudent Gabriel-Okopi ONLY)
```
Client selects Mrs. Prudent
  → selects session type
  → fills preferred dates (3 date preferences, no live calendar shown)
  → fills personal details + occasion
  → pays consultation fee upfront
  → booking status = PENDING_CONFIRMATION
  → admin notified immediately
  → admin reviews in /admin/consultations/[id]
  → admin clicks [Confirm Booking] → picks actual date/time → sends confirmation
  → client receives confirmation email with slot + meeting link or address
  → OR: admin clicks [Propose Alternative] → sends email with new date options
  → OR: admin clicks [Cancel & Refund Note] → sends cancellation email
      (actual payment refund done manually in payment gateway dashboard)
```

---

## PRISMA SCHEMA ADDITIONS

Check `prisma/schema.prisma` — add ONLY what is missing. Then run `npx prisma generate`.

```prisma
// ─────────────────────────────────────────
// CONSULTATION SYSTEM MODELS
// ─────────────────────────────────────────

model Consultant {
  id            String   @id @default(cuid())
  name          String   // "Mrs. Prudent Gabriel-Okopi"
  title         String   // "Founder & Creative Director"
  bio           String   @db.Text
  image         String?  // Cloudinary URL
  isActive      Boolean  @default(true)
  isFlagship    Boolean  @default(false) // true = Mrs. Prudent → manual flow
  displayOrder  Int      @default(0)     // order shown on booking page

  offerings     ConsultantOffering[]
  availability  ConsultantAvailability[]
  blockedDates  ConsultantBlockedDate[]
  bookings      ConsultationBooking[]

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

// Each consultant can offer multiple session type + delivery combinations
// Each combination has its own fee and duration
model ConsultantOffering {
  id              String          @id @default(cuid())
  consultantId    String
  consultant      Consultant      @relation(fields: [consultantId], references: [id], onDelete: Cascade)
  sessionType     ConsultationSessionType
  deliveryMode    ConsultationDeliveryMode
  durationMinutes Int             // e.g. 30, 45, 60, 90
  feeNGN          Float           // Consultation fee in NGN
  feeUSD          Float?          // Optional USD price
  feeGBP          Float?          // Optional GBP price
  isActive        Boolean         @default(true)
  description     String?         // Short note: "Deep dive into your bridal vision"
  bookings        ConsultationBooking[]

  @@unique([consultantId, sessionType, deliveryMode])
}

// Weekly recurring availability — for LIVE CALENDAR consultants only
// (Not used for Mrs. Prudent / isFlagship consultants)
model ConsultantAvailability {
  id            String     @id @default(cuid())
  consultantId  String
  consultant    Consultant @relation(fields: [consultantId], references: [id], onDelete: Cascade)
  dayOfWeek     Int        // 0=Sunday, 1=Monday ... 6=Saturday
  startTime     String     // "09:00" (WAT / UTC+1)
  endTime       String     // "17:00"
  isActive      Boolean    @default(true)

  @@unique([consultantId, dayOfWeek])
}

// Specific blocked dates — holidays, travel, fully booked days
model ConsultantBlockedDate {
  id            String     @id @default(cuid())
  consultantId  String
  consultant    Consultant @relation(fields: [consultantId], references: [id], onDelete: Cascade)
  date          DateTime   // The blocked date (store as start of day UTC)
  reason        String?    // Internal note: "Lagos Fashion Week", "Personal"
  createdAt     DateTime   @default(now())

  @@unique([consultantId, date])
}

// The core booking record
model ConsultationBooking {
  id              String                    @id @default(cuid())
  bookingNumber   String                    @unique // "CB-2024-00042"
  offeringId      String
  offering        ConsultantOffering        @relation(fields: [offeringId], references: [id])
  consultantId    String
  consultant      Consultant                @relation(fields: [consultantId], references: [id])

  // Client info (works for both logged-in users and guests)
  userId          String?
  user            User?                     @relation(fields: [userId], references: [id])
  clientName      String
  clientEmail     String
  clientPhone     String
  clientCountry   String
  clientInstagram String?                   // Optional — for portfolio reference

  // What they want to discuss
  occasion        String                    // "Bridal", "Corporate Event", etc.
  description     String                    @db.Text
  referenceImages String[]                  // Cloudinary URLs (up to 5)

  // Scheduling
  // For LIVE flow: confirmedDate is set immediately on booking
  // For MANUAL flow: these are preferred dates submitted by client
  preferredDate1  DateTime?
  preferredDate2  DateTime?
  preferredDate3  DateTime?
  confirmedDate   DateTime?                 // Set by admin (MANUAL) or auto (LIVE)
  confirmedTime   String?                   // "14:00" WAT

  // Session delivery details
  meetingLink     String?                   // Google Meet / Zoom URL (virtual sessions)
  meetingPlatform String?                   // "Google Meet" | "Zoom"
  atelierAddress  String?                   // Pre-filled for in-person atelier sessions

  // Payment
  feeNGN          Float                     // Snapshot of fee at time of booking
  currency        Currency                  @default(NGN)
  paymentGateway  PaymentGateway?
  paymentRef      String?
  paymentStatus   PaymentStatus             @default(PENDING)
  paidAt          DateTime?

  // Booking status
  status          ConsultationStatus        @default(PENDING_PAYMENT)
  adminNotes      String?                   // Internal only
  cancellationReason String?

  // Post-consultation
  completedAt     DateTime?
  adminFeedback   String?                   // Private session notes by admin

  createdAt       DateTime                  @default(now())
  updatedAt       DateTime                  @updatedAt

  @@index([clientEmail])
  @@index([status])
  @@index([confirmedDate])
  @@index([consultantId])
}

// ─────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────

enum ConsultationSessionType {
  BESPOKE_DESIGN          // Full bespoke piece design session
  BRIDAL_CONSULTATION     // Bridal-specific deep-dive
  STYLING_SESSION         // Fabric selection + look advice only
  WARDROBE_CONSULTATION   // General wardrobe strategy
  GROUP_SESSION           // Design team group consultation
  DISCOVERY_CALL          // First-time client introduction (shorter)
}

enum ConsultationDeliveryMode {
  VIRTUAL_STANDARD        // Video call with standard consultant
  VIRTUAL_WITH_PRUDENT    // Video call specifically with Mrs. Prudent
  VIRTUAL_WITH_TEAM       // Video call with the design team
  INPERSON_ATELIER        // In-person at Lagos atelier
  INPERSON_ATELIER_PRUDENT // In-person at atelier with Mrs. Prudent specifically
  INPERSON_HOME_TEAM      // Design team visits client's location
  INPERSON_HOME_PRUDENT   // Mrs. Prudent visits client's location
  PHONE_CALL              // Phone / WhatsApp call
}

enum ConsultationStatus {
  PENDING_PAYMENT         // Booking created, awaiting payment
  PENDING_CONFIRMATION    // Paid, awaiting admin confirmation (Mrs. Prudent flow)
  CONFIRMED               // Date + time locked, confirmation email sent
  RESCHEDULED             // Admin proposed new time, client notified
  COMPLETED               // Session took place
  CANCELLED_BY_CLIENT     // Client cancelled
  CANCELLED_BY_ADMIN      // Admin cancelled (refund note sent)
  NO_SHOW                 // Client didn't attend
}

// Add to User model (if not present):
// consultationBookings ConsultationBooking[]
```

After adding schema:
```bash
npx prisma generate
npx prisma db push
```

---

## TASK A — LIBRARY FILES

### A1 — Booking Number Generator

**`src/lib/consultation.ts`** (new file)
```typescript
import { prisma } from './prisma'
import { ConsultationDeliveryMode, ConsultationStatus } from '@prisma/client'

// generateBookingNumber(): string
//   Format: "CB-" + last 2 digits of year + "-" + 5-digit padded random
//   Example: "CB-24-00042"

// isManualFlow(deliveryMode: ConsultationDeliveryMode): boolean
//   Returns true if deliveryMode involves Mrs. Prudent (MANUAL confirmation)
//   True for: VIRTUAL_WITH_PRUDENT, INPERSON_ATELIER_PRUDENT, INPERSON_HOME_PRUDENT
//   False for all others (LIVE calendar auto-confirm)
//   NOTE: Also check consultant.isFlagship as a secondary guard

// getAvailableSlots(consultantId: string, date: Date, durationMinutes: number): Promise<string[]>
//   Returns array of available time strings for a given date: ["09:00", "10:00", ...]
//
//   Logic:
//   1. Get consultant.availability for that day of week (dayOfWeek)
//   2. If no availability record or isActive=false: return [] (no slots)
//   3. Check consultant.blockedDates for this specific date → return [] if blocked
//   4. Generate all possible slots between startTime–endTime with durationMinutes intervals
//      e.g. 09:00–17:00 with 60min = ["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00"]
//      (last slot must end by endTime, so 16:00+60min=17:00 is valid, 17:00+60min=18:00 is not)
//   5. Fetch existing CONFIRMED or PENDING_CONFIRMATION bookings for this consultant on this date
//   6. Remove slots that overlap with existing bookings
//      A slot at "10:00" for 60min conflicts if any booking falls within 10:00–11:00
//   7. Remove slots in the past (compare with current time + 2hr buffer)
//   8. Return remaining available slots

// getNextAvailableDates(consultantId: string, daysAhead: number = 60): Promise<Date[]>
//   Returns array of dates (next 60 days) that have at least 1 available slot
//   Used to highlight/disable dates on the calendar picker
//   Exclude: past dates, blocked dates, fully booked dates, days with no availability

// formatConsultationFee(offering: ConsultantOffering, currency: 'NGN'|'USD'|'GBP'): string
//   Convert fee using existing convertFromNGN from lib/currency.ts
//   Format with formatPrice

// getDeliveryModeLabel(mode: ConsultationDeliveryMode): string
//   Human-readable: VIRTUAL_STANDARD → "Virtual Video Call"
//   VIRTUAL_WITH_PRUDENT → "Virtual with Mrs. Prudent Gabriel-Okopi"
//   INPERSON_ATELIER → "In-Person · Prudential Atelier, Lagos"
//   INPERSON_ATELIER_PRUDENT → "In-Person with Mrs. Prudent · Lagos Atelier"
//   INPERSON_HOME_TEAM → "Home Visit · Design Team"
//   INPERSON_HOME_PRUDENT → "Home Visit · Mrs. Prudent Gabriel-Okopi"
//   PHONE_CALL → "Phone / WhatsApp Call"

// getSessionTypeLabel(type: ConsultationSessionType): string
//   BESPOKE_DESIGN → "Bespoke Design Session"
//   BRIDAL_CONSULTATION → "Bridal Consultation"
//   STYLING_SESSION → "Styling & Fabric Session"
//   WARDROBE_CONSULTATION → "Wardrobe Consultation"
//   GROUP_SESSION → "Group Design Session"
//   DISCOVERY_CALL → "Discovery Call"
```

### A2 — Consultation Email Helpers

**Add to `src/lib/email.tsx`** (new functions alongside existing ones):
```typescript
// sendConsultationPendingEmail(params: {
//   to: string, clientName: string, bookingNumber: string,
//   consultantName: string, sessionTypeLabel: string, deliveryModeLabel: string,
//   feeNGN: number, currency: string
// }): Promise<void>
//   Subject: "Consultation Request Received — #[bookingNumber] | Prudential Atelier"
//   Body: "Thank you [clientName]. Your booking request for [consultantName] has been received."
//         "We will review your preferred dates and confirm your slot within 24–48 hours."
//   Uses ConsultationPendingEmail template

// sendConsultationConfirmedEmail(params: {
//   to: string, clientName: string, bookingNumber: string,
//   consultantName: string, sessionTypeLabel: string, deliveryModeLabel: string,
//   confirmedDate: Date, confirmedTime: string,
//   durationMinutes: number, feeNGN: number,
//   meetingLink?: string, meetingPlatform?: string,
//   atelierAddress?: string, isVirtual: boolean
// }): Promise<void>
//   Subject: "Consultation Confirmed — #[bookingNumber] · [date formatted]"

// sendConsultationCancelledEmail(params: {
//   to: string, clientName: string, bookingNumber: string,
//   consultantName: string, reason?: string
// }): Promise<void>
//   Subject: "Consultation Cancelled — #[bookingNumber]"

// sendConsultationRescheduleEmail(params: {
//   to: string, clientName: string, bookingNumber: string,
//   consultantName: string, proposedDates: string[], adminMessage?: string
// }): Promise<void>
//   Subject: "New Date Proposed — #[bookingNumber]"

// sendAdminConsultationNotification(params: {
//   bookingNumber: string, clientName: string, clientEmail: string,
//   consultantName: string, sessionTypeLabel: string, deliveryModeLabel: string,
//   preferredDates: string[], isManual: boolean
// }): Promise<void>
//   Subject: "New Consultation Booking — #[bookingNumber] [MANUAL REVIEW REQUIRED?]"
//   To: process.env.ADMIN_EMAIL
```

### A3 — Consultation Validation Schemas

**`src/validations/consultation.ts`**
```typescript
import { z } from 'zod'
import { ConsultationSessionType, ConsultationDeliveryMode, Currency } from '@prisma/client'

export const consultationBookingSchema = z.object({
  offeringId:       z.string().cuid(),
  consultantId:     z.string().cuid(),
  currency:         z.nativeEnum(Currency).default('NGN'),
  gateway:          z.enum(['PAYSTACK', 'FLUTTERWAVE', 'STRIPE', 'MONNIFY']),

  // Client details
  clientName:       z.string().min(2).max(100),
  clientEmail:      z.string().email(),
  clientPhone:      z.string().min(7).max(20),
  clientCountry:    z.string().min(2),
  clientInstagram:  z.string().optional(),

  // What they need
  occasion:         z.string().min(1),
  description:      z.string().min(20).max(2000),
  referenceImages:  z.array(z.string().url()).max(5).default([]),

  // LIVE FLOW: confirmed slot
  confirmedDate:    z.coerce.date().optional(),
  confirmedTime:    z.string().regex(/^\d{2}:\d{2}$/).optional(),

  // MANUAL FLOW: preferred dates (Mrs. Prudent)
  preferredDate1:   z.coerce.date().optional(),
  preferredDate2:   z.coerce.date().optional(),
  preferredDate3:   z.coerce.date().optional(),
})
.refine(
  data => {
    // Live flow: must have confirmedDate + confirmedTime
    // Manual flow: must have at least preferredDate1
    // We validate this server-side based on isManualFlow()
    return true // client-side: just ensure one or the other is filled
  }
)

export type ConsultationBookingInput = z.infer<typeof consultationBookingSchema>

export const consultantAdminSchema = z.object({
  name:          z.string().min(2),
  title:         z.string().min(2),
  bio:           z.string().min(10),
  image:         z.string().url().optional(),
  isActive:      z.boolean().default(true),
  isFlagship:    z.boolean().default(false),
  displayOrder:  z.number().int().min(0).default(0),
  offerings: z.array(z.object({
    id:              z.string().optional(),
    sessionType:     z.nativeEnum(ConsultationSessionType),
    deliveryMode:    z.nativeEnum(ConsultationDeliveryMode),
    durationMinutes: z.number().int().min(15).max(240),
    feeNGN:          z.number().min(0),
    feeUSD:          z.number().min(0).optional(),
    feeGBP:          z.number().min(0).optional(),
    isActive:        z.boolean().default(true),
    description:     z.string().optional(),
  })),
  availability: z.array(z.object({
    dayOfWeek:  z.number().int().min(0).max(6),
    startTime:  z.string().regex(/^\d{2}:\d{2}$/),
    endTime:    z.string().regex(/^\d{2}:\d{2}$/),
    isActive:   z.boolean().default(true),
  })),
})
```

---

## TASK B — API ROUTES

### B1 — Public Consultants List

**`src/app/api/consultants/route.ts`** (GET)
```typescript
// Fetch all active consultants with their active offerings
// Include: offerings (where isActive), availability (where isActive)
// Order by: displayOrder asc
// Do NOT include blocked dates or internal notes
// Return: { consultants: ConsultantWithOfferings[] }
// Cache: revalidate 300 (5 min — admin changes propagate quickly)
```

### B2 — Available Slots API

**`src/app/api/consultants/[id]/slots/route.ts`** (GET)
```typescript
// Query: date (YYYY-MM-DD string), offeringId
// Validate: date is in the future (min: tomorrow)
// Fetch offering for durationMinutes
// Call getAvailableSlots(consultantId, date, durationMinutes) from lib/consultation.ts
// Return: { slots: string[], date: string, consultantId: string }
// If consultant.isFlagship: return { slots: [], isManualFlow: true }
//   (Frontend knows not to show slots for Mrs. Prudent)
// Cache: no-store (real-time availability)
```

### B3 — Booking Create

**`src/app/api/consultations/create/route.ts`** (POST)
```typescript
// Auth: session (preferred) OR guest (clientEmail required)
// Input: consultationBookingSchema

// SERVER-SIDE VALIDATION:
// 1. Fetch offering — verify exists, isActive, consultant isActive
// 2. Verify feeNGN matches offering.feeNGN (never trust client price)
// 3. For LIVE flow (not isFlagship):
//    a. confirmedDate + confirmedTime must be present
//    b. Re-verify slot is still available (race condition check)
//    c. Verify date >= tomorrow
// 4. For MANUAL flow (isFlagship):
//    a. preferredDate1 must be present (others optional)
//    b. All preferred dates must be >= 3 days from now (min lead time for Mrs. Prudent)

// CREATE BOOKING (prisma.$transaction):
//   a. Create ConsultationBooking:
//      - bookingNumber: generateBookingNumber()
//      - status: PENDING_PAYMENT (payment not yet taken)
//      - For LIVE: confirmedDate + confirmedTime set immediately
//      - For MANUAL: preferredDate1/2/3 set, confirmedDate = null
//   b. No stock change, no points change at this stage

// Return: { bookingId, bookingNumber, feeNGN, currency }
// (Client then calls payment initiation with bookingId)
```

### B4 — Consultation Payment Routes

**`src/app/api/consultations/payment/paystack/initiate/route.ts`** (POST)
```typescript
// Input: { bookingId: string }
// Fetch booking, verify status === PENDING_PAYMENT
// Verify booking.clientEmail matches session OR matches input email (guest)
// Call paystack.initializeTransaction({
//   email: booking.clientEmail,
//   amountKobo: Math.round(booking.feeNGN * 100),
//   reference: booking.bookingNumber,
//   callbackUrl: NEXT_PUBLIC_APP_URL + '/api/consultations/payment/paystack/verify?bookingId=' + bookingId,
//   metadata: { bookingId, bookingNumber: booking.bookingNumber, type: 'consultation' }
// })
// Return: { authorizationUrl, reference }
```

**`src/app/api/consultations/payment/paystack/verify/route.ts`** (GET)
```typescript
// Query: reference, bookingId
// Call paystack.verifyTransaction(reference)
// If status === 'success':
//   Update booking in $transaction:
//     paymentStatus: PAID, paidAt: now(), paymentRef: reference, paymentGateway: PAYSTACK
//     If LIVE flow (confirmedDate already set): status → CONFIRMED
//     If MANUAL flow: status → PENDING_CONFIRMATION
//
//   Send emails:
//     If CONFIRMED (LIVE): sendConsultationConfirmedEmail(...)
//       Build meetingLink if virtual: generate Google Meet link placeholder OR
//       use 'https://meet.google.com' (admin will update with real link)
//       atelierAddress if in-person atelier: "14 [Atelier Address], Lagos, Nigeria"
//     If PENDING_CONFIRMATION (MANUAL): sendConsultationPendingEmail(...)
//     Always: sendAdminConsultationNotification(...)
//
// Redirect: /consultation/success?booking=[bookingNumber]
//        OR /consultation?error=payment-failed
```

**`src/app/api/consultations/payment/paystack/webhook/route.ts`** (POST — RAW BODY)
```typescript
// Same signature verification pattern as /api/payment/paystack/webhook
// Handle: charge.success → same PAID + status update logic (idempotent)
// Always return 200
```

**Create equivalent for Flutterwave:**
`/api/consultations/payment/flutterwave/initiate`
`/api/consultations/payment/flutterwave/verify`
`/api/consultations/payment/flutterwave/webhook`

**Create equivalent for Stripe:**
`/api/consultations/payment/stripe/initiate`
`/api/consultations/payment/stripe/webhook`

**Create equivalent for Monnify:**
`/api/consultations/payment/monnify/initiate`
`/api/consultations/payment/monnify/verify`
`/api/consultations/payment/monnify/webhook`

*(Follow exact same pattern as existing payment routes — just substitute booking fields for order fields)*

### B5 — Account Bookings API

**`src/app/api/account/consultations/route.ts`** (GET)
```typescript
// Auth required
// Fetch ConsultationBookings for userId OR clientEmail matches session.user.email
// Include: consultant (name, image), offering (sessionType, deliveryMode, durationMinutes)
// OrderBy: createdAt desc
// Return: { bookings: ConsultationBookingWithDetails[] }
```

**`src/app/api/account/consultations/[id]/route.ts`** (GET)
```typescript
// Fetch single booking
// Verify belongs to user (userId match OR email match)
// Return full booking details
```

### B6 — Admin Consultation APIs

**`src/app/api/admin/consultants/route.ts`** (GET, POST)
```typescript
// GET: All consultants with offerings, availability, bookings count
// POST: Create consultant (consultantAdminSchema)
//   $transaction: create consultant + create all offerings + create availability slots
```

**`src/app/api/admin/consultants/[id]/route.ts`** (GET, PATCH, DELETE)
```typescript
// PATCH: Update consultant + upsert offerings + upsert availability
//   Offerings: upsert by id, delete offerings not in submitted list
//   $transaction
// DELETE: only if no CONFIRMED/PENDING_CONFIRMATION bookings exist
//   Check + return 409 if active bookings
```

**`src/app/api/admin/consultants/[id]/blocked-dates/route.ts`** (GET, POST, DELETE)
```typescript
// GET: list blocked dates for this consultant
// POST: { date: Date, reason?: string } → create ConsultantBlockedDate
// DELETE: ?date=[YYYY-MM-DD] → delete blocked date
```

**`src/app/api/admin/consultations/route.ts`** (GET)
```typescript
// All bookings with pagination + filters
// Filters: status, consultantId, deliveryMode, dateFrom, dateTo, search (name/email/bookingNumber)
// Include: consultant (name), offering (sessionType, deliveryMode)
// OrderBy: createdAt desc
```

**`src/app/api/admin/consultations/[id]/route.ts`** (GET, PATCH)
```typescript
// GET: Full booking details
//
// PATCH: Admin actions
//   Allowed fields:
//     confirmedDate, confirmedTime (setting the actual slot for MANUAL flow)
//     meetingLink, meetingPlatform
//     status (controlled transitions only — see below)
//     adminNotes, adminFeedback
//     cancellationReason
//
//   STATUS TRANSITIONS (server enforces these):
//     PENDING_CONFIRMATION → CONFIRMED (admin sets date/time + sends confirmation email)
//     PENDING_CONFIRMATION → RESCHEDULED (admin proposes new dates + sends email)
//     CONFIRMED → COMPLETED (admin marks session done)
//     CONFIRMED → CANCELLED_BY_ADMIN (admin cancels + sends cancellation email)
//     CONFIRMED → NO_SHOW (client didn't attend)
//     PENDING_CONFIRMATION → CANCELLED_BY_ADMIN
//
//   On transition to CONFIRMED: sendConsultationConfirmedEmail(...)
//   On transition to CANCELLED_BY_ADMIN: sendConsultationCancelledEmail(...)
//   On RESCHEDULED: sendConsultationRescheduleEmail(...)
```

---

## TASK C — STOREFRONT: CONSULTATION PAGE

**`src/app/(storefront)/consultation/page.tsx`** (Server Component)
```typescript
// Fetch consultants: GET /api/consultants
// Pass to ConsultationBookingFlow (client component)
// revalidate: 300
// metadata: "Book a Consultation — Prudential Atelier"
```

### C1 — Page Hero

```
Full-width hero (500px desktop, 300px mobile)
Background: dark editorial image — atelier/measurement/consultation scene
  src: https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=1400
Overlay: charcoal/75

Centered content:
  SectionLabel (gold): "BOOK A CONSULTATION"
  h1 (Display L, ivory, Cormorant italic):
    "Your Vision Starts<br/>With a Conversation."
  p (Body M, ivory/70, max-w-lg mx-auto):
    "Choose your consultant, select your session, and begin the journey
     to your most exquisite piece."

Trust badges row (below heading, mt-6):
  🔒 "Secure Payment"   |   ✨ "Expert Guidance"   |   📅 "Flexible Scheduling"
  (font-label, 11px, ivory/60)
```

### C2 — Booking Flow Component

**`src/components/consultation/ConsultationBookingFlow.tsx`** (client component)
```typescript
// Props: { consultants: ConsultantWithOfferings[] }
//
// 4-step flow with progress indicator
// State: step (1–4), selections, form data, paymentState
```

**PROGRESS INDICATOR (top, full-width):**
```
4 steps: [1 Choose] [2 Schedule] [3 Details] [4 Confirm & Pay]
Completed: wine circle + checkmark ✓
Current: wine circle + number, gold border glow
Future: grey outline circle
Connecting lines: wine fill for completed, grey for future
Step labels visible on desktop, hidden on mobile
```

---

### STEP 1 — Choose Your Session

**`src/components/consultation/StepChoose.tsx`**

```
HEADING: "Who would you like to consult with?"
Subtext: "Each consultant brings a different level of expertise and focus."

CONSULTANT CARDS (grid: 1-col mobile, 2-col desktop):

Each card layout:
  ─────────────────────────────────────
  [Photo: 80×80, rounded-full, object-cover] ← left
  
  RIGHT:
    Name (Cormorant, 20px, charcoal, font-semibold)
    Title (font-label, 11px, gold, uppercase)
    If isFlagship: badge "Flagship · By Request Only" (wine bg, ivory text)
    Bio (DM Sans, 13px, charcoal-mid, line-clamp-3)
    
  OFFERINGS below (mt-3, inside card):
    chips showing available session types + delivery modes
    e.g. "Bespoke Design · Virtual" | "Bridal · In-Person" etc.
    Overflow: show 3 chips + "+N more" if many
  
  "From ₦[lowest fee]" (bottom right, gold, font-medium)
  ─────────────────────────────────────
  
  Selected state:
    wine border (2px), wine bg/5 tint
    Large wine checkmark circle top-right

On select: expand SESSION TYPE + DELIVERY MODE selectors below the card

SESSION TYPE SELECTOR (appears after consultant selected):
  Label: "What would you like to focus on?"
  Radio cards (2-col grid):
    Each: icon + session type label + short description
    Icons (use Lucide or emoji):
      BESPOKE_DESIGN: ✂️ "Bespoke Design Session"
        "Design your custom piece from concept to creation"
      BRIDAL_CONSULTATION: 💍 "Bridal Consultation"
        "Your complete bridal vision — gown, traditional, accessories"
      STYLING_SESSION: 👗 "Styling & Fabric Session"
        "Fabric selection, colour advice, and look creation"
      WARDROBE_CONSULTATION: 🪞 "Wardrobe Consultation"
        "Strategic wardrobe building for the modern professional"
      GROUP_SESSION: 👥 "Group Design Session"
        "Collaborative session for bridal party or team"
      DISCOVERY_CALL: 🌟 "Discovery Call"
        "First-time client? Start here — meet the team"
    
    Only show session types offered by selected consultant
    Selected: wine border, wine radio dot

DELIVERY MODE SELECTOR (appears after session type selected):
  Label: "How would you like to meet?"
  Radio cards:
    Show only delivery modes available for selected consultant + session type combo
    Each card:
      Icon (Lucide: Video, MapPin, Home, Phone)
      Label (from getDeliveryModeLabel())
      Duration: "[X] minutes" (gold badge)
      Fee: "₦[fee]" (Display S, wine, right-aligned)
      If USD/GBP: "≈ $[x] · £[x]" (small, grey, below)
      
      Special card styling for Mrs. Prudent modes:
        Gold gradient border (animated shimmer effect)
        "✦ Flagship Experience" badge
        "Sessions confirmed personally by Mrs. Gabriel-Okopi"
    
    Selected: wine border, wine radio dot

[Continue to Schedule →] button (bottom, wine, full-width)
  Disabled if: no consultant + session type + delivery mode selected
```

---

### STEP 2 — Schedule

**`src/components/consultation/StepSchedule.tsx`**

```typescript
// Props: { consultant, offering, isManualFlow: boolean }
```

**IF isManualFlow = false (LIVE CALENDAR):**
```
HEADING: "Select your preferred date & time"
Subtext: "All times are in West Africa Time (WAT · UTC+1)"

CALENDAR:
  Month view calendar (build custom — no external library needed)
  
  Calendar header: [←] Month Year [→]
  Days grid: 7 columns (Sun–Sat)
  
  Each day cell styling:
    Past dates: grey, line-through, disabled
    Today: gold ring outline
    Available: ivory bg, black text, cursor-pointer
               hover: wine bg/10, wine text
    Unavailable / fully booked / blocked: grey/40, cursor-not-allowed
    Selected: wine bg, ivory text, rounded-sm
  
  Fetch available dates:
    On calendar mount: GET /api/consultants/[id]/available-dates?durationMinutes=[N]
    This returns array of Date strings with ≥1 slot available
    Use to style cells as available vs unavailable
    Loading: shimmer skeleton over calendar
  
  On date select: fetch time slots:
    GET /api/consultants/[id]/slots?date=[YYYY-MM-DD]&offeringId=[id]
    Loading: skeleton row of slot chips

TIME SLOTS (below calendar, appears after date selected):
  Label: "Available times on [selected date formatted]:"
  
  Grid of time chips (flex-wrap, gap-2):
    Each: "[HH:MM] WAT" in a chip button
    Unselected: ivory bg, border-border, charcoal text
    Selected: wine bg, ivory text
    Disabled (already booked): grey, line-through
  
  If no slots: "No times available on this date. Please select another."
  
  Below slots:
    Duration reminder: "This session is [X] minutes."
    Timezone note: "Times shown in WAT (Lagos, GMT+1)"

[Continue to Your Details →] button
  Disabled until: date + time selected
```

**IF isManualFlow = true (MRS. PRUDENT — MANUAL):**
```
HEADING: "Submit Your Preferred Dates"

Subtext (wine bg/10, gold border, p-4, rounded-sm):
  "✦ As Mrs. Gabriel-Okopi personally conducts these sessions,
   scheduling is coordinated directly with her team.
   Please submit up to 3 preferred dates and we will confirm
   your slot within 24–48 hours."

3 DATE PICKERS (stacked):
  "1st Preference" (required)
  "2nd Preference" (optional)
  "3rd Preference" (optional)
  
  Each: native date input (min: 3 days from today)
  Style: branded Input component with floating label
  
  Note below: "Please allow a minimum of 3 days lead time for Mrs. Prudent's sessions."

Lead time note (charcoal-mid, 13px, mt-4):
  "Once your dates are submitted and payment is completed,
   our team will confirm your session and send all details within 24–48 hours."

[Continue to Your Details →] button
  Disabled until: preferredDate1 set and is >= 3 days from now
```

---

### STEP 3 — Your Details

**`src/components/consultation/StepDetails.tsx`**

```
HEADING: "Tell us about yourself and your vision"

Two-column form (React Hook Form, Zod consultationBookingSchema):

LEFT COLUMN — Personal Information:
  Full Name (Input, required)
  Email Address (Input type="email", required)
  Phone Number (Input, required)
  Country (Select, default Nigeria)
  Instagram Handle (Input, optional, placeholder "@yourhandle")
    Note: "Optional — helps us understand your style references"

RIGHT COLUMN — Your Consultation:
  Occasion (Select, required):
    Options: White Wedding, Traditional Wedding, Wedding Guest, Engagement,
             Corporate Event, Birthday, Gala/Red Carpet, AMVCA/Awards,
             Naming/Dedication, Wardrobe Refresh, Other
  
  Description (Textarea, required, min 20 chars):
    Placeholder: "Tell us about what you have in mind, the event,
                  your style, and anything specific you'd like to achieve
                  in this consultation..."
    Char counter: X / 2000
  
  Reference Images (optional, up to 5):
    Drag-and-drop upload zone:
      "Upload inspiration images (optional · max 5)"
      Accept: image/*
      Each upload: POST /api/admin/upload → get URL
      Preview thumbnails with X remove
      Progress indicator per image

SESSION SUMMARY CARD (below form, bg-ivory-dark, border-border, p-4):
  "Your Booking Summary"
  Consultant: [name] · [title]
  Session: [session type label]
  Mode: [delivery mode label]
  If LIVE: Date & Time: [selected date] at [time] WAT · [X] minutes
  If MANUAL: Preferred Dates: [date1], [date2], [date3]
  Fee: ₦[fee] (+ equivalent in USD/GBP smaller)

[Continue to Payment →] button
```

---

### STEP 4 — Confirm & Pay

**`src/components/consultation/StepPayment.tsx`**

```
HEADING: "Confirm and complete your booking"

LEFT — Final Summary Card (bg-cream, border-border, p-6):
  "Booking Summary" (Heading M, Cormorant)
  
  ── CONSULTANT:
    Photo (48×48 rounded-full) + Name (bold) + Title (gold, small)
  
  ── SESSION DETAILS:
    [Video icon or MapPin icon] [delivery mode label]
    [Clock icon] [duration] minutes
    [Calendar icon] [date + time] OR "Pending Confirmation"
    [Tag icon] [session type label]
  
  ── CLIENT:
    Name, Email, Phone, Country
    Occasion
    
  ── FEE:
    Divider
    Consultation Fee: ₦[fee] (Display S, wine, right-aligned)
    Currency equivalents (small, grey): ≈ $X · £X
    
    Wine info box (p-3, rounded-sm):
      "ℹ️ This consultation fee is a standalone payment.
       It covers your session with [consultant name] and includes
       preparation time and post-session design notes."

RIGHT — Payment (sticky):
  Currency selector: ₦ NGN | $ USD | £ GBP
  (Updates displayed fee + gateway options)
  
  PAYMENT METHODS (radio cards):
    Show/hide by currency same logic as checkout:
    ● PAYSTACK — NGN only
    ● FLUTTERWAVE — All currencies
    ● STRIPE — USD / GBP only
    ● MONNIFY — NGN only
  
  [Confirm Booking & Pay ₦XX,XXX] button
    Full-width, large, wine/gold
    Disabled: no gateway selected OR isSubmitting
    
    On click:
      1. isSubmitting = true
      2. POST /api/consultations/create → get { bookingId, bookingNumber }
      3. POST /api/consultations/payment/[gateway]/initiate { bookingId }
      4. Redirect to payment URL
  
  🔒 "Payment secured by [gateway]"
  
  MANUAL FLOW NOTE (only if Mrs. Prudent selected):
    Gold box below payment button:
    "✦ Your payment reserves priority access to Mrs. Gabriel-Okopi's
     schedule. Your confirmed date will be sent within 24–48 hours."
```

---

### C3 — Consultation Success Page

**`src/app/(storefront)/consultation/success/page.tsx`** (client component)
```typescript
// URL: /consultation/success?booking=[bookingNumber]
// If no bookingNumber: redirect to /consultation
// Fetch: GET /api/account/consultations/[bookingNumber]
//   (allow public access by bookingNumber — no auth required for this route)
```

```
Animated checkmark (same SVG draw as checkout success)
Background: ivory

If CONFIRMED (LIVE flow):
  "Consultation Confirmed!" (Display M, wine)
  "#[bookingNumber]" (gold, font-label)
  "Your session is booked."
  
  DETAILS CARD (border-gold, bg-cream, p-6):
    Consultant name + photo
    Date: [formatted] at [time] WAT
    Duration: [X] minutes
    
    If VIRTUAL:
      Platform badge (Google Meet / Zoom icon)
      "Your meeting link will be sent to [email]"
      OR if meetingLink set: [Join Meeting] button (gold, opens new tab)
    
    If INPERSON_ATELIER or INPERSON_ATELIER_PRUDENT:
      📍 "Prudential Atelier, Lagos, Nigeria"
      "Full address and preparation guide sent to [email]"
    
    If HOME_VISIT:
      "Our team will contact you at [phone] to confirm your address."
  
  "A confirmation has been sent to [email]"

If PENDING_CONFIRMATION (MANUAL / Mrs. Prudent flow):
  Icon: ⏳ (animated pulse) instead of checkmark
  "Request Submitted!" (Display M, wine)
  "#[bookingNumber]" (gold)
  
  Wine gradient card (same style as referral card):
    "✦ Your Preferred Dates:"
    [date1 formatted]
    [date2 if present]
    [date3 if present]
  
  Timeline of what happens next (3 steps):
    01: "Payment Confirmed ✓" (green, done)
    02: "Team Reviews Your Dates" (amber, current)
    03: "Confirmation Sent to [email]" (grey, pending)
  
  "You will receive your confirmed date and session details 
   within 24–48 hours."

BOTH flows:
  [View My Bookings] → /account/consultations (wine button)
  [Back to Shop] → /shop (outlined)
  
  Guest prompt (if not logged in):
    Same pattern as checkout success
    "Create an account to track your consultations and manage your bookings."
```

---

### C4 — Consultation Detail Page (client browsing)

**`src/app/(storefront)/consultation/[bookingNumber]/page.tsx`** (client component)
```typescript
// Accessible to the client who booked it
// Auth: if logged in, verify ownership. If guest, show public booking summary.
// Fetch: /api/account/consultations/[bookingNumber]
```

```
Shows full booking details, current status, meeting link (if confirmed + virtual)
Status badge with clear messaging for each status
[Cancel Booking] button: only if status is CONFIRMED + confirmedDate > 48hrs from now
  On click: PATCH /api/account/consultations/[id] { status: 'CANCELLED_BY_CLIENT' }
  Confirmation dialog first: "Are you sure? Cancellation policy applies."
```

---

## TASK D — ACCOUNT: MY CONSULTATIONS

### D1 — Consultations Section in Account

**`src/app/(account)/account/consultations/page.tsx`** (Server Component)
```typescript
// Auth required
// Fetch: /api/account/consultations
// Pass to client component
```

```
"My Consultations" heading + count

Add "Consultations" to AccountSidebar.tsx nav items:
  Icon: Calendar (Lucide)
  Label: "Consultations"
  Href: /account/consultations
  Position: after "My Orders"

BOOKINGS LIST (card-based, not table):
  Each booking card (bg-cream, border, p-5):
    TOP ROW:
      Booking # (font-label, gold) | Status badge
    
    MIDDLE: flex row (consultant photo + details)
      Photo: 48×48 rounded-full
      Right:
        Consultant name (font-medium, 15px)
        Session type + delivery mode (font-label, 12px, gold)
        Date/time: If CONFIRMED → "[date] at [time] WAT"
                   If PENDING_CONFIRMATION → "Awaiting confirmation"
                   If COMPLETED → "Completed on [date]"
    
    FEE ROW:
      "₦[fee]" right-aligned | Payment status badge
    
    FOOTER ACTIONS:
      [View Details] → /consultation/[bookingNumber]
      [Join Meeting] → meetingLink (only if CONFIRMED + virtual + meetingLink set)
  
  Empty state:
    Calendar icon (64px, wine)
    "No consultations booked yet."
    "Book a session with our design team or Mrs. Gabriel-Okopi."
    [Book a Consultation] → /consultation (wine button)
```

---

## TASK E — ADMIN: CONSULTATION MANAGEMENT

### E1 — Admin Navigation Update

**Update `src/components/admin/AdminSidebar.tsx`**:
```typescript
// Add under "CATALOGUE" section:
  CalendarDays  "Consultations"    /admin/consultations
  Users         "Consultants"      /admin/consultants
```

### E2 — Admin Consultations Page

**`src/app/(admin)/admin/consultations/page.tsx`** (Server Component)
```typescript
// Fetch all bookings with filters
// searchParams: status, consultantId, dateFrom, dateTo, search, page
// Include: consultant (name), offering (sessionType, deliveryMode, durationMinutes)
// Count by status for tab badges
```

**`src/components/admin/ConsultationsTable.tsx`** (client component)
```
STATUS TABS (top):
  All | Pending Payment | Pending Confirmation ([N] — red badge if > 0) |
  Confirmed | Completed | Cancelled

FILTER ROW:
  Consultant select | Delivery mode select | Date range (from/to) | Search input

TABLE:
  Columns:
    Booking # (font-label, gold)
    Client (name + email)
    Consultant (name + photo 24px)
    Session (type + delivery mode badge)
    Date (confirmedDate or "Pending" for MANUAL)
    Fee (₦X,XXX)
    Payment badge
    Status badge
    Actions: [View]

ROW CLICK: opens ConsultationDetailModal OR navigates to /admin/consultations/[id]
```

**`src/app/(admin)/admin/consultations/[id]/page.tsx`** (Server Component)
```typescript
// Full booking detail with all admin actions
```

```
HEADER:
  Back link ← Consultations
  Booking # (Display S, wine)
  Status badge + Payment badge

BOOKING DETAILS (2-column layout):

LEFT — Client & Session:
  CLIENT CARD:
    Name, Email (mailto link), Phone (wa.me link if Nigerian), Country, Instagram
    [Email Client] → mailto
    [WhatsApp] → wa.me/[phone] (strips + for wa.me format)
  
  SESSION CARD:
    Consultant (photo + name + title)
    Session type: [label]
    Delivery mode: [label]
    Duration: [X] minutes
    Fee paid: ₦[fee] | [paymentGateway] | [paymentRef truncated]
  
  SCHEDULING CARD:
    If LIVE (confirmedDate set): "Confirmed: [date] at [time] WAT"
    If MANUAL (PENDING_CONFIRMATION):
      "Preferred Dates (client submitted):"
      [date1], [date2], [date3] — formatted clearly
    
    Meeting link (if set): [platform] + clickable link + [Edit] button
  
  DESCRIPTION: full client description
  
  REFERENCE IMAGES: thumbnail grid (click to open full)

RIGHT — Admin Actions (sticky):
  
  CURRENT STATUS (large badge, centered)
  
  ── IF PENDING_CONFIRMATION (Mrs. Prudent's manual flow):
    
    "Confirm This Booking" section:
      Date picker: "Select confirmed date"
      Time input: "Select time (WAT)"
      [Confirm & Send Email] button (wine)
        On confirm: PATCH /api/admin/consultations/[id] {
          status: 'CONFIRMED',
          confirmedDate: selectedDate,
          confirmedTime: selectedTime,
          meetingLink: meetingLinkInput (if virtual)
        }
        → sends ConsultationConfirmedEmail automatically
    
    OR "Propose Alternative Dates":
      Textarea: "Message to client"
      3 alternative date pickers
      [Send Proposal] button
        → PATCH status: RESCHEDULED
        → sends ConsultationRescheduleEmail
    
    OR [Cancel Booking] (red, outlined)
      → AlertDialog: "Cancel and notify client?"
      → PATCH status: CANCELLED_BY_ADMIN + cancellationReason
      → sends ConsultationCancelledEmail
  
  ── IF CONFIRMED:
    
    Meeting Link:
      Input (pre-filled if set): "Google Meet / Zoom link"
      [Update Link] → PATCH { meetingLink, meetingPlatform }
    
    [Mark as Completed] button (green)
      → PATCH status: COMPLETED, completedAt: now()
    
    [Mark as No Show] button (amber)
      → PATCH status: NO_SHOW
    
    [Cancel Booking] (red)
  
  ── IF COMPLETED:
    
    Admin Feedback (private session notes):
      Textarea: "Session notes (internal)"
      [Save Notes] → PATCH { adminFeedback }
    
    "Apply Manual Credit?" section:
      Info: "If this consultation led to a bespoke order,
             you can manually credit the client's wallet."
      [Go to Customer Wallet →] link → /admin/customers/[userId] (if userId exists)
      (Uses existing "Adjust Points" feature — no new code needed)
  
  ── ADMIN NOTES (always visible):
    Textarea: "Internal notes (not sent to client)"
    Auto-save on blur: PATCH { adminNotes }
```

### E3 — Admin Consultants Page

**`src/app/(admin)/admin/consultants/page.tsx`** (Server Component)
```typescript
// Fetch all consultants with offerings count + bookings count
```

```
[+ Add Consultant] button → /admin/consultants/new

CONSULTANTS GRID (2-col desktop, 1-col mobile):
  
  Each card (bg-[#1E1E1E], border, p-5):
    Photo (64×64, rounded-full) + Name + Title
    Badges: Active/Inactive | Flagship (if isFlagship)
    "Offerings: [N]" | "Bookings: [N]"
    Display order badge
    [Edit] → /admin/consultants/[id]/edit
    [Deactivate] toggle

SORT: by displayOrder (drag handles for reordering — simple up/down arrows)
```

**`src/app/(admin)/admin/consultants/new/page.tsx`**
**`src/app/(admin)/admin/consultants/[id]/edit/page.tsx`**
Both render `ConsultantFormPage` component:

**`src/components/admin/ConsultantFormPage.tsx`** (client component)
```
LAYOUT: 2-column (2/3 left + 1/3 right)

LEFT — Consultant Details:
  SECTION "Profile" (card):
    Photo upload (Cloudinary, same pattern as product images):
      Preview circle (80px, rounded-full)
      [Upload Photo] button
    Name (Input, required)
    Title (Input, e.g. "Founder & Creative Director")
    Bio (Textarea, required, Tiptap or plain textarea)
    Display Order (number input, 0 = first)
    Flagship toggle:
      isFlagship = true → Mrs. Prudent (manual flow)
      Show warning: "⚠️ Flagship consultants use manual confirmation.
                     Their bookings are never auto-confirmed."
  
  SECTION "Offerings" (card):
    Label: "Session Types & Fees"
    Note: "Each combination of session type + delivery mode is a separate offering
           with its own duration and fee."
    
    TABLE of offering rows (similar to VariantManager):
      Session Type (Select) | Delivery Mode (Select) | Duration (mins) | Fee NGN | Fee USD | Fee GBP | Active | Delete
      [+ Add Offering] button appends empty row
      
      Validation: no duplicate sessionType+deliveryMode combos
      Min 1 offering required
  
  SECTION "Availability" (card):
    Label: "Weekly Schedule (for live calendar)"
    Note: "Not required for flagship (manual) consultants."
    
    7 day rows (Sun → Sat):
      Each row: Day name | Active toggle | Start Time | End Time
      Inactive rows: greyed out
      Validation: endTime > startTime if active
    
    Timezone note: "All times in West Africa Time (WAT · UTC+1)"
  
  SECTION "Blocked Dates" (card):
    Label: "Block specific dates"
    Date + reason input row + [Block Date] button
    List of blocked dates (date + reason + [Remove] button)
    Fetches from /api/admin/consultants/[id]/blocked-dates

RIGHT — Status & Settings (card, sticky):
  isActive toggle (large, labeled "Consultant is Active")
  isFlagship toggle (labeled "Flagship — Manual Confirmation")
  
  [Save Changes] / [Create Consultant] button (wine, full-width)
  
  If edit mode:
    Booking stats: [N] total · [N] confirmed · [N] completed
    [View All Bookings] → /admin/consultations?consultantId=[id]
```

---

## TASK F — EMAIL TEMPLATES

### F1 — Consultation Pending (MANUAL flow — Mrs. Prudent)

**`src/emails/ConsultationPendingEmail.tsx`**
```typescript
// Props: { clientName, bookingNumber, consultantName, sessionTypeLabel,
//          deliveryModeLabel, feeNGN, preferredDate1, preferredDate2?, preferredDate3? }
//
// Subject: "Request Received — Your Consultation with [consultantName] | #[bookingNumber]"
//
// Content:
//   "Thank you, [clientName]." (heading)
//   "Your consultation request has been received and your payment confirmed."
//
//   Booking reference box (gold border):
//     #[bookingNumber]
//     [consultantName] · [sessionTypeLabel] · [deliveryModeLabel]
//
//   "Your preferred dates:"
//     • [preferredDate1 formatted]
//     • [preferredDate2 if present]
//     • [preferredDate3 if present]
//
//   What happens next (numbered):
//     1. Our team will review your preferred dates
//     2. [consultantName] will personally confirm your session
//     3. You will receive your confirmation within 24–48 hours
//
//   "In the meantime, if you have any questions, reply to this email
//    or reach us at hello@prudentgabriel.com"
//
//   CTA: "View Your Booking" → [APP_URL]/consultation/[bookingNumber]
```

### F2 — Consultation Confirmed

**`src/emails/ConsultationConfirmedEmail.tsx`**
```typescript
// Props: { clientName, bookingNumber, consultantName, sessionTypeLabel,
//          deliveryModeLabel, confirmedDate, confirmedTime, durationMinutes,
//          isVirtual, meetingLink?, meetingPlatform?, atelierAddress? }
//
// Subject: "Confirmed ✓ — Your Consultation on [date] | Prudential Atelier"
//
// Content:
//   "Your consultation is confirmed." (heading)
//   
//   Confirmed details box (wine border, gold highlight):
//     📅 [day, DD Month YYYY]
//     🕐 [time] WAT ([durationMinutes] minutes)
//     👤 [consultantName]
//     📋 [sessionTypeLabel]
//
//   If VIRTUAL:
//     Meeting details box (gold bg/10):
//       "📹 [meetingPlatform] Video Call"
//       If meetingLink: [Join Meeting] button (wine)
//       Else: "Your meeting link will be sent separately."
//     "Please join 2–3 minutes before your scheduled time."
//
//   If INPERSON (any):
//     "📍 [atelierAddress OR "Our team will be in touch to confirm location details"]"
//     "Please arrive 5 minutes early. Wear or bring any reference items you'd like to discuss."
//
//   Preparation tips (bulleted):
//     • Prepare any reference images or inspiration boards
//     • Note down specific concerns or requirements
//     • [For virtual] Ensure you have a stable internet connection
//
//   "Need to reschedule? Contact us at hello@prudentgabriel.com
//    at least 48 hours before your session."
//
//   CTA: "View Booking Details" → [APP_URL]/consultation/[bookingNumber]
```

### F3 — Consultation Cancelled

**`src/emails/ConsultationCancelledEmail.tsx`**
```typescript
// Props: { clientName, bookingNumber, consultantName, reason? }
//
// Subject: "Consultation Cancelled — #[bookingNumber]"
//
// Content:
//   "Your consultation has been cancelled." (heading)
//   If reason: "Reason: [reason]"
//   "For questions, contact hello@prudentgabriel.com"
//   CTA: "Book Another Session" → [APP_URL]/consultation
```

### F4 — Reschedule Proposal

**`src/emails/ConsultationRescheduleEmail.tsx`**
```typescript
// Props: { clientName, bookingNumber, consultantName, proposedDates: string[], adminMessage? }
//
// Subject: "Alternative Dates Proposed — #[bookingNumber]"
//
// Content:
//   "New dates have been proposed for your consultation." (heading)
//   If adminMessage: "[adminMessage]"
//   "Proposed alternatives:"
//   • [date1]
//   • [date2 if present]
//   "Please reply to this email to confirm your preferred date."
//   CTA: "Contact Us" → mailto:hello@prudentgabriel.com
```

### F5 — Wire Into email.tsx

Add all 4 new email functions to `src/lib/email.tsx` using `render()` from `@react-email/render`, same pattern as existing email helpers.

---

## TASK G — SEED DATA FOR CONSULTANTS

**Update `prisma/seed.ts`** — add consultant seed data:

```typescript
// Add after existing seed data:

console.log('\n👤 Creating consultants...')

await prisma.consultant.upsert({
  where: { id: 'consultant-prudent' },  // use static ID for upsert
  update: {},
  create: {
    id: 'consultant-prudent',
    name: 'Mrs. Prudent Gabriel-Okopi',
    title: 'Founder & Creative Director',
    bio: 'The visionary behind Prudential Atelier. With over five years of award-winning design and a clientele spanning four continents, Mrs. Gabriel-Okopi brings her singular eye for couture, cultural heritage, and feminine power to every session. Her consultations are rare, intimate, and transformative.',
    image: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400',
    isActive: true,
    isFlagship: true,
    displayOrder: 0,
    offerings: {
      create: [
        {
          sessionType: 'BESPOKE_DESIGN',
          deliveryMode: 'VIRTUAL_WITH_PRUDENT',
          durationMinutes: 60,
          feeNGN: 50000,
          feeUSD: 33,
          feeGBP: 26,
          description: 'A private virtual design session with Mrs. Gabriel-Okopi to conceptualise your bespoke piece.',
          isActive: true,
        },
        {
          sessionType: 'BESPOKE_DESIGN',
          deliveryMode: 'INPERSON_ATELIER_PRUDENT',
          durationMinutes: 90,
          feeNGN: 75000,
          feeUSD: 49,
          feeGBP: 38,
          description: 'An immersive in-person session at the Prudential Atelier in Lagos. Includes fabric viewing and sketch preview.',
          isActive: true,
        },
        {
          sessionType: 'BRIDAL_CONSULTATION',
          deliveryMode: 'VIRTUAL_WITH_PRUDENT',
          durationMinutes: 90,
          feeNGN: 75000,
          feeUSD: 49,
          feeGBP: 38,
          description: 'Complete bridal vision session — gown, traditional attire, colour palette, and accessories.',
          isActive: true,
        },
        {
          sessionType: 'BRIDAL_CONSULTATION',
          deliveryMode: 'INPERSON_ATELIER_PRUDENT',
          durationMinutes: 120,
          feeNGN: 100000,
          feeUSD: 65,
          feeGBP: 51,
          description: 'The full bridal experience at our Lagos atelier. Champagne, fabric samples, and a complete design plan.',
          isActive: true,
        },
        {
          sessionType: 'BRIDAL_CONSULTATION',
          deliveryMode: 'INPERSON_HOME_PRUDENT',
          durationMinutes: 120,
          feeNGN: 150000,
          feeUSD: 97,
          feeGBP: 76,
          description: 'Mrs. Gabriel-Okopi comes to you. Private home visit with full bridal consultation and fabric samples.',
          isActive: true,
        },
      ],
    },
    // No availability set (isFlagship = manual flow, no calendar)
  },
})

await prisma.consultant.upsert({
  where: { id: 'consultant-senior' },
  update: {},
  create: {
    id: 'consultant-senior',
    name: 'Senior Design Team',
    title: 'Senior Designer · Prudential Atelier',
    bio: 'Our senior design team brings years of atelier experience and a deep understanding of fabric, structure, and Nigerian couture traditions. Ideal for bespoke pieces, corporate wardrobes, and clients who want expert guidance from the people who build every Prudential Atelier creation.',
    image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400',
    isActive: true,
    isFlagship: false,
    displayOrder: 1,
    offerings: {
      create: [
        {
          sessionType: 'BESPOKE_DESIGN',
          deliveryMode: 'VIRTUAL_STANDARD',
          durationMinutes: 60,
          feeNGN: 20000,
          feeUSD: 13,
          feeGBP: 10,
          isActive: true,
        },
        {
          sessionType: 'BESPOKE_DESIGN',
          deliveryMode: 'INPERSON_ATELIER',
          durationMinutes: 60,
          feeNGN: 25000,
          feeUSD: 16,
          feeGBP: 13,
          isActive: true,
        },
        {
          sessionType: 'BRIDAL_CONSULTATION',
          deliveryMode: 'VIRTUAL_STANDARD',
          durationMinutes: 60,
          feeNGN: 25000,
          feeUSD: 16,
          feeGBP: 13,
          isActive: true,
        },
        {
          sessionType: 'BRIDAL_CONSULTATION',
          deliveryMode: 'INPERSON_ATELIER',
          durationMinutes: 90,
          feeNGN: 35000,
          feeUSD: 23,
          feeGBP: 18,
          isActive: true,
        },
        {
          sessionType: 'WARDROBE_CONSULTATION',
          deliveryMode: 'VIRTUAL_STANDARD',
          durationMinutes: 45,
          feeNGN: 15000,
          feeUSD: 10,
          feeGBP: 8,
          isActive: true,
        },
      ],
    },
    availability: {
      create: [
        { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true }, // Monday
        { dayOfWeek: 2, startTime: '09:00', endTime: '17:00', isActive: true }, // Tuesday
        { dayOfWeek: 3, startTime: '09:00', endTime: '17:00', isActive: true }, // Wednesday
        { dayOfWeek: 4, startTime: '09:00', endTime: '17:00', isActive: true }, // Thursday
        { dayOfWeek: 5, startTime: '09:00', endTime: '14:00', isActive: true }, // Friday (half day)
      ],
    },
  },
})

await prisma.consultant.upsert({
  where: { id: 'consultant-team' },
  update: {},
  create: {
    id: 'consultant-team',
    name: 'Design Team',
    title: 'Collective Session · Prudential Atelier',
    bio: 'A collaborative group session with multiple members of the Prudential Atelier design team. Perfect for bridal parties, brand wardrobes, or clients who want diverse perspectives on their look. High energy, creative, and comprehensive.',
    image: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=400',
    isActive: true,
    isFlagship: false,
    displayOrder: 2,
    offerings: {
      create: [
        {
          sessionType: 'GROUP_SESSION',
          deliveryMode: 'VIRTUAL_WITH_TEAM',
          durationMinutes: 90,
          feeNGN: 35000,
          feeUSD: 23,
          feeGBP: 18,
          description: 'Group virtual session — ideal for bridal parties coordinating their looks.',
          isActive: true,
        },
        {
          sessionType: 'GROUP_SESSION',
          deliveryMode: 'INPERSON_ATELIER',
          durationMinutes: 120,
          feeNGN: 50000,
          feeUSD: 33,
          feeGBP: 26,
          description: 'Full group session at the atelier. Bring your bridal party or creative team.',
          isActive: true,
        },
        {
          sessionType: 'BESPOKE_DESIGN',
          deliveryMode: 'INPERSON_HOME_TEAM',
          durationMinutes: 90,
          feeNGN: 60000,
          feeUSD: 39,
          feeGBP: 31,
          description: 'The design team comes to you with fabric samples and a portable consultation kit.',
          isActive: true,
        },
      ],
    },
    availability: {
      create: [
        { dayOfWeek: 2, startTime: '10:00', endTime: '16:00', isActive: true },
        { dayOfWeek: 4, startTime: '10:00', endTime: '16:00', isActive: true },
        { dayOfWeek: 6, startTime: '10:00', endTime: '14:00', isActive: true }, // Saturday
      ],
    },
  },
})

await prisma.consultant.upsert({
  where: { id: 'consultant-style' },
  update: {},
  create: {
    id: 'consultant-style',
    name: 'Style Consultant',
    title: 'Fabric & Style Advisor',
    bio: 'Expert guidance on fabric selection, colour theory, and personal style direction. The ideal starting point for clients who are exploring their aesthetic or need expert advice before committing to a bespoke piece.',
    image: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400',
    isActive: true,
    isFlagship: false,
    displayOrder: 3,
    offerings: {
      create: [
        {
          sessionType: 'STYLING_SESSION',
          deliveryMode: 'VIRTUAL_STANDARD',
          durationMinutes: 30,
          feeNGN: 10000,
          feeUSD: 7,
          feeGBP: 5,
          description: 'Quick virtual session — fabric picks, colour palette, and look direction.',
          isActive: true,
        },
        {
          sessionType: 'STYLING_SESSION',
          deliveryMode: 'INPERSON_ATELIER',
          durationMinutes: 45,
          feeNGN: 15000,
          feeUSD: 10,
          feeGBP: 8,
          description: 'In-person styling with real fabric samples and a curated look board.',
          isActive: true,
        },
        {
          sessionType: 'DISCOVERY_CALL',
          deliveryMode: 'PHONE_CALL',
          durationMinutes: 20,
          feeNGN: 5000,
          feeUSD: 4,
          feeGBP: 3,
          description: 'First-time client? A short discovery call to understand your needs before booking a full session.',
          isActive: true,
        },
        {
          sessionType: 'DISCOVERY_CALL',
          deliveryMode: 'VIRTUAL_STANDARD',
          durationMinutes: 30,
          feeNGN: 8000,
          feeUSD: 5,
          feeGBP: 4,
          isActive: true,
        },
      ],
    },
    availability: {
      create: [
        { dayOfWeek: 1, startTime: '09:00', endTime: '18:00', isActive: true },
        { dayOfWeek: 2, startTime: '09:00', endTime: '18:00', isActive: true },
        { dayOfWeek: 3, startTime: '09:00', endTime: '18:00', isActive: true },
        { dayOfWeek: 4, startTime: '09:00', endTime: '18:00', isActive: true },
        { dayOfWeek: 5, startTime: '09:00', endTime: '18:00', isActive: true },
        { dayOfWeek: 6, startTime: '10:00', endTime: '15:00', isActive: true },
      ],
    },
  },
})

// Add 3 demo consultation bookings for testing
// (Use customer1 and customer2 IDs from existing seed)
// 1 × CONFIRMED (virtual, senior designer, customer1)
// 1 × PENDING_CONFIRMATION (Mrs. Prudent, customer2)
// 1 × COMPLETED (style consultant, customer1)

console.log('  ✅ 4 consultants created with offerings and availability.')
console.log('  ✅ Demo consultation bookings created.')
```

---

## TASK H — DOMAIN + NAVBAR UPDATE

### H1 — Update production domain

**Find and replace** across all files in `src/emails/` and `DEPLOYMENT.md`:
```
Replace: prudentialatelier.com
With:    prudentgabriel.com
```

Also update in:
- `src/app/layout.tsx` (metadata openGraph url, twitter site)
- `src/app/sitemap.ts` (base URL)
- `src/app/robots.ts` (sitemap URL)
- Any hardcoded APP_URL fallbacks in lib files

### H2 — Add Consultation to Navbar

**Update `src/components/layout/Navbar.tsx`**:
```typescript
// Add "CONSULTATION" between "BESPOKE" and "OUR STORY" in nav links
// href: /consultation
// Desktop: standard nav link
// Mobile menu: add between bespoke and our story items

// Also update Footer.tsx — add "Book Consultation" under Shop column
```

### H3 — Add Consultation CTA to Homepage

**Update `src/components/home/BespokeStory.tsx`**:
```typescript
// Current button: [Begin Your Journey] → /bespoke
// Change to TWO buttons (flex row, gap-3):
//   [Begin Your Journey] → /bespoke (wine, primary)
//   [Book a Consultation] → /consultation (outlined, secondary)
```

### H4 — Add Consultation Link to Bespoke Page

**Update `src/app/(storefront)/bespoke/page.tsx`**:
```typescript
// After the form hero section, add a callout banner:
// bg-ivory-dark, border-gold/20, p-6
// "Looking to discuss your vision before committing? Book a consultation first."
// [Book a Consultation →] → /consultation (gold text link)
```

---

## FINAL CHECKS

After completing all tasks:

```bash
npx prisma generate
npx prisma db push
npx prisma db seed
npx tsc --noEmit   # must pass with zero errors
npx next build     # must succeed
```

Verify these routes work:
- `/consultation` — all 4 consultant cards render
- `/consultation` Step 1 — selecting Mrs. Prudent shows manual flow UI in Step 2
- `/consultation` Step 1 — selecting Style Consultant shows live calendar in Step 2
- `/consultation/success?booking=CB-24-00001` — success page renders
- `/account/consultations` — shows 3 demo bookings from seed
- `/admin/consultations` — table shows all bookings
- `/admin/consultants` — 4 consultant cards
- `/admin/consultants/consultant-prudent/edit` — form pre-filled
- `/admin/consultations/[id]` — manual confirm UI shows for Mrs. Prudent bookings

---

## SESSION END SUMMARY FORMAT

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SESSION 6 COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Task A — Consultation library (slots, availability, labels)
✅ Task B — All API routes (consultants, slots, bookings, all 4 payment gateways)
✅ Task C — /consultation booking page (4-step flow, live + manual flows)
✅ Task D — /account/consultations (client booking history)
✅ Task E — Admin consultation management + consultant CRUD
✅ Task F — 4 new email templates wired into email.tsx
✅ Task G — Seed: 4 consultants with offerings, availability, demo bookings
✅ Task H — Domain (prudentgabriel.com), navbar, homepage CTA

NEXT: Push to GitHub (Nonyd/prudentgabriel), deploy to Vercel
      Webhook URLs: /api/consultations/payment/*/webhook
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

*Prudential Atelier · Cursor Session 6*
*Prepared by Nony | SonsHub Media · For Mrs. Prudent Gabriel-Okopi*
