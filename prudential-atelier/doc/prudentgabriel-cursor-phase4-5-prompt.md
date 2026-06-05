# CURSOR AI — PRUDENTGABRIEL.COM
## Phase 4.5: QA Fixes + Navigation + Collections + Atelier Flow
### Prepared by SonsHub Media Ltd (Nony — Okafor Chinonso Daniel)

---

## CRITICAL INSTRUCTIONS

1. Read the entire prompt before writing any code.
2. Do not change any working payment flows, auth logic, or database models unless explicitly instructed.
3. Every visible label change from "Bespoke" to "Atelier" is a display/copy change only — do not rename database fields, API routes, or internal variables. Only what the user sees changes.
4. Run `pnpm exec tsc --noEmit` after each major section before moving to the next.

---

## SECTION 1 — TERMINOLOGY: "BESPOKE" → "ATELIER"

Replace every user-facing instance of "Bespoke" with "Atelier" across the entire platform. This is a display change only — database fields, API routes, and internal variable names stay as-is.

**Public frontend — change these labels:**
- Nav link: "Bespoke" → "Atelier"
- Page heading `/bespoke` or `/atelier`: "The Atelier"
- Homepage section: "Bespoke showcase" → "Atelier"
- Consultation page: "Bespoke Design" → "Atelier Commission"
- Order tracking: "Bespoke commission" → "Atelier commission"
- Stage emails: "bespoke" → "atelier" in all copy
- Consultation booking cards: update copy
- Homepage hero button: "Begin a Bespoke" → "Begin a Commission"
- PFA banner: update any "bespoke" references

**Admin panel — change these labels:**
- Sidebar: "Bespoke Pipeline" → "Atelier Pipeline"
- Page headings: "Bespoke Orders" → "Atelier Orders"
- "New Bespoke Order" button → "New Atelier Order"
- Stage names in UI (keep the same stage names but remove word "bespoke" from surrounding copy)
- Order detail page headings
- Report labels

**Do NOT change:**
- Database model names (`BespokeOrder`, `BespokeStage` etc.)
- API route paths (`/api/bespoke/*`)
- Internal variable names
- URL paths (keep `/admin/bespoke`, `/track` etc.)

---

## SECTION 2 — NAVIGATION RESTRUCTURE

Replace the current navbar with this exact structure:

```
SHOP · READY TO WEAR ▾ · BRIDAL · ATELIER · KIDS · JOURNAL · ABOUT
```

### Desktop Navbar:

**SHOP** → `/shop` (all products — RTW + Bridal + Atelier showcase + Kids)

**READY TO WEAR** → `/rtw` with a dropdown on hover:
```
READY TO WEAR
├── All Ready-to-Wear → /rtw
├── ─────────────────
├── Collections
│   ├── [Collection 1 name] → /rtw/collections/[slug]
│   ├── [Collection 2 name] → /rtw/collections/[slug]
│   └── [Collection 3 name] → /rtw/collections/[slug]
└── ─────────────────
    New Arrivals → /rtw?sort=newest
```

Collections in the dropdown are **dynamic** — fetched from the `Collection` model where `isPublished: true`, ordered by `displayOrder`. When a new collection is created in admin, it automatically appears here. No code changes needed.

**BRIDAL** → `/bridal`

**ATELIER** → `/atelier` (was `/bespoke`)

**KIDS** → `/kids`

**JOURNAL** → `/journal`

**ABOUT** → `/about`

### Dropdown design:
- Appears on hover (desktop)
- Background: `var(--ivory)` with subtle border-bottom `var(--sand)`
- Collection items: Jost 11px, var(--text-mid), hover → var(--choc)
- "Collections" label: Jost 9px uppercase, var(--lightbr), letter-spacing 0.18em — acts as a section header, not a link
- Smooth fade-in animation (Framer Motion, 150ms)
- Arrow indicator on "READY TO WEAR" link when dropdown is open

### Mobile menu:
- SHOP
- READY TO WEAR (expandable accordion)
  - All Ready-to-Wear
  - Collections (sub-accordion)
    - [each collection]
  - New Arrivals
- BRIDAL
- ATELIER
- KIDS
- JOURNAL
- ABOUT

### Route: `/atelier`
Create `src/app/(public)/atelier/page.tsx` as the new Atelier landing page.
This replaces `/bespoke` (add a redirect from `/bespoke` → `/atelier`).

