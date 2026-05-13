# CURSOR SESSION PROMPT — SESSION 12
## Gallery Masonry · Admin Connections · Shipping Zones · Team Management
## Notification Drawer · Profile Panels · Logout · Saved Payment Details
### Prudent Gabriel · prudentgabriel.com
### Prepared by Nony | SonsHub Media

---

> ## ⚠️ MANDATORY PRE-FLIGHT
>
> 1. **Never recreate files that exist.** Read File before creating.
> 2. **No `any` types.** All types derived from Prisma or explicit interfaces.
> 3. **Cloudinary is now configured** — CLOUDINARY_CLOUD_NAME=dwgbr0oyn.
>    All image uploads must go through Cloudinary. No placeholder fallbacks in production.
> 4. **This session touches DB schema** — run `npx prisma generate && npx prisma db push` after.
> 5. After every task: `npx tsc --noEmit` must pass.

---

## PRISMA SCHEMA ADDITIONS

Add only what is missing:

```prisma
// ─────────────────────────────────────────
// TEAM INVITATIONS
// ─────────────────────────────────────────

model TeamInvitation {
  id          String    @id @default(cuid())
  email       String    @unique
  role        Role      @default(ADMIN)
  token       String    @unique @default(cuid())
  invitedBy   String    // userId of inviting admin
  expiresAt   DateTime  // 72 hours from creation
  acceptedAt  DateTime?
  createdAt   DateTime  @default(now())

  @@index([token])
  @@index([email])
}

// ─────────────────────────────────────────
// SAVED PAYMENT METHODS (customer)
// ─────────────────────────────────────────

model SavedPaymentMethod {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  gateway         PaymentGateway  // PAYSTACK or STRIPE
  
  // Paystack: authorization code (token)
  paystackAuthCode     String?  // reusable auth code
  paystackCardLast4    String?
  paystackCardBrand    String?  // Visa, Mastercard, Verve
  paystackCardExpiry   String?  // "12/26"
  paystackEmail        String?  // email used during tokenization
  
  // Stripe: payment method ID
  stripePaymentMethodId String?
  stripeCardLast4       String?
  stripeCardBrand       String?
  stripeCardExpiry      String?  // "12/2026"
  stripeCustomerId      String?  // Stripe customer ID
  
  isDefault       Boolean  @default(false)
  nickname        String?  // "My Visa Card", "Work Card"
  createdAt       DateTime @default(now())

  @@unique([userId, gateway, paystackAuthCode])
  @@index([userId])
}

// Add relation to User:
// savedPaymentMethods SavedPaymentMethod[]

// ─────────────────────────────────────────
// ADD preferredGateway TO User
// ─────────────────────────────────────────
// Add to User model if not present:
// preferredGateway PaymentGateway?
```

---

## TASK A — GALLERY MASONRY FIX

The current gallery shows same-size images in a uniform grid. Fix to true Pinterest masonry.

### A1 — Fix /atelier page masonry

**Update `src/components/gallery/AtelierGalleryClient.tsx`**:

The CSS columns approach works but needs correct implementation:

```typescript
// REMOVE any grid/flex layout on the image container
// REPLACE with pure CSS columns:

// Container div:
<div
  className="px-4 pt-8"
  style={{
    columnCount: 4,
    columnGap: '4px',
  }}
>
  {images.map((image) => (
    <div
      key={image.id}
      style={{
        breakInside: 'avoid',
        marginBottom: '4px',
        display: 'block',
      }}
    >
      <img
        src={optimizeImageUrl(image.url, 600)}
        alt={image.alt || 'Prudent Gabriel Atelier'}
        style={{
          width: '100%',
          height: 'auto',      // ← CRITICAL: natural height, not fixed
          display: 'block',
        }}
        loading="lazy"
      />
      {image.caption && (
        <div style={{
          padding: '8px 4px',
          fontSize: '11px',
          fontFamily: 'Jost, sans-serif',
          color: '#8A8A85',
          letterSpacing: '0.02em',
        }}>
          {image.caption}
        </div>
      )}
    </div>
  ))}
</div>

// Responsive column counts via inline style or CSS:
// Use useMediaQuery hook to determine columns:
//   >= 1024px: 4 columns
//   >= 768px:  3 columns
//   < 768px:   2 columns

// IMPORTANT: Use <img> not next/image for masonry
// next/image requires fixed dimensions — breaks natural height masonry
// For gallery, direct <img> with loading="lazy" is correct
// (next/image is for above-fold LCP images — not for galleries)
```

