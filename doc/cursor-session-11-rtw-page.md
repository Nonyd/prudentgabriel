# CURSOR SESSION PROMPT — SESSION 11
## /rtw Page · Product Card Refinements · Navbar Updates
### Prudent Gabriel · prudentgabriel.com
### Prepared by Nony | SonsHub Media

---

> ## ⚠️ MANDATORY PRE-FLIGHT
>
> 1. **Never recreate files that exist.** Read File before creating.
> 2. **No `any` types.**
> 3. **Do NOT touch /shop** — it stays exactly as-is. We are adding /rtw alongside it.
> 4. **The existing ProductCard.tsx is working well** — we are only making
>    visual refinements, not rebuilding it from scratch.
> 5. After every task: `npx tsc --noEmit` must pass.

---

## WHAT THE SCREENSHOT SHOWS (reference for this session)

The existing prudentgabriel.com RTW page has:
- 4-column product grid, full-width, no sidebar
- White/grey studio backgrounds on all product photography
- Product images are portrait (3/4 ratio), models full-body
- "SELECT OPTIONS" label on hover (our quick buy panel)
- Product name in small caps or small font below image
- Price below name
- Load more button at bottom
- Simple black navbar with logo left, links center, account/cart right

This is the aesthetic target for /rtw.

---

## TASK A — CREATE /rtw PAGE

### A1 — RTW Page Route

**Create `src/app/(storefront)/rtw/page.tsx`** (Server Component):

```typescript
// Fetch initial products: type RTW OR category not BRIDAL
// (RTW page shows everything EXCEPT bridal — RTW, Evening, Formal, Casual, Kiddies, Accessories)
// Query: /api/products?type=RTW&limit=40&isPublished=true&sort=newest
// Also fetch content settings for page text
// revalidate: 300

// Metadata:
// title: "Ready to Wear | Prudent Gabriel"
// description: "Shop the latest ready-to-wear collection..."

// Render: RTWPageClient (client component for infinite scroll + filters)
```

### A2 — RTW Page Client Component

**Create `src/components/rtw/RTWPageClient.tsx`** (client component):

```
LAYOUT: Full viewport width, white background

── HERO / HEADER (minimal — not full-screen):
  Height: 200px desktop / 140px mobile
  Background: white
  
  Content (centered, text-center):
    Label (Jost 9px uppercase tracking-[0.25em], dark-grey): "PRUDENT GABRIEL"
    h1 (Bodoni Moda italic, 56px desktop / 32px mobile, black, line-height 0.95, mt-2):
      "Ready to Wear."
    
  NO subtext. NO buttons. Clean and minimal.
  Border-bottom: 1px solid var(--mid-grey)

── FILTER ROW (sticky, bg-white, border-bottom 1px solid var(--mid-grey), z-30):
  Height: 48px
  max-w-[1600px] mx-auto px-6
  
  LEFT: Horizontal scrollable chips row (hide scrollbar: scrollbar-hide class):
    ALL · DRESSES · JUMPSUITS · SETS · SUITS · KIDDIES · ACCESSORIES
    
    Each chip: 
      Jost 10px weight-500 uppercase letter-spacing 0.1em
      Padding: 6px 16px
      NO border-radius
      Border: 1px solid transparent
      
      Unselected: text-dark-grey, border-transparent
                  hover: text-black, border-mid-grey
      Selected:   text-black, border-black, bg-transparent
      
      Transition: 150ms ease
    
    Chips map to tag filters:
      ALL → no tag filter
      DRESSES → tag: 'dress'
      JUMPSUITS → tag: 'jumpsuit'
      SETS → tag: 'set'
      SUITS → tag: 'suit'
      KIDDIES → category: KIDDIES
      ACCESSORIES → category: ACCESSORIES
    
    Selecting updates URL params + re-fetches products
  
  RIGHT (ml-auto, flex items-center gap-4, flex-shrink-0):
    Total count: "[N] pieces" (Jost 10px, dark-grey)
    Sort dropdown (minimal — no box, just text + chevron):
      "NEWEST ▾" → opens dropdown
      Options: Newest · Price: Low–High · Price: High–Low
      Jost 10px uppercase, olive on active

── PRODUCT GRID:
  max-w-[1600px] mx-auto px-4
  Padding top: 32px
  
  Desktop (xl+): 4 columns
  Desktop (lg):  4 columns  
  Tablet (md):   3 columns
  Mobile:        2 columns
  
  Gap: 1px (tight — flush images like the reference screenshot)
  
  Render RTWProductCard for each product (see Task B)
  
  Loading state: skeleton grid (same dimensions as cards)

── LOAD MORE:
  Centered, margin-top: 48px
  
  Condition: hasMore && !isLoading
  
  Button:
    "[LOAD MORE]" text + current count display:
    "LOAD MORE  —  Showing [X] of [total]"
    
    Style: NO background, NO border
           Jost 11px uppercase tracking, dark-grey
           Underline on hover (text-decoration: underline)
           Cursor pointer
    
    On click: fetch next page, APPEND to products
  
  Loading: "LOADING..." (same style, no click)
  End: "— [total] pieces —" (Jost 10px, dark-grey/50, centered)
       Shown when all products loaded

── FOOTER SPACING: padding-bottom: 80px
```

