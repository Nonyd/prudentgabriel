# CURSOR AI — PRUDENTGABRIEL.COM
## Phase 4: Role System + Staff Dashboard + Finance + CRM + Reporting
### Prepared by SonsHub Media Ltd (Nony — Okafor Chinonso Daniel)

---

## CRITICAL INSTRUCTIONS — READ BEFORE WRITING A SINGLE LINE

1. This is **Phase 4** of a 5-phase build. Phases 1, 2A, 2B, and 3 are complete and live on Vercel.
2. **DO NOT touch any existing model** unless explicitly instructed to add fields.
3. **DO NOT modify** any existing payment flows, auth logic, or public pages.
4. This phase introduces a **flexible job role system** that replaces hardcoded roles for staff. The existing `Role` enum in the database stays — we add a new `JobRole` model alongside it.
5. Staff members (tailors, beaders, designers) get a **completely separate dashboard interface** from the admin panel. They never see the admin.
6. Read the entire prompt before writing any code.
7. Design system unchanged — Cormorant Garamond + Lora + Jost, chocolate/cream palette.

---

## MENTAL MODEL — TWO TYPES OF USERS

```
ADMIN USERS → go to /admin-login → see /admin dashboard
  Super Admin (Nony)
  General Admin (Mrs. Prudent + deputies)
  Staff Admin (restricted admin)
  Department managers (bespoke, finance, content, etc.)

STAFF USERS → go to /staff-login → see /staff dashboard
  Tailors
  Beaders  
  Designers
  Pattern Cutters
  Any operational staff
```

These are completely separate interfaces. A tailor never sees the admin panel. An admin never accidentally lands on the staff portal.

---

## SCHEMA ADDITIONS

Add to `prisma/schema.prisma`:

```prisma
// Flexible job role system
model JobRole {
  id          String   @id @default(cuid())
  name        String   // e.g. "Head Beader", "Senior Tailor"
  description String?
  isPreset    Boolean  @default(false) // system templates
  isActive    Boolean  @default(true)
  
  // Permissions as array of permission keys
  permissions String[] // e.g. ["view_bespoke_orders", "mark_stages_complete"]
  
  // Which users have this role
  users       User[]   @relation("UserJobRole")
  
  createdBy   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// Add to User model:
// jobRoleId   String?
// jobRole     JobRole? @relation("UserJobRole", fields: [jobRoleId], references: [id])
// jobTitle    String?  ← display title (e.g. "Head Beader")
// department  String?  ← e.g. "Production", "Design", "Admin"
// isStaff     Boolean  @default(false) ← true for non-admin operational staff

// Staff task log per day (what they're working on)
model StaffTask {
  id          String       @id @default(cuid())
  staffId     String
  staff       StaffProfile @relation(fields: [staffId], references: [id])
  orderId     String?
  taskNote    String
  date        DateTime     @default(now()) @db.Date
  createdAt   DateTime     @default(now())

  @@index([staffId, date])
}
```

After adding, run: `pnpm exec prisma db push`

---

## PERMISSION KEYS REFERENCE

Define all permission keys in `src/lib/permissions.ts`:

```typescript
export const PERMISSIONS = {
  // Bespoke
  VIEW_BESPOKE_ORDERS:    'view_bespoke_orders',
  MARK_STAGES_COMPLETE:   'mark_stages_complete',
  ASSIGN_STAFF:           'assign_staff',
  VIEW_ORDER_DETAILS:     'view_order_details',

  // Clients
  VIEW_CLIENTS:           'view_clients',
  EDIT_CLIENTS:           'edit_clients',
  ADD_CLIENT_NOTES:       'add_client_notes',

  // Shop
  MANAGE_PRODUCTS:        'manage_products',
  VIEW_RTW_ORDERS:        'view_rtw_orders',
  PROCESS_RTW_ORDERS:     'process_rtw_orders',

  // Consultations
  VIEW_CONSULTATIONS:     'view_consultations',
  MANAGE_CONSULTATIONS:   'manage_consultations',
  SEND_MEETING_LINKS:     'send_meeting_links',

  // Staff & Attendance
  VIEW_STAFF:             'view_staff',
  MANAGE_STAFF:           'manage_staff',
  VIEW_ATTENDANCE:        'view_attendance',
  VIEW_PERFORMANCE:       'view_performance',

  // Finance
  VIEW_INVOICES:          'view_invoices',
  MANAGE_INVOICES:        'manage_invoices',
  CONFIRM_PAYMENTS:       'confirm_payments',
  VIEW_FINANCIAL_REPORTS: 'view_financial_reports',

  // Content
  MANAGE_BLOG:            'manage_blog',
  MANAGE_PAGES:           'manage_pages',

  // Reports
  VIEW_DAILY_REPORTS:     'view_daily_reports',
  VIEW_WEEKLY_REPORTS:    'view_weekly_reports',

  // System (Super Admin / General Admin only)
  MANAGE_USERS:           'manage_users',
  MANAGE_ROLES:           'manage_roles',
  VIEW_LOGS:              'view_logs',
  ACCESS_DEVELOPER:       'access_developer',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// Preset role templates
export const ROLE_PRESETS: Record<string, { 
  name: string; 
  description: string; 
  permissions: Permission[] 
}> = {
  TAILOR: {
    name: 'Tailor',
    description: 'Garment construction and tailoring',
    permissions: [
      'view_bespoke_orders',
      'view_order_details',
    ]
  },
  BEADER: {
    name: 'Beader',
    description: 'Beading and embellishment work',
    permissions: [
      'view_bespoke_orders',
      'view_order_details',
    ]
  },
  DESIGNER: {
    name: 'Designer',
    description: 'Fashion design and concept development',
    permissions: [
      'view_bespoke_orders',
      'view_order_details',
      'view_clients',
    ]
  },
  BESPOKE_MANAGER: {
    name: 'Bespoke Manager',
    description: 'Full bespoke pipeline management',
    permissions: [
      'view_bespoke_orders',
      'mark_stages_complete',
      'assign_staff',
      'view_order_details',
      'view_clients',
      'add_client_notes',
      'view_consultations',
    ]
  },
  RTW_MANAGER: {
    name: 'RTW Manager',
    description: 'Ready-to-wear shop management',
    permissions: [
      'manage_products',
      'view_rtw_orders',
      'process_rtw_orders',
    ]
  },
  CONTENT_MANAGER: {
    name: 'Content Manager',
    description: 'Website content and blog management',
    permissions: [
      'manage_blog',
      'manage_pages',
    ]
  },
  FINANCE_OFFICER: {
    name: 'Finance Officer',
    description: 'Invoice and payment management',
    permissions: [
      'view_invoices',
      'manage_invoices',
      'confirm_payments',
      'view_financial_reports',
    ]
  },
  CONSULTATION_MANAGER: {
    name: 'Consultation Manager',
    description: 'Consultation booking and scheduling',
    permissions: [
      'view_consultations',
      'manage_consultations',
      'send_meeting_links',
      'view_clients',
    ]
  },
  HR_MANAGER: {
    name: 'HR Manager',
    description: 'Staff and attendance management',
    permissions: [
      'view_staff',
      'manage_staff',
      'view_attendance',
      'view_performance',
      'view_daily_reports',
    ]
  },
  GENERAL_MANAGER: {
    name: 'General Manager',
    description: 'Full operational access',
    permissions: [
      'view_bespoke_orders', 'mark_stages_complete', 'assign_staff',
      'view_order_details', 'view_clients', 'edit_clients',
      'add_client_notes', 'manage_products', 'view_rtw_orders',
      'process_rtw_orders', 'view_consultations', 'manage_consultations',
      'send_meeting_links', 'view_staff', 'manage_staff',
      'view_attendance', 'view_performance', 'view_invoices',
      'manage_invoices', 'confirm_payments', 'view_financial_reports',
      'manage_blog', 'manage_pages', 'view_daily_reports',
      'view_weekly_reports',
    ]
  },
};
```

---

## 1. JOB ROLES MANAGEMENT — ADMIN

**Route:** `/admin/settings/roles`

Add "Job Roles" link to Settings section in AdminSidebar.
Visible to: `SUPER_ADMIN` and `ADMIN` only.

### Role List Page

Cards grid (not a table — more visual):
Each card shows:
- Role name (Cormorant 20px)
- Description (Lora 13px)
- Permission count badge: "12 permissions"
- Staff count: "3 staff members"
- "PRESET" badge if `isPreset: true`
- Edit button, Delete button (disabled if staff assigned)

"New Role" button — top right

### Create / Edit Role Modal