### A2 — Fix /bridesals page masonry

**Update `src/components/gallery/BridalGalleryClient.tsx`**:

Same fix as atelier. The bridal gallery currently shows every image at the same size
because all seed images have the same aspect ratio (Unsplash URL = same image).

When admin uploads real bridal photos, the natural heights will vary creating the
Pinterest effect. For now, ensure the CSS is correct so it works immediately with real uploads.

### A3 — Load More (after 24, not 50)

Change initial load from 50 to **24** images (more responsive):
```typescript
// In both gallery page server components:
// Change limit from 50 to 24

// Load More fetches next 24
// Button appears when hasMore: true
// After clicking: append (don't replace) next 24 images

// API: GET /api/gallery?category=ATELIER&page=2&limit=24
```

### A4 — Gallery upload fix

**Update `src/app/api/admin/gallery/route.ts`** (POST):

```typescript
// Ensure upload saves the Cloudinary URL correctly:
// After cloudinary.uploader.upload():
//   result.secure_url → url field in GalleryImage
//   result.public_id  → publicId field
//   result.width      → width field
//   result.height     → height field
//
// IF Cloudinary is not configured (missing env vars):
//   Return 400: "Cloudinary is not configured. Please add CLOUDINARY credentials in Settings."
//   Never save a placeholder URL to the DB

// Verify the file is being read correctly:
// Use request.formData() to get the file
// Convert to buffer: Buffer.from(await file.arrayBuffer())
// Upload as base64 OR stream to Cloudinary

// After successful upload:
//   Create GalleryImage record with real Cloudinary URL
//   Return the new GalleryImage with url, publicId, width, height

// The admin gallery UI then:
//   Shows the new image immediately (optimistic update)
//   Real image loads from Cloudinary CDN
```

---

## TASK B — NOTIFICATION DRAWER (replaces dropdown)

### B1 — Remove existing dropdown, add drawer

**Update `src/components/admin/NotificationBell.tsx`**:

Replace the Radix Popover with a right-side drawer:

```typescript
// STATE: isOpen (boolean), notifications, unreadCount

// BELL BUTTON (in topbar):
//   Same as before: bell icon + count badge
//   onClick: setIsOpen(true) + fetch notifications + mark all read

// DRAWER (fixed, right-side slide-in):
//   Position: fixed, top-0, right-0, bottom-0
//   Width: 400px desktop / 100vw mobile
//   z-index: 50
//   
//   Framer Motion: x: 400 → 0 (desktop), 100% → 0 (mobile)
//   AnimatePresence for mount/unmount
//   
//   BACKDROP: fixed inset-0, bg-black/20, z-40
//             onClick: close drawer
//   
//   DRAWER PANEL: bg-white, border-left: 1px solid #EBEBEA, h-full, flex flex-col

// DRAWER HEADER (padding 20px 24px, border-bottom 1px #EBEBEA):
//   "Notifications" (Bodoni Moda 22px, black, left)
//   X close button (right, Lucide X, 18px, charcoal)
//   Below: "[N] unread" (Jost 11px, olive) if unread > 0

// FILTER TABS (below header, border-bottom 1px #EBEBEA):
//   All | Orders | Bespoke | Consultations | Reviews | Stock
//   Jost 11px uppercase tracking
//   Active: olive border-bottom 2px, olive text
//   Inactive: dark-grey, hover black
//   Horizontal scroll on mobile

// NOTIFICATIONS LIST (flex-1, overflow-y-auto, data-lenis-prevent):
//   Filtered by selected tab
//   
//   Each notification item (padding 16px 24px, border-bottom 1px #F5F5F3):
//     Unread: left-border 3px olive, bg-[#FAFAF8]
//     Read: white bg, no border
//     
//     Row: icon circle (32px) + content (flex-1) + time (right)
//     
//     Icon colors per type (same as before):
//       NEW_ORDER → green ShoppingCart
//       NEW_BESPOKE → purple Scissors
//       NEW_CONSULTATION → blue Calendar
//       REVIEW_PENDING → amber Star
//       LOW_STOCK → red AlertTriangle
//       PAYMENT_FAILED → red CreditCard
//       NEW_CUSTOMER → green User
//       COUPON_EXPIRING → amber Tag
//     
//     Title: Jost 13px weight-500 black
//     Message: Jost 12px weight-300 dark-grey, line-clamp-2, mt-0.5
//     Time: Jost 10px dark-grey/50, mt-1
//     
//     onClick: router.push(notification.link || '/admin'), close drawer
//     Mark individual as read: PATCH /api/admin/notifications/read { id }
//   
//   EMPTY STATE (centered, py-16):
//     BellOff icon (32px, #EBEBEA)
//     "No notifications" (Jost 14px, dark-grey)
//     "You're all caught up!" (Jost 12px, dark-grey/60)
//   
//   LOADING: 5 skeleton rows

// DRAWER FOOTER (border-top 1px #EBEBEA, padding 16px 24px):
//   Left: [Mark All Read] text button (Jost 11px, dark-grey)
//          onClick: PATCH /api/admin/notifications/read { markAllRead: true }
//   Right: [View All Notifications →] link (Jost 11px, olive)
//           href: /admin/notifications
```

