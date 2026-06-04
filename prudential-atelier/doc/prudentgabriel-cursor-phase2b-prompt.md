# CURSOR AI — PRUDENTGABRIEL.COM
## Phase 2B: Client Dashboard + Executive Reporting
### Prepared by SonsHub Media Ltd (Nony — Okafor Chinonso Daniel)

---

## CRITICAL INSTRUCTIONS — READ BEFORE WRITING A SINGLE LINE

1. This is **Phase 2B** of a 5-phase build. Phases 1 and 2A are complete and live on Vercel.
2. **DO NOT touch, rename, or remove any existing model** in `prisma/schema.prisma`. No schema changes are needed in this phase — all required models already exist.
3. **DO NOT modify** any existing admin pages, API routes, or components built in Phase 1 or 2A unless explicitly instructed to extend them.
4. The existing `User` model is the source of truth for: `pointsBalance`, `referralCode`, `referrals`, `pointsHistory`, `orders` (RTW), `consultationBookings`.
5. The `ClientProfile` model (added in Phase 2A) is the source of truth for: `measurements`, `moodboards`, `bespokeOrders`, `eventDates`, `adminNotes`, `loyaltyTier`, `totalSpend`.
6. The client dashboard must read from BOTH and present a unified experience. Never expose the underlying model split to the user.
7. Design system is unchanged — Cormorant + Montserrat, chocolate/cream palette. Every surface must match exactly.
8. Read the entire prompt before writing any code.

---

## DESIGN SYSTEM REMINDER

```css
--choc:    #442913;   /* Primary dark, sidebars, hero */
--nut:     #5C3422;   /* CTAs, active states */
--lightbr: #98755B;   /* Accents, labels, icons */
--cream:   #E2D1C2;   /* Text on dark */
--sand:    #D4BBAC;   /* Borders, dividers */
--ivory:   #F7F2EC;   /* Light page background */
--bg:      #F0E8DD;   /* Dashboard background */
```

Fonts: `Cormorant` (headings/display) + `Montserrat` (body/UI/labels)

---

## NO SCHEMA CHANGES NEEDED

All models required for Phase 2B already exist:
- `User` — points, referral, RTW orders, consultation bookings
- `ClientProfile` — measurements, moodboards, bespoke orders, loyalty tier, event dates, admin notes
- `BespokeOrder` + `StageUpdate` — bespoke pipeline with stage history
- `Measurement` — body measurements vault
- `Moodboard` — per client moodboard images
- `EventDate` — anniversary/event reminders
- `Order` + `OrderItem` — RTW orders
- `ConsultationBooking` — existing consultation records
- `WishlistItem` — existing wishlist
- `Review` — existing reviews
- `PointsTransaction` — existing points history
- `LoyaltyRule` — configurable points rules
- `BlogPost` — for journal preview on dashboard
- `ActivityLog` / `ErrorLog` — already wired
- `SiteSetting` — for report configuration

---

## PHASE 2B DELIVERABLES

---

### 1. CLIENT DASHBOARD LAYOUT & SHELL

**Route:** `/account`
**File:** `src/app/(public)/account/layout.tsx`

The client dashboard has its own layout separate from the public site layout. It shares the public `Navbar` at the top but replaces the main content area with a two-column shell:

```
┌─────────────────────────────────────────────────┐
│                   Public Navbar                  │
├──────────────┬──────────────────────────────────┤
│              │                                   │
│   Sidebar    │        Page Content               │
│   (220px)    │        (flex-1)                   │
│              │                                   │
└──────────────┴──────────────────────────────────┘
```

**Account Sidebar** (`src/components/account/AccountSidebar.tsx`):
- Background: `var(--choc)`, width 220px
- Top section: client avatar (initials circle in `var(--lightbr)`), name, loyalty tier badge
- Navigation sections:

```
MY ACCOUNT
  Dashboard         (ti-layout-dashboard)
  My Orders         (ti-package)          ← badge: active order count
  Measurements      (ti-ruler-2)
  Moodboards        (ti-photo)
  Consultations     (ti-calendar-event)

PERKS
  Loyalty & Rewards (ti-crown)
  Wishlist          (ti-heart)            ← badge: wishlist count
  Refer a Friend    (ti-users)

PREFERENCES
  Style Profile     (ti-sparkles)
  Settings          (ti-settings)
```