### A3 — RTW-Specific Product Card

**Create `src/components/rtw/RTWProductCard.tsx`**:

This card is optimized specifically for the RTW page aesthetic.
It is simpler and cleaner than the main ProductCard.

```typescript
interface RTWProductCardProps {
  product: {
    id: string
    name: string
    slug: string
    images: { url: string; alt?: string; isPrimary: boolean }[]
    variants: { priceNGN: number; salePriceNGN?: number | null; size: string; stock: number }[]
    colors: { hex: string; name: string; imageUrl?: string | null }[]
    isOnSale: boolean
    isNewArrival: boolean
    category: string
    tags: string[]
  }
  priority?: boolean
}
```

```
CONTAINER: group, cursor-pointer, bg-white

IMAGE SECTION (aspect-[3/4], overflow-hidden, relative, bg-[#F8F8F6]):
  
  PRIMARY IMAGE: next/image fill object-cover object-top
    priority={priority} for first 8 cards
  
  SECONDARY IMAGE (on group-hover):
    opacity-0 → opacity-100, transition-opacity 500ms ease
    Absolute inset-0, same sizing
    Only render if images[1] exists
    If no second image: primary zooms slightly:
      group-hover:scale-[1.03] transition-transform 700ms ease
  
  HOVER PANEL (slides up from bottom):
    Transform: translateY(100%) → translateY(0) on group-hover
    Transition: 400ms cubic-bezier(0.25, 0.1, 0.25, 1)
    Background: white
    Padding: 12px 14px
    
    CONTENT based on variant count:
    
    Single variant / One Size:
      [ADD TO BAG] — full width, bg-black, white text
                     Jost 10px uppercase tracking, height 38px
      On click (e.stopPropagation): cartStore.addItem, toast
    
    Multiple sizes:
      SIZE ROW (flex gap-1 flex-wrap, mb-2):
        Each size chip: Jost 10px, padding 3px 8px
                        border: 1px solid #E8E8E4
                        hover: border-black
                        selected: bg-black text-white border-black
                        OOS: opacity-30, cursor-not-allowed, line-through
      
      [SELECT OPTIONS] — appears before size selected
        Jost 10px uppercase tracking, dark-grey, text-center
        Transforms to [ADD TO BAG] (black) once size is selected
  
  TOP-LEFT BADGE (absolute top-3 left-3):
    SALE only: "SALE" — bg-olive text-white, Jost 9px uppercase, px-2 py-0.5
    NEW only: "NEW" — bg-black text-white, same
    SALE takes priority over NEW

INFO SECTION:
  Padding: 10px 2px 16px
  
  Product name:
    Jost 13px weight-400 black
    line-clamp-1
    hover: opacity-70 transition 200ms
  
  Price row (mt-1.5):
    On sale:
      <del className="text-[12px] text-dark-grey font-light mr-2"> ₦[original] </del>
      <span className="text-[13px] text-olive font-medium"> ₦[sale] </span>
    Normal:
      <span className="text-[13px] text-dark-grey font-light">
        {multipleVariants ? 'From ' : ''} ₦[formatted]
      </span>
  
  COLOR DOTS (if colors.length > 0, mt-2):
    Flex row, gap-1.5
    10px circles, bg=[hex]
    ring-1 ring-[#E8E8E4]
    hover: ring-black transition 150ms
    Max 5, "+N" text in dark-grey/60 if more
    On dot click (e.stopPropagation):
      If color has imageUrl: swap primary image display
      Update selected color state

onClick (container, not buttons): router.push('/rtw/' + product.slug)
← Note: product detail pages stay at /shop/[slug] for now
  RTW cards link to /shop/[slug] (the existing detail page)
  We add /rtw/[slug] as a redirect or alias in a later session
```