Content:
- Hero: "The Atelier" — Cormorant 64px, dark chocolate background, cream text
- Subtitle: "Every commission begins with a conversation. We design entirely around you."
- "Begin a Commission" CTA → links to `/consultation`
- Process section: visual display of the 13 stages (simplified, editorial)
- Gallery of past work (pulls from GalleryImage where category = ATELIER)
- Testimonials (pulls from approved Reviews)
- CTA: "Book your consultation"

---

## SECTION 3 — SHOP PAGE REDESIGN

The `/shop` page shows ALL products — RTW, Bridal, Atelier showcase, Kids.

### Page layout:

Header (centered, ivory):
- Eyebrow: "THE COLLECTION" (Jost 10px, var(--lightbr))
- Title: "Prudent Gabriel" (Cormorant Garamond 64px, var(--choc))
- Subtitle: "Ready-to-wear, bridal, and bespoke couture." (Lora 14px)

Filter bar:
- Category pills: ALL · READY-TO-WEAR · BRIDAL · ATELIER · KIDS
- Sort: Featured, Newest, Price Low-High, Price High-Low
- Piece count: "X PIECES"

Product grid: 4 columns, same design as current shop
- All published products regardless of category
- BEST SELLER, NEW IN badges as currently implemented

### RTW Page (`/rtw`):
- Same layout but filtered to RTW products only
- Header: "Ready-to-Wear"
- Shows collections strip above the grid if collections exist:
  ```
  [Collection cover] [Collection cover] [Collection cover]
  Rich & Regal       Church Girl        La Femme
  ```
  Each links to `/rtw/collections/[slug]`

---

## SECTION 4 — COLLECTIONS SYSTEM

The `Collection` model already exists in the schema. Build the full collections feature.

### Collection Detail Page (`/rtw/collections/[slug]`)

```
src/app/(public)/rtw/collections/[slug]/page.tsx
```

Layout:
- Full-width cover image (if set) with dark overlay
- Collection name (Cormorant 52px, cream on dark overlay)
- Collection description (Lora 15px)
- Product grid below: 4 columns, same ProductCard component
- "Back to Ready-to-Wear" breadcrumb

Server component — fetch collection with products:
```typescript
const collection = await prisma.collection.findUnique({
  where: { slug, isPublished: true },
  include: {
    products: {
      include: { product: { include: { images: true, variants: true } } },
      orderBy: { sortOrder: 'asc' }
    }
  }
})
```

### Collections Admin (`/admin/shop/collections`)

Add "Collections" link under Shop section in AdminSidebar.

**Collections list page:**
- BulkSelectTable: Cover image thumbnail, Name, Products count, Published status, Display order, Actions
- "New Collection" button
- Drag-to-reorder rows (updates displayOrder)

**Create/Edit Collection (`/admin/shop/collections/new` and `/admin/shop/collections/[id]/edit`):**

Fields:
- Name (auto-generates slug)
- Description (TipTap lite)
- Season (e.g. "Spring/Summer 2026")
- Cover image (Cloudinary upload — portrait 3:4)
- Published toggle
- Auto-tag (optional: products with this tag automatically added)
- Products: manual product picker
  - Search and select products
  - Drag to reorder within collection
  - Remove product from collection

**API routes:**
```
GET    /api/admin/collections          List all
POST   /api/admin/collections          Create
GET    /api/admin/collections/[id]     Get single
PATCH  /api/admin/collections/[id]     Update
DELETE /api/admin/collections/[id]     Delete
POST   /api/admin/collections/[id]/products  Add product
DELETE /api/admin/collections/[id]/products/[productId]  Remove
```