- Active state: background `rgba(152,117,91,0.18)`, border-right `2px solid var(--lightbr)`, text `var(--cream)`
- Mobile: sidebar collapses to a bottom tab bar (5 key tabs: Dashboard, Orders, Loyalty, Wishlist, Account)

**Route protection:** All `/account/*` routes require authenticated session with role `CUSTOMER` (or any role). Redirect unauthenticated users to `/login?callbackUrl=/account`.

**ClientProfile auto-creation:** When an authenticated user visits `/account` for the first time and has no `ClientProfile`, create one automatically via `POST /api/account/profile/init`. This ensures every client who logs in gets a profile without requiring manual admin action.

---

### 2. ACCOUNT DASHBOARD HOME

**Route:** `/account`
**File:** `src/app/(public)/account/page.tsx`

This is a Server Component. Fetch all data server-side.

**Data to fetch:**
```typescript
// From User model
const user = await prisma.user.findUnique({
  where: { id: session.user.id },
  include: {
    orders: { orderBy: { createdAt: 'desc' }, take: 3 },
    consultationBookings: { orderBy: { createdAt: 'desc' }, take: 3 },
    pointsHistory: { orderBy: { createdAt: 'desc' }, take: 5 },
    wishlist: { include: { product: true } },
  }
});

// From ClientProfile model
const profile = await prisma.clientProfile.findUnique({
  where: { userId: session.user.id },
  include: {
    bespokeOrders: {
      orderBy: { createdAt: 'desc' },
      take: 3,
      include: { stageHistory: { orderBy: { completedAt: 'desc' }, take: 1 } }
    },
    measurements: true,
    moodboards: { take: 4 },
    eventDates: { where: { date: { gte: new Date() } }, orderBy: { date: 'asc' }, take: 3 },
  }
});
```

**Page layout — four zones:**

**Zone 1 — Welcome bar:**
- "Welcome back, [firstName]" in Cormorant 28px
- Today's date in Montserrat 12px light
- Loyalty tier badge with icon and tier name
- Points balance: "[X] points" in Cormorant 22px with `var(--lightbr)` colour
- "Book Consultation" CTA button (top right)

**Zone 2 — Stats row (4 cards):**
```
Active Orders | Total Spent | Loyalty Points | Outstanding Balance
```
- Active Orders: count of bespoke orders not in DELIVERED status + RTW orders not in DELIVERED status
- Total Spent: `clientProfile.totalSpend` formatted as ₦X,XXX,XXX
- Loyalty Points: `user.pointsBalance` with tier progress indicator
- Outstanding Balance: sum of `balance` across all active `BespokeOrder` records. If > 0, show in `var(--nut)` with a "Pay Now" link

**Zone 3 — Two column grid:**

Left column (wider):

*Active Bespoke Order card* (show only if active bespoke order exists):
- Order ref, outfit description (truncated), delivery date
- 13-stage visual progress tracker — same component as the public `/track` page but embedded here
- Stage notes from last `StageUpdate`
- Thumbnail of last uploaded image (if any)
- "Track publicly" link → opens `/track/[trackingToken]` in new tab
- "View all bespoke orders" link

*Recent RTW Orders:*
- Last 3 RTW orders: product thumbnail, name, size, status pill, price, date
- "View all orders" link
- Empty state: "No orders yet — browse the shop" with a shop CTA

Right column:

*Loyalty card* (dark chocolate background):
- Tier badge: Bronze/Silver/Gold/Platinum with icon
- Points balance (large, Cormorant)
- Progress bar to next tier with label "X points to [NextTier]"
- Current perks list with checkmarks (unlocked) and lock icons (locked)
- "View rewards" link

*Measurement Vault preview:*
- Shows 4 key measurements: Bust, Waist, Hips, Dress Length
- "Last updated: [date]" caption
- "View full measurements" link
- Empty state: "No measurements saved yet" with "Add measurements" CTA