### B2 — Notifications Full Page

**Create `src/app/(admin)/admin/notifications/page.tsx`** (Server Component):

```typescript
// Fetch all notifications (no limit, paginated 50 per page)
// Include unread count
// Pass to NotificationsPageClient
```

**Create `src/components/admin/NotificationsPageClient.tsx`**:

```
PAGE HEADER:
  "Notifications" (Bodoni Moda 28px)
  "[N] unread" badge (olive, right)
  [Mark All Read] button (outlined, right)

FILTER TABS:
  All | Unread | Orders | Bespoke | Consultations | Reviews | Stock | System

TABLE (white, border 1px #EBEBEA):
  Columns: Type icon | Title | Message | Time | Status | Action
  
  Unread rows: olive left border, bg-[#FAFAF8]
  Read rows: white
  
  [Mark Read] button per row
  [Go to →] link per row (notification.link)
  
  Pagination: 50 per page

BULK ACTIONS:
  Checkbox select
  [Mark Selected Read] | [Delete Selected]
```

**Add to AdminSidebar** under SYSTEM section:
```typescript
// Bell icon, "Notifications", /admin/notifications
// Show unread count badge if > 0
```

---

## TASK C — ADMIN + CUSTOMER PROFILE PANELS

### C1 — Admin Profile Panel (top-right)

**Update `src/components/admin/AdminTopbar.tsx`**:

Replace the static avatar with a clickable avatar that opens a profile panel:

```typescript
// AVATAR BUTTON (top-right, after bell):
//   28px circle, bg-olive, white initials
//   Admin name (Jost 12px, black, desktop only)
//   ChevronDown (12px, dark-grey)
//   onClick: opens ProfileDrawer (right-side, same pattern as notification drawer)

// LOGOUT BUTTON (also in topbar, right of avatar):
//   "Logout" text (Jost 12px, dark-grey)
//   LogOut icon (14px) left
//   hover: text-red-500
//   onClick: signOut({ callbackUrl: '/admin-login' })
//   Style: minimal, no background — just text + icon
```

**Create `src/components/admin/AdminProfileDrawer.tsx`**:

```
WIDTH: 360px
Same animation as notification drawer (slide from right)
Opens independently (separate state from notification drawer)

HEADER:
  "My Profile" (Bodoni Moda 20px)
  X close button

CONTENT (padding 24px, overflow-y-auto, data-lenis-prevent):

AVATAR SECTION:
  Large avatar circle: 72px, bg-olive, white initials (or photo if set)
  [Change Photo] button below: Jost 11px, dark-grey
    onClick: file picker → POST /api/admin/upload → update profile
  
  Name (Bodoni Moda 20px, black, text-center, mt-3): [admin name]
  Role badge (Jost 10px uppercase, olive text, olive border, px-2 py-0.5): SUPER ADMIN

PROFILE FORM (mt-6):
  First Name (Input)
  Last Name (Input)
  Email (Input, disabled — lock icon)
  Phone (Input)
  [Save Profile] button (olive, full-width, mt-4)
  → PATCH /api/account/profile
  → Toast "Profile updated ✓"

DIVIDER

PASSWORD SECTION:
  "Change Password" (Jost 11px uppercase tracking, dark-grey, mb-4)
  Current Password (Input, password type)
  New Password (Input, password type)
  Confirm Password (Input, password type)
  [Update Password] button (outlined, full-width)
  → PATCH /api/account/profile/password

DIVIDER

PREFERENCES SECTION:
  "Display" (Jost 11px uppercase tracking, dark-grey)
  Dark mode toggle row:
    "Dark Mode" label + DarkModeToggle component
    Note: "Affects storefront preview only"

FOOTER (border-top, padding 16px 24px):
  [← Back to Store] link (Jost 12px, dark-grey) → /
  [Logout] button (Jost 12px, red-500 hover) → signOut({ callbackUrl: '/admin-login' })
```

