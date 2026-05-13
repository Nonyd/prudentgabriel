# CURSOR SESSION PROMPT — SESSION 15
## Collections System — Named Collections with Listing + Individual Pages
### Prudent Gabriel · prudentgabriel.com
### Prepared by Nony | SonsHub Media

---

> ## ⚠️ MANDATORY PRE-FLIGHT
>
> 1. **Never recreate files that exist.** Read File before creating.
> 2. **No `any` types.**
> 3. **This session adds new DB models** — run `npx prisma generate && npx prisma db push` after schema changes.
> 4. After every task: `npx tsc --noEmit` must pass.

---

## WHAT A COLLECTION IS

A **Collection** is a named, curated group of products.
Examples: "Rich & Regal", "Church Girl Collection", "La Femme", "Sunday Brunch"

Collections are:
- Created manually by admin with a name, description, cover image, and optional tag
- Products can be added manually OR auto-linked via a tag (e.g. tag "rich-regal" → auto-include all products with that tag)
- Each collection has its own editorial page at `/collections/[slug]`
- All collections listed at `/collections`
- Collections appear in the navbar and footer

---

## PRISMA SCHEMA ADDITIONS

```prisma
model Collection {
  id            String    @id @default(cuid())
  name          String    // "Rich & Regal"
  slug          String    @unique // "rich-regal"
  description   String?   @db.Text
  excerpt       String?   // Short tagline: "Elegance redefined for the modern woman"
  coverImage    String?   // Cloudinary URL — hero image for the collection page
  coverImageAlt String?
  
  // Auto-tag linking: if set, all products with this tag are included automatically
  autoTag       String?   // e.g. "rich-regal" — links products by tag
  
  // Manual product assignments (for products not tagged)
  products      CollectionProduct[]
  
  // Display
  isFeatured    Boolean   @default(false)  // shows on homepage
  isPublished   Boolean   @default(true)
  displayOrder  Int       @default(0)
  
  // Season / year label (optional)
  season        String?   // "SS25", "AW24", or null
  year          Int?      // 2025
  
  // SEO
  metaTitle       String?
  metaDescription String?
  
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([slug])
  @@index([isPublished, isFeatured])
}

// Manual product → collection assignments
model CollectionProduct {
  id            String     @id @default(cuid())
  collectionId  String
  collection    Collection @relation(fields: [collectionId], references: [id], onDelete: Cascade)
  productId     String
  product       Product    @relation(fields: [productId], references: [id], onDelete: Cascade)
  sortOrder     Int        @default(0)
  createdAt     DateTime   @default(now())

  @@unique([collectionId, productId])
  @@index([collectionId])
}

// Add to Product model:
// collections CollectionProduct[]
```

After adding: `npx prisma generate && npx prisma db push`

---

## TASK A — COLLECTION APIs

### A1 — Public Collections API

**`src/app/api/collections/route.ts`** (GET):
```typescript
// Fetch all published collections, orderBy displayOrder asc, createdAt desc
// Include: _count of products (manual + auto-tag)
// For auto-tag count: prisma.product.count({ where: { tags: { has: collection.autoTag }, isPublished: true } })
// Return: { collections: CollectionWithCount[] }
// Cache: revalidate 300
```

**`src/app/api/collections/[slug]/route.ts`** (GET):
```typescript
// Fetch collection by slug where isPublished: true
// 
// Fetch products two ways and merge (deduplicate by id):
//
// 1. Auto-tag products (if collection.autoTag set):
//    prisma.product.findMany({
//      where: { tags: { has: collection.autoTag }, isPublished: true },
//      include: { images: { where: { isPrimary: true }, take: 1 }, variants: { orderBy: { priceNGN: 'asc' }, take: 1 } }
//    })
//
// 2. Manual products:
//    via CollectionProduct join, orderBy sortOrder
//    same include as above
//
// Merge + deduplicate by productId
// Sort: manual products first (by sortOrder), then auto-tag products (by createdAt desc)
//
// Return: { collection, products: Product[], total: number }
// 404 if not found
// Cache: revalidate 60
```