*Upcoming events (from EventDate):*
- Up to 3 upcoming event dates
- Each: date block (day/month), event label, days-until badge
- If within 60 days: show "Book a consultation for this event" CTA
- "Add event date" button
- Empty state: "No upcoming events saved"

**Zone 4 — Recent consultations strip:**
- Last 2 consultation bookings: date, type, status pill, consultant name
- "Book a new consultation" CTA

---

### 3. MY ORDERS PAGE

**Route:** `/account/orders`
**File:** `src/app/(public)/account/orders/page.tsx`

Two tabs: **Bespoke Orders** | **Ready-to-Wear**

**Bespoke Orders tab:**
- List of all `BespokeOrder` records for this client
- Each card: order ref, outfit description, current stage pill, delivery date, total amount, amount paid, balance
- If balance > 0: "Pay Balance" button → payment flow
- Click card → expand to show full 13-stage tracker + stage history with notes and images
- Empty state: "No bespoke orders yet — book a consultation to get started"

**Ready-to-Wear tab:**
- List of all `Order` records for this user
- Each row: order number, date, items summary, total, status pill, tracking number if available
- Click → order detail modal showing all items with images, sizes, prices
- Empty state: "No orders yet"

---

### 4. MEASUREMENTS VAULT

**Route:** `/account/measurements`
**File:** `src/app/(public)/account/measurements/page.tsx`

**Display section:**
- Page header: "Your Measurements" (Cormorant 36px) + "Last updated: [date]"
- Beautiful grid layout — not a table. Each measurement displayed as a card:
  ```
  ┌─────────────┐
  │    38       │  ← Cormorant 32px, var(--choc)
  │   inches    │  ← Montserrat 10px, var(--text-light)
  │    Bust     │  ← Montserrat 11px, var(--text-mid), uppercase
  └─────────────┘
  ```
- Measurements to display: Bust, Waist, Hips, Shoulder Width, Sleeve Length, Dress Length, Thigh, Inseam, Neck, Armhole
- Unit toggle: inches / centimetres (converts display values, does not change stored value)
- Notes field displayed below the grid if notes exist
- "Download measurements" button → generates a simple branded PDF card

**Edit section:**
- "Update Measurements" button → opens a modal with all measurement fields
- All fields optional — client fills in what they know
- Unit selector at top of modal (inches/cm)
- Zod validation: all values must be positive numbers if provided
- On save: `PATCH /api/account/measurements`
- Toast on success: "Measurements updated"

**Empty state:**
- Illustrated empty state with a friendly message
- "Add Your Measurements" button → opens the same modal

---

### 5. MOODBOARD ARCHIVE

**Route:** `/account/moodboards`
**File:** `src/app/(public)/account/moodboards/page.tsx`

- Grid of moodboard cards: 3 columns desktop, 2 tablet, 1 mobile
- Each card: title, image grid (up to 4 thumbnails in a 2x2 layout), date created, linked order ref (if any)
- Click card → expand modal showing full moodboard: all images in a masonry/grid layout, notes, linked order
- "Create New Moodboard" button:
  - Modal: title input, notes textarea, image upload (Cloudinary multi-upload, up to 12 images), link to existing bespoke order (optional select)
  - On save: `POST /api/moodboards`
- Delete moodboard button (with confirmation)
- Empty state: "No moodboards yet — upload your inspiration images"

---

### 6. CONSULTATIONS PAGE

**Route:** `/account/consultations`
**File:** `src/app/(public)/account/consultations/page.tsx`

- List of all `ConsultationBooking` records for this user
- Each card:
  - Date and time
  - Type badge (Virtual / In-Person)
  - Platform (Zoom / Google Meet / WhatsApp etc.)
  - Consultant name
  - Status pill
  - Meeting link (if `meetingLink` is set and status is CONFIRMED)
  - Description/occasion notes
- "Book New Consultation" button → links to `/consultation`
- Empty state: "No consultations booked yet"

---

### 7. LOYALTY & REWARDS

**Route:** `/account/loyalty`
**File:** `src/app/(public)/account/loyalty/page.tsx`

