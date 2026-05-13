# CURSOR SESSION PROMPT — SESSION 4
## Stage 7: Admin Dashboard · Stage 9: Email Templates · Final Polish
### Prudential Atelier · Picks up from Session 3 completion

---

> ## ⚠️ MANDATORY PRE-FLIGHT — READ BEFORE TOUCHING ANY FILE
>
> 1. **Never recreate a file that already exists.** Use Read File to check first.
> 2. **Never use `any` types.** Derive types from Prisma client or define explicit interfaces.
> 3. **All admin API routes must verify role server-side** — check `session.user.role` in EVERY admin route handler, not just middleware. Return 403 if not ADMIN or SUPER_ADMIN.
> 4. **`lucide-react` in this repo has no `Instagram`/`Facebook` exports** — use `src/components/icons/SocialIcons.tsx`.
> 5. **Admin area is dark-themed** — bg `#0F0F0F` page, `#1A1A1A` sidebar, `#1E1E1E` cards. Gold accents. Never use ivory/cream backgrounds in admin.
> 6. After every task: `npx tsc --noEmit` must pass.
> 7. Complete every function fully. No `// TODO`, no placeholder returns.

---

## WHAT IS ALREADY BUILT (do not rebuild)

### ✅ Complete (Sessions 1–3)
- Full auth, all auth pages, referral cookie
- All global components (Navbar, Footer, CartDrawer, SearchModal, ProductCard, etc.)
- Full shop + product detail pages
- Complete checkout flow (3-step, all 4 gateways, webhooks)
- Account dashboard (all 7 pages + all account API routes)
- Bespoke page + API
- Our Story, Contact, Legal pages, 404
- Libraries: `lib/coupon.ts`, `lib/shipping.ts`, `lib/points.ts`, `lib/payments/*`, `lib/email.ts`, `lib/order-number.ts`
- `src/app/admin/page.tsx` — minimal shell only

### ❌ NOT YET BUILT (this session)
- Admin layout, sidebar, topbar
- Admin: Products (list, create, edit with VariantManager)
- Admin: Orders (list, detail, status update)
- Admin: Bespoke Requests (list, detail, status update)
- Admin: Coupons (list, create)
- Admin: Shipping Zones (list, create/edit)
- Admin: Customers (list, detail)
- Admin: Reviews moderation
- Admin: Analytics dashboard (charts, KPIs)
- Admin: Upload API
- All admin API routes
- React Email templates (upgrade from inline HTML in `lib/email.ts`)

---

## PRISMA — CHECK THESE EXIST

Before writing code, verify these models/fields exist in `prisma/schema.prisma`.
Add only what is missing, then run `npx prisma generate`:

```prisma
// Verify OrderStatus has all values:
enum OrderStatus {
  PENDING
  CONFIRMED
  PROCESSING
  SHIPPED
  DELIVERED
  CANCELLED
  REFUNDED
}

// Verify PaymentGateway enum exists:
enum PaymentGateway {
  PAYSTACK
  FLUTTERWAVE
  STRIPE
  MONNIFY
}

// Verify Role enum:
enum Role {
  CUSTOMER
  ADMIN
  SUPER_ADMIN
}

// Verify Product has: metaTitle, metaDescription, lowStockAt (Int @default(3))
// Verify ProductVariant has: sortOrder (Int @default(0))
// Verify Review has: isApproved (Boolean @default(false)), helpfulCount (Int @default(0))
```

---

## TASK A — ADMIN LAYOUT & NAVIGATION

### A1 — Admin Layout

**`src/app/(admin)/layout.tsx`** (Server Component)
```typescript
// auth() — if no session OR role not in ['ADMIN', 'SUPER_ADMIN']:
//   redirect('/auth/login?callbackUrl=/admin')
// Render AdminShell (client component) passing session as prop
```

**`src/components/admin/AdminShell.tsx`** (client component)
```typescript
// Props: { session: Session, children: React.ReactNode }
// Overall: flex, h-screen, overflow-hidden, bg-[#0F0F0F]
```

**`src/components/admin/AdminSidebar.tsx`** (client component)
```
Width: 240px, fixed height, overflow-y-auto
Background: #1A1A1A
Border-right: 1px solid rgba(201,168,76,0.15)

TOP:
  Logo (white version), link to /admin
  Below logo: thin gold divider line

NAVIGATION (mt-6):
  Grouped sections with section labels:

  SECTION: "OVERVIEW"
    LayoutDashboard  "Dashboard"           /admin
  
  SECTION: "CATALOGUE" (mt-6, section label gold/40, 10px uppercase)
    Package          "Products"            /admin/products
    Scissors         "Bespoke Requests"    /admin/bespoke
    Star             "Reviews"             /admin/reviews
  
  SECTION: "COMMERCE" (mt-6)
    ShoppingCart     "Orders"              /admin/orders
    Tag              "Coupons"             /admin/coupons
    Truck            "Shipping Zones"      /admin/shipping
  
  SECTION: "CUSTOMERS" (mt-6)
    Users            "All Customers"       /admin/customers
    TrendingUp       "Referral Analytics"  /admin/referrals
  
  SECTION: "SYSTEM" (mt-6)
    Settings         "Settings"            /admin/settings

  NAV ITEM STYLE:
    Default: flex items-center gap-3, px-3 py-2.5, rounded-sm
             text-[#8A8A8A], text-[13px], icon 16px
             hover: bg-[#252525], text-ivory/80
    Active (pathname match):
             bg-[#6B1C2A]/20, text-[#C9A84C], gold left border 2px

BOTTOM (mt-auto, border-t border-gold/10, pt-4):
  User row: initials circle (wine bg, 32px) + name + role badge
  [← Back to Store] link → / (text-[#8A8A8A], hover:text-gold)
  [Sign Out] button (text-[#8A8A8A], LogOut icon, hover:text-red-400)

usePathname() for active state detection.
```

**`src/components/admin/AdminTopbar.tsx`** (client component)
```
Height: 56px, bg-[#1A1A1A], border-b border-gold/10
Padding: 0 24px
Flex: items-center justify-between

LEFT: 
  Breadcrumb: "Admin / [Page Name]"
  Page name derived from usePathname() — capitalize last segment

RIGHT:
  Bell icon (Lucide Bell, #8A8A8A) — badge if pending bespoke > 0
  Admin avatar (initials circle, 32px, wine bg, gold text)
```

**Update `src/app/(admin)/layout.tsx`** to render:
```
AdminSidebar (fixed left) + flex-col main: AdminTopbar + overflow-y-auto content
Content area: p-8, bg-[#0F0F0F]
```

---

## TASK B — ADMIN ANALYTICS DASHBOARD