```
Role Name: [input]
Description: [textarea, optional]

PERMISSIONS
(grouped checklist — plain English labels)

ORDERS & PRODUCTION
☐ View bespoke orders
☐ Mark production stages complete
☐ Assign tailors and beaders
☐ View full order details

CLIENTS
☐ View client profiles
☐ Edit client information
☐ Add notes to client profiles

SHOP
☐ Manage products
☐ View shop orders
☐ Process shop orders

CONSULTATIONS
☐ View consultations
☐ Manage consultation calendar
☐ Send virtual meeting links

STAFF & HR
☐ View staff profiles
☐ Manage staff profiles
☐ View attendance records
☐ View performance scores

FINANCE
☐ View invoices and quotes
☐ Create and edit invoices
☐ Confirm bank transfer payments
☐ View financial reports

CONTENT
☐ Write and publish blog posts
☐ Edit website pages

REPORTS
☐ View daily reports
☐ View weekly reports
```

"Start from a template" — dropdown of presets.
Selecting fills the checkboxes automatically.
User can then customise.

Save button → creates/updates `JobRole` record.

### Seed preset roles on first load

On `/admin/settings/roles` page load, check if presets exist.
If not, seed all `ROLE_PRESETS` with `isPreset: true`.
This runs once automatically.

---

## 2. USER MANAGEMENT — ADMIN

**Route:** `/admin/settings/users`

(Built in Phase 3 — extend it with job roles)

### Updates to existing user management:

In the Invite User modal, change role selector:

**Before:** dropdown of hardcoded Role enum values
**After:** two-field selection:

```
User Type:
○ Admin User    (has access to admin panel)
○ Staff Member  (has access to staff portal only)

Job Role: [dropdown of JobRole records]
```

If "Admin User" selected:
- System Role maps automatically:
  - General Manager role → ADMIN
  - Any other role → STAFF_ADMIN
- They get /admin-login access

If "Staff Member" selected:
- System Role = STAFF (existing enum value)
- `User.isStaff = true`
- They get /staff-login access only
- Never see the admin panel

Job Title field (free text): e.g. "Head Beader", "Junior Tailor"
Department field (free text): e.g. "Production", "Design"

### Invitation email update:

For Staff Members, the invite email changes:
```
Subject: "You've been added to Prudential Atelier"

Hi [name],

You've been set up on the Prudential Atelier staff 
system.

Your login details:
URL: prudentgabriel.com/staff-login
Email: [email]
Temporary password: [WORD-1234]

You'll be asked to set a new password when you 
first log in.

— Prudential Atelier
```

---

## 3. STAFF PORTAL — SEPARATE INTERFACE

### Login page: `/staff-login`

Same design as `/admin-login` but with:
- "OPERATIONS SUITE" replaced with "STAFF PORTAL"
- "Staff Sign In" heading
- "For production staff only" subtitle
- After login → redirect to `/staff` (not `/admin`)

### Staff dashboard shell

**Route group:** `src/app/(staff)/`
**Layout:** `src/app/(staff)/layout.tsx`

Completely separate from the admin shell.
No admin sidebar. No admin topbar.

Layout:
```
┌─────────────────────────────────┐
│  [Logo]   STAFF PORTAL   [Name] │  ← top bar
├─────────────────────────────────┤
│                                 │
│         Page Content            │
│                                 │
├─────────────────────────────────┤
│  🏠    📋    ⏰    👤           │  ← bottom nav (mobile)
│ Home  Tasks  Time  Profile      │
└─────────────────────────────────┘
```

Mobile-first design. Staff use phones.

Top bar:
- Logo (white variant, small)
- "STAFF PORTAL" label (Jost 9px, var(--lightbr))
- Staff name + avatar initials (right side)
- Notification bell

Bottom navigation (fixed):
- Home (dashboard)
- My Tasks (assigned orders)
- Time (attendance/clock)
- Profile