### A2 — Admin Collections APIs

**`src/app/api/admin/collections/route.ts`** (GET, POST):
```typescript
// GET: all collections (published + unpublished), with product counts
//   Include _count manually + auto-tag count
//   OrderBy: displayOrder asc

// POST: create collection
//   Validate with collectionAdminSchema
//   Auto-generate slug from name if not provided
//   Return created collection
```

**`src/app/api/admin/collections/[id]/route.ts`** (GET, PATCH, DELETE):
```typescript
// GET: full collection with manual products list
// PATCH: update any field
// DELETE: delete collection + all CollectionProduct records (cascade)
//   Products themselves are NOT deleted — just unassigned
```

**`src/app/api/admin/collections/[id]/products/route.ts`** (GET, POST, DELETE):
```typescript
// GET: list manually assigned products for this collection
// POST: { productId, sortOrder? } — add product to collection manually
//   Check: product not already in collection
//   Return: updated CollectionProduct
// DELETE: ?productId=[id] — remove product from collection
```

**`src/app/api/admin/collections/[id]/reorder/route.ts`** (PATCH):
```typescript
// Body: { orderedProductIds: string[] }
// Update sortOrder for each CollectionProduct based on array position
```

---

## TASK B — VALIDATION SCHEMA

**`src/validations/collection.ts`**:
```typescript
import { z } from 'zod'

export const collectionAdminSchema = z.object({
  name:           z.string().min(2).max(100),
  slug:           z.string().min(2).max(100).regex(/^[a-z0-9-]+$/).optional(),
  description:    z.string().max(2000).optional(),
  excerpt:        z.string().max(200).optional(),
  coverImage:     z.string().url().optional().nullable(),
  coverImageAlt:  z.string().max(200).optional(),
  autoTag:        z.string().max(50).optional().nullable(),
  isFeatured:     z.boolean().default(false),
  isPublished:    z.boolean().default(true),
  displayOrder:   z.number().int().min(0).default(0),
  season:         z.string().max(10).optional().nullable(),
  year:           z.number().int().min(2000).max(2100).optional().nullable(),
  metaTitle:      z.string().max(60).optional(),
  metaDescription:z.string().max(160).optional(),
})
```

---

## TASK C — STOREFRONT: /collections PAGE

**`src/app/(storefront)/collections/page.tsx`** (Server Component):
```typescript
// Fetch all published collections with product counts
// revalidate: 300
// Metadata: title "Collections | Prudent Gabriel"
```

**`src/components/collections/CollectionsPage.tsx`** (client component):

```
HERO (280px, black bg):
  Centered:
    Label (Jost 9px uppercase tracking, white/50): "PRUDENT GABRIEL"
    h1 (Bodoni Moda italic, 64px desktop / 36px mobile, white, line-height 0.95):
      "Collections."
    p (Jost 14px weight-300, white/55, mt-3):
      "Every collection tells a story. Find yours."

COLLECTIONS GRID (bg-white, padding 80px 0):
  max-w-[1400px] mx-auto px-6

  LAYOUT — Editorial asymmetric grid:
  
  Desktop: alternating layout per collection
    Even rows: image LEFT (60%) + text RIGHT (40%)
    Odd rows:  text LEFT (40%) + image RIGHT (60%)
  
  Mobile: stacked (image top, text bottom always)
  
  Each collection block:
    MIN-HEIGHT: 500px desktop / 350px mobile
    
    IMAGE SIDE:
      Full-height image (next/image fill, object-cover, object-top)
      src: collection.coverImage || placeholder
      Hover: scale(1.02) transition 600ms ease
      overflow hidden
      
      PLACEHOLDER (if no coverImage):
        bg-[#F2F2F0]
        Centered: collection name initial in Bodoni Moda 120px, charcoal/10
    
    TEXT SIDE:
      Vertically centered, padding: 60px 80px desktop / 40px 24px mobile
      bg-white
      
      Season badge (if season set):
        "SS25" | "AW24" (Jost 9px uppercase tracking, olive, mb-4)
      
      Collection name (Bodoni Moda italic, 52px desktop / 32px mobile, black, line-height 1.0):
        e.g. "Rich & Regal"
      
      Excerpt (Jost 15px weight-300, dark-grey, line-height 1.8, mt-4, max-w-sm):
        collection.excerpt || ""
      
      Product count (Jost 11px uppercase tracking, dark-grey/50, mt-6):
        "[N] PIECES"
      
      [EXPLORE COLLECTION →] link → /collections/[slug]
        Jost 11px uppercase tracking, black
        border-bottom 1px solid black
        hover: color olive, border-olive
        padding-bottom: 2px
        
    Thin 1px divider between collections (full width, #F0F0EE)
  
  EMPTY STATE (if no collections):
    "No collections yet." (Jost 14px, dark-grey, centered, py-20)
```