**Seed 3 demo collections:**
```typescript
const collections = [
  {
    name: 'Rich & Regal',
    slug: 'rich-and-regal',
    description: 'Commanding pieces for the woman who owns every room she enters. Structured silhouettes, premium fabrics, unapologetic presence.',
    season: 'Spring/Summer 2026',
    isPublished: true,
    displayOrder: 1,
    // Assign: The Adaeze Gown, Lumi Tailored Suit, Nneka Aso-Ebi Set
  },
  {
    name: 'Church Girl',
    slug: 'church-girl', 
    description: 'Refined, modest, and effortlessly elegant. For the woman whose Sunday best is always extraordinary.',
    season: 'Spring/Summer 2026',
    isPublished: true,
    displayOrder: 2,
    // Assign: Ember Silk Wrap, Ife Bias Slip
  },
  {
    name: 'La Femme',
    slug: 'la-femme',
    description: 'Soft, feminine, and deeply romantic. Pieces that move with you and speak for you.',
    season: 'Spring/Summer 2026',
    isPublished: true,
    displayOrder: 3,
    // Assign: Zara Flower Girl Set, Kito Junior Tuxedo
  },
]
```

Add to `scripts/seed-demo.ts` and run.

---

## SECTION 5 — PRODUCT DETAIL PAGE REDESIGN

The current product detail page needs a full redesign to match the luxury editorial standard of the rest of the site.

**Route:** `/shop/[slug]`

### New layout — two column, editorial:

```
┌────────────────────────────┬──────────────────────────┐
│                            │                          │
│   IMAGE GALLERY            │   PRODUCT INFO           │
│   (left, wider)            │   (right, sticky)        │
│                            │                          │
│   Main image: portrait     │   Brand: PRUDENT GABRIEL │
│   3:4, full height         │   Category eyebrow       │
│                            │   Product name           │
│   Thumbnail strip          │   Price                  │
│   below main image         │   Currency toggle        │
│   (4 per row)              │   Size selector          │
│                            │   Colour selector        │
│                            │   Quantity               │
│                            │   ADD TO BAG button      │
│                            │   ADD TO WISHLIST        │
│                            │                          │
│                            │   Accordion details:     │
│                            │   - Product Details      │
│                            │   - Size & Fit           │
│                            │   - Delivery & Returns   │
└────────────────────────────┴──────────────────────────┘
```

**Specific design rules:**

Left column (60% width):
- Main image: portrait aspect ratio (3:4), `object-fit: cover`, `object-position: center top`
- Smooth image swap on thumbnail click (no page reload)
- Thumbnails: 4 small squares below, 1px gap, currently selected has a thin border in var(--choc)
- If only 1 image: just show the single image, no thumbnails

Right column (40% width, sticky on scroll):
- "PRUDENT GABRIEL" — Jost 10px, letter-spacing 0.2em, uppercase, var(--lightbr), margin-bottom 4px
- Category — Jost 10px, uppercase, var(--text-light), margin-bottom 16px
- Product name — Cormorant Garamond 42px, weight 400, var(--choc), line-height 1.1
- Price — Cormorant 28px, var(--choc), margin-top 16px
- Currency display: show NGN price, then USD and GBP smaller below if set
  ```
  ₦485,000
  Also: $316 · £249
  ```
- Divider line (1px, var(--sand)) between price and size selector

**Size selector:**
- Label: "SIZE" (Jost 10px, uppercase, var(--text-light))
- "SIZE GUIDE" link right-aligned (same line)
- Size pills: rectangular, not round — 48px wide, 36px height
  - Available: border var(--sand), color var(--text-mid), hover: border var(--choc)
  - Selected: background var(--choc), color var(--cream)
  - Out of stock: strikethrough, opacity 0.4, not clickable
- If only 1 size: hide selector entirely, don't show "One Size" pill

**Colour selector (if product has colours):**
- Label: "COLOUR" (Jost 10px, uppercase, var(--text-light))
- Colour dot circles: 24px, border 1px solid var(--sand)
- Selected: ring border 2px solid var(--choc) with 2px gap

**Quantity:**
- Simple +/- with number in middle
- Jost 13px, min 1, max = variant stock
- Do not show if only 1 available

**ADD TO BAG button:**
- Full width, height 52px
- Background var(--choc), color var(--cream)
- Jost 11px, weight 600, letter-spacing 0.18em, uppercase
- Hover: background var(--nut)
- Loading state: spinner

**ADD TO WISHLIST:**
- Ghost, below ADD TO BAG
- Heart icon + "ADD TO WISHLIST"
- Jost 11px, var(--text-mid)
- Toggles when clicked (filled heart if in wishlist)

**Trust badges row** (below buttons):
```
🔒 Secure Checkout   ✈ Ships Worldwide   📏 Free Size Guide
```
Jost 10px, var(--text-light)