**`src/app/(admin)/admin/page.tsx`** — Replace shell with full implementation.

```typescript
// Server component
// Auth check (role guard)
// Fetch analytics data for default period (last 30 days):
//   Promise.all([
//     prisma.order.aggregate({ where: { paymentStatus: 'PAID', createdAt: { gte: thirtyDaysAgo } },
//       _sum: { totalNGN: true }, _count: { id: true } }),
//     prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo }, role: 'CUSTOMER' } }),
//     prisma.order.count({ where: { status: 'PENDING' } }),
//     prisma.bespokeRequest.count({ where: { status: 'PENDING' } }),
//     prisma.review.count({ where: { isApproved: false } }),
//     // Revenue by day (last 30): group by date
//     prisma.order.findMany({
//       where: { paymentStatus: 'PAID', createdAt: { gte: thirtyDaysAgo } },
//       select: { totalNGN: true, createdAt: true },
//       orderBy: { createdAt: 'asc' }
//     }),
//     // Recent orders (last 10)
//     prisma.order.findMany({
//       orderBy: { createdAt: 'desc' }, take: 10,
//       include: { items: { take: 1, include: { product: { select: { name: true } } } } }
//     }),
//     // Out of stock variants
//     prisma.productVariant.findMany({
//       where: { stock: 0 },
//       include: { product: { select: { name: true, slug: true } } },
//       take: 5
//     }),
//   ])
// Pass all data as props to AdminDashboardClient
```

**`src/components/admin/AnalyticsDashboard.tsx`** (client component)
```
KPI CARDS ROW (4 cards, grid 2×2 mobile, 4×1 desktop):
  
  Card style: bg-[#1E1E1E], border border-gold/10, rounded-sm, p-6
  
  Card 1 — Revenue (30 days):
    Label: "Revenue (30 days)" (text-[#8A8A8A], 12px uppercase)
    Value: "₦[X,XXX,XXX]" (text-white, Display S, Cormorant)
    Sub: "+[X]% vs prev 30 days" (green if positive, red if negative)
    Icon: TrendingUp (gold, right side)
  
  Card 2 — Total Orders (30 days):
    Value: "[X] orders"
    Sub: "[X] pending payment"
  
  Card 3 — New Customers (30 days):
    Value: "[X] customers"
    Sub: "[X] via referral"
  
  Card 4 — Pending Actions:
    Value: "[X]" (red if > 0)
    Sub: "[X] bespoke · [X] reviews · [X] orders"
    Clicking navigates to most urgent section

REVENUE CHART (below KPIs):
  Recharts ResponsiveContainer + LineChart
  Data: daily revenue aggregated from orders
  Line: stroke #C9A84C (gold), strokeWidth 2, dot false
  Area fill: gold/10
  XAxis: day labels (short format, e.g. "Jan 5"), text #8A8A8A
  YAxis: formatted ₦ values, text #8A8A8A
  Tooltip: custom — bg-[#252525], wine border, ivory text, ₦ formatted
  Grid: stroke #2A2A2A (subtle)
  bg-[#1E1E1E] container

RECENT ORDERS TABLE:
  Title: "Recent Orders" + [View All] link (gold)
  
  Table: bg-[#1E1E1E], no outer border
  Header: text-[#8A8A8A], 11px uppercase, border-b border-gold/10
  Columns: Order # | Customer | Items | Total | Gateway | Status | Date
  
  Row hover: bg-[#252525]
  Status badges: same colors as customer-facing
  Each row links to /admin/orders/[id]

ALERT PANELS ROW (3 panels):
  
  Panel 1 — Out of Stock (bg-[#1E1E1E]):
    Title: "Out of Stock" + count badge (red)
    List: product name + size (variant) + [Edit] link
    If none: "All variants are in stock ✓" (green)
  
  Panel 2 — Pending Bespoke (bg-[#1E1E1E]):
    Title: "Bespoke Requests" + count badge
    List: request number + name + occasion + date
    [Review All] link
  
  Panel 3 — Expiring Coupons (bg-[#1E1E1E]):
    Title: "Coupons Expiring Soon" (within 7 days)
    List: code + expiry date + uses remaining
    If none: "No coupons expiring soon ✓"
```

---

## TASK C — ADMIN PRODUCTS

### C1 — Products List

**`src/app/(admin)/admin/products/page.tsx`** (Server Component)

```typescript
// Fetch products with pagination (default 20 per page)
// searchParams: search, category, type, page, sort, published, stock
// Include: images (primary only), variants (count + min price), _count: { orderItems }
// Pass to ProductsTable client component
```

**`src/components/admin/ProductsTable.tsx`** (client component)
```
TOOLBAR:
  Left: Search input (searches name + slug, debounced 300ms → updates URL)
  Right: Filters row:
    Category select | Type select | Status select (All/Published/Draft) | Stock select (All/In Stock/Out of Stock)
  [+ Add Product] button (wine bg, gold text, right of toolbar)

TABLE (TanStack Table v8 — already installed):
  Columns:
    [✓] Checkbox (bulk select)
    Image: 40×52px thumbnail (primary image)
    Name + slug (Name bold ivory, slug small gold)
    Category: Badge
    Type: "RTW" | "Bespoke" badge
    Variants: "[N] sizes · From ₦[min]"
    Stock: total stock across all variants (red if 0, amber if < 10, green)
    Featured: toggle switch (PATCH /api/admin/products/[id] { isFeatured })
    Published: toggle switch (PATCH /api/admin/products/[id] { isPublished })
    Actions: Edit (pencil icon → /admin/products/[id]/edit), Delete (trash icon)
  
  BULK ACTIONS (appear when rows selected):
    [Delete Selected] (confirm dialog first)
    [Publish Selected]
    [Unpublish Selected]
    [Toggle Featured]
  
  Row click (not on controls): navigate to /admin/products/[id]/edit
  
  Pagination: bottom, items per page select (10/20/50), prev/next

DELETE CONFIRMATION:
  Radix AlertDialog
  "Delete [product name]? This action cannot be undone."
  [Cancel] [Delete] (red)
  On confirm: DELETE /api/admin/products/[id]
  Optimistic remove from table + toast "Product deleted"
```

### C2 — Product Form (Create + Edit)

**`src/app/(admin)/admin/products/new/page.tsx`** (Server Component → renders ProductFormPage)
**`src/app/(admin)/admin/products/[id]/edit/page.tsx`** (Server Component → fetches product → renders ProductFormPage)

**`src/components/admin/ProductFormPage.tsx`** (client component)
```typescript
// Props: { product?: FullProduct }  — undefined for create, populated for edit
// mode: 'create' | 'edit' derived from product prop
```