---

## TASK D — STOREFRONT: /collections/[slug] PAGE

**`src/app/(storefront)/collections/[slug]/page.tsx`** (Server Component):
```typescript
// generateStaticParams: fetch 20 most recent published collection slugs
// generateMetadata: collection name, description, cover image
// revalidate: 60
// notFound() if collection not found
```

**`src/components/collections/CollectionDetailPage.tsx`** (client component):

```
── HERO (full-viewport height, 100svh):
  
  BACKGROUND:
    Full-bleed cover image (collection.coverImage)
    next/image fill, object-cover, object-top, priority
    
    If no cover image:
      bg-charcoal
      Large collection name as watermark:
        Bodoni Moda italic, 200px, white/5, absolute centered
  
  OVERLAY:
    gradient: linear-gradient(to top, rgba(10,10,10,0.85) 0%, transparent 60%)
  
  CONTENT (absolute bottom-16 left-16 desktop / bottom-8 left-6 mobile):
    
    Framer Motion stagger on mount:
    
    Season (if set):
      Jost 10px uppercase tracking, white/50, mb-3: "SS25 COLLECTION"
    
    Collection name (Display XL, Bodoni Moda italic, white, line-height 0.9):
      "Rich & Regal"
    
    Excerpt (Jost 16px weight-300, white/70, max-w-lg, mt-4):
      collection.excerpt
    
    Stats row (mt-6, flex gap-8):
      "[N] Pieces" (Jost 11px uppercase tracking, white/60)
      "Season [season] [year]" if set
    
    [SHOP THE COLLECTION] button (mt-8):
      1px solid white, white text, Jost 11px uppercase tracking
      padding 14px 40px
      hover: bg-white, black text
  
  Scroll indicator (absolute bottom-8 right-8):
    "SCROLL" vertical text + thin line
    white/40

── COLLECTION INTRODUCTION (bg-white, padding 80px 0):
  If collection.description:
    max-w-2xl mx-auto px-6 text-center
    
    Decorative divider: ——◆——  (gold/40)
    
    Description (Bodoni Moda italic 22px, charcoal, line-height 1.7, mt-6):
      collection.description
      (display as editorial pull quote)

── PRODUCTS GRID (bg-white OR bg-off-white alternating with intro):
  
  GRID HEADER (max-w-[1400px] mx-auto px-6, mb-8):
    Left: "[N] pieces in this collection" (Jost 11px uppercase, dark-grey/50)
    Right: Sort select (Newest | Price Low–High | Price High–Low)
  
  GRID (max-w-[1400px] mx-auto px-6):
    Desktop: 4 columns
    Tablet:  3 columns
    Mobile:  2 columns
    Gap: 1px (tight editorial)
    
    Render RTWProductCard for each product
    (same component from /rtw page — hover image swap, quick buy)
    
    First 8: priority={true}
    
    Empty: "No products in this collection yet."
  
  LOAD MORE (if > 24 products):
    Same pattern as /rtw
    "LOAD MORE — Showing [X] of [total]"

── MORE COLLECTIONS (bg-off-white, padding 80px 0):
  "Explore More Collections" (Bodoni Moda 36px italic, centered)
  
  3-column grid of OTHER collections (exclude current):
    Each card:
      Cover image (aspect 4/5, object-cover, hover scale 1.03)
      Collection name (Bodoni Moda 20px, mt-3)
      "[N] pieces" (Jost 11px, dark-grey)
      Clicking: navigates to /collections/[slug]
    
    Max 3 shown. If < 3 other collections: show what's available.
```