**Hero section (dark chocolate background):**
- Current tier badge (large icon + tier name)
- Points balance (Cormorant 56px)
- Progress bar to next tier
- "X points needed to reach [NextTier]"

**Tier benefits comparison table:**
```
Benefit                  | Bronze | Silver | Gold  | Platinum
Priority booking         |   ✓    |   ✓    |   ✓   |    ✓
Early collection access  |        |   ✓    |   ✓   |    ✓
Free consultation/year   |        |        |   ✓   |    ✓
Complimentary alterations|        |        |       |    ✓
```
Current tier column highlighted with `var(--nut)` border.

**Tier thresholds** (read from `SiteSetting`):
```
loyalty_threshold_bronze:   0
loyalty_threshold_silver:   2000
loyalty_threshold_gold:     5000
loyalty_threshold_platinum: 10000
```

**Points history table:**
- Date, description (e.g. "Purchase — Order #1234"), points earned/redeemed, balance after
- Paginated: 10 per page
- Sourced from `PointsTransaction` model

**How to earn points section:**
- Read from `LoyaltyRule` model
- Display as icon + label + points value cards
- e.g. "Make a purchase — earn 1 point per ₦100 spent"

---

### 8. WISHLIST

**Route:** `/account/wishlist`
**File:** `src/app/(public)/account/wishlist/page.tsx`

- Product grid: same `ProductCard` component from the shop
- Each card has: product image, name, price, size selector, "Add to Cart" button, "Remove from Wishlist" button
- If a wished product goes out of stock: show "Out of Stock" overlay + "Notify Me" button
- Empty state: "Your wishlist is empty — browse the collection"
- Sourced from `WishlistItem` model joined with `Product`

---

### 9. REFER A FRIEND

**Route:** `/account/referrals`
**File:** `src/app/(public)/account/referrals/page.tsx`

- Referral link display: `prudentgabriel.com/register?ref=[referralCode]`
- Copy link button with toast "Link copied"
- Share buttons: WhatsApp (pre-filled message), copy link
- Stats cards: Total Referred, Converted (placed an order), Total Points Earned from referrals
- Referred friends list: name (first name only for privacy), join date, status (Joined / Ordered)
- How it works: 3-step explanation
- Sourced from `User.referrals` and `PointsTransaction` where type = `EARNED_REFERRAL`

---

### 10. STYLE PROFILE

**Route:** `/account/style-profile`
**File:** `src/app/(public)/account/style-profile/page.tsx`

**Onboarding quiz** (shown if profile not yet completed):
- Step 1: "What silhouettes do you love?" — multi-select chips (A-line, Fitted, Flowy, Structured, Wrap, Oversized)
- Step 2: "Your colour palette" — multi-select colour swatches (Neutrals, Earth tones, Bold & Bright, Pastels, Monochrome, Metallics)
- Step 3: "What occasions do you dress for?" — multi-select chips (Work, Events, Church, Casual, Bridal, Black tie)
- Step 4: "Your typical budget range" — single select (₦50k–₦150k, ₦150k–₦350k, ₦350k–₦750k, ₦750k+)
- Progress bar across steps
- On completion: saves to `ClientProfile` via `PATCH /api/account/profile`
- Toast: "Your style profile is saved"

**Profile view** (shown if already completed):
- Display all saved preferences as styled chips/swatches
- "Edit Profile" button → returns to quiz flow pre-filled with current values

**Personalised picks section:**
- "Picked for you" — 4 RTW products filtered by client's preferred categories and budget range
- Server-side filtering: `Product.priceNGN` within budget range, `Product.tags` matching style preferences
- Falls back to featured products if no matches
- "Browse the full collection" CTA

---

### 11. ACCOUNT SETTINGS

**Route:** `/account/settings`
**File:** `src/app/(public)/account/settings/page.tsx`

Sections:

**Personal Information:**
- Name, email (read-only — cannot change email), phone
- Profile photo upload (Cloudinary)
- Save button → `PATCH /api/account/profile`

**Password:**
- Current password, new password, confirm new password
- Zod validation: min 8 chars, must match
- `PATCH /api/account/password`