```
LAYOUT: Full page, two sections

HEADER:
  Back link: ← Products
  Title: "Add New Product" | "Edit: [product name]"
  Right: [Save Draft] [Publish] buttons
  
  Auto-save indicator: "Saving..." | "Saved ✓" | "Unsaved changes" (subtle, top-right)

TWO-COLUMN LAYOUT (lg: 2/3 left + 1/3 right):

LEFT COLUMN:

  SECTION: "Basic Information" (card: bg-[#1E1E1E], border, p-6, mb-4):
    Product Name (Input, required)
      → on blur: auto-generate slug if slug field is empty
    
    Slug (Input, below name):
      Pre-filled from name, editable
      Live preview: "prudentialatelier.com/shop/[slug]" (small gold text below)
    
    Short Description (Textarea, max 200 chars, char counter)
    Full Description (Tiptap rich text editor):
      Toolbar: Bold, Italic, Bullet list, Numbered list, Heading 2/3
      Minimal styling, ivory text on dark bg
    
    Product Details (Tiptap, second editor):
      Label: "Materials & Care (shown in accordion)"
      Same toolbar

  SECTION: "Media" (card):
    IMAGE UPLOADER:
      Drag-and-drop zone:
        Border: 2px dashed gold/30
        On drop OR click: open file picker, accept image/*
        Multiple files allowed (max 10)
        Each file → POST /api/admin/upload → returns { url, publicId }
        Show upload progress bar per image
      
      UPLOADED IMAGES GRID (3 columns):
        Each: thumbnail + delete X + "Set Primary" star button
        Drag to reorder (react-beautiful-dnd OR simple up/down arrows)
        Primary image: gold star filled, ring-2 ring-gold
        Non-primary: grey star outline
        Delete: removes from list (+ DELETE /api/admin/upload/[publicId] optionally)

  SECTION: "Variants & Pricing" (card):
    This is the most important section. Read carefully.
    
    BASE PRICING (fallback, used when no variant override):
      3-column row: Base Price NGN (required) | Base Price USD (optional) | Base Price GBP (optional)
      Small note: "Leave USD/GBP blank to use live exchange rates"
    
    SALE PRICING:
      Toggle: "Product is on sale"
      If toggled: "Sale ends" date-time picker (saleEndsAt)
    
    VARIANT MANAGER (VariantManager.tsx — extract as sub-component):
      
      Table of size variants. Each row:
        Size Label (text input, e.g. "S", "UK 10", "Age 4-5")
        SKU (text input, auto-generated: PA-[SLUG6]-[SIZE], editable)
        Price NGN (number input, required)
        Price USD (optional)
        Price GBP (optional)
        Sale Price NGN (optional — overrides base sale for this variant)
        Stock (number input, min 0)
        Low Stock At (number input, default 3)
        Delete row (X, disabled if only 1 row)
      
      [+ Add Size] button: appends a new empty row
      
      Quick-fill: "Apply ₦[basePriceNGN] to all variants" button
      
      Validation: every row needs Size label + priceNGN ≥ 0 + stock ≥ 0
    
    COLORS:
      Color entries list:
        Name text input + hex color picker (<input type="color"> + hex text input) + optional image URL + delete X
      [+ Add Colour] button

  SECTION: "Complete the Look" (card):
    Product search input (searches /api/products?search=&limit=5)
    Results dropdown → click to add
    Added products show as removable pills (name + X)
    Max 4 bundle items
    Note: "These products appear as suggestions on this product's page"

RIGHT COLUMN:

  SECTION: "Status" (card: bg-[#1E1E1E], sticky top-6):
    [Save as Draft] button (full-width, outlined)
    [Publish] button (full-width, wine bg)
    
    Status toggles (toggle switches):
      Published (isPublished)
      Featured on Homepage (isFeatured)
      New Arrival Badge (isNewArrival)
      Bespoke Available (isBespokeAvail)
    
    Created: [date] (if edit mode)
    Last updated: [date] (if edit mode)
    
    [Delete Product] link (small, red, at bottom):
      Only in edit mode
      Opens confirmation dialog before delete

  SECTION: "Organisation" (card):
    Category (Radix Select, required):
      Options: Bridal, Evening Wear, Casual, Formal, Kiddies, Accessories
    
    Product Type (radio: RTW | Bespoke)
    
    Tags (tag input — type + Enter to add, X to remove):
      Existing tags as removable chips
      Placeholder: "Add tag (e.g. bridal, modest)..."

  SECTION: "SEO" (card):
    Meta Title (Input, max 60, char counter)
    Meta Description (Textarea, max 160, char counter)
    Preview box:
      Simulated Google result:
        Title (blue link): meta title or product name
        URL (green): prudentialatelier.com/shop/[slug]
        Description (grey): meta description

FORM SUBMISSION:
  [Save as Draft]: sets isPublished: false → POST or PATCH
  [Publish]:       sets isPublished: true → POST or PATCH
  
  On success (create): redirect to /admin/products/[newId]/edit + toast "Product created ✓"
  On success (edit):   stay on page + toast "Changes saved ✓"
  On error:            toast error message, stay on page

React Hook Form with Zod: productAdminSchema (create in src/validations/product.ts)
```

**`src/validations/product.ts`**
```typescript
// productAdminSchema: z.object({
//   name:           z.string().min(2).max(200),
//   slug:           z.string().min(2).max(200).regex(/^[a-z0-9-]+$/),
//   description:    z.string().optional(),
//   details:        z.string().optional(),
//   category:       z.nativeEnum(ProductCategory),
//   type:           z.nativeEnum(ProductType),
//   tags:           z.array(z.string()).default([]),
//   basePriceNGN:   z.number().positive(),
//   basePriceUSD:   z.number().positive().optional(),
//   basePriceGBP:   z.number().positive().optional(),
//   isOnSale:       z.boolean().default(false),
//   saleEndsAt:     z.coerce.date().optional().nullable(),
//   isPublished:    z.boolean().default(false),
//   isFeatured:     z.boolean().default(false),
//   isNewArrival:   z.boolean().default(false),
//   isBespokeAvail: z.boolean().default(false),
//   metaTitle:      z.string().max(60).optional(),
//   metaDescription:z.string().max(160).optional(),
//   variants: z.array(z.object({
//     id:            z.string().optional(),  // existing variant
//     size:          z.string().min(1),
//     sku:           z.string().min(1),
//     priceNGN:      z.number().min(0),
//     priceUSD:      z.number().min(0).optional(),
//     priceGBP:      z.number().min(0).optional(),
//     salePriceNGN:  z.number().min(0).optional().nullable(),
//     stock:         z.number().int().min(0),
//     lowStockAt:    z.number().int().min(0).default(3),
//     sortOrder:     z.number().int().default(0),
//   })).min(1),
//   colors: z.array(z.object({
//     id:       z.string().optional(),
//     name:     z.string().min(1),
//     hex:      z.string().regex(/^#[0-9A-Fa-f]{6}$/),
//     imageUrl: z.string().url().optional().nullable(),
//   })).default([]),
//   images: z.array(z.object({
//     url:       z.string().url(),
//     alt:       z.string().optional(),
//     isPrimary: z.boolean().default(false),
//     sortOrder: z.number().int().default(0),
//   })).default([]),
//   bundleProductIds: z.array(z.string().cuid()).max(4).default([]),
// })
```