**Accordion details:**
- Three sections: Product Details, Size & Fit, Delivery & Returns
- Content from `product.details` field
- Clean accordion: heading row with + / - icon
- Lora 13px for content
- Border-top var(--sand) between sections

**Below the fold (full width):**

Reviews section:
- "Client Reviews" heading (Cormorant 32px)
- Average rating display if reviews exist
- "Write a Review" button
- Review cards: client name, rating stars, title, body, date
- Empty state: "Be the first to review this piece"

"You May Also Like" section:
- 4 products from same category
- Same ProductCard component

"Recently Viewed" section (client-side, localStorage):
- Shows last 4 viewed products
- Only shows if has history

---

## SECTION 6 — INVOICE + CONSULTATION + ATELIER FLOW

### Invoice origins (two types):

**Type A — Consultation-linked invoice:**
When a consultation is completed, the admin can raise an invoice directly from the consultation record:
- In `/admin/consultations/[id]` detail page, add "Create Invoice" button
- Pre-fills client details from consultation
- Pre-fills line items with consultation fee + any agreed atelier commission amount
- On save: invoice linked to `consultationId`

**Type B — Standalone invoice:**
- Finance Manager creates from `/admin/invoices/new`
- Manual client details and line items
- No consultation link

### Schema additions:
```prisma
// Add to Invoice model:
consultationId String?
// consultation Consultation? (add relation if not exists)
```

Run `prisma db push` after.

### Staff assignment per stage:

Currently `OrderAssignment` links one staff member to an entire order with a role.

**Change to per-stage assignment:**

In the Atelier order detail page (`/admin/bespoke/[orderId]`), the stage completion panel should include a staff assignment field:

When the Atelier Manager is about to mark a stage complete OR when setting up the next stage:
- "Assign staff to this stage" — dropdown of active StaffProfile records
- Multiple staff can be assigned to one stage (e.g. two tailors on stage 8)
- Shows smart suggestion: who has fewest active assignments

Update `OrderAssignment` model — add `stage` field:
```prisma
// Add to OrderAssignment:
stage BespokeStage?  // which stage this assignment is for
```

Run `prisma db push` after.

In the stage completion form:
```
Stage 8 — Tailoring / Construction

Assign staff to this stage:
[Tunde Kareem — Senior Tailor ×]  [+ Add staff]

Notes: [textarea — required]
Images: [upload]
Videos: [upload]

[MARK STAGE COMPLETE]
```

Staff assigned to each stage are visible:
- On the order detail page (timeline shows who handled each stage)
- On the staff member's profile (their stage history)
- On the public tracking page (shows "Crafted by our atelier team" — no individual names for privacy)

---

## SECTION 7 — REMAINING QA FIXES

### Fix 1 — Remove debug logging
Remove all `console.log` statements added during auth debugging:
- `src/lib/auth.ts` — remove JWT CALLBACK, SESSION CALLBACK logs
- `src/middleware.ts` — remove MIDDLEWARE HIT, ADMIN GATE logs
- `src/app/api/auth/test-session/route.ts` — delete this file entirely
- `src/app/api/auth/check-staff-user/route.ts` — delete this file

### Fix 2 — Shop product images not portrait
The shop grid is showing some landscape/square images. 
All product card images must use portrait 3:4 aspect ratio:
```css
.product-image-wrapper {
  aspect-ratio: 3/4;
  overflow: hidden;
  position: relative;
}
.product-image-wrapper img {
  object-fit: cover;
  object-position: center top;
  width: 100%;
  height: 100%;
}
```
Apply to ProductCard component and all product image containers.

### Fix 3 — Journal featured post layout
The featured post (first/largest post) should span full width with the image on the left and text on the right — not stacked. On mobile it stacks. Match the design reference PDF layout.

### Fix 4 — Homepage best sellers section
Best sellers should show 4 products in a row (4-column grid) not 1. The section currently shows only 1 product because only 1 product is marked `isFeatured: true`.