---

## TASK E — ADMIN COLLECTIONS MANAGEMENT

### E1 — Collections List Page

**`src/app/(admin)/admin/collections/page.tsx`** (Server Component)

Add to AdminSidebar under CATALOGUE (after Products, before Import):
```typescript
// Icon: Layers (Lucide)
// Label: "Collections"
// Href: /admin/collections
```

**`src/components/admin/CollectionsClient.tsx`** (client component):

```
PAGE HEADER:
  "Collections" (Bodoni Moda 24px)
  "[N] collections" (Jost 13px, dark-grey)
  [+ Create Collection] button (olive, right)

COLLECTIONS TABLE (white, border 1px #EBEBEA):
  Columns:
    Cover (48×64px thumbnail, object-cover, bg-[#F2F2F0] if none)
    Name + slug
    Products count (manual + auto-tag total)
    Auto-tag (if set: shows tag as olive chip)
    Season/Year (if set)
    Featured toggle
    Published toggle
    Display order (number, inline editable)
    Actions: [Edit] [Delete]
  
  Row click: opens CollectionFormModal (edit mode)
  [+ Create Collection]: opens CollectionFormModal (create mode)
  
  Drag handles for reordering (simple ↑↓ arrows, updates displayOrder)

DELETE:
  AlertDialog: "Delete [name]? Products will not be deleted, just unassigned."
  On confirm: DELETE /api/admin/collections/[id]
```

### E2 — Collection Form Modal

**`src/components/admin/CollectionFormModal.tsx`** (client component):

```
Radix Dialog, width 700px, NO border-radius

HEADER: "Create Collection" / "Edit: [name]"

TWO-COLUMN LAYOUT (60% left + 40% right):

LEFT COLUMN:

  BASIC INFO SECTION:
    Collection Name (Input, required)
      → auto-generates slug on blur
    
    Slug (Input, editable, shows URL preview):
      "prudentgabriel.com/collections/[slug]"
    
    Tagline/Excerpt (Input, max 200 chars):
      "Short line shown on collections listing page"
      e.g. "Dressed for every chapter of your story"
    
    Description (Textarea, max 2000 chars):
      "Full description shown on the collection page"
      Displayed as editorial pull quote
    
    Season + Year (2 inline inputs):
      Season: text input, max 6 chars — "SS25", "AW24", "FW25"
      Year: number input — 2025
  
  PRODUCTS SECTION:
    
    AUTO-TAG (optional):
      Label: "Auto-tag" (Jost 11px uppercase, dark-grey)
      Text input: e.g. "rich-regal"
      Helper: "All products with this tag are automatically included."
      Live count: "Currently matches [N] published products"
        → GET /api/products?tags=[value]&limit=0 to get count
      Note: "Products tagged after collection creation are included automatically"
    
    MANUAL PRODUCTS (optional, in addition to auto-tag):
      Label: "Also include these specific products:"
      Product search (debounced, GET /api/products?search=&limit=8):
        Results dropdown: image thumbnail + name
        Click to add: appears as chip below
        Already-added: shows as chip with X remove
      
      Chips list of manually added products
      Max 100 manually assigned products
      
      Note: "Manually added products appear before auto-tagged ones"

RIGHT COLUMN (sticky):

  COVER IMAGE:
    Large image area (aspect 3/4, bg-[#F2F2F0])
    Click: file picker → POST /api/admin/upload → set coverImage
    OR: paste URL into text input below
    [Upload Image] button
    [Preview] shows current image
    
    Image hint: "Use a portrait editorial image (3:4 ratio) for best results"
  
  STATUS & DISPLAY:
    Published toggle (default: ON)
    Featured on Homepage toggle:
      "Featured collections appear on the homepage"
    Display Order (number input):
      "Lower number = shown first"
  
  SEO (collapsible):
    Meta Title (max 60)
    Meta Description (max 160)
    Preview box

FOOTER:
  [Cancel] [Save Collection] (olive)

ON SAVE:
  Create: POST /api/admin/collections
  Edit: PATCH /api/admin/collections/[id]
  On success: close modal, refresh list, toast "Collection saved ✓"
```