### C2 — Customer Profile Panel (top-right in account)

**Update `src/components/account/AccountLayout.tsx`**:

Add to the account topbar/header area:

```typescript
// TOP-RIGHT of account layout (both desktop and mobile):
//   User avatar (32px circle, wine bg, white initials, or photo)
//   "Logout" button (Jost 12px, text only, LogOut icon)
//     onClick: signOut({ callbackUrl: '/' })
//   
//   Avatar is clickable → opens CustomerProfileDrawer (right-side drawer)
```

**Create `src/components/account/CustomerProfileDrawer.tsx`**:

```
WIDTH: 360px, same slide-from-right animation

HEADER:
  "Account" (Bodoni Moda 20px)
  X close

CONTENT:

AVATAR + NAME:
  64px circle (wine bg or photo)
  [Change Photo]: POST /api/admin/upload (reuse same endpoint)
  Name + email below
  Points balance: "[X] pts" (olive badge)

PROFILE FORM:
  First Name, Last Name, Phone
  [Save Changes] → PATCH /api/account/profile

DIVIDER

PAYMENT PREFERENCES (new section):
  "Payment Preferences" (Jost 11px uppercase, dark-grey)
  
  PREFERRED GATEWAY:
    Radio cards (compact):
      ● Paystack (NGN — recommended for Nigeria)
      ○ Flutterwave
      ○ Stripe (USD/GBP)
      ○ Monnify
    [Save Preference] → PATCH /api/account/profile { preferredGateway }
    Note: "Your preferred payment method at checkout"
  
  SAVED CARDS:
    List of SavedPaymentMethod records for this user
    
    Each saved card:
      Card brand icon (Visa/Mastercard/Verve) + "•••• [last4]"
      Expiry: "[month/year]"
      Gateway badge (Paystack / Stripe)
      [Default] toggle
      [Remove] button → DELETE /api/account/payment-methods/[id]
    
    [+ Add New Card] button:
      For Paystack: 
        Shows Paystack inline modal (use Paystack.js popup with ₦50 charge)
        On success: save authorization_code as SavedPaymentMethod
        Note: "A ₦50 test charge will be made and refunded immediately"
      
      For Stripe:
        Shows Stripe Payment Element (setup intent, not payment intent)
        No charge — just saves card
        On success: save stripePaymentMethodId
    
    Max 3 saved cards per gateway

DIVIDER

DARK MODE TOGGLE:
  Same as admin — "Display Preferences"
  DarkModeToggle component

FOOTER:
  [Logout] button (full-width, outlined, LogOut icon, hover red)
  → signOut({ callbackUrl: '/' })
```

---

## TASK D — SAVED PAYMENT METHODS API

**`src/app/api/account/payment-methods/route.ts`** (GET, POST):
```typescript
// GET: Return user's SavedPaymentMethods
//   Auth required
//   Return: { methods: SavedPaymentMethod[] (card details only, no secret tokens) }
//   Never return: paystackAuthCode, stripePaymentMethodId (these are server-side only)

// POST: Save new payment method
//   Auth required
//   Body (Paystack): { gateway: 'PAYSTACK', authCode, last4, brand, expiry, email }
//   Body (Stripe):   { gateway: 'STRIPE', paymentMethodId, last4, brand, expiry }
//   
//   For Paystack: verify authCode is valid before saving
//     GET https://api.paystack.co/customer/[email] to verify card exists
//   For Stripe:
//     Create Stripe customer if not exists
//     Attach payment method to customer
//   
//   If isDefault: set all other methods for this user isDefault: false first
//   Create SavedPaymentMethod
//   Return: { success: true, method: SafePaymentMethod }
```