### C3 — Product Admin API Routes

**`src/app/api/admin/products/route.ts`** (GET, POST)
```typescript
// GET: same as public /api/products but allows isPublished=false, shows all
//      Role check: ADMIN or SUPER_ADMIN
//      Include variants count, images primary, orderItems count
//
// POST: Create product
//   Validate with productAdminSchema
//   Role check
//   In $transaction:
//     1. Create Product
//     2. Create ProductVariant for each variant (generate SKU if blank)
//     3. Create ProductColor for each color
//     4. Create ProductImage for each image
//     5. Create BundleItems for bundleProductIds
//   Return created product with id + slug
```

**`src/app/api/admin/products/[id]/route.ts`** (GET, PATCH, DELETE)
```typescript
// GET: Full product with all relations (for edit form population)
//
// PATCH: Partial update
//   Handle: basic fields, status toggles (isFeatured, isPublished), pricing
//   For variants: UPSERT by id (update if id present, create if no id)
//                 DELETE variants where id not in submitted list
//   For colors: same upsert pattern
//   For images: same upsert pattern
//   For bundles: delete all existing, recreate from bundleProductIds
//   All in $transaction
//
// DELETE: 
//   Check no PENDING/CONFIRMED/PROCESSING orders contain this product
//   If orders exist: return 409 "Cannot delete — active orders contain this product"
//   Else: delete product (cascades to variants, images, colors, bundle items)
```

**`src/app/api/admin/upload/route.ts`** (POST)
```typescript
// Multipart form data: file field
// Validate: image file (jpeg/png/webp), max 5MB
// Upload to Cloudinary:
//   cloudinary.uploader.upload(base64 or stream, {
//     folder: 'prudential-atelier/products',
//     transformation: [{ width: 1200, crop: 'limit' }, { quality: 'auto' }]
//   })
// Return: { url: secure_url, publicId: public_id }
// If CLOUDINARY_API_KEY not set: return a placeholder Unsplash URL (dev mode)
```

---

## TASK D — ADMIN ORDERS

**`src/app/(admin)/admin/orders/page.tsx`** (Server Component)
```typescript
// Fetch: orders with pagination (20 per page)
// searchParams: search (order# or email), status, paymentStatus, gateway, page, dateFrom, dateTo
// Include: user (name, email), items count, shippingZone name
// Total count for pagination
```

**`src/components/admin/OrdersTable.tsx`** (client component)
```
TOOLBAR:
  Search: order number or customer email (debounced 300ms)
  Filters: Status | Payment Status | Gateway | Date Range (from/to date pickers)
  [Export CSV] button:
    Client-side: build CSV from current filtered data, trigger download
    Columns: Order#, Customer, Email, Items, Subtotal, Shipping, Discount, Total, Gateway, Status, Date

TABLE:
  Columns:
    Order # (font-label, gold)
    Customer (name + email, or "Guest [email]" for guest orders)
    Items (count + first product name)
    Total (₦ formatted, plus flag if discounted)
    Gateway badge (Paystack=green, Flutterwave=blue, Stripe=purple, Monnify=orange)
    Payment badge (PAID=green, PENDING=amber, FAILED=red)
    Status badge (same colors as customer-facing)
    Date (relative: "2 days ago", tooltip with exact date)
    [→] link to /admin/orders/[id]
  
  Row hover: bg-[#1E1E1E]
  Click anywhere: navigate to order detail

PAGINATION: standard numbered, 20 per page
```

**`src/app/(admin)/admin/orders/[id]/page.tsx`** (Server Component)
```typescript
// Fetch order by id with ALL relations
// Include: items (product + variant + images), user, shippingZone, coupon
// Role check
```

```
HEADER:
  Back link ← Orders
  Order number (Display S, Cormorant, wine)
  Badges row: Payment status + Order status + Gateway + Currency

ORDER TIMELINE (same OrderTimeline component as customer-facing)

STATUS UPDATE BAR (admin-only):
  Current status display
  [Change Status] dropdown:
    Options filtered to logical next steps:
      PENDING → [Confirm]
      CONFIRMED → [Mark Processing]
      PROCESSING → [Mark Shipped] (shows tracking number input)
      SHIPPED → [Mark Delivered]
      Any → [Cancel] | [Refund]
  
  "Mark Shipped" action: opens small modal:
    Tracking number input (optional)
    Carrier name input (optional)
    [Confirm Shipment] button
    On confirm: PATCH /api/admin/orders/[id] { status: 'SHIPPED', trackingNumber, carrier }
    Trigger send OrderShippedEmail
  
  Admin Notes textarea:
    "Internal notes (not visible to customer)"
    Auto-save on blur: PATCH /api/admin/orders/[id] { adminNotes }

ORDER ITEMS table (same as customer view but with variant IDs shown)

PRICING BREAKDOWN card (right side)

CUSTOMER INFO card:
  If user account: name, email, phone, link to /admin/customers/[id]
  If guest: "Guest Order" badge + email + phone from addressSnapshot

ADDRESS card: formatted address snapshot

PAYMENT card: gateway, reference, paidAt

REFUND SECTION (if paymentStatus === PAID):
  [Issue Refund] button → opens modal:
    Full or partial amount
    Reason text
    Note: "Refunds must be processed manually through [gateway] dashboard"
    On confirm: update paymentStatus to REFUNDED, update order status to REFUNDED
```

**`src/app/api/admin/orders/route.ts`** (GET)
**`src/app/api/admin/orders/[id]/route.ts`** (GET, PATCH)
```typescript
// GET /[id]: full order with all relations
// PATCH /[id]: update status, adminNotes, trackingNumber
//   On status change to SHIPPED: send OrderShippedEmail (if customer email available)
//   On status change to DELIVERED: award purchase points (idempotent check)
//   Validate: only allow logical status transitions
//   Role check on all
```

---

## TASK E — ADMIN BESPOKE