Background: `var(--bg)` (#F0E8DD)

### Staff Dashboard Home (`/staff`)

**Clock-in status banner (top of page):**

If not clocked in today:
```
┌─────────────────────────────────────┐
│  You haven't clocked in yet today   │
│  [CLOCK IN NOW →]                   │
└─────────────────────────────────────┘
```
Background: amber tint, nut brown text, urgent feel

If clocked in:
```
┌─────────────────────────────────────┐
│  ✓ Clocked in at 8:42 AM            │
│  Working on: Order ORD-2847         │
│  [CLOCK OUT]                        │
└─────────────────────────────────────┘
```
Background: green tint

**My Assignments section:**
List of active `OrderAssignment` records for this staff member.
Each card:
- Order ref + outfit name
- Client first name only (privacy)
- Stage they're assigned to
- Delivery date (with countdown: "14 days")
- Status: In Progress / Waiting / Complete
- "View details" → `/staff/orders/[orderId]`

**Today's summary:**
- Hours clocked today
- Tasks completed this week
- Performance score (if visible to their role)

### Staff Order Detail (`/staff/orders/[orderId]`)

What a tailor/beader sees when they open an assigned order:

- Order ref, outfit description
- Their specific assignment (e.g. "Tailoring — Stage 8")
- Client measurements (read-only, beautifully presented)
- Materials list for this order
- Stage notes from Bespoke Manager (instructions for them)
- Image gallery of reference photos and sketches
- Delivery date
- No financial information visible
- No client contact details visible (privacy)

Note: Staff cannot mark stages complete — only Bespoke Manager can. This page is read-only reference material for the staff member.

### My Tasks (`/staff/tasks`)

Full list of all active and past assignments:
- Filter: Active / Completed / All
- Sort by delivery date
- Each row: order ref, outfit, stage, assigned date, status

### Time & Attendance (`/staff/time`)

**Clock In/Out section:**

Two modes:

**Mode A — QR Scan (primary):**
```
┌─────────────────────────────────────┐
│  [QR Scanner Camera View]           │
│                                     │
│  Point your camera at the           │
│  workstation QR code                │
└─────────────────────────────────────┘
```
Uses device camera to scan the QR code.
On valid scan: opens task confirmation modal.

**Mode B — Manual fallback (if camera unavailable):**
Text input: "Enter QR code manually"
(For devices that can't scan)

**Task confirmation modal (after successful scan):**
```
Good morning, [name]!

What will you be working on today?

[Dropdown: select from assigned orders]
  OR
[Text: describe your task]

[CONFIRM CLOCK IN]
```

**Clock out:**
Simple "CLOCK OUT" button.
Shows summary: "You worked 7h 23m today"

**My attendance history:**
Table: Date, Clock in, Clock out, Hours, Task
Last 30 days.

### Staff Profile (`/staff/profile`)

- Name, photo upload
- Job title, department (read-only — set by admin)
- Skill tags (read-only)
- Change password
- Notification preferences

---

## 4. QR CODE SYSTEM — ADMIN SIDE

**Route:** `/admin/attendance/qr`

### QR Code Display Page

This page is meant to be **displayed on a tablet/screen 
mounted at the workstation** in the atelier.

Full-screen QR code display:
- Large QR code (400px)
- "Scan to clock in/out" instruction (Lora 16px)
- Today's date displayed below
- QR code refreshes automatically every 24 hours
- No login required to VIEW this page 
  (it's a display page, not a data page)
- The QR code itself is the security — it expires daily

URL: `/attendance/qr` (public display page, no auth)

The QR code encodes:
```
{
  code: "[unique daily code from QRCode model]",
  date: "2026-06-04",
  location: "Atelier Floor"
}
```
Encoded as a JSON string, then as QR image using `qrcode` package.

### QR Management in Admin

In `/admin/attendance`:
- Current QR code display (small preview)
- "Regenerate QR Now" button (emergency regeneration)
- QR history: date, generated at, scans count
- Download QR as PNG (for printing)

---

## 5. ATTENDANCE ADMIN DASHBOARD

**Route:** `/admin/attendance` (already exists — extend it)

### Today's view (main panel):

Staff grid — each staff member card:
```
┌──────────────────────┐
│  [TK]  Tunde Kareem  │
│  Senior Tailor       │
│  ● In · 8:02 AM      │  ← green
│  Working on ORD-2847 │
└──────────────────────┘
```

Status colours:
- Green "● In": clocked in
- Amber "● Late": clocked in after resumption time
- Red "● Not in": not clocked in yet (after resumption time)
- Grey "● Off": freelancer (not tracked) or day off

**Summary row at top:**
```
[11 On the clock]  [2 Late]  [1 Not in]  [2 Freelance]
```

### Attendance table (below grid):

Full table for selected date range.
Columns: Staff, Date, Clock In, Clock Out, Hours, Task, Status
Filter by: staff member, date range, status
Export to CSV

### Late alert configuration:

Card in this page:
- Resumption time setting (e.g. 09:00)
- "Alert HR Manager if staff not clocked in by [time]"
- Save → updates SiteSetting `hr_resumption_time`

---

## 6. FINANCE MANAGER DASHBOARD

**Route:** `/admin/finance` (already exists — extend it)

### Finance dashboard overview:

4 summary cards:
- Total revenue this month
- Pending bank transfers (count + total amount)
- Outstanding balances across all bespoke orders
- Invoices overdue (count)

### Pending bank transfers (priority panel):

Prominent section at top.
Each pending transfer:
- Client name + order/booking ref
- Amount
- Date submitted
- Receipt thumbnail → click to open lightbox
- "CONFIRM" button (green) → fires confirmation email
- "REJECT" button → opens reason modal → fires rejection email

### All payments table:

Full payment history across all order types.
Columns: Date, Client, Type (Bespoke/RTW/Consultation), 
Method, Amount, Status, Actions
Filter by: type, method, status, date range
Search by: client name, reference

### Outstanding balances:

List of all BespokeOrders where `balance > 0`
Columns: Client, Order ref, Total, Paid, Balance, Delivery date
Sort by: balance (highest first), delivery date (soonest first)
"Send reminder" button → sends payment reminder email to client

---

## 7. INVOICE PDF SYSTEM

Build `src/lib/invoice-pdf.ts` using `@react-pdf/renderer`:

```typescript
export async function generateInvoicePDF(
  invoice: Invoice & { 
    bespokeOrders?: BespokeOrder[] 
  }
): Promise<Buffer>
```

**Invoice PDF design:**
- A4 size, portrait
- Header: Prudential Atelier logo (from SiteSetting logo_white on dark header)
  OR text wordmark if no logo
- Dark chocolate header band (#442913) with ivory text
- Gold accent line below header (#C9A84C)
- Invoice details: number, date, due date
- Bill To: client name, email, phone, address
- Line items table:
  - Description
  - Quantity
  - Unit Price
  - Total
  - Alternating row background
- Subtotal, discount, VAT (if applicable), Total
- Payment instructions section:
  - Bank transfer details
  - Online payment link (if invoice has publicToken)
- Footer: "Prudential Atelier · prudentgabriel.com"
  + "Developed with love by SonsHub Media Ltd"
- Brand colours: chocolate, gold, ivory throughout

**API routes:**
```
GET  /api/invoices/[id]/pdf     → generate + return PDF
POST /api/invoices/[id]/send    → generate PDF + email to client
```

**Invoice list page** (`/admin/invoices`):
- BulkSelectTable: Invoice #, Client, Amount, Status, Date, Actions
- Status pills: Draft (grey), Sent (blue), Paid (green), 
  Overdue (red), Partially Paid (amber)
- Actions: View, Download PDF, Send, Mark Paid, Edit
- "New Invoice" button

**Invoice detail/edit page** (`/admin/invoices/[id]`):
- Line items editor (dynamic rows, same as quotation)
- Client info
- Status management
- Payment history
- PDF preview (inline using iframe or object tag)
- Send button → email with PDF attachment

---

## 8. QUOTATION → INVOICE CONVERSION

The quotation system (built in Phase 2A) needs the 
conversion flow completed:

When a quotation is approved by client 
(via `/quote/[approvalToken]`):
1. Status → APPROVED, approvedAt set
2. Admin sees notification in sidebar badge
3. In quotation detail page: "Convert to Invoice" button appears
4. Click → creates Invoice from quotation data
5. Creates BespokeOrder linked to invoice
6. Sets quotation status → CONVERTED
7. Redirects admin to new bespoke order page

Auto-conversion option (setting in admin):
SiteSetting `auto_convert_approved_quotes`: true/false
If true: approved quote automatically creates invoice + order.

---

## 9. CLIENT CRM — COMPLETE THE ADMIN SIDE

**Route:** `/admin/clients` (already exists — extend it)

### Client list page updates:

Add these columns to existing BulkSelectTable:
- Total bespoke orders
- Last order date
- Loyalty tier badge

Add quick filters:
- "VIP clients" (Gold + Platinum tier)
- "Active orders" (has in-progress bespoke order)
- "No orders yet" (registered but never ordered)

### Client profile page updates (`/admin/clients/[clientId]`):

**Add "Quick Actions" bar (sticky at top):**
```
[Create Bespoke Order]  [Book Consultation]  
[Send Invoice]  [Send Message]
```

**Add "Communication Log" section:**
All emails sent to this client from the system.
Each entry: date, subject, type (stage email/invoice/etc), 
status (sent/failed)
Pulled from ActivityLog where module = 'email' 
and recordId = client userId

**Add "Send Custom Email" button:**
Opens modal:
- Subject field
- Body (TipTap lite editor)
- Send button → uses Nodemailer
- Logs to ActivityLog

---

## 10. STAFF PERFORMANCE SCORING

Auto-computed nightly via cron job.
Add to `vercel.json`:
```json
{ "path": "/api/cron/update-performance", "schedule": "0 2 * * *" }
```

**`/api/cron/update-performance`:**

For each StaffProfile:

1. **Orders completed:**
   Count of OrderAssignment records where completedAt is set

2. **Average stage time (hours):**
   Average of (completedAt - assignedAt) across all 
   completed assignments

3. **Client rating:**
   Average rating from Review records linked to 
   orders they worked on
   (Pull from Review.orderId → BespokeOrder → 
   OrderAssignment → staffId)

4. **Attendance score (%):**
   (Days clocked in / Total working days this month) × 100
   Working days = all days except Sunday 
   (or configure in SiteSetting)

5. **Punctuality score (%):**
   (Days clocked in on time / Total days clocked in) × 100
   "On time" = clocked in before resumption time

Update StaffProfile:
- `ordersCompleted`
- `avgStageHours`
- `attendanceScore`

Store detailed monthly breakdown in a new model:

```prisma
model PerformanceRecord {
  id              String       @id @default(cuid())
  staffId         String
  staff           StaffProfile @relation(fields: [staffId], references: [id])
  month           Int          // 1-12
  year            Int
  ordersCompleted Int          @default(0)
  avgStageHours   Float?
  clientRating    Float?
  attendanceScore Float?
  punctualityScore Float?
  createdAt       DateTime     @default(now())
  
  @@unique([staffId, month, year])
}
```

**Performance dashboard** (`/admin/staff/performance`):

Top performers table:
- Staff name, role, orders completed, avg stage time, 
  rating, attendance, punctuality
- Sortable by any column
- Filter by department

Individual staff performance card:
In `/admin/staff/[staffId]` — add performance section:
- Monthly trend chart (Recharts LineChart)
- Current month vs last month comparison
- Star rating display for client rating
- Attendance calendar (heatmap style — 
  green = present, red = absent, amber = late)

---

## 11. REPORTS — COMPLETE THE SYSTEM

**Route:** `/admin/reports` (already exists — extend it)

### Add missing report panels:

**RTW Inventory Report:**
- Table: product name, category, sizes, stock levels
- Highlight: low stock (amber), out of stock (red)
- "Export inventory" CSV button

**Consultation Pipeline Report:**
- Upcoming consultations this week (calendar view)
- Conversion rate: consultations → bespoke orders
- Revenue by consultation type

**Bespoke Production Report:**
- All active orders with stage, tailor assigned, 
  delivery date, risk flag
- Overdue orders highlighted in red
- Average production time per stage

**Staff Productivity Report:**
- Hours worked per staff member this week
- Orders completed per staff member
- Top performer highlight

### Report delivery (already built in Phase 2B — verify):

Confirm these cron jobs are working:
- `/api/cron/daily-report` — 11pm daily
- `/api/cron/weekly-report` — 7am Monday

If not sending, debug the email transport.

---

## 12. ADMIN USER MANAGEMENT — COMPLETE

**Route:** `/admin/settings/users` (built in Phase 3 — extend)

### Wire job roles into the invite flow:

Update invite modal to use the new JobRole system:

```
User Type: ○ Admin User  ○ Staff Member

Job Role: [dropdown of JobRole.name values]
          Shows permission count: "12 permissions"

Job Title: [free text, e.g. "Head Beader"]
Department: [free text, e.g. "Production"]

Full Name: 
Email:
```

When creating a Staff Member:
- Set `User.role = STAFF`
- Set `User.isStaff = true`
- Set `User.jobRoleId` to selected JobRole
- Set `User.jobTitle` and `User.department`
- Create linked `StaffProfile` automatically

### Staff member vs Admin user routing:

Update `middleware.ts`:
- Users with `isStaff = true` → redirect to `/staff` if they try to access `/admin`
- Users with admin roles → redirect to `/admin` if they try to access `/staff`
- `/staff/*` routes require authentication + `isStaff = true` OR any admin role

---

## 13. NOTIFICATION SYSTEM

Build a real-time notification system for admin users.

**Model (already exists: `AdminNotification`)**

**Notification bell** (already in admin topbar — wire it):

`GET /api/admin/notifications` — paginated, unread first
`PATCH /api/admin/notifications/[id]/read`
`PATCH /api/admin/notifications/read-all`

Dropdown panel from bell icon:
- Unread count badge (red dot, already showing)
- List of recent notifications (max 10 in dropdown)
- Each: icon + title + message + time ago + link
- "Mark all read" button
- "View all notifications" link

**Trigger notifications for:**
- New consultation booking → Consultation Manager
- Bank transfer receipt uploaded → Finance Manager
- Bespoke order stage advanced → General Admin
- New client registered → General Admin
- Low stock alert → RTW Manager
- Staff not clocked in (late alert) → HR Manager
- Quote approved by client → Bespoke Manager + Finance Manager

Build `src/lib/notify.ts`:
```typescript
export async function createAdminNotification(params: {
  type: AdminNotificationType;
  title: string;
  message: string;
  link?: string;
  entityId?: string;
  // which roles should see this notification:
  targetRoles?: string[];
}): Promise<void>
```

Wire this into all existing API routes that should 
trigger notifications (checkout, consultation booking, 
stage completion, bank transfer upload, etc.)

---

## 14. PAGES CONTENT MANAGER

**Route:** `/admin/content/pages`

A simple CMS for key website content 
(so Mrs. Prudent's team can update text without 
touching the codebase):

Pages to manage:
- Announcement bar text (the rotating messages at top)
- About page copy
- Bespoke process page copy
- Contact information
- Shipping & Returns policy
- Privacy Policy
- Terms & Conditions

Each page in the CMS:
- TipTap rich text editor
- Save button → stores in SiteSetting with key `page_[pagename]`
- Live preview link

Homepage sections (toggle on/off + edit text):
- Announcement bar: text + enabled/disabled
- Hero: headline, subheadline, button labels
- PFA banner: heading, body text
- Brand quote: quote text, attribution

---

## 15. EXECUTION ORDER

Build in this exact sequence:

1. Add schema additions → `prisma db push`
2. Build `src/lib/permissions.ts` with all permission keys and presets
3. Build Job Roles admin page (`/admin/settings/roles`)
4. Update User Management to use job roles
5. Build `/staff-login` page
6. Build staff portal layout + bottom nav
7. Build staff dashboard home (`/staff`)
8. Build staff order detail (`/staff/orders/[orderId]`)
9. Build staff tasks page (`/staff/tasks`)
10. Build staff attendance page (`/staff/time`) with QR scanner
11. Build staff profile page (`/staff/profile`)
12. Build `/attendance/qr` display page
13. Extend `/admin/attendance` with QR management
14. Build invoice PDF system
15. Build invoice list + detail admin pages
16. Complete quotation → invoice conversion flow
17. Extend `/admin/clients` CRM
18. Build staff performance cron + dashboard
19. Add report panels to `/admin/reports`
20. Wire notification system
21. Build `/admin/content/pages` CMS
22. Add `PerformanceRecord` model → `prisma db push`
23. Run full build — fix all TypeScript errors
24. Deploy to Vercel

---

## COMPLETION CHECKLIST

- [ ] `pnpm build` passes with zero TypeScript errors
- [ ] Job role can be created, edited, deleted from admin
- [ ] Preset roles seed on first visit to roles page
- [ ] Inviting a staff member (tailor) sends email with /staff-login URL
- [ ] Staff member logs into /staff portal (not /admin)
- [ ] Staff sees their assigned orders on dashboard
- [ ] Staff can clock in via QR scan on /staff/time
- [ ] /attendance/qr displays full-screen QR code
- [ ] Admin sees attendance in real time
- [ ] Invoice PDF generates correctly with branding
- [ ] Invoice can be sent to client via email
- [ ] Approved quote converts to invoice + bespoke order
- [ ] Finance dashboard shows pending bank transfers
- [ ] Admin can confirm/reject bank transfer
- [ ] Performance scores update via cron
- [ ] Staff performance visible in /admin/staff/performance
- [ ] Notification bell shows real notifications
- [ ] Pages CMS saves and reflects on public site

---

*Prepared by SonsHub Media Ltd for Prudential Atelier — prudentgabriel.com*
*₦7,500,000 engagement · Phase 4 of 5*