**Notification Preferences:**
- Toggles (saved to `SiteSetting` per user or a simple JSON on `ClientProfile`):
  - Email me when my order advances a stage
  - Email me about new collections
  - Email me when wishlisted items restock
  - Email me 8 weeks before my saved event dates

**Danger Zone:**
- "Delete my account" — opens confirmation modal, requires typing "DELETE" to confirm
- Soft delete: sets `User.isActive = false`, does not hard delete

---

### 12. API ROUTES FOR CLIENT DASHBOARD

```
POST   /api/account/profile/init          Auto-create ClientProfile if missing
GET    /api/account/profile               Get full client profile (merged User + ClientProfile)
PATCH  /api/account/profile               Update name, phone, avatar, style preferences
PATCH  /api/account/password              Change password (requires current password)
DELETE /api/account                       Soft-delete account

PATCH  /api/account/measurements          Update measurements
GET    /api/account/measurements          Get measurements

GET    /api/account/orders/bespoke        List client's BespokeOrders
GET    /api/account/orders/rtw            List client's RTW Orders
GET    /api/account/orders/rtw/[orderId]  Get RTW order detail

GET    /api/account/consultations         List client's ConsultationBookings

GET    /api/account/moodboards            List client's moodboards
POST   /api/account/moodboards            Create moodboard
DELETE /api/account/moodboards/[id]       Delete moodboard

GET    /api/account/loyalty               Points balance, tier, history, rules
GET    /api/account/referrals             Referral stats and list

GET    /api/account/wishlist              List wishlist items
POST   /api/account/wishlist              Add item
DELETE /api/account/wishlist/[productId]  Remove item

GET    /api/account/events                List upcoming event dates
POST   /api/account/events                Add event date
DELETE /api/account/events/[id]           Remove event date
```

All `/api/account/*` routes must:
1. Validate session — return 401 if not authenticated
2. Only return/modify data belonging to the authenticated user
3. Never expose other users' data
4. Log meaningful actions to `ActivityLog`

---

### 13. REGISTER FLOW ENHANCEMENT

When a new user registers at `/register`:

1. Create `User` record as normal
2. Immediately create a linked `ClientProfile` record
3. If URL contains `?ref=[referralCode]`:
   - Find the referrer by `User.referralCode`
   - Set `ClientProfile.referredBy = referrer.id`
   - Award referrer signup bonus points (read from `LoyaltyRule` where action = `SIGNUP_REFERRAL`)
   - Create `PointsTransaction` for referrer
4. Award signup bonus points to new user (from `LoyaltyRule` where action = `SIGNUP`)
5. Send welcome email via `lib/email.ts`

---

### 14. EXECUTIVE REPORTING — MRS. PRUDENT

#### 14a. Interactive Reports Dashboard

**Route:** `/admin/reports`
**Access:** `GENERAL_ADMIN` (`ADMIN`) and `SUPER_ADMIN` only

**Page layout — three sections:**

**Section 1 — Date range selector:**
- Preset buttons: Today, Yesterday, This Week, This Month, Last Month, Custom Range
- Date range picker for custom range
- All data on the page updates based on selected range

**Section 2 — KPI overview (6 cards):**
```
Total Revenue  | Bespoke Revenue | RTW Revenue
New Clients    | Orders Completed | Consultations
```
Each card shows: value for selected period + percentage change vs previous equivalent period (green arrow up / red arrow down)

**Section 3 — Detailed panels:**

*Revenue breakdown chart:*
- Line chart using Recharts: daily revenue over selected period
- Two lines: Bespoke vs RTW
- X-axis: dates, Y-axis: ₦ amounts

*Bespoke pipeline status:*
- Bar chart: count of orders at each stage
- Highlights overdue orders (delivery date passed, not yet delivered) in `var(--danger)`

*Staff attendance summary:*
- For selected period: total days, avg attendance rate per staff member
- Table: staff name, days clocked in, avg hours/day, late arrivals

*Top clients:*
- Table: client name, total spend in period, number of orders, loyalty tier
- Top 5 by spend

*Consultation summary:*
- Total bookings, completed, cancelled, revenue
- Breakdown by consultation type