**`src/app/(admin)/admin/bespoke/page.tsx`** (Server Component)
```typescript
// Fetch all bespoke requests, orderBy createdAt desc
// Filter by status (searchParams)
// Include: linked user (if any)
```

**`src/components/admin/BespokeTable.tsx`** (client component)
```
FILTER TABS (top):
  All · Pending · Reviewed · Confirmed · In Progress · Ready · Delivered
  Tab count badges (number per status)

TABLE:
  Columns:
    Request # (font-label, gold)
    Client (name + email)
    Occasion
    Budget Range
    Timeline
    Status badge (with status-specific colors)
    Date
    [View] button

CLICK → opens BespokeDetailModal (Radix Dialog, full details)
```

**`src/components/admin/BespokeDetailModal.tsx`** (client component)
```
Full request details laid out in cards:
  Client info card: name, email, phone, country, source, linked account (if userId)
  Request details card: occasion, description (full), budget, timeline
  Reference images (if any): thumbnail grid, click to open full size
  Measurements card (if provided): bust, waist, hips, height, notes
  Preferred date, submitted date

STATUS UPDATE (right panel):
  Current status badge
  [Update Status] select:
    PENDING → REVIEWED → CONFIRMED → IN_PROGRESS → READY → DELIVERED
    CANCELLED (always available)
  Estimated Price input (NGN, optional — fills when admin reviews)
  Admin Notes textarea (internal)
  [Save Updates] button → PATCH /api/admin/bespoke/[id]
  
  On CONFIRMED: send BespokeConfirmationEmail (or "In Progress" update email)
  On READY: send "Your piece is ready for collection" email

Contact client buttons:
  [Email Client] → mailto:[email]?subject=Re: Bespoke Request [requestNumber]
  [WhatsApp] → https://wa.me/[phone] (if phone starts with +)
```

**`src/app/api/admin/bespoke/route.ts`** (GET)
**`src/app/api/admin/bespoke/[id]/route.ts`** (GET, PATCH)
```typescript
// PATCH: update status, estimatedPrice, adminNotes
// Send status-update email when status changes to CONFIRMED, READY
```

---

## TASK F — ADMIN COUPONS

**`src/app/(admin)/admin/coupons/page.tsx`** (Server Component)
```typescript
// Fetch all coupons with usedCount and usages count
// Pass to CouponsTable client component
```

**`src/components/admin/CouponsTable.tsx`** (client component)
```
[+ Create Coupon] button (top right) → opens CouponFormModal

TABLE:
  Columns:
    Code (font-label, gold, monospace)
    Type badge: "% Off" | "₦ Off" | "Free Ship"
    Value: "20%" | "₦5,000" | "—"
    Min Order: "₦80,000" | "None"
    Uses: "[usedCount] / [maxUsesTotal ?? ∞]"
    Per User: "[maxUsesPerUser]"
    Expiry: date or "No expiry" (red if past, amber if within 7 days)
    Active: toggle switch (PATCH /api/admin/coupons/[id] { isActive })
    Actions: Edit (opens modal pre-filled) | Delete (with confirm)
```

**`src/components/admin/CouponFormModal.tsx`** (client component)
```
Radix Dialog, max-w-lg
Title: "Create Coupon" | "Edit Coupon"

Form fields (React Hook Form + couponAdminSchema):
  Code (uppercase input, disable in edit mode to prevent breaking existing use)
  Description (optional)
  Type (radio: Percentage / Fixed Amount / Free Shipping)
  Value (number input, label changes: "%" or "₦" based on type, hidden for Free Shipping)
  Minimum Order NGN (optional)
  Max Total Uses (optional, 0 = unlimited)
  Max Per User (default 1)
  Applies To (radio: All Products / Specific Categories)
  If Specific Categories: multi-select checkboxes for ProductCategory
  Start Date (date input, default today)
  Expiry Date (date input, optional)
  Active toggle

[Cancel] [Save Coupon] buttons

POST /api/admin/coupons (create) | PATCH /api/admin/coupons/[id] (edit)
```

**`src/app/api/admin/coupons/route.ts`** (GET, POST)
**`src/app/api/admin/coupons/[id]/route.ts`** (GET, PATCH, DELETE)
```typescript
// DELETE: check no active (non-expired, non-cancelled) orders used this coupon
//         If orders exist: soft-disable (isActive: false) instead of hard delete
//         If no orders: hard delete
```

---

## TASK G — ADMIN SHIPPING ZONES

**`src/app/(admin)/admin/shipping/page.tsx`** (Server Component)
```typescript
// Fetch all shipping zones
// Pass to ShippingZonesTable
```

**`src/components/admin/ShippingZonesTable.tsx`** (client component)
```
[+ Add Zone] button → opens ShippingZoneModal

TABLE:
  Zone name | Countries | States (if NG) | Flat Rate | Free Above | Est. Days | Active | Actions

ShippingZoneModal (Radix Dialog):
  Name (Input)
  Countries: multi-select with search (list of ISO codes + country names)
    Pre-filled common options: Nigeria (NG), UK (GB), US (US), Australia (AU), Canada (CA), etc.
  States: only show if NG is in countries list
    Comma-separated or multi-select of Nigerian states
  Flat Rate NGN (number)
  Per Kg NGN (number, default 0)
  Free Above NGN (number, optional — 0 or empty = never free)
  Estimated Days (text: "1–2 business days")
  Active (toggle)
  
  [Save Zone] → POST /api/admin/shipping | PATCH /api/admin/shipping/[id]
```

**`src/app/api/admin/shipping/route.ts`** (GET, POST)
**`src/app/api/admin/shipping/[id]/route.ts`** (PATCH, DELETE)

---

## TASK H — ADMIN CUSTOMERS

**`src/app/(admin)/admin/customers/page.tsx`** (Server Component)
```typescript
// Fetch users (role: CUSTOMER only), paginated 20 per page
// Include: _count { orders, referrals }
// searchParams: search (name or email), page
// Sort by: newest, most orders, most spent
```

**`src/components/admin/CustomersTable.tsx`** (client component)
```
Search input (name or email, debounced)

TABLE:
  Columns:
    Avatar (initials circle, 32px)
    Name + email
    Joined date
    Orders (count, link style)
    Total Spent (sum of PAID order totalNGN for this user)
    Points Balance
    Referrals (count)
    [View] button → /admin/customers/[id]
```

**`src/app/(admin)/admin/customers/[id]/page.tsx`** (Server Component)
```typescript
// Fetch user with:
//   orders (last 10, with items count + total)
//   pointsHistory (last 20)
//   referrals (users this person referred, with their orders count)
//   addresses
```