**`src/app/api/account/payment-methods/[id]/route.ts`** (PATCH, DELETE):
```typescript
// PATCH: { isDefault?: boolean, nickname?: string }
//   If isDefault: clear others first ($transaction)

// DELETE:
//   If Stripe: stripe.paymentMethods.detach(stripePaymentMethodId)
//   Delete DB record
//   Return { success: true }
```

**`src/app/api/account/profile/route.ts`** (PATCH — update existing):
```typescript
// Add: preferredGateway field to allowed update fields
// Validate: must be valid PaymentGateway enum value
```

---

## TASK E — SHIPPING ZONES (WORKING CRUD)

The shipping zones page exists but admin can't add new zones. Fix it completely.

**Update `src/app/(admin)/admin/shipping/page.tsx`**:

```typescript
// Server: fetch all ShippingZones
// Pass to ShippingZonesClient
```

**Create `src/components/admin/ShippingZonesClient.tsx`** (full client):

```
PAGE HEADER:
  "Shipping Zones" (Bodoni Moda 24px)
  "[N] zones configured" (Jost 13px, dark-grey)
  [+ Add Zone] button (olive, right)

ZONES LIST (white, border 1px #EBEBEA, divided):
  Each zone card (padding 20px 24px, border-bottom 1px #F5F5F3):
    LEFT:
      Zone name (Jost 14px weight-500 black)
      Countries (Jost 12px, dark-grey): "Nigeria (NG)"
      States if NG (Jost 11px, dark-grey): "Lagos only" | "All states"
    
    MIDDLE:
      Flat Rate: "₦[X]" (Jost 14px black)
      Per KG: "+ ₦[X]/kg" (Jost 12px, dark-grey) — if > 0
      Free Above: "Free above ₦[X]" (Jost 12px, olive) — if set
    
    RIGHT:
      Estimated Days (Jost 12px, dark-grey)
      Active toggle
      [Edit] button | [Delete] button
    
  Empty: "No shipping zones configured yet. Add your first zone."
  [+ Add Zone] centered button

[+ Add Zone] / [Edit] → opens ShippingZoneModal
```

**Create `src/components/admin/ShippingZoneModal.tsx`**:

```
Radix Dialog, width 560px, NO border-radius

FORM (React Hook Form + Zod):

Zone Name (Input, required):
  e.g. "Lagos", "Other Nigeria", "United Kingdom"

Countries (multi-select with search):
  Common options pre-listed:
    🇳🇬 Nigeria (NG)
    🇬🇧 United Kingdom (GB)
    🇺🇸 United States (US)
    🇦🇺 Australia (AU)
    🇨🇦 Canada (CA)
    🇩🇪 Germany (DE)
    🇫🇷 France (FR)
    🇦🇪 UAE (AE)
    🇿🇦 South Africa (ZA)
    🇬🇭 Ghana (GH)
  + Text input to add any ISO code manually
  Multi-select: chips with X to remove

Nigerian States (only shows if NG is in countries):
  Toggle: "All Nigerian States" OR "Specific States"
  If specific: multi-select of Nigerian states:
    Lagos, Abuja, Rivers, Oyo, Kano, Enugu, Anambra, Imo, Edo,
    Delta, Cross River, Akwa Ibom, Ogun, Osun, Ekiti, [all 36 + FCT]

Pricing:
  Flat Rate NGN (₦ number input, required)
  Per KG NGN (₦ number input, default 0):
    Helper: "Additional charge per kg of product weight"
  Free Shipping Above NGN (₦ number input, optional):
    Placeholder: "Leave blank — never free"
    Helper: "Order subtotal above this amount gets free shipping"

Estimated Delivery:
  Text input: e.g. "1–2 business days"

Active: Toggle (default ON)

FOOTER:
  [Cancel] [Save Zone] (olive)

Submit:
  Create: POST /api/admin/shipping
  Edit: PATCH /api/admin/shipping/[id]
  On success: close modal, refresh list, toast "Shipping zone saved ✓"
```

**Ensure API routes exist and work:**

**`src/app/api/admin/shipping/route.ts`** (GET, POST):
```typescript
// GET: all shipping zones, orderBy name asc
// POST: create ShippingZone (validate with Zod)
//   Required: name, countries (array), flatRateNGN, estimatedDays
//   Optional: states, perKgNGN (default 0), freeAboveNGN, isActive (default true)
```