---

## TASK B — PRODUCT CARD REFINEMENTS (global)

Apply these improvements to the existing **`src/components/common/ProductCard.tsx`** used on /shop:

### B1 — Name and price sizing

```typescript
// CURRENT: product name likely too small
// UPDATE:
// Product name: Jost 14px weight-400 (was 13px)
// Price: Jost 13px weight-300 (was 12px)
// Info section padding-bottom: 20px (add breathing room)
```

### B2 — Image hover — ensure secondary image works

```typescript
// Verify the secondary image crossfade is working:
// The transition must be:
//   primary: className="... transition-opacity duration-500 group-hover:opacity-0"
//   secondary: className="... opacity-0 transition-opacity duration-500 group-hover:opacity-100"
// 
// IMPORTANT: secondary image must only render if images[1]?.url exists
// If no secondary image: add zoom on primary instead:
//   primary gets: className="... transition-transform duration-700 group-hover:scale-[1.04]"
//   NO opacity change on primary
// 
// Make sure both are mutually exclusive — not both animating at once
```

### B3 — Quick buy panel refinement

```typescript
// The quick buy panel background should be white (not white/95 with blur)
// Remove backdrop-blur — it causes visual artifacts on some browsers
// Replace: bg-white/95 backdrop-blur-sm
// With:    bg-white (solid)
```

---

## TASK C — NAVBAR UPDATES

### C1 — Update "READY TO WEAR" link

**Update `src/components/layout/Navbar.tsx`**:

```typescript
// Change "READY TO WEAR" nav link href from /shop to /rtw
// The dropdown indicator (▾) stays
// 
// Desktop nav:
// HOME · ATELIER · BRIDESALS · READY TO WEAR ▾ · BOOK A CONSULTATION
//                                     ↓
//                              href="/rtw"
//
// Mobile menu: same change

// READY TO WEAR dropdown (if implemented):
//   Show sub-links on hover:
//     All Ready to Wear → /rtw
//     New Arrivals → /rtw?sort=newest
//     Dresses → /rtw?tag=dress
//     Jumpsuits → /rtw?tag=jumpsuit
//     Sets → /rtw?tag=set
//     Suits → /rtw?tag=suit
//   
//   Style: dropdown appears on hover (CSS group-hover, not JS)
//          bg-white, border-bottom 1px mid-grey, border-x 1px mid-grey
//          Each item: Jost 12px, charcoal, padding 10px 20px
//                     hover: bg-[#FAFAFA], text-olive
//          NO border-radius
//          Width: 200px
```

### C2 — Announcement bar content

The announcement bar messages come from content settings (wired in Session 10).
Verify they are displaying correctly on /rtw.

---

## TASK D — /rtw/[slug] REDIRECT

Product detail pages currently live at /shop/[slug].
When a user clicks a product on /rtw, they should go to the product detail page.

For now: RTW product cards link directly to `/shop/[slug]`.

**Also create a redirect for `/rtw/[slug]` → `/shop/[slug]`**:

**`src/app/(storefront)/rtw/[slug]/page.tsx`**:
```typescript
import { redirect } from 'next/navigation'

export default function RTWProductRedirect({ params }: { params: { slug: string } }) {
  redirect(`/shop/${params.slug}`)
}
```

This future-proofs the URL structure — `/rtw/[slug]` always works.

---

## TASK E — FILTER FUNCTIONALITY

### E1 — Tag-based filtering

