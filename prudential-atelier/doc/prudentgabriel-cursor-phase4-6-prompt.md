# CURSOR AI — PRUDENTGABRIEL.COM
## Phase 4.6: Sub-brand Logos + WooCommerce Importer + UI/UX Polish
### Prepared by SonsHub Media Ltd (Nony — Okafor Chinonso Daniel)

---

## CRITICAL INSTRUCTIONS

1. Read the entire prompt before writing any code.
2. Do not change any working payment flows, auth logic, or database models unless explicitly instructed.
3. Run `pnpm exec tsc --noEmit` after each major section.
4. This phase has three independent sections — complete them in order.

---

## SECTION 1 — SUB-BRAND LOGO + INSTAGRAM SYSTEM

### What changes:
- When on `/bridal` or any bridal page → show Bridal logo + Bridal Instagram
- When on `/kids` or any kids page → show Kids logo + Kids Instagram
- When on `/atelier` or any atelier page → show Atelier logo + Atelier Instagram
- All other pages → show Main logo + Main Instagram
- Navbar logo changes, footer logo changes, footer Instagram changes
- Everything else in the navbar and footer stays identical

### Step 1 — Add SiteSetting keys

Add these keys to the settings seed/bootstrap in `src/lib/logos.ts` or wherever logo settings are initialised:

```typescript
// Sub-brand logos (light = for light backgrounds, dark = for dark backgrounds)
'logo_atelier_dark'    // Atelier logo on light background
'logo_atelier_white'   // Atelier logo on dark background
'logo_bridal_dark'     // Bridal logo on light background  
'logo_bridal_white'    // Bridal logo on dark background
'logo_kids_dark'       // Kids logo on light background
'logo_kids_white'      // Kids logo on dark background

// Sub-brand Instagram handles
'social_instagram'           // Main: @prudentgabriel (already exists)
'social_instagram_atelier'   // @prudential_atelier
'social_instagram_bridal'    // @prudential_bridal
'social_instagram_kids'      // @prudential_kids
```

### Step 2 — Logo component update

Update `src/components/ui/Logo.tsx` to accept a `subBrand` prop:

```typescript
interface LogoProps {
  variant: 'dark' | 'white'
  size?: 'sm' | 'md' | 'lg'
  subBrand?: 'main' | 'atelier' | 'bridal' | 'kids'
}
```

Logic:
- If `subBrand` logo URL is set in SiteSetting → use it
- If not set → fall back to main logo
- If main logo not set → fall back to text wordmark

The text wordmark fallback per sub-brand:
- main: "PRUDENTIAL / ATELIER"
- atelier: "PRUDENTIAL / ATELIER"
- bridal: "PRUDENTIAL / BRIDAL"
- kids: "PRUDENTIAL / KIDS"

### Step 3 — Page-aware logo in Navbar

The Navbar is a Server Component (or receives server data). Detect the current path and pass the correct `subBrand`:

```typescript
// In Navbar or its parent layout:
// Use Next.js headers() or pathname to detect sub-brand
import { headers } from 'next/headers'

function getSubBrand(pathname: string): 'main' | 'atelier' | 'bridal' | 'kids' {
  if (pathname.startsWith('/bridal')) return 'bridal'
  if (pathname.startsWith('/kids')) return 'kids'
  if (pathname.startsWith('/atelier')) return 'atelier'
  return 'main'
}
```

Pass `subBrand` to `<Logo>` in Navbar.