**`src/app/api/admin/shipping/[id]/route.ts`** (GET, PATCH, DELETE):
```typescript
// PATCH: partial update, same validation
// DELETE: check no orders use this zone in PENDING/CONFIRMED/PROCESSING status
//   If orders exist: return 409 "Cannot delete — active orders use this zone"
//   Else: delete
```

---

## TASK F — TEAM MANAGEMENT (ADMIN USER INVITATIONS)

### F1 — Team Page

**Create `src/app/(admin)/admin/team/page.tsx`** (Server Component):

```typescript
// Fetch: all users where role IN ['ADMIN', 'SUPER_ADMIN']
// Fetch: all pending TeamInvitations (acceptedAt: null, expiresAt > now)
// Pass to TeamClient
```

Add to AdminSidebar under SYSTEM:
```typescript
// Users icon, "Team", /admin/team
```

**Create `src/components/admin/TeamClient.tsx`**:

```
PAGE HEADER:
  "Team" (Bodoni Moda 24px)
  "[N] members" (Jost 13px, dark-grey)
  [+ Invite Admin] button (olive, right)

CURRENT MEMBERS TABLE:
  Title: "Active Members" (Jost 11px uppercase, dark-grey, mb-3)
  
  Table (white, border 1px #EBEBEA):
    Columns: Avatar | Name + Email | Role | Joined | Last Login | Actions
    
    Avatar: 32px circle, olive bg, white initials (or photo)
    Role badge:
      SUPER_ADMIN: bg-[#37392d] text-white "Super Admin"
      ADMIN: bg-[#F0E8FF] text-[#6B3FAD] "Admin"
    
    Actions:
      [Change Role] dropdown (ADMIN ↔ SUPER_ADMIN) — SUPER_ADMIN only
      [Remove] button (red, confirm dialog) — SUPER_ADMIN only
        Cannot remove yourself
        Cannot remove last SUPER_ADMIN

PENDING INVITATIONS TABLE (below, if any):
  Title: "Pending Invitations" (Jost 11px uppercase, dark-grey, mb-3)
  
  Columns: Email | Role | Invited By | Expires | Actions
  Expired invitations shown with red "Expired" badge
  Actions: [Resend] | [Cancel]

[+ Invite Admin] → opens InviteAdminModal
```

### F2 — Invite Admin Modal

**Create `src/components/admin/InviteAdminModal.tsx`**:

```
Radix Dialog, width 480px

HEADER: "Invite Team Member"

FORM:
  Email Address (Input, required, type email):
    Validate: not already a user, not already invited
  
  Role (radio cards):
    ● Admin
      "Can manage products, orders, bespoke, and customers.
       Cannot manage team or payment credentials."
    ○ Super Admin
      "Full access including team management and payment settings."
  
  Personal Message (textarea, optional, max 300 chars):
    Placeholder: "Add a personal note to the invitation email..."

PREVIEW (below form, bg-[#FAFAF8], border 1px #EBEBEA, p-4):
  "The invitation email will look like this:"
  ┌─────────────────────────────────┐
  │ You've been invited to join     │
  │ Prudent Gabriel Admin Portal    │
  │ as [role].                      │
  │ [personal message if set]       │
  │ [Accept Invitation →] button    │
  │ Link expires in 72 hours.       │
  └─────────────────────────────────┘

[Cancel] [Send Invitation] (olive)
```

### F3 — Invitation API Routes

**`src/app/api/admin/team/invite/route.ts`** (POST):
```typescript
// Auth required, SUPER_ADMIN only
// Body: { email, role: 'ADMIN'|'SUPER_ADMIN', message? }
//
// Checks:
//   1. Email not already a user → return 409 "User already exists"
//   2. No pending invitation for this email → upsert (replace existing)
//   3. Inviting admin is SUPER_ADMIN → return 403 if not
//
// Create TeamInvitation:
//   token: nanoid(32)
//   expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000)
//   invitedBy: session.user.id
//
// Send invitation email:
//   To: email
//   Subject: "You've been invited to join Prudent Gabriel Admin"
//   Body:
//     "Hi, you've been invited to join the Prudent Gabriel admin team as [role]."
//     If message: "[message]"
//     [Accept Invitation] button → NEXT_PUBLIC_APP_URL + /admin/accept-invite?token=[token]
//     "This link expires in 72 hours."
//
// Return: { success: true }
```