```
CUSTOMER HEADER:
  Avatar (large, 64px) + full name + email + phone
  Badges: role, join date, verified email badge
  Stats row: Total Orders | Total Spent | Points | Referrals

TABS (Radix):
  Orders: table of all orders, same style as main orders table
  Points History: same as customer wallet view
  Referrals: users referred + their first order status
  Addresses: list of saved addresses

ADMIN ACTIONS:
  [Adjust Points] button:
    Modal: Amount input (positive = add, negative = deduct), Description, Type select
    PATCH /api/admin/customers/[id]/points
  
  [Change Role] (SUPER_ADMIN only):
    Select: CUSTOMER | ADMIN
    PATCH /api/admin/customers/[id] { role }
  
  [View as Customer] link: opens /account in new tab while logged in as admin
    (Not required to actually impersonate — just a link)
```

**`src/app/api/admin/customers/route.ts`** (GET)
**`src/app/api/admin/customers/[id]/route.ts`** (GET, PATCH)
**`src/app/api/admin/customers/[id]/points/route.ts`** (POST)
```typescript
// POST: { amount: number, description: string, type: 'ADJUSTED_ADMIN' }
//   Update user.pointsBalance (can go negative — cap at 0)
//   Create PointsTransaction
//   $transaction
```

---

## TASK I — ADMIN REVIEWS

**`src/app/(admin)/admin/reviews/page.tsx`** (Server Component)
```typescript
// Default: isApproved: false (pending moderation)
// searchParams: approved (true/false), page
// Include: user (name), product (name, slug), order (for verified check)
```

**`src/components/admin/ReviewModerator.tsx`** (client component)
```
FILTER TABS:
  Pending ([count]) | Approved | All

TABLE:
  Columns:
    Product (name + category, link to shop page)
    Customer (name)
    Rating (star display)
    Title + Body (truncated 100 chars, expandable)
    Verified Purchase: yes/no badge
    Date
    Actions:
      [✓ Approve] button (green) → PATCH /api/admin/reviews/[id] { isApproved: true }
        Optimistically move row from pending to approved tab
      [✗ Reject] button (red) → DELETE /api/admin/reviews/[id]
        Confirm dialog: "Remove this review permanently?"

Empty pending: "No reviews awaiting moderation ✓" (green)
```

**`src/app/api/admin/reviews/route.ts`** (GET)
**`src/app/api/admin/reviews/[id]/route.ts`** (PATCH, DELETE)

---

## TASK J — ADMIN ANALYTICS ROUTE

**`src/app/api/admin/analytics/route.ts`** (GET)
```typescript
// Query params: period ('7d' | '30d' | '90d' | '1y', default '30d')
// Returns:
// {
//   revenue: { total: number, byDay: { date: string, amount: number }[] },
//   orders: { total: number, byStatus: Record<OrderStatus, number> },
//   customers: { total: number, new: number, withOrders: number },
//   topProducts: { productId, name, revenue, orderCount }[],
//   pendingActions: { orders: number, bespoke: number, reviews: number },
//   revenueGrowth: number  // % vs previous period
// }
//
// Group orders by day:
// Process orders array: group by date string (YYYY-MM-DD), sum totalNGN
// Fill missing days with 0
```

---

## TASK K — REACT EMAIL TEMPLATES

**Goal:** Replace the inline HTML strings in `src/lib/email.ts` with proper React Email components.

**Install if not present:** `react-email` and `@react-email/components` (already in package.json — verify).

Create `src/emails/` folder with the following files:

### K1 — Base Layout

**`src/emails/components/EmailLayout.tsx`**
```typescript
// Props: { children: React.ReactNode, previewText?: string }
// Uses @react-email/components: Html, Head, Preview, Body, Container, Section, Text
//
// Structure:
//   Html lang="en"
//   Head: charset, viewport, Google Font import (Georgia fallback)
//   Preview: previewText (shown in email client preview)
//   Body: bg #FAF6EF, font-family Georgia
//   Container: max-width 600px, margin auto
//
//   HEADER:
//     Section: bg #6B1C2A, padding 24px
//     Text: "PRUDENTIAL ATELIER" (gold #C9A84C, letter-spacing 4px, 14px, centered)
//     Thin gold divider line
//
//   CONTENT:
//     Section: bg white, padding 40px 48px
//     {children}
//
//   FOOTER:
//     Section: bg #1A1A1A, padding 24px 48px
//     Text links: "Shop" | "Bespoke" | "Our Story" | "Contact" (ivory/60, 12px, centered)
//     Text: "© 2024 Prudential Atelier · Lagos, Nigeria" (ivory/40, 11px, centered)
//     Text: "You received this email because you have an account or placed an order."
//           "Unsubscribe" link

// Export EmailLayout as default
```

### K2 — Welcome Email

**`src/emails/WelcomeEmail.tsx`**
```typescript
// Props: { firstName: string, pointsBalance: number, referralCode: string }
// Subject (export const subject): "Welcome to Prudential Atelier, [firstName] ✨"
//
// Content:
//   Heading: "Welcome, [firstName]." (Cormorant style — font-size 32px, Georgia)
//   Body: "You've joined one of Nigeria's most celebrated fashion houses."
//   If pointsBalance > 0:
//     Gold box: "🌟 You have [X] loyalty points waiting — worth ₦[X] store credit."
//   CTA button: "Explore the Collection" → [APP_URL]/shop
//     Button style: bg #6B1C2A, color #C9A84C, padding 12px 32px, no border-radius
//   Divider
//   Small text: "Your referral code: [referralCode]"
//              "Share it with friends to earn more points."
```

### K3 — Order Confirmation Email

**`src/emails/OrderConfirmationEmail.tsx`**
```typescript
// Props: {
//   firstName: string
//   orderNumber: string
//   items: { name: string; size: string; color?: string; qty: number; priceNGN: number }[]
//   subtotalNGN: number
//   shippingNGN: number
//   discountNGN: number
//   pointsDiscNGN: number
//   totalNGN: number
//   addressSnapshot: Record<string, string>
//   estimatedDays?: string
// }
//
// Content:
//   "Thank you, [firstName]." heading (32px)
//   "Your order is confirmed." (body)
//   Order number box (gold border): #[orderNumber]
//   
//   ITEMS TABLE:
//     Use @react-email/components Row + Column for table layout
//     Each item: Name · Size [color if present] · Qty × ₦price = ₦total
//   
//   TOTALS section:
//     Subtotal
//     Shipping (or "Free")
//     Discount (if any, green)
//     Points discount (if any, gold)
//     ─────────
//     Total (bold)
//   
//   DELIVERY ADDRESS (formatted from snapshot)
//   ESTIMATED DELIVERY (if estimatedDays provided)
//   
//   CTA: "Track Your Order" → [APP_URL]/account/orders
//   
//   Footer note: "Questions? Reply to this email or contact hello@prudentialatelier.com"
```