### E3 — Collection Detail Admin Page

**`src/app/(admin)/admin/collections/[id]/page.tsx`** (Server Component):

```typescript
// Fetch collection with products
// Render CollectionDetailAdmin
```

**`src/components/admin/CollectionDetailAdmin.tsx`**:

```
HEADER:
  Back link ← Collections
  Collection name (Bodoni Moda 24px)
  [Edit Collection] button (outlined, opens CollectionFormModal)
  [View on Site ↗] link → /collections/[slug] (new tab)

TWO SECTIONS:

LEFT — Products in Collection:
  Tab: Manual ([N]) | Auto-tag ([N]) | All ([N])
  
  MANUAL TAB:
    List of manually assigned products:
      Drag handle | Thumbnail | Name | Price | [Remove] button
    Drag to reorder (or ↑↓ buttons) → PATCH reorder API
    
    [+ Add Products] → product search modal
  
  AUTO-TAG TAB:
    If autoTag set: shows all matching products
    "[N] products auto-included via tag: [autoTag]"
    List of matched products (read-only — manage tags on products)
    
    If no autoTag: "No auto-tag set. Edit collection to add one."

RIGHT — Collection Stats (sidebar):
  Total products (manual + auto-tag)
  Published / Draft breakdown
  Cover image preview
  [Edit Cover] button
  Created date
  Last updated
```

---

## TASK F — SEED DEFAULT COLLECTIONS

**Add to `prisma/seed.ts`**:

```typescript
const defaultCollections = [
  {
    name: 'Rich & Regal',
    slug: 'rich-regal',
    excerpt: 'Where opulence meets everyday elegance.',
    description: 'The Rich & Regal collection reimagines luxury for the modern Nigerian woman. Each piece commands attention with rich fabrics, bold silhouettes, and intricate detailing.',
    autoTag: 'rich-regal',
    coverImage: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1200',
    isFeatured: true,
    isPublished: true,
    displayOrder: 0,
  },
  {
    name: 'Church Girl Collection',
    slug: 'church-girl',
    excerpt: 'Modest, beautiful, and unmistakably Prudent Gabriel.',
    description: 'Grace and modesty elevated to high fashion. The Church Girl Collection celebrates covered elegance — long sleeves, flowing silhouettes, and refined details for the woman who dresses with intention.',
    autoTag: 'church-girl',
    coverImage: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=1200',
    isFeatured: true,
    isPublished: true,
    displayOrder: 1,
  },
  {
    name: 'La Femme',
    slug: 'la-femme',
    excerpt: 'For the woman who defines her own standard.',
    description: 'La Femme is our most editorial collection — dramatic cuts, unexpected fabrics, and a silhouette that turns every room into a runway.',
    autoTag: 'la-femme',
    coverImage: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1200',
    isFeatured: false,
    isPublished: true,
    displayOrder: 2,
  },
]

for (const col of defaultCollections) {
  await prisma.collection.upsert({
    where: { slug: col.slug },
    update: {},
    create: col,
  })
}
```

---

## TASK G — NAVBAR + FOOTER

### G1 — Add Collections to Navbar

**Update `src/components/layout/Navbar.tsx`**:

```typescript
// Option: Add "COLLECTIONS" as a nav item with dropdown
// 
// Desktop nav:
// HOME · ATELIER · BRIDAL · KIDS · COLLECTIONS ▾ · READY TO WEAR ▾ · CONSULTATION
//
// COLLECTIONS dropdown (hover):
//   All Collections → /collections
//   ─────────────────
//   [fetched dynamically OR hardcoded featured ones]
//   Rich & Regal → /collections/rich-regal
//   Church Girl → /collections/church-girl
//   La Femme → /collections/la-femme
//   ─────────────────
//   View All → /collections
//
// For the dropdown items: either hardcode the 3 seed collections
// OR fetch from /api/collections on the client (simpler: hardcode for now,
// admin can request a dynamic dropdown in a future session)
//
// Mobile menu: add "Collections" link → /collections
//   Sub-items: same as dropdown
```