For the **client-side navbar** (if it's a client component), use `usePathname()` from `next/navigation`.

### Step 4 — Footer sub-brand switching

In `Footer.tsx`, detect current path and show:
1. Correct logo variant
2. Correct Instagram handle + link

```typescript
// Footer Instagram display:
// Main pages: @prudentgabriel → https://instagram.com/prudentgabriel
// Bridal pages: @prudential_bridal → https://instagram.com/prudential_bridal
// Kids pages: @prudential_kids → https://instagram.com/prudential_kids
// Atelier pages: @prudential_atelier → https://instagram.com/prudential_atelier
```

### Step 5 — Admin Settings → Appearance

In `/admin/settings/appearance`, extend the Brand Logos section:

```
MAIN BRAND
  Logo — Light Theme [upload] [preview]
  Logo — Dark Theme  [upload] [preview]

ATELIER
  Logo — Light Theme [upload] [preview]
  Logo — Dark Theme  [upload] [preview]

BRIDAL  
  Logo — Light Theme [upload] [preview]
  Logo — Dark Theme  [upload] [preview]

KIDS
  Logo — Light Theme [upload] [preview]
  Logo — Dark Theme  [upload] [preview]
```

Each upload saves to the corresponding SiteSetting key.
Show a note: "If sub-brand logo is not set, the main brand logo will be used."

### Step 6 — Admin Settings → Social Media

In `/admin/settings/general` → Social Media section, add:

```
Main Instagram handle: [input] placeholder "@prudentgabriel"
Atelier Instagram:     [input] placeholder "@prudential_atelier"
Bridal Instagram:      [input] placeholder "@prudential_bridal"
Kids Instagram:        [input] placeholder "@prudential_kids"
```

Save to respective SiteSetting keys.

---

## SECTION 2 — WOOCOMMERCE CSV PRODUCT IMPORTER

### Context from CSV analysis:
- 688 rows total: 63 parent products (variable), 624 variations, 1 simple
- Parent products have: images, description, categories, sizes (as attributes)
- Variations have: price, size, colour (linked to parent via `id:XXXX` in Parent column)
- **47 products are importable** (have images + description + at least one priced variation)
- Images are live URLs from `prudentgabriel.com/wp-content/uploads/`
- Sizes: `6, 8, 10, 12, 14, 16, 18, 20, 22, Custom`
- Category mapping: `rtw > Dress` → CASUAL/RTW, `rtw > suit` → FORMAL, etc.

### Route: `/admin/shop/import`

Add "Import Products" link to the Shop section in AdminSidebar.

### Import page layout:

```
┌─────────────────────────────────────────┐
│  Import Products from WooCommerce       │
│  Upload your WooCommerce CSV export     │
│                                         │
│  [Drop CSV file here or click to upload]│
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  [Preview table — shows after upload]   │
│                                         │
│  [IMPORT SELECTED PRODUCTS] button      │
└─────────────────────────────────────────┘
```

### Step 1 — CSV Parser (`src/lib/woocommerce-parser.ts`)

```typescript
export interface ParsedProduct {
  wcId: string
  name: string
  slug: string          // generated from name
  shortDescription: string
  description: string
  images: string[]      // array of image URLs
  category: ProductCategory  // mapped from WC categories
  tags: string[]
  variants: ParsedVariant[]
  minPrice: number
  sizes: string[]
  colors: string[]
  isImportable: boolean  // has images + description + priced variants
  skipReason?: string   // why it's not importable
}

export interface ParsedVariant {
  size: string
  color?: string
  price: number
  sku?: string
}

export function parseWooCommerceCSV(csvText: string): ParsedProduct[]
```

**Category mapping logic:**
```typescript
function mapCategory(wcCategories: string): ProductCategory {
  const cats = wcCategories.toLowerCase()
  if (cats.includes('bridal') || cats.includes('bride')) return 'BRIDAL'
  if (cats.includes('kids') || cats.includes('kiddies') || cats.includes('children')) return 'KIDDIES'
  if (cats.includes('suit') || cats.includes('3-piece') || cats.includes('2-piece')) return 'FORMAL'
  if (cats.includes('dress')) return 'CASUAL'
  if (cats.includes('jump')) return 'CASUAL'
  if (cats.includes('accessories') || cats.includes('bag')) return 'ACCESSORIES'
  return 'CASUAL' // default
}
```

**Slug generation:**
```typescript
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}
```

### Step 2 — Upload API Route

```
POST /api/admin/import/parse
Content-Type: multipart/form-data
Body: { file: CSV file }

Response: {
  total: number,
  importable: number,
  skipped: number,
  products: ParsedProduct[]
}
```

Logic:
1. Receive CSV file
2. Parse with `parseWooCommerceCSV()`
3. Return parsed products (do NOT save to DB yet)
4. Client displays the preview table

### Step 3 — Preview Table

After CSV is uploaded, show a preview table:

Columns:
- Checkbox (select/deselect)
- Product image (first image, small thumbnail 48x48px)
- Product name
- Category pill
- Price (from min variation price)
- Sizes (comma-separated, truncated)
- Colours (small colour dots)
- Status: "✓ Ready" (green) or "⚠ Skip — [reason]" (amber)

Controls above table:
- "Select all importable" button
- "Deselect all" button
- Counter: "47 of 63 products ready to import"

Only importable products have their checkbox enabled.
Non-importable show the skip reason and checkbox is disabled.

### Step 4 — Import API Route

```
POST /api/admin/import/execute
Body: { products: ParsedProduct[] }  // only selected products

Response: {
  imported: number,
  failed: number,
  errors: string[],
  productIds: string[]
}
```

Logic for each product:
1. Check if product with same slug already exists → skip if yes (don't duplicate)
2. Create `Product` record:
   ```typescript
   {
     name: product.name,
     slug: product.slug,  // ensure uniqueness with suffix if needed
     description: product.description,
     details: product.shortDescription,
     category: product.category,
     type: 'RTW',
     priceNGN: product.minPrice,
     isPublished: false,  // DRAFT — admin must review
     isNewArrival: false,
     isFeatured: false,
     tags: product.tags,
   }
   ```
3. Create `ProductImage` records for each image URL
   - Use the WooCommerce image URL directly (don't re-upload to Cloudinary yet)
   - Admin can replace with proper images later
   - Set first image as `isPrimary: true`
4. Create `ProductVariant` records for each size/colour combination:
   ```typescript
   {
     size: variant.size,
     priceNGN: variant.price,
     stock: 0,  // unknown — admin sets later
     lowStockAt: 3,
   }
   ```
5. Create `ProductColor` if colours exist
6. Log to ActivityLog: CREATE, module 'import'

### Step 5 — Post-import flow

After import completes, show results:

```
✓ 47 products imported successfully
⚠ 2 products failed (see details below)

All products are in DRAFT status.
Review and publish them from the Products page.

[VIEW IMPORTED PRODUCTS →]  [IMPORT AGAIN]
```

"VIEW IMPORTED PRODUCTS" links to `/admin/shop/products?status=draft`

### Step 6 — Products list — Draft filter

In `/admin/shop/products`, ensure the existing filter includes:
- All
- Published
- Draft ← new filter
- Out of Stock

When filtering by Draft, show a banner:
"These products were imported and are awaiting review. 
Set images, check prices, then publish."

---

## SECTION 3 — KIDS PAGE REDESIGN

The `/kids` page should feel more playful and colourful while staying within the brand family.

### Colour overrides for Kids pages only:

```css
/* Applied only on /kids and /kids/* routes */
/* Override via a kids-specific CSS class on the layout */
.kids-theme {
  --accent: #E8A838;        /* warm amber/gold */
  --accent-soft: #FFF3DC;   /* soft warm background */
  --hero-bg: #2D1B69;       /* deep purple — playful but premium */
  --cta-bg: #E8A838;        /* amber CTA buttons */
}
```

### Kids page layout changes:

**Hero section:**
- Background: deep purple `#2D1B69` (playful, premium)
- Headline: "Dressed for little royals" — Cormorant 52px, cream
- Subtitle: "Beautifully crafted pieces for the children who deserve the best."
- CTA: "Shop Kids Collection" button in amber

**Product grid:**
- Same 4-column grid as shop
- Product cards have a subtle warm amber badge accent instead of wine

**Category filters:**
- Pill filters use amber accent instead of chocolate

**Gallery section:**
- Slightly more colourful — warm tones
- Can show kids in outfits (from GalleryImage where category = KIDS)

Keep the same navbar, footer, and overall layout. Only the hero background, accent colour, and CTA colour change.

### Implementation:
In `src/app/(public)/kids/layout.tsx` (create if not exists):
```typescript
export default function KidsLayout({ children }) {
  return (
    <div className="kids-theme">
      {children}
    </div>
  )
}
```

Add `.kids-theme` CSS overrides to `globals.css`.

---

## SECTION 4 — UI/UX POLISH PASS

Go through every page of the platform systematically. For each page, fix:

### Typography consistency:
- All page eyebrows: Jost 10px, uppercase, letter-spacing 0.2em, `var(--lightbr)`
- All page titles: Cormorant Garamond, correct sizes (hero: 56-72px, section: 36-42px, cards: 18-22px)
- All body copy: Lora, 13-15px, line-height 1.8-1.9
- All UI labels, buttons, nav: Jost
- No Montserrat anywhere (it was replaced by Jost)

### Spacing consistency:
- Section padding: 72px top/bottom on desktop, 48px on mobile
- Card padding: 24-32px
- Grid gaps: 16-20px
- No sections that feel cramped or too sparse

### Colour accuracy:
- Replace any remaining hardcoded hex values with CSS variables
- Ensure dark mode responds correctly on every page
- Check: sidebars, cards, inputs, dropdowns all use CSS variables

### Button consistency:
- Primary: `var(--choc)` background, `var(--cream)` text, 2px border-radius
- Ghost on dark: `0.5px solid var(--lightbr)` border, `var(--cream)` text
- Ghost on light: `0.5px solid var(--nut)` border, `var(--nut)` text
- All buttons: Jost 10-11px, weight 600, letter-spacing 0.16em, uppercase
- Hover: smooth 0.2s transition

### Image consistency:
- ALL product images: portrait 3:4 aspect ratio, `object-fit: cover`, `object-position: center top`
- ALL hero images: portrait or full-bleed landscape — never awkward cropping
- Replace any broken image placeholders with a branded placeholder (chocolate background with a subtle "P" monogram or "PRUDENTIAL ATELIER" text)

### Pages to audit in order:

**PUBLIC:**
1. Homepage — check all 8 sections, animations, spacing
2. /shop — grid, filters, spacing
3. /shop/[slug] — product detail, gallery, size picker
4. /rtw — collections strip, grid
5. /rtw/collections/[slug] — collection detail
6. /bridal — gallery, hero
7. /atelier — landing page, process section, gallery
8. /kids — hero, grid (with new colour theme)
9. /journal — listing, featured post
10. /journal/[slug] — article layout
11. /consultation — 3-step wizard
12. /track — search + results
13. /about — full page
14. /login (modal) — form design
15. /register (modal) — form design

**CLIENT DASHBOARD:**
16. /account — dashboard home
17. /account/orders — bespoke + RTW tabs
18. /account/measurements — vault display
19. /account/loyalty — tier display
20. /account/wishlist

**STAFF PORTAL:**
21. /staff — dashboard
22. /staff/time — QR scanner
23. /staff/orders/[id]

**ADMIN:**
24. /admin — executive dashboard
25. /admin/bespoke — pipeline list + order detail
26. /admin/clients — CRM list + profile
27. /admin/attendance — dashboard
28. /admin/invoices — list + detail
29. /admin/settings — all settings pages

### Specific fixes needed (from screenshots reviewed):

**Homepage:**
- Best sellers: ensure 4 products show in a proper 4-column grid
- Consultation section: the booking widget form inputs need more padding
- Journal preview: featured post should be larger/more editorial

**Shop:**
- Product cards: ensure consistent card heights in the grid
- Missing images: show a branded placeholder instead of broken image icon

**Admin:**
- Invoice page subtitle: change "Prudential Atelier Bespoke" → "Prudential Atelier"
- Invoice table: "BESPOKE" column header → "ORDER"
- Sidebar: verify all items have correct active states

**Dark mode:**
- Check every page in dark mode — no cream/ivory text on cream/ivory background
- Cards should use `var(--bg-card)` not hardcoded colours
- Ensure `[data-theme="dark"]` variables apply correctly everywhere

### Branded placeholder image component:

Create `src/components/ui/ImagePlaceholder.tsx`:
```typescript
// Renders when no image is available
// Dark chocolate background with subtle "PG" monogram
// Used in: ProductCard, product detail, gallery
```

```tsx
export function ImagePlaceholder({ className }: { className?: string }) {
  return (
    <div className={`bg-choc flex items-center justify-center ${className}`}>
      <span style={{
        fontFamily: 'Cormorant Garamond, serif',
        fontSize: '32px',
        color: 'rgba(226,209,194,0.2)',
        letterSpacing: '0.1em',
        fontWeight: 300,
      }}>
        PG
      </span>
    </div>
  )
}
```

Use this everywhere an image fails to load or is missing.

---

## EXECUTION ORDER

1. Section 1 — Sub-brand logo + Instagram system
   - Add SiteSetting keys
   - Update Logo component with subBrand prop
   - Update Navbar for path-aware logo
   - Update Footer for path-aware Instagram
   - Update Admin Settings → Appearance
   - Update Admin Settings → Social Media
   - `pnpm exec tsc --noEmit`

2. Section 2 — WooCommerce importer
   - Build `src/lib/woocommerce-parser.ts`
   - Build `/admin/shop/import` page
   - Build `/api/admin/import/parse` route
   - Build `/api/admin/import/execute` route
   - Add Draft filter to products list
   - `pnpm exec tsc --noEmit`

3. Section 3 — Kids page redesign
   - Add kids-theme CSS variables
   - Create kids layout with theme wrapper
   - Update kids hero section
   - `pnpm exec tsc --noEmit`

4. Section 4 — UI/UX polish pass
   - Work through all 29 pages systematically
   - Fix typography, spacing, colours, images
   - Create ImagePlaceholder component
   - Fix admin invoice labels
   - Verify dark mode on every page
   - `pnpm exec tsc --noEmit`
   - `pnpm build` — must pass with zero errors

---

## COMPLETION CHECKLIST

- [ ] Logo changes on /bridal, /kids, /atelier pages
- [ ] Instagram handle changes in footer per sub-brand
- [ ] Admin can upload sub-brand logos in Appearance settings
- [ ] Admin can set sub-brand Instagram handles in General settings
- [ ] `/admin/shop/import` page loads
- [ ] CSV upload shows preview table with 47 importable products
- [ ] Import creates products as DRAFT (isPublished: false)
- [ ] Imported products visible in /admin/shop/products with Draft filter
- [ ] Kids page has playful purple/amber colour scheme
- [ ] All pages use Cormorant + Lora + Jost (no Montserrat)
- [ ] All product images are portrait 3:4
- [ ] Missing images show PG placeholder
- [ ] Dark mode works correctly on every page
- [ ] Invoice page says "ORDER" not "BESPOKE" in column header
- [ ] `pnpm build` passes with zero TypeScript errors

---

*Prepared by SonsHub Media Ltd for Prudential Atelier — prudentgabriel.com*
*₦7,500,000 engagement · Phase 4.6 of 5*