**`src/app/api/admin/team/route.ts`** (GET):
```typescript
// Fetch all admin users + pending invitations
// SUPER_ADMIN only
```

**`src/app/api/admin/team/[userId]/route.ts`** (PATCH, DELETE):
```typescript
// PATCH: { role: 'ADMIN'|'SUPER_ADMIN' } — change role
//   Cannot change own role
//   Cannot demote last SUPER_ADMIN
//
// DELETE: Remove admin (set role to CUSTOMER, or delete if no orders)
//   Cannot remove self
//   Cannot remove last SUPER_ADMIN
```

**`src/app/api/admin/invitations/[token]/cancel/route.ts`** (DELETE):
```typescript
// Delete TeamInvitation by token
// SUPER_ADMIN only
```

### F4 — Accept Invitation Page

**Create `src/app/accept-invite/page.tsx`** (public — no auth):

```typescript
// URL: /accept-invite?token=[token]
// 
// Server: validate token
//   Fetch TeamInvitation where token = params.token
//   If not found: show "Invalid invitation link"
//   If expired (expiresAt < now): show "This invitation has expired. Contact the admin."
//   If acceptedAt set: show "This invitation has already been accepted."
//   If valid: render AcceptInviteClient
```

**`src/components/auth/AcceptInviteClient.tsx`** (client):

```
LAYOUT: Same split layout as /auth/login
  Left: olive panel with logo + "Join the Team"
  Right: form

FORM:
  Heading: "Create Your Admin Account"
  Email: pre-filled from invitation (disabled, locked)
  Role: pre-filled (disabled, shows badge)
  
  First Name (Input, required)
  Last Name (Input, required)
  Password (Input, min 8 chars, strength indicator)
  Confirm Password (Input)
  
  [Create Account] button (olive, full-width)
  
  On submit: POST /api/auth/accept-invite
    { token, firstName, lastName, password }
    Creates User with role from invitation
    Marks invitation acceptedAt: new Date()
    Auto-signs in
    Redirects to /admin
```

**`src/app/api/auth/accept-invite/route.ts`** (POST):
```typescript
// Body: { token, firstName, lastName, password }
//
// In $transaction:
//   1. Fetch + validate TeamInvitation
//   2. Check email not already taken
//   3. Hash password (bcrypt 12)
//   4. Create User {
//        firstName, lastName,
//        email: invitation.email,
//        password: hashed,
//        role: invitation.role,
//        emailVerified: new Date(),  // auto-verified via invite
//        referralCode: nanoid(8),
//      }
//   5. Mark invitation: acceptedAt: new Date()
//
// Sign in automatically using credentials
// Return: { success: true } → client redirects to /admin
```

---

## TASK G — LOGOUT BUTTONS

### G1 — Admin logout (topbar)

Already covered in Task C1 (AdminProfileDrawer footer + topbar text button).

Verify logout button is visible in AdminTopbar WITHOUT needing to open the drawer:
```typescript
// In AdminTopbar RIGHT section (after bell, after avatar):
//   "Logout" text link (Jost 11px, dark-grey)
//   LogOut icon (14px) left of text
//   hover: text-red-500 + icon-red-500
//   onClick: signOut({ callbackUrl: '/admin-login' })
//   
//   This is ALWAYS VISIBLE — not hidden in a menu
```

### G2 — Customer account logout

**Update `src/components/account/AccountSidebar.tsx`** (or AccountLayout):
```typescript
// At the bottom of account sidebar (desktop):
//   "Logout" button (full-width of sidebar)
//   LogOut icon + "Logout" text
//   Jost 13px, charcoal
//   hover: bg-red-50 text-red-600
//   onClick: signOut({ callbackUrl: '/' })
//
// On mobile (bottom tab bar area):
//   "Logout" option in the overflow/menu

// Also: top-right of account layout header:
//   Small "Logout" text link (Jost 12px, dark-grey, hover red)
```

---

## TASK H — CONNECT ADMIN PANEL GAPS

### H1 — Payments page (new admin page)

The sidebar shows "Payments" but no page exists. Create it:

**Create `src/app/(admin)/admin/payments/page.tsx`**:

```typescript
// Server: fetch recent payments (orders with paymentStatus PAID, last 30 days)
// Include: gateway breakdown
// Pass to PaymentsClient
```

**Create `src/components/admin/PaymentsClient.tsx`**:

```
PAGE HEADER:
  "Payments" (Bodoni Moda 24px)

STATS ROW (4 cards):
  Total Revenue (all time)
  Revenue This Month
  Avg Order Value
  Refunds Issued

GATEWAY BREAKDOWN (horizontal bar chart or simple table):
  Paystack | Flutterwave | Stripe | Monnify
  Show: transaction count + total ₦

RECENT TRANSACTIONS TABLE:
  Order # | Customer | Amount | Gateway | Status | Date | Action
  [View Order] links to /admin/orders/[id]

FILTER: Date range + Gateway + Status
```

### H2 — Fix Payments sidebar link

**Update `src/components/admin/AdminSidebar.tsx`**:
```typescript
// Verify "Payments" links to /admin/payments (not a dead link)
// Add CreditCard icon
```

### H3 — Connect all sidebar links

Audit every sidebar link and ensure the page exists:
```typescript
// CATALOGUE:
//   Products → /admin/products ✓
//   Bespoke → /admin/bespoke ✓
//   Consultations → /admin/consultations ✓
//   Consultants → /admin/consultants ✓
//   Reviews → /admin/reviews ✓
//   Gallery → /admin/gallery ✓

// COMMERCE:
//   Orders → /admin/orders ✓
//   Payments → /admin/payments ← CREATE THIS (Task H1)
//   Coupons → /admin/coupons ✓
//   Shipping Zones → /admin/shipping ✓

// CUSTOMERS:
//   All Customers → /admin/customers ✓
//   Referral Analytics → /admin/referrals ✓

// SYSTEM:
//   Team → /admin/team ← CREATE (Task F)
//   Notifications → /admin/notifications ← CREATE (Task B2)
//   Settings → /admin/settings ✓
//   Gallery → /admin/gallery ✓ (already added)

// For any link that 404s: create a minimal page with "Coming soon" OR connect it
```

---

## TASK I — SEED FIX

Fix the `balancePaystackRef` error from the previous session:

**Check `prisma/seed.ts`** around line 581:
```typescript
// Find the BespokeRequest upsert that uses balancePaystackRef
// This field was added to the schema but may not have been pushed to DB
// 
// Solution A (preferred): 
//   Run npx prisma db push first, then seed
//   The field should now exist
//
// Solution B (if field doesn't exist in schema):
//   Remove balancePaystackRef from the seed upsert data
//   It was likely added erroneously
//
// After fix: npx prisma db push && npx prisma db seed should complete without errors
```

---

## FINAL CHECKS

```bash
npx prisma generate
npx prisma db push
npx prisma db seed
npx tsc --noEmit    # must pass
npx next build      # must pass
```

Verify:
```
/atelier               → Pinterest masonry (varying heights), 24 images, Load More
/bridesals             → Same masonry, bridal palette
/admin/gallery         → Upload image → appears in gallery immediately (Cloudinary)
/admin/notifications   → Full notifications page
Admin topbar           → Bell → notification drawer slides from RIGHT
Admin topbar           → "Logout" always visible top-right
Admin topbar           → Avatar click → profile drawer slides from right
/admin/shipping        → [+ Add Zone] modal works end-to-end
/admin/team            → Lists admin users + [Invite Admin] modal
/accept-invite?token=X → Set password form works
/account               → "Logout" visible in sidebar + top-right
/account               → Avatar click → customer profile drawer (gateway prefs + saved cards)
/admin/payments        → Payments page loads
All sidebar links      → No dead links (no 404s)
```

---

## SESSION END FORMAT

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SESSION 12 COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Task A — Gallery masonry fix (CSS columns, natural heights, 24 limit, load more)
✅ Task B — Notification drawer (right-side slide) + /admin/notifications page
✅ Task C — Admin profile drawer + Customer profile drawer
✅ Task D — Saved payment methods API (Paystack + Stripe)
✅ Task E — Shipping zones CRUD (working add/edit/delete modal)
✅ Task F — Team management (invite, accept invite, role change, remove)
✅ Task G — Logout buttons (admin topbar always visible + account sidebar)
✅ Task H — Admin panel connections (Payments page, all sidebar links working)
✅ Task I — Seed fix (balancePaystackRef error resolved)

Build: ✅ passes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

*Prudent Gabriel · Session 12*
*Prepared by Nony | SonsHub Media*