### G2 — Footer

**Update `src/components/layout/Footer.tsx`**:
```typescript
// Under SHOP column, add before "New Arrivals":
// Collections → /collections
```

---

## TASK H — HOMEPAGE FEATURED COLLECTIONS SECTION

Replace the current `CollectionsGrid` component (which shows category-based grid)
with a `FeaturedCollections` component that shows actual Collection records:

**Update `src/app/(storefront)/page.tsx`**:
```typescript
// Add to server-side fetches:
const featuredCollections = await prisma.collection.findMany({
  where: { isFeatured: true, isPublished: true },
  orderBy: { displayOrder: 'asc' },
  take: 3,
})

// Pass to new FeaturedCollections component
// Keep the old CollectionsGrid as a fallback if no featured collections exist
```

**Create `src/components/home/FeaturedCollections.tsx`**:

```
Section: bg-white, padding: 100px 0

HEADER:
  SectionLabel (Jost 10px uppercase tracking, olive): "COLLECTIONS"
  h2 (Bodoni Moda italic, 52px, black, line-height 1.0): "The Edit."
  Subtext (Jost 14px weight-300, dark-grey, mt-3): "Curated collections, crafted with intention."
  [View All Collections] ghost link → /collections (right-aligned)

FEATURED GRID (mt-12):
  If 1 collection:  full-width hero card
  If 2 collections: 50/50 side by side
  If 3 collections: 1 large (left, 2/3) + 2 stacked (right, 1/3)
  
  Each collection card:
    aspect-[3/4] (portrait) for stacked small, aspect-[4/5] for large
    
    Background: coverImage (object-cover, object-top, fill)
    Overlay: gradient bottom charcoal/60
    Hover: image scale 1.03, transition 600ms
    
    Content (absolute bottom-0, padding 24px):
      Collection name (Bodoni Moda italic, 28px, white)
      Excerpt (Jost 13px weight-300, white/70, mt-1, line-clamp-2)
      "[N] pieces" (Jost 10px uppercase, white/50, mt-2)
      "Explore →" (Jost 11px uppercase, white, slides up on hover)
    
    Click: navigates to /collections/[slug]
  
  Fallback (if no featured collections):
    Show existing CollectionsGrid component (category-based)
```

---

## TASK I — SITEMAP

**Update `src/app/sitemap.ts`**:
```typescript
// Add /collections (priority 0.8)
// Dynamically add /collections/[slug] for each published collection (priority 0.7)
// Fetch from DB: prisma.collection.findMany({ where: { isPublished: true }, select: { slug: true, updatedAt: true } })
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
/collections                      → listing page, 3 seed collections
/collections/rich-regal           → full collection page, hero image, products grid
/collections/church-girl          → same
/admin/collections                → table with 3 seed collections
/admin/collections (modal)        → [+ Create Collection] form opens
/admin/collections (modal)        → auto-tag live count updates as you type
Homepage                          → FeaturedCollections shows Rich & Regal etc
Navbar                            → COLLECTIONS ▾ dropdown works
Footer                            → Collections link present
```

---

## SESSION END FORMAT

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SESSION 15 COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Task A — Collection APIs (public + admin CRUD + products assignment)
✅ Task B — Validation schema
✅ Task C — /collections listing page (alternating editorial layout)
✅ Task D — /collections/[slug] individual page (hero + products + more collections)
✅ Task E — Admin collections management (table + form modal + detail page)
✅ Task F — Seed: 3 default collections (Rich & Regal, Church Girl, La Femme)
✅ Task G — Navbar COLLECTIONS dropdown + footer link
✅ Task H — Homepage FeaturedCollections component (replaces static grid)
✅ Task I — Sitemap updated

Build: ✅ passes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

*Prudent Gabriel · Session 15 — Collections System*
*Prepared by Nony | SonsHub Media*