### K4 — Order Shipped Email

**`src/emails/OrderShippedEmail.tsx`**
```typescript
// Props: {
//   firstName: string, orderNumber: string,
//   trackingNumber?: string, carrier?: string, estimatedDays?: string
// }
//
// Content:
//   "Your order is on its way! 📦" heading
//   "Your Prudential Atelier piece has been shipped."
//   If trackingNumber: gold box with tracking number + carrier
//   Estimated delivery note
//   CTA: "Track Your Order" → /account/orders
```

### K5 — Bespoke Confirmation Email

**`src/emails/BespokeConfirmationEmail.tsx`**
```typescript
// Props: { name: string, requestNumber: string, occasion: string, timeline: string }
//
// Content:
//   "Your Bespoke Request" heading
//   "Thank you, [name]. We've received your request."
//   Request number box (gold border): #[requestNumber]
//   
//   "What happens next?" (3 steps, bulleted):
//     • Our team will review your request within 24–48 hours.
//     • We will contact you to discuss your vision and confirm details.
//     • Once confirmed, we'll begin crafting your piece.
//   
//   Your occasion: [occasion] · Timeline: [timeline]
//   
//   "In the meantime, browse our ready-to-wear collection."
//   CTA: "Browse Collection" → /shop
//   
//   Contact: "Reach us at hello@prudentialatelier.com or @prudent_gabriel on Instagram"
```

### K6 — Password Reset Email

**`src/emails/PasswordResetEmail.tsx`**
```typescript
// Props: { resetUrl: string }
//
// Content:
//   "Reset Your Password" heading
//   "We received a request to reset your Prudential Atelier password."
//   CTA button: "Reset Password" → resetUrl (LARGE button, centered)
//   "This link expires in 1 hour."
//   "If you didn't request this, you can safely ignore this email."
//   Security note: "For your security, never share this link with anyone."
```

### K7 — Referral Success Email

**`src/emails/ReferralSuccessEmail.tsx`**
```typescript
// Props: { referrerName: string, friendFirstName: string, pointsEarned: number, newBalance: number }
//
// Content:
//   "You just earned [pointsEarned] points! 🌟" heading
//   "[friendFirstName] signed up using your referral link."
//   Gold highlight box:
//     "+[pointsEarned] points added"
//     "Your new balance: [newBalance] pts = ₦[newBalance]"
//   CTA: "View Your Wallet" → /account/wallet
```

### K8 — Back In Stock Email

**`src/emails/BackInStockEmail.tsx`**
```typescript
// Props: { productName: string, size: string, productSlug: string, priceNGN: number }
//
// Content:
//   "[productName] is back in stock!" heading
//   "The piece you were waiting for is available again."
//   Product details: [productName] · Size: [size] · ₦[price]
//   "⚡ Limited stock — act fast."
//   CTA: "Shop Now" → /shop/[productSlug]
```

### K9 — Wire Templates Into email.ts

**Update `src/lib/email.ts`** to use React Email's `render()` function:
```typescript
import { render } from '@react-email/render'
import WelcomeEmail from '@/emails/WelcomeEmail'
// ... import all templates

// Replace inline HTML strings with:
// const html = render(<WelcomeEmail firstName={...} ... />)
// resend.emails.send({ ..., html })

// Update all sendX functions to use the templates
// Keep the console.log fallback for dev mode (no API key)
```

Add to `package.json` scripts:
```json
"email:dev": "email dev --dir src/emails --port 3001"
```
This lets you preview all email templates at localhost:3001 during development.

---

## TASK L — ADMIN REFERRAL ANALYTICS PAGE

**`src/app/(admin)/admin/referrals/page.tsx`** (Server Component)
```typescript
// Fetch:
//   Top 10 referrers: users with most referrals, ordered by referral count desc
//   Total points issued via referrals (sum of EARNED_REFERRAL + EARNED_SIGNUP transactions)
//   Total points redeemed (sum of REDEEMED transactions)
//   Referral conversion: users who referred AND whose referrals placed at least 1 order
```

```
KPI CARDS:
  Total Referrals | Points Issued (Referrals) | Points Redeemed | Conversion Rate

TOP REFERRERS TABLE:
  Rank | Name | Email | Referrals | Points Earned | Actions ([View Customer])

POINTS FLOW CHART (Recharts bar chart):
  Two bars per month: Earned vs Redeemed
  Colors: gold (earned), wine (redeemed)
```

---

## TASK M — ADMIN SETTINGS PAGE

**`src/app/(admin)/admin/settings/page.tsx`** (Server Component → client form)
```
Simple settings page for future expansion.

SECTIONS:
  Store Info:
    Store Name (read-only: "Prudential Atelier")
    Contact Email (editable: ADMIN_EMAIL value)
    Instagram Handle (editable)
  
  Points Configuration:
    Points per ₦100 spent (number, default: 1)
    Referral signup points — new user (default: 500)
    Referral signup points — referrer (default: 250)
    Review points (default: 50)
    Note: "Changes affect future transactions only"
  
  Shipping:
    Free shipping threshold — Lagos (default: ₦150,000)
    [Manage Zones] → /admin/shipping
  
  [Save Settings] button
  
  Note: "These settings are stored as environment variables or DB config.
         For now, they display current defaults."

// Store settings in a simple key-value table or just display — no need to persist to DB this session
// This page is for future expansion
```

---

## TASK N — FINAL INTEGRATION & POLISH

### N1 — Navbar Admin Link

**Update `src/components/layout/Navbar.tsx`**:
```typescript
// If session.user.role === 'ADMIN' || 'SUPER_ADMIN':
//   Add "Admin" link in the right-side icons (or in account dropdown)
//   Style: small gold badge/link → /admin
```

### N2 — Missing UI Components

Check if these exist. Create only if missing:

**`src/components/ui/Input.tsx`** (check exists from Session 3 Task G)
```
If missing or incomplete:
  Floating label: label absolutely positioned over input
                  moves up (scale 0.85, translateY -100%) when focused OR has value
  Bottom border only, 1px solid var(--border)
  Focus: 2px wine bottom border
  Error: red border + error text below
  Password: Eye/EyeOff icon toggle right side
  All transitions: 200ms ease
```

**`src/components/ui/Select.tsx`** (Radix Select wrapper)
```
If missing: wrap Radix Select with brand styling
  Trigger: same style as Input (bottom border only, floating label pattern)
  Content: bg-cream, border-border, shadow-lg
  Item: hover bg-wine-muted, selected gold checkmark left
```