Fix the query to fall back to products ordered by `orderCount` descending if fewer than 4 are marked as best sellers:
```typescript
// Fetch best sellers with fallback
const bestSellers = await prisma.product.findMany({
  where: { isPublished: true, isFeatured: true },
  take: 4,
  include: { images: true, variants: true },
  orderBy: { orderCount: 'desc' }
})

// If fewer than 4, fill with top products by orderCount
if (bestSellers.length < 4) {
  const existingIds = bestSellers.map(p => p.id)
  const filler = await prisma.product.findMany({
    where: { 
      isPublished: true, 
      id: { notIn: existingIds } 
    },
    take: 4 - bestSellers.length,
    include: { images: true, variants: true },
    orderBy: { orderCount: 'desc' }
  })
  bestSellers.push(...filler)
}
```

### Fix 5 — Footer "ATELIER" missing below "PRUDENTIAL"
In the footer, the wordmark shows "PRUDENTIAL" but "/ ATELIER" subline is missing or not visible.
Ensure the footer wordmark matches the navbar: "PRUDENTIAL" + "/ ATELIER" below.

### Fix 6 — Admin dashboard revenue chart cut off
The revenue chart on the executive dashboard is cut off at the bottom. 
Ensure the chart container has enough height:
```tsx
<div style={{ width: '100%', height: 280, minHeight: 280 }}>
  <ResponsiveContainer width="100%" height="100%">
```

### Fix 7 — Attendance "No active QR code"
The attendance page shows "No active QR code". 
The QR rotation cron hasn't run yet (it runs at midnight).
Add an auto-generate on first load: if no active QR exists when the attendance page loads, generate one automatically.

```typescript
// In /api/admin/attendance/qr/current GET route:
let qr = await prisma.qRCode.findFirst({
  where: { isActive: true, expiresAt: { gt: new Date() } }
})

if (!qr) {
  // Auto-generate if none exists
  qr = await generateDailyQR()
}

return NextResponse.json({ qr })
```

---

## SECTION 8 — PAGES THAT NEED CREATING/FIXING

### `/about` page
Create a proper about page at `src/app/(public)/about/page.tsx`:

- Hero: full-width dark chocolate background
  "The House of Prudent Gabriel" — Cormorant 52px, cream
  "Founded in Lagos. Worn around the world." — Lora 16px, sand
- Brand story section: Lora body text (pulled from SiteSetting `page_about` — Content Manager editable)
- Mrs. Prudent's quote (same as homepage brand quote section)
- Team section: placeholder for team photos
- PFA crosslink banner (same component as homepage)

### `/atelier` page (new — replaces /bespoke)
Already specified in Section 2.

Add redirect: `src/app/(public)/bespoke/page.tsx` → redirect to `/atelier`

---

## EXECUTION ORDER

1. Terminology changes (Section 1) — find/replace in all display strings
2. Navigation restructure (Section 2)
3. Create `/atelier` page, add redirect from `/bespoke`
4. Shop page redesign (Section 3)
5. Collections admin + seed demo collections (Section 4)
6. Collection detail page `/rtw/collections/[slug]`
7. Product detail page redesign (Section 5)
8. Schema additions for invoice+consultation link and per-stage staff (Section 6) → `prisma db push`
9. Invoice from consultation flow (Section 6)
10. Per-stage staff assignment in Atelier order detail (Section 6)
11. QA fixes (Section 7) — all 7 fixes
12. About page (Section 8)
13. `pnpm exec tsc --noEmit` — must pass with zero errors
14. Push to GitHub → deploy to Vercel

---

## COMPLETION CHECKLIST

- [ ] "Bespoke" replaced with "Atelier" everywhere user-facing
- [ ] Navbar shows correct structure with RTW dropdown + collections submenu
- [ ] Collections appear dynamically from database in nav
- [ ] `/atelier` page loads, `/bespoke` redirects to it
- [ ] `/shop` shows all products across all categories
- [ ] `/rtw` shows RTW products + collections strip
- [ ] `/rtw/collections/[slug]` loads with correct products
- [ ] Collections manageable from `/admin/shop/collections`
- [ ] Product detail page matches new editorial design
- [ ] Images are portrait 3:4 throughout
- [ ] Invoice can be created from consultation detail page
- [ ] Stage assignments work per-stage in order detail
- [ ] All debug logs removed
- [ ] Best sellers shows 4 products
- [ ] QR code auto-generates on attendance page load
- [ ] `pnpm build` passes with zero TypeScript errors

---

*Prepared by SonsHub Media Ltd for Prudential Atelier — prudentgabriel.com*
*₦7,500,000 engagement · Phase 4.5 of 5*