**Section 4 — Export:**
- "Download Report (PDF)" button → generates a branded PDF summary of the current view using `@react-pdf/renderer`
- "Export CSV" button → raw data export

#### 14b. Automated Daily Report Email

**Cron route:** `POST /api/cron/daily-report`
**Schedule:** Add to `vercel.json` — runs at 11:00 PM daily (`0 23 * * *`)

**Email content:**
```
Subject: "Daily Report — [date] | Prudential Atelier"

Sections:
1. Revenue Today — total payments confirmed
2. Stages Completed — list of orders that advanced a stage, with order ref and stage name
3. Staff Attendance — who clocked in, who was late, who was absent
4. Consultations Today — list of completed consultations
5. Upcoming Deliveries — orders with delivery date within next 7 days
6. Payments Pending — bank transfer receipts awaiting confirmation
```

Send to: `GENERAL_ADMIN_EMAIL` (Mrs. Prudent) and `SUPER_ADMIN_EMAIL` (Nony)

#### 14c. Automated Weekly Report Email

**Cron route:** `POST /api/cron/weekly-report`
**Schedule:** Add to `vercel.json` — runs at 7:00 AM every Monday (`0 7 * * 1`)

**Email content:**
```
Subject: "Weekly Report — Week of [date] | Prudential Atelier"

Sections:
1. Revenue This Week — total + breakdown by channel
2. Production Progress — all active bespoke orders with current stage and delivery date
3. Staff Performance — top performers, attendance leaders, anyone with 3+ late arrivals
4. Overdue Orders — orders past delivery date not yet delivered (flagged red)
5. New Clients — clients who registered this week
6. Consultation Revenue — bookings and revenue for the week
7. RTW Sales Summary — units sold, revenue, top product
```

Send to: `GENERAL_ADMIN_EMAIL` and `SUPER_ADMIN_EMAIL`

**Email template for both reports:**
- Same branded wrapper as bespoke stage emails (ivory background, light brown accents)
- Each section clearly separated with a divider
- Key numbers in bold, Cormorant font for headings
- "View full report" button linking to `/admin/reports`

---

### 15. EVENT DATE REMINDER CRON

**Cron route:** `POST /api/cron/event-reminders`
**Schedule:** Add to `vercel.json` — runs daily at 9:00 AM (`0 9 * * *`)

Logic:
1. Fetch all `EventDate` records where `date` is exactly 60 days, 30 days, or 14 days from today AND `notified = false`
2. For each: send email to client
   ```
   Subject: "[EventLabel] is coming up — time to get dressed?"
   Body: "Hi [name], your [eventLabel] is [X] weeks away.
          Whether you need a bespoke piece or something from our
          collection, we'd love to dress you for the occasion.
          [Book a Consultation] [Browse the Collection]"
   ```
3. Set `notified = true` on the `EventDate` record
4. Log to `ActivityLog`

Add to `vercel.json`:
```json
{ "path": "/api/cron/event-reminders", "schedule": "0 9 * * *" }
{ "path": "/api/cron/daily-report",    "schedule": "0 23 * * *" }
{ "path": "/api/cron/weekly-report",   "schedule": "0 7 * * 1" }
```

All cron routes validate `Authorization: Bearer ${CRON_SECRET}` before executing.

---

### 16. WISHLIST & RESTOCK NOTIFICATIONS

Extend the existing `StockAlert` model (already in schema) to fire emails when a variant comes back in stock:

**When RTW Manager updates product stock** (in existing `/admin/shop/products` page):
- After saving, check if any `StockAlert` records exist for variants that are now back in stock (`stock > 0`)
- For each matching alert: send restock notification email to the subscriber
- Delete the `StockAlert` record after sending

**Restock email:**
```
Subject: "Back in stock — [Product Name] | Prudential Atelier"
Body: "[Product Name] in [size] is back in stock.
       [Shop Now] button linking to /shop/[slug]"
```

Also update the wishlist page: if a wishlisted product has `stock = 0` on all variants, show "Out of Stock" with a "Notify Me" button that creates a `StockAlert` record.

---

### 17. HOMEPAGE ENHANCEMENTS