The chips (DRESSES, JUMPSUITS, etc.) filter by product tags.
Products need to have these tags in the database.

**Update `prisma/seed.ts`** — add tags to existing products:
```typescript
// For each product in the seed, ensure appropriate tags:
// Dresses: tag 'dress'
// Jumpsuits/2-piece: tag 'jumpsuit'  
// Coord sets: tag 'set'
// Suits: tag 'suit'
// 
// Example update (add to existing product upserts):
// await prisma.product.update({
//   where: { slug: 'sunday-brunch-dress' },
//   data: { tags: ['dress', 'casual', 'modest'] }
// })
// 
// Update all 14 seeded products with appropriate tags
```

### E2 — API support for tag filtering

**Verify `src/app/api/products/route.ts`** supports tag filtering:
```typescript
// The existing products API should support:
// ?tags=dress (single tag)
// ?tags=dress,jumpsuit (multiple tags — OR logic)
// ?category=KIDDIES (category filter)
// 
// If not implemented, add to the where clause:
// if (tags) {
//   where.tags = { hasSome: tags.split(',') }
// }
```

---

## TASK F — PERFORMANCE ON /rtw

### F1 — Image optimization

```typescript
// RTWProductCard images:
// Add quality={85} to next/image
// For Unsplash URLs: append ?w=600&q=85 if not already present
// For Cloudinary URLs: add transformation c_fill,g_top,w_600,q_auto,f_auto
//
// Helper function in src/lib/utils.ts:
// optimizeImageUrl(url: string, width: number = 600): string
//   If Cloudinary URL: insert transformation
//   If Unsplash URL: append ?w=[width]&q=85
//   Other: return as-is
```

### F2 — Priority loading

```typescript
// First 8 cards get priority={true}
// Implement by passing index to RTWProductCard:
// <RTWProductCard key={p.id} product={p} priority={index < 8} />
```

---

## TASK G — MISSING SMALL FIXES

### G1 — scrollbar-hide utility

Add to `tailwind.config.ts` if not present:
```typescript
// In plugins array:
plugin(function({ addUtilities }) {
  addUtilities({
    '.scrollbar-hide': {
      '-ms-overflow-style': 'none',
      'scrollbar-width': 'none',
      '&::-webkit-scrollbar': { display: 'none' },
    },
  })
})
```

### G2 — Ensure /rtw appears in sitemap

**Update `src/app/sitemap.ts`**:
```typescript
// Add static URL:
{ url: baseUrl + '/rtw', lastModified: new Date(), priority: 0.9 }
```

### G3 — Footer links

**Update `src/components/layout/Footer.tsx`**:
```typescript
// Under SHOP column:
// Change "Ready to Wear" link from /shop to /rtw
// Keep "New Arrivals" as /rtw?sort=newest
// Keep "Bridal" as /bridesals (gallery page)
```

---

## FINAL CHECKS

```bash
npx tsc --noEmit    # must pass
npx next build      # must pass
```

Verify:
```
/rtw                        → 4-col grid, real products, no sidebar
/rtw                        → horizontal chip filter row at top
/rtw                        → click DRESSES chip → filters to dress products
/rtw                        → hover product → secondary image OR zoom
/rtw                        → hover → quick buy panel slides up from bottom
/rtw                        → load more button works, appends products
/shop/[slug]                → product detail still works (unchanged)
/rtw/amore-bridal-gown      → redirects to /shop/amore-bridal-gown
Navbar "READY TO WEAR"      → links to /rtw (not /shop)
```

---

## SESSION END FORMAT

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SESSION 11 COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Task A — /rtw page (header, chip filters, 4-col grid, load more)
✅ Task B — ProductCard refinements (name size, hover fix, quick buy)
✅ Task C — Navbar: READY TO WEAR → /rtw + dropdown
✅ Task D — /rtw/[slug] redirect → /shop/[slug]
✅ Task E — Tag filtering (seed tags, API support)
✅ Task F — Performance (image optimization, priority loading)
✅ Task G — Small fixes (scrollbar-hide, sitemap, footer links)

Build: ✅ passes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

*Prudent Gabriel · Session 11*
*Prepared by Nony | SonsHub Media*