**`src/components/ui/Toggle.tsx`** (used in admin)
```
Props: { checked: boolean, onChange: (v: boolean) => void, disabled?: boolean }
Width: 44px, height: 24px, rounded-full
Unchecked: bg-border (grey)
Checked: bg-wine
Thumb: white circle, translateX on toggle (Framer Motion spring)
Disabled: opacity 50%
```

### N3 — Seed Updates

**Update `prisma/seed.ts`**:
```typescript
// Add these missing coupon codes (check if already seeded):
//   FREESHIP     — Free shipping (min ₦50,000, no expiry)
//   BRIDAL20     — 20% off bridal category (min ₦150,000, max 50 uses)
//   FLASH5000    — ₦5,000 off (min ₦80,000, expires in 7 days from seed run)
//   VIP15        — 15% off (max 5 per user, 365 days)
//   EXPIRED10    — expired coupon (isActive: false, expiresAt: past date)
//
// Note: WELCOME10 was seeded in Session 3 — only add the others if missing.
// Use upsert (createMany with skipDuplicates: true OR check before insert):
//   await prisma.coupon.upsert({ where: { code: 'FREESHIP' }, update: {}, create: {...} })

// Ensure admin user has correct password (bcrypt hash of 'Admin@PA2024!'):
//   await prisma.user.upsert({ where: { email: 'admin@prudentialatelier.com' }, ... })
```

### N4 — Environment Variables Guide

Create **`DEPLOYMENT.md`** in project root:
```markdown
# Prudential Atelier — Deployment Guide

## Vercel Deployment

### Step 1 — Database (Neon.tech)
1. Create account at neon.tech
2. Create new project: "prudential-atelier"
3. Copy: DATABASE_URL (pooled) and DIRECT_URL (unpooled/direct)

### Step 2 — Vercel Project
1. Push repo to GitHub
2. Import to Vercel
3. Framework: Next.js (auto-detected)
4. Build command: `npx prisma generate && next build`

### Step 3 — Environment Variables (add all in Vercel dashboard)
DATABASE_URL=           # Neon pooled URL
DIRECT_URL=             # Neon direct URL
NEXTAUTH_SECRET=        # openssl rand -base64 32
NEXTAUTH_URL=           # https://your-domain.vercel.app
NEXT_PUBLIC_APP_URL=    # https://your-domain.vercel.app
GOOGLE_CLIENT_ID=       # (optional for presentation)
GOOGLE_CLIENT_SECRET=   # (optional for presentation)
CLOUDINARY_CLOUD_NAME=  # (optional — falls back to Unsplash images)
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
PAYSTACK_SECRET_KEY=    # Get from paystack.com dashboard
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=
FLUTTERWAVE_SECRET_KEY=
NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY=
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=
STRIPE_WEBHOOK_SECRET=
MONNIFY_API_KEY=
MONNIFY_SECRET_KEY=
MONNIFY_CONTRACT_CODE=
MONNIFY_BASE_URL=https://api.monnify.com
RESEND_API_KEY=         # (optional — emails log to console if absent)
OPEN_EXCHANGE_RATES_APP_ID=  # (optional — fallback rates used if absent)
ADMIN_EMAIL=admin@prudentialatelier.com
ADMIN_PASSWORD=Admin@PA2024!
CRON_SECRET=            # openssl rand -base64 32

### Step 4 — After Deploy
npx prisma migrate deploy  (or: npx prisma db push for first deploy)
npx prisma db seed

### Step 5 — Webhook URLs (register in payment dashboards)
Paystack:     https://[domain]/api/payment/paystack/webhook
Flutterwave:  https://[domain]/api/payment/flutterwave/webhook
Stripe:       https://[domain]/api/payment/stripe/webhook
Monnify:      https://[domain]/api/payment/monnify/webhook

### Step 6 — Google OAuth (optional for presentation)
In Google Cloud Console → OAuth 2.0 Client:
  Authorized redirect URI: https://[domain]/api/auth/callback/google

## Coolify Migration (after Vercel presentation)
See: docker-compose.yml + Dockerfile (add next.config.ts output: 'standalone')

## Test Accounts
Admin:      admin@prudentialatelier.com / Admin@PA2024!
Customer 1: amara@example.com / Customer@2024
Customer 2: chidinma@example.com / Customer@2024
Customer 3: folake@example.com / Customer@2024

## Test Coupons
WELCOME10, FREESHIP, BRIDAL20, FLASH5000, VIP15, EXPIRED10
```

---

## FINAL CHECKS

After completing all tasks:

1. `npx prisma generate`
2. `npx tsc --noEmit` — zero errors
3. `npx next build` — succeeds
4. Verify these admin routes render without 500:
   - `/admin` — analytics dashboard with charts
   - `/admin/products` — table with 14 seeded products
   - `/admin/products/new` — empty form loads
   - `/admin/products/[id]/edit` — form pre-filled with product data
   - `/admin/orders` — table with 8 seeded orders
   - `/admin/orders/[id]` — full order detail
   - `/admin/bespoke` — table with 8 seeded requests
   - `/admin/coupons` — table with 6 coupons
   - `/admin/customers` — table with 4 users
   - `/admin/reviews` — pending review queue (1 pending from seed)
5. Verify email preview (if react-email configured):
   - `npm run email:dev` starts on port 3001
   - All 8 templates visible and render without errors
6. Admin role protection: visiting `/admin` while logged in as `amara@example.com`
   should redirect to `/auth/login` (she is CUSTOMER role)

---

## SESSION END SUMMARY FORMAT

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SESSION 4 COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Task A — Admin layout, sidebar, topbar
✅ Task B — Analytics dashboard (KPIs, charts, alerts)
✅ Task C — Products CRUD (list, create, edit, VariantManager)
✅ Task D — Orders management (list, detail, status update)
✅ Task E — Bespoke management (list, detail modal, status update)
✅ Task F — Coupons management (list, create/edit modal)
✅ Task G — Shipping zones management
✅ Task H — Customers (list, detail, points adjustment)
✅ Task I — Reviews moderation
✅ Task J — Analytics API route
✅ Task K — React Email templates (8 templates + wired into email.ts)
✅ Task L — Referral analytics page
✅ Task M — Settings page shell
✅ Task N — Final integration (admin nav link, missing UI, seed, DEPLOYMENT.md)

NEXT SESSION (Session 5 — Final):
  - End-to-end QA fixes
  - Performance optimizations (image loading, ISR, bundle)
  - Deployment to Vercel
  - Post-deploy seed run
  - Presentation preparation checklist
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

*Prudential Atelier · Cursor Session 4*
*Prepared by Nony | SonsHub Media*