Extend the existing homepage (`src/app/(public)/page.tsx`) with two improvements:

**Best Sellers automation:**
The `Product.isBestSeller` flag should be set automatically. Add a Vercel cron job:

**Cron route:** `POST /api/cron/update-bestsellers`
**Schedule:** Daily at 2:00 AM (`0 2 * * *`)

Logic:
1. Fetch threshold from `SiteSetting` key `bestseller_threshold` (default 10)
2. Update `Product.isBestSeller = true` where `orderCount >= threshold`
3. Update `Product.isBestSeller = false` where `orderCount < threshold`
4. Log count of products updated

Also increment `Product.orderCount` when an RTW order is placed — add this to the existing order creation API route.

**"Latest from the Journal" section:**
The homepage already has a blog preview section. Wire it to the database:
- Fetch 3 most recent published `BlogPost` records server-side
- If fewer than 3 published posts exist, show graceful empty state (hide the section entirely if 0 posts)
- This should already be a Server Component — verify and fix if it's currently using static data

---

### 18. EXECUTION ORDER

Build in this exact sequence:

1. Build all `/api/account/*` routes
2. Build `POST /api/account/profile/init` — auto-create ClientProfile
3. Enhance register flow with ClientProfile creation + referral points
4. Build `AccountSidebar` component
5. Build `/account` layout with sidebar
6. Build `/account` dashboard home page
7. Build `/account/orders` (bespoke + RTW tabs)
8. Build `/account/measurements`
9. Build `/account/moodboards`
10. Build `/account/consultations`
11. Build `/account/loyalty`
12. Build `/account/wishlist`
13. Build `/account/referrals`
14. Build `/account/style-profile`
15. Build `/account/settings`
16. Build `/admin/reports` interactive dashboard
17. Build `/api/cron/daily-report` and `/api/cron/weekly-report`
18. Build report email templates
19. Build `/api/cron/event-reminders`
20. Build wishlist restock notification flow
21. Build `/api/cron/update-bestsellers`
22. Wire homepage blog preview to database
23. Update `vercel.json` with all new cron schedules
24. Run full build — fix all TypeScript errors — verify Vercel deployment

---

## CODING STANDARDS (unchanged from all previous phases)

- TypeScript strict mode — no `any`
- Server Components by default, `'use client'` only when needed
- Every API route: try/catch → `logError()` on exception
- Every meaningful action: `logActivity()`
- Every async action: loading state + toast on success/error
- Every empty list: designed empty state with CTA — never a blank page
- Forms: React Hook Form + Zod, inline field errors
- Images: `next/image` with proper dimensions and alt text
- All UI must match the chocolate/cream design system exactly
- Mobile responsive: all client dashboard pages fully responsive at 375px

---

## COMPLETION CHECKLIST

Confirm all before calling Phase 2B done:

- [ ] `pnpm build` passes with zero TypeScript errors
- [ ] New client registers → `ClientProfile` auto-created
- [ ] Referral link works: `?ref=[code]` → points awarded to referrer
- [ ] `/account` dashboard loads with real data from both `User` and `ClientProfile`
- [ ] Stage tracker on dashboard matches `/track/[token]` page
- [ ] `/account/measurements` — measurements can be saved and displayed
- [ ] `/account/moodboards` — moodboard can be created with images
- [ ] `/account/loyalty` — tier, points, history all display correctly
- [ ] `/account/wishlist` — items show, "Notify Me" creates StockAlert
- [ ] `/account/referrals` — referral link copies, stats display
- [ ] `/account/style-profile` — quiz completes, personalised picks show
- [ ] `/admin/reports` — date range selector works, all charts load
- [ ] Daily report cron route returns 200 with correct payload
- [ ] Weekly report cron route returns 200 with correct payload
- [ ] Event reminder cron marks EventDates as notified after sending
- [ ] Homepage blog preview shows real published posts
- [ ] All new cron jobs added to `vercel.json`

When all boxes are checked, report back and Phase 3 prompt will be written.

---

*Prepared by SonsHub Media Ltd for Prudential Atelier — prudentgabriel.com*
*₦7,500,000 engagement · Phase 2B of 5*
