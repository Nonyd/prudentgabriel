# CURSOR SESSION PROMPT — STAGE 3 COMPLETION + STAGE 4
### Prudential Atelier · Session 2
### Picks up from: Stage 3 shell built (Navbar, Footer, AnnouncementBar, Button, Badge, etc. done)

---

> ## ⚠️ READ BEFORE TOUCHING ANY FILE
>
> 1. **Do NOT recreate files that already exist.** Check before creating.
> 2. **Do NOT remove any existing working code** — even if unused by current layout.
> 3. The app lives at `prudential-atelier/` — all paths below are relative to that root.
> 4. `lucide-react` in this repo has no `Instagram`/`Facebook` exports — use `src/components/icons/SocialIcons.tsx` (already created) for all social icons.
> 5. After every file creation run `npx tsc --noEmit` mentally — no `any` types, no missing imports.
> 6. **Complete every step fully before moving to the next.** Do not leave TODOs or placeholder functions.

---

## CONTEXT — WHAT IS ALREADY BUILT

### ✅ Stage 1 — Complete
- `src/styles/tokens.css`, `globals.css`, `tailwind.config.ts`
- `src/lib/prisma.ts`, `src/lib/utils.ts`
- `src/providers/RootProvider.tsx`, `src/providers/LenisProvider.tsx`
- `src/app/layout.tsx` (fonts, providers, metadata)
- `vercel.json`, `.env.local`
- `src/app/api/cron/abandoned-cart/route.ts`
- `src/app/api/cron/expired-coupons/route.ts`

### ✅ Stage 2 — Complete
- `src/middleware.ts`
- `src/validations/auth.ts`
- `src/app/api/auth/register/route.ts`
- `src/app/api/auth/forgot-password/route.ts`
- `src/app/api/auth/reset-password/route.ts`
- `src/app/(auth)/layout.tsx` + all auth pages (login, register, forgot, reset, error)
- `src/app/ref/[code]/route.ts`
- `src/app/account/page.tsx` (shell)
- `src/app/admin/page.tsx` (shell)

### ✅ Stage 3 — PARTIALLY COMPLETE (shell only)
Already built:
- `src/components/ui/Button.tsx`, `Badge.tsx`, `Skeleton.tsx`, `Spinner.tsx`, `SectionLabel.tsx`, `Divider.tsx`
- `src/components/layout/AnnouncementBar.tsx`, `Navbar.tsx`, `MobileMenu.tsx`, `Footer.tsx`
- `src/components/common/CurrencySwitcher.tsx`
- `src/components/icons/SocialIcons.tsx`
- `src/app/(storefront)/layout.tsx`
- `src/app/(storefront)/page.tsx` (dark hero placeholder)
- `src/app/(storefront)/checkout/page.tsx` (shell)
- `src/store/cartStore.ts`, `src/store/currencyStore.ts`

### ❌ NOT YET BUILT (this session's work):
- `src/components/layout/CartDrawer.tsx`
- `src/components/layout/SearchModal.tsx`
- `src/components/common/ProductCard.tsx`
- `src/components/common/ProductCardSkeleton.tsx`
- `src/components/common/WishlistButton.tsx`
- `src/components/common/PFABanner.tsx`
- `src/components/common/QuickViewModal.tsx`
- `src/store/recentlyViewedStore.ts`
- `src/store/wishlistStore.ts`
- `src/app/api/currency/rates/route.ts`
- ALL of Stage 4 (products API, shop page, product detail page)
- ALL homepage sections (Stage 8 partial — needed for demo)

---

## TASK A — COMPLETE STAGE 3

### A1 — Zustand Stores (missing ones)

**`src/store/wishlistStore.ts`**
```typescript
// Zustand store — persisted to localStorage
// State: ids: string[]
// Actions:
//   addToWishlist(id: string): void
//   removeFromWishlist(id: string): void
//   toggleWishlist(id: string): void
//   isInWishlist(id: string): boolean
//   clearWishlist(): void
// Persist key: 'pa-wishlist'
// Use zustand/middleware persist
```

**`src/store/recentlyViewedStore.ts`**
```typescript
// Zustand store — persisted to localStorage
// State: ids: string[] — max 8 items, most recent first
// Actions:
//   addViewed(id: string): void  — prepend, deduplicate, cap at 8
//   clearViewed(): void
// Persist key: 'pa-recently-viewed'
```

---

### A2 — Currency API Route

**`src/app/api/currency/rates/route.ts`** (GET)

```typescript
// Fetch exchange rates from Open Exchange Rates API
// URL: https://openexchangerates.org/api/latest.json?app_id=[KEY]&symbols=NGN,GBP
// Cache in module-level variable: { rates, fetchedAt }
// Refresh only if > 1 hour old
// If OPEN_EXCHANGE_RATES_APP_ID is not set, return fallback rates:
//   { NGN: 1580, USD: 1, GBP: 0.79 }
// Response shape: { NGN: number, USD: number, GBP: number }
// Next.js cache: revalidate 3600
// On fetch error: return fallback rates (never throw to client)
```

Also create **`src/lib/currency.ts`**:
```typescript
// getExchangeRates(): Promise<{ NGN: number; USD: number; GBP: number }>
//   — calls the route above, OR fetches directly if called server-side
//   — use module-level cache (TTL 1 hour)
//   — fallback: { NGN: 1580, USD: 1, GBP: 0.79 }

// convertFromNGN(amountNGN: number, toCurrency: 'NGN'|'USD'|'GBP', rates): number
//   NGN → USD: amountNGN / rates.NGN
//   NGN → GBP: (amountNGN / rates.NGN) * rates.GBP
//   NGN → NGN: amountNGN

// formatPrice(amount: number, currency: 'NGN'|'USD'|'GBP'): string
//   NGN: Intl.NumberFormat 'en-NG', currency NGN, minimumFractionDigits 0
//        Override symbol: replace "NGN" with "₦" if Intl outputs letters
//   USD: Intl.NumberFormat 'en-US', currency USD
//   GBP: Intl.NumberFormat 'en-GB', currency GBP
```

---

### A3 — CartDrawer

**`src/components/layout/CartDrawer.tsx`** (client component)

```
Layout: Fixed overlay. Slides in from RIGHT.
        Framer Motion: x: '100%' → 0, transition 350ms easeOut.
        Backdrop: black/40, click to close.
        Drawer width: 420px desktop / 100vw mobile (max-w-[420px] w-full).
        z-index: 50.

HEADER:
  "Your Bag" (font-display, 20px) + item count "(X)"
  X close button (right)
  Thin gold bottom border

CART ITEMS (scrollable, overflow-y-auto, max-h calculated):
  Each item:
    - Product image: 64×80px, object-cover, rounded-sm
    - Right of image:
        Product name (14px, font-display)
        Size badge (font-label, 11px, gold)
        Color (if present, 12px grey)
        Quantity control:
          [ - ] [number] [ + ]
          Minus: disabled at qty=1, calls cartStore.updateQty(itemId, qty-1)
          Plus: calls cartStore.updateQty(itemId, qty+1)
        Price (right-aligned, formatPrice from currency store)
    - Remove button (X, top-right of item, calls cartStore.removeItem)
  
  Optimistic UI: update store immediately, no API call needed here
  (cart syncs to server via CartSyncProvider on login)

EMPTY STATE (when cart is empty):
  SVG inline icon: simple hanger or shopping bag outline (wine color, 64px)
  "Your bag is empty" (font-display, italic)
  "Discover pieces made for you."
  [Explore Collection] button → navigates to /shop, closes drawer

FOOTER (sticky bottom, border-t border-border, bg-cream, padding 20px):
  Points earn preview:
    Small gold pill: "🌟 You'll earn ~X points with this order"
    X = Math.floor(subtotalNGN / 100)
    Only show if subtotalNGN > 0
  
  Subtotal row:
    "Subtotal" (label)   [formatted price, right]
    "Shipping calculated at checkout" (small grey)
  
  [View Bag & Checkout] button:
    Full width, wine/gold, large
    navigates to /checkout, closes drawer
  
  [Continue Shopping] link:
    Centered below, small, gold, underline on hover

STATE: Read from cartStore (isOpen, items, totalItems, totalNGN)
ACTIONS: cartStore.close(), cartStore.updateQty(), cartStore.removeItem()
```

**Add CartDrawer to `src/app/(storefront)/layout.tsx`** — render inside the layout alongside Navbar and Footer. It's always in the DOM, toggled by isOpen.

---

### A4 — SearchModal

**`src/components/layout/SearchModal.tsx`** (client component)

```
STATE: local isOpen — add isSearchOpen / openSearch / closeSearch to cartStore
       OR create a separate uiStore. Use cartStore for simplicity (add fields).

Layout: Fixed full-screen overlay.
        Background: var(--charcoal)/95, backdrop-blur-sm.
        z-index: 60 (above CartDrawer).
        Framer Motion: opacity 0→1, duration 200ms.
        Press Escape to close (useEffect keydown listener).
        Click backdrop to close.

CONTENT (centered, max-w-2xl, mx-auto, pt-20):
  Close button: top-right of screen (X icon, ivory)
  
  Search input:
    Large, bottom-border only (no box), 48px height
    Font: var(--font-display), 24px, ivory
    Placeholder: "Search for a piece..." (ivory/40)
    Focus: auto-focus on open (autoFocus prop)
    Gold bottom border on focus
  
  RECENT SEARCHES (show when input is empty):
    Label: SectionLabel "RECENT SEARCHES" (ivory/60)
    Last 5 searches from localStorage key 'pa-recent-searches'
    Each: clickable chip → fills input + triggers search
    [Clear] link (right, small gold)
  
  SEARCH RESULTS (show when input has >= 2 chars):
    Debounce: 300ms after typing
    Fetch: GET /api/products?search=[query]&limit=6&isPublished=true
    Loading: 3 skeleton rows
    
    Each result row:
      Image thumbnail 48×60px | Name (ivory) | Category badge (gold) | Price
      Click → navigate to /shop/[slug], close modal, save query to recent searches
    
    No results: "No pieces found for '[query]'" (italic, ivory/60)
  
  FEATURED (show when input empty and no recent searches):
    SectionLabel: "FEATURED PIECES"
    2×2 grid of featured products (fetch /api/products?featured=true&limit=4)
    Small ProductCard variant (image + name + price, no hover effects, ivory text)

Connect to Navbar:
  - Search icon in Navbar calls openSearch()
  - SearchModal rendered in (storefront)/layout.tsx
```

---

### A5 — ProductCard

**`src/components/common/ProductCard.tsx`** (client component)

```typescript
interface ProductCardProps {
  product: {
    id: string
    name: string
    slug: string
    category: string
    isOnSale: boolean
    isNewArrival: boolean
    isBespokeAvail: boolean
    images: { url: string; alt?: string; isPrimary: boolean }[]
    variants: { priceNGN: number; salePriceNGN?: number | null; size: string }[]
    colors: { hex: string; name: string }[]
  }
  priority?: boolean  // for hero/above-fold cards
}
```

```
CONTAINER: group, relative, cursor-pointer
           onClick (not on buttons): router.push('/shop/' + product.slug)

IMAGE WRAPPER: aspect-[3/4], overflow-hidden, relative, bg-ivory-dark

  PRIMARY IMAGE: next/image fill, object-cover, object-top
                 transition-opacity duration-500
  
  SECONDARY IMAGE: next/image fill, object-cover, object-top
                   absolute inset-0
                   opacity-0 group-hover:opacity-100
                   transition-opacity duration-500
                   (use images[1].url if exists, else don't render)
  
  TOP-LEFT BADGES (absolute top-2 left-2, flex flex-col gap-1):
    isOnSale → Badge variant="wine" size="sm": "Sale"
    isNewArrival → Badge variant="gold" size="sm": "New"
    isBespokeAvail → Badge variant="outline-wine" size="sm": "Bespoke"
    (show max 2 badges — Sale first, then New, then Bespoke)
  
  TOP-RIGHT: WishlistButton (productId=product.id)
             absolute top-2 right-2
  
  BOTTOM (absolute bottom-0 left-0 right-0):
    Translucent overlay slides up 40px on group-hover:
    bg-gradient-to-t from-charcoal/80 to-transparent
    transform translate-y-full → translate-y-0 on group-hover
    transition-transform duration-300
    
    [Quick View] button centered:
      small, ivory text, no bg, border border-ivory/60
      onClick: e.stopPropagation(), opens QuickViewModal

INFO SECTION: padding 12px 0

  PRODUCT NAME: font-display, 16px, charcoal, line-clamp-1
  
  PRICE DISPLAY:
    Get lowest variant price (min of variants[].priceNGN)
    If product.isOnSale:
      Get lowest salePriceNGN from variants (filter non-null)
      Show: <span line-through text-charcoal-light text-sm> From [original] </span>
            <span text-wine font-medium> [sale price] </span>
    Else:
      "From [formatPrice(lowestPrice, currency)]" if multiple variants
      "[formatPrice(price, currency)]" if single variant
    
    Use currency from currencyStore + convertFromNGN()
  
  COLOR SWATCHES (if colors.length > 0):
    Row of small circles (12px), max 4 shown, +N if more
    Each: bg=[hex], ring-1 ring-border, rounded-full
    Tooltip on hover: color name

HOVER: container translateY(-4px), shadow-md → shadow-lg, transition 250ms
```

---

### A6 — ProductCardSkeleton

**`src/components/common/ProductCardSkeleton.tsx`**
```
Matches ProductCard dimensions exactly.
aspect-[3/4] shimmer block for image
Two shimmer lines below for name and price
Use Skeleton.tsx component
```

---

### A7 — WishlistButton

**`src/components/common/WishlistButton.tsx`** (client component)

```typescript
// Props: { productId: string; className?: string }
// 
// Reads wishlistStore.isInWishlist(productId)
// Renders: Heart icon (Lucide HeartIcon)
//   - Filled (Heart fill="currentColor"): if in wishlist → wine color
//   - Outline: if not in wishlist → charcoal/60, hover wine
//
// onClick:
//   If NOT logged in (useSession().status !== 'authenticated'):
//     router.push('/auth/login?callbackUrl=' + current path)
//     return
//   
//   Optimistic: toggle wishlistStore immediately
//   API call:
//     If adding: POST /api/wishlist { productId }
//     If removing: DELETE /api/wishlist?productId=[id]
//   On API error: revert store change + show toast error
//
// Button: no bg, padding 8px, rounded-full
//         hover:bg-wine-muted transition
//         size 32px × 32px
```

---

### A8 — PFABanner

**`src/components/common/PFABanner.tsx`** (client component)

```
Full-width strip. bg-charcoal. padding: 20px 0.
Responsive: stack on mobile, row on desktop.

Layout (desktop): 3 columns in a row
  LEFT:   Cormorant italic, gold, 20px: "Aspire to Create"
  CENTER: DM Sans, ivory, 14px:
          "Learn from the master. Prudential Fashion Academy has trained
           over 5,000 designers."
  RIGHT:  Button variant="secondary" (gold outlined):
          "Explore PFA Academy →"
          onClick: window.open('https://pfacademy.ng', '_blank')

Mobile: center-aligned stack, center button
Thin top border: 1px solid var(--gold)/20
```

---

### A9 — QuickViewModal

**`src/components/common/QuickViewModal.tsx`** (client component)

```typescript
interface QuickViewModalProps {
  productSlug: string | null  // null = closed
  onClose: () => void
}
```

```
MODAL: Radix Dialog, max-w-3xl, full-screen on mobile
       Framer Motion: scale 0.96→1 + opacity, 250ms easeOut
       Backdrop: charcoal/60

When productSlug is set:
  Fetch: GET /api/products/[slug]
  Loading: split skeleton (image left, lines right)

LAYOUT (2 columns, 50/50):

LEFT — Image:
  Primary image, aspect-[3/4], object-cover
  
RIGHT — Info:
  Category badge (gold)
  Product name (Heading L, Cormorant)
  PriceDisplay (same logic as ProductCard but larger)
  
  Divider
  
  Color selector (if colors exist):
    Small swatch row, selected has wine ring
  
  Size selector:
    Chips — available/unavailable states
    On select: update price display
  
  Qty control: simple — / number / +
  
  [Add to Bag] button — full width, wine/gold
    onClick: cartStore.addItem({...}), show toast "Added to bag ✓", close modal
  
  [View Full Details →] link → /shop/[slug], close modal

Close X button top-right of modal.
```

---

### A10 — Wire Everything Into Layout

**Update `src/app/(storefront)/layout.tsx`**:
- Import and render `CartDrawer` (always in DOM)
- Import and render `SearchModal` (always in DOM)
- Ensure Navbar receives `openSearch` handler

**Update `src/store/cartStore.ts`** — add if not present:
```typescript
// Add to CartStore interface:
isSearchOpen: boolean
openSearch: () => void
closeSearch: () => void
```

---

## TASK B — STAGE 4: PRODUCTS API

### B1 — Products List API

**`src/app/api/products/route.ts`** (GET)

```typescript
// Query params (all optional):
//   category: ProductCategory enum value
//   type: 'RTW' | 'BESPOKE'
//   tags: comma-separated string
//   sort: 'newest' | 'price-asc' | 'price-desc' | 'featured'
//   page: number (default 1)
//   limit: number (default 24, max 48)
//   search: string (searches name, description)
//   newArrival: 'true'
//   featured: 'true'
//   sale: 'true'
//   minPriceNGN: number
//   maxPriceNGN: number
//   ids: comma-separated product IDs (for recently viewed)
//   isPublished: 'true' (default) | 'false' (admin only)

// Build Prisma where clause dynamically from params
// isPublished: default true unless admin session + isPublished=false passed

// Include:
//   images: { where: { isPrimary: true }, take: 1 }
//   variants: { orderBy: { priceNGN: 'asc' }, select: { id, size, priceNGN, salePriceNGN, stock } }
//   colors: { select: { id, name, hex } }
//   _count: { select: { reviews: true } }

// Sort:
//   newest: { createdAt: 'desc' }
//   price-asc: { basePriceNGN: 'asc' }
//   price-desc: { basePriceNGN: 'desc' }
//   featured: [{ isFeatured: 'desc' }, { createdAt: 'desc' }]

// Pagination:
//   skip: (page - 1) * limit
//   take: limit
//   Also run prisma.product.count(same where) for total

// Response:
//   {
//     products: ProductListItem[],
//     total: number,
//     page: number,
//     totalPages: number,
//     hasNext: boolean,
//     hasPrev: boolean
//   }

// Cache: no-store (products change frequently)
// Error: return { error: string } with appropriate status
```

### B2 — Single Product API

**`src/app/api/products/[slug]/route.ts`** (GET)

```typescript
// Fetch by slug
// Include ALL relations:
//   images: { orderBy: { sortOrder: 'asc' } }
//   variants: { orderBy: { priceNGN: 'asc' } }
//   colors: true
//   reviews: {
//     where: { isApproved: true },
//     include: { user: { select: { name: true, image: true, firstName: true } } },
//     orderBy: { createdAt: 'desc' },
//     take: 20
//   }
//   bundleItems: {
//     include: {
//       target: {
//         include: {
//           images: { where: { isPrimary: true }, take: 1 },
//           variants: { orderBy: { priceNGN: 'asc' }, take: 1 }
//         }
//       }
//     }
//   }

// Compute:
//   averageRating: reviews.reduce(sum r.rating) / reviews.length || 0
//   reviewCount: reviews.length

// 404 if not found or not published (unless admin)
// Response: product object + averageRating + reviewCount
// Cache: revalidate: 60
```

### B3 — Wishlist API

**`src/app/api/wishlist/route.ts`**

```typescript
// GET: return user's wishlist product IDs
//   Auth required. Return: { ids: string[] }

// POST: add to wishlist
//   Auth required. Body: { productId: string }
//   Upsert WishlistItem. Return: { success: true }

// DELETE: remove from wishlist
//   Auth required. Query: ?productId=[id]
//   Delete WishlistItem. Return: { success: true }
```

---

## TASK C — STAGE 4: SHOP PAGE

### C1 — Shop Page

**`src/app/(storefront)/shop/page.tsx`** (Server Component)

```typescript
// Accept searchParams: {
//   category?: string, type?: string, sort?: string,
//   page?: string, search?: string, tags?: string,
//   minPrice?: string, maxPrice?: string, sale?: string
// }

// Server fetch: GET /api/products with all params
// Pass products + total + filters to client components
// revalidate: 300

// PAGE STRUCTURE:
```

```
HERO SECTION (280px):
  Background: wine with subtle grain texture (bg-wine + CSS noise filter or SVG)
  Centered text:
    SectionLabel (ivory): "THE COLLECTION"
    Heading (Display M, ivory, Cormorant italic): "The Edit"
    Subtext (Body M, ivory/70): "Discover pieces made for you"
  
  FILTER CHIPS ROW (below heading, scroll on mobile):
    All · Bridal · Evening Wear · Formal · Casual · Kiddies · Accessories
    Selected: ivory bg, wine text
    Unselected: transparent, ivory/70 border, ivory text
    Each chip: Link with ?category=[value] (updates URL, triggers server re-fetch)
    "All" selected when no category param

MAIN CONTENT (below hero):
  
  DESKTOP LAYOUT (lg+): Sidebar 280px fixed-width + Product grid flex-1
  MOBILE LAYOUT: No sidebar. "Filter & Sort" button (opens FilterDrawer)
  
  ── SIDEBAR (FilterPanel.tsx) desktop only:
  
  Header: "Refine" (Heading M) + [Clear All] link (if any active filter)
  
  Sections (Radix Accordion, defaultOpen):
    
    SORT:
      Radio options: Newest · Price: Low to High · Price: High to Low · Featured
      Update URL ?sort=[value]
    
    PRODUCT TYPE:
      Radio: All · Ready-to-Wear · Bespoke
      Update URL ?type=[RTW|BESPOKE]
    
    PRICE RANGE:
      Radix Slider: min 0, max 1000000, step 10000
      State: [minPrice, maxPrice]
      Display: "₦[min] – ₦[max]" formatted
      On change end: update URL ?minPrice=&maxPrice=
    
    SIZE:
      Chip buttons: XS · S · M · L · XL · XXL · Custom · UK8 · UK10 · UK12
      Multi-select allowed
      Update URL ?sizes=[comma,separated]
    
    TAGS:
      Chip buttons: Bridal · Evening · Modest · Corporate · Kiddies · Traditional
      Multi-select
      Update URL ?tags=[comma,separated]
    
    SALE ONLY:
      Checkbox: "Show sale items only"
      Update URL ?sale=true
    
    IN STOCK:
      Checkbox: "In stock only" (default true)
  
  All filter changes use router.push() — no page reload, URL stays clean.
  Active filters: show count badge on each section header.

  ── PRODUCT GRID HEADER:
    "Showing [X] of [total] pieces" (Body S, charcoal-light)
    Sort select (mobile only — same options as sidebar, Radix Select)
    Active filter pills row: each shows filter name + X to remove
    [Filter] button (mobile only): opens FilterDrawer
  
  ── PRODUCT GRID:
    CSS Grid:
      Mobile: 2 columns
      Tablet (md): 3 columns
      Desktop (lg): 3 columns (sidebar takes space)
      Wide (xl): 4 columns (only when no sidebar, e.g. future full-width mode)
    
    Gap: 24px
    
    Render ProductCard for each product
    Pass priority={true} to first 4 cards
    
    Loading state: 12× ProductCardSkeleton
    (Wrap grid in Suspense with skeleton fallback)
    
    Empty state:
      Centered, padding 80px
      Wine hanger icon (SVG inline, 64px)
      "No pieces match your search"
      [Clear All Filters] button

  ── PAGINATION (bottom of grid):
    Only show if totalPages > 1
    Layout: centered, flex row, gap 8px
    
    [← Prev] button: disabled on page 1
    Page numbers: show current ±2 pages, ellipsis for gaps
    [Next →] button: disabled on last page
    
    Each page: Link with ?page=[n]
    Current page: wine bg, ivory text, rounded-sm
    Other pages: outlined, hover wine bg
```

### C2 — Filter Panel Component

**`src/components/shop/FilterPanel.tsx`** (client component)
- Extract sidebar filter UI into this component
- Props: `searchParams` (current active filters), `onFilterChange` callback
- Use `useRouter` + `useSearchParams` for URL manipulation

### C3 — Filter Drawer (mobile)

**`src/components/shop/FilterDrawer.tsx`** (client component)
- Same content as FilterPanel but in a Radix Dialog / Drawer
- Triggered by "Filter & Sort" button on mobile
- Full-screen on mobile, slides from bottom

---

## TASK D — STAGE 4: PRODUCT DETAIL PAGE

**`src/app/(storefront)/shop/[slug]/page.tsx`** (Server Component)

```typescript
// generateStaticParams: fetch 20 most recent published products for ISR
// generateMetadata: use product name, description, first image
// revalidate: 60
// If product not found or not published: notFound()
```

```
PAGE LAYOUT (max-w-site mx-auto px-4):

BREADCRUMB (top, 12px, grey):
  Shop / [Category] / [Product Name]
  Using Next.js Link components

── TWO COLUMN LAYOUT (lg: side by side, mobile: stacked)

LEFT COLUMN (lg:w-[55%]):

  PRODUCT GALLERY (ProductGallery.tsx):
    
    Main image:
      aspect-[3/4], overflow-hidden
      next/image fill object-cover object-top
      On hover: inner div scales to 1.08 (CSS transition, overflow hidden clips it)
      Image counter: "1 / [total]" absolute bottom-right, tiny, ivory on dark bg
    
    Thumbnail strip (below main, horizontal scroll):
      Each: 72×96px, object-cover, cursor-pointer
      Selected: wine ring border 2px
      On click: Framer Motion → animate main image opacity 0→1 (key change)
      Max 6 thumbnails visible, scroll for more
    
    Mobile: swipeable (Swiper with free mode, no pagination needed — just swipe)

RIGHT COLUMN (lg:w-[45%], lg:sticky lg:top-32, lg:self-start):

  Category badge (gold, font-label)
  
  Product name (Display M, Cormorant, charcoal)
  
  REVIEW SUMMARY ROW:
    Gold star row (StarRating component, size sm, read-only)
    "[averageRating] ([reviewCount] reviews)"
    Click → smooth scroll to #reviews section
  
  Divider
  
  PRICE DISPLAY (PriceDisplay.tsx):
    Props: product, selectedVariant (null = show "From X")
    
    If variant selected + on sale:
      <del className="text-charcoal-light text-lg"> ₦[original] </del>
      <span className="text-wine text-2xl font-semibold"> ₦[sale] </span>
      <Badge wine> Save [X]% </Badge>
    
    If variant selected + NOT on sale:
      <span className="text-2xl font-semibold"> ₦[price] </span>
    
    If NO variant selected:
      "From ₦[lowest variant price]"
    
    Below main price (always):
      <span className="text-sm text-charcoal-light">
        Also: $[convertedUSD] · £[convertedGBP]
      </span>
    
    If product.saleEndsAt is set:
      <CountdownTimer endsAt={product.saleEndsAt} />
  
  Divider
  
  COLOR SELECTOR (if colors.length > 0):
    Label: "Colour: [selected color name]" (font-label)
    Swatch row:
      Each: 28px circle, bg=[hex], ring-2 ring-offset-2
      Selected: ring-wine
      Unselected: ring-transparent hover:ring-border
      Tooltip: color name on hover

  VARIANT/SIZE SELECTOR:
    Label: "Size" (font-label) + [Size Guide] link (opens SizeGuideModal)
    
    Grid of size chips (flex-wrap):
      Each chip: variant.size label
      
      Available + unselected:
        bg-cream, border-border, text-charcoal
        hover: border-wine, text-wine
      
      Selected:
        bg-wine, border-wine, text-ivory
      
      Out of stock (variant.stock === 0):
        bg-cream, border-border, text-charcoal-light/50
        line-through text
        Disabled pointer-events
        Small "Sold Out" tooltip on hover
      
      Low stock (0 < variant.stock <= lowStockAt):
        Show "Only [X] left!" badge below chip row (gold, small)
      
      On select:
        Update selectedVariant state
        Update PriceDisplay
        If out-of-stock: show StockAlertForm below chips
  
  QUANTITY CONTROL:
    Label: "Qty" (font-label)
    [ − ] [ number ] [ + ] row
    Minus: disabled when qty === 1
    Plus: disabled when qty >= variant.stock
    Style: each button 36×36px, outlined, wine on hover
  
  ACTION BUTTONS:
    [Add to Bag] — full width, large, variant="primary" (wine)
      Disabled if no size selected (show tooltip: "Please select a size")
      On click: cartStore.addItem(product, selectedVariant, selectedColor, qty)
               Show toast: "Added to your bag ✓"
    
    [Add to Wishlist] — full width, variant="secondary", HeartIcon left
      WishlistButton logic applied to full button (not just icon)
  
  TRUST BADGES ROW:
    Flex row, gap 16px, centered, margin-top 16px
    3 badges:
      🔒 "Secure Checkout"
      ✈️ "Ships Worldwide"  
      📏 "Free Size Guide"
    Each: icon + 11px text, charcoal-light

  ACCORDION (Radix, separated items):
    "Product Details"
      → dangerouslySetInnerHTML product.details (Tiptap HTML output)
      → prose styling: tailwind @tailwindcss/typography or manual
    
    "Size & Fit"
      → [View Full Size Guide] button → SizeGuideModal
      → Brief: "If between sizes, size up. Cut is [fitted/relaxed]."
    
    "Delivery & Returns"
      → "Free Lagos delivery on orders over ₦150,000. Ships worldwide."
      → "Returns accepted within 14 days in original condition."
    
    "Bespoke Version"  (only if product.isBespokeAvail === true)
      → "Have this piece made to your exact measurements."
      → "Lead time: 3–6 weeks. Starts from ₦[basePriceNGN × 1.3]"
      → [Book Bespoke Consultation] → /bespoke

── BELOW FOLD (full width, below 2-col section):

REVIEWS SECTION (#reviews, id="reviews"):

  Component: src/components/product/ReviewsSection.tsx
  
  Header: "Client Reviews" (Heading L) + "[reviewCount] reviews" badge
  
  RATING SUMMARY (if reviews exist):
    Large average: "4.8" (Display M, gold) + star row
    
    Rating bars (5 down to 1):
      Each row: "[N]★" label + progress bar (fill % of reviews) + count
      Bar: wine fill, ivory-dark bg, height 8px, rounded
  
  WRITE A REVIEW BUTTON:
    Show only if:
      a) User is logged in
      b) User has an order containing this product (orderId check)
    → Opens ReviewForm in a Modal
  
  REVIEWS LIST:
    Each review card:
      Stars (gold filled)
      Title (bold, 15px)
      Body (DM Sans, 14px, grey)
      Reviewer: avatar/initials circle (wine bg) + name + "Verified Purchase" badge if isVerified
      Date (small, grey, date-fns format)
      Helpful: "Helpful? 👍 [N]" button → POST /api/reviews/[id]/helpful
    
    Show 5 reviews, [Load More] button → show all
    If no reviews: "Be the first to review this piece" (italic, grey)

COMPLETE THE LOOK (if product.bundleItems.length > 0):
  Component: src/components/product/CompleteTheLook.tsx
  SectionLabel: "COMPLETE THE LOOK"
  Heading: "Style It With"
  Horizontal scrollable row of ProductCards

RELATED PRODUCTS:
  Component: src/components/product/RelatedProducts.tsx
  Fetch server-side: same category, exclude current, published, limit 4
  SectionLabel: "YOU MAY ALSO LIKE"
  4-column ProductCard grid

```

### D1 — Supporting Components

**`src/components/product/ProductGallery.tsx`** (client component)
- Extract gallery logic from detail page
- Props: `images: ProductImage[]`

**`src/components/product/PriceDisplay.tsx`** (client component)
- Props: `product`, `selectedVariant`, `currency`, `rates`
- Pure display component, no state

**`src/components/product/ReviewsSection.tsx`** (client component)
- Props: `reviews`, `averageRating`, `reviewCount`, `productId`

**`src/components/product/ReviewForm.tsx`** (client component)
```typescript
// React Hook Form + Zod: { rating: number (1-5), title: string (optional), body: string (min 10) }
// POST /api/reviews: { productId, rating, title, body }
// On success: toast "Review submitted for approval ✓", close modal
```

**`src/app/api/reviews/route.ts`** (POST)
```typescript
// Auth required
// Body: { productId, rating, title?, body? }
// Validate with Zod
// Check user has ordered this product (orderId) → set isVerified: true if so
// Create Review with isApproved: false (admin must approve)
// Return: { success: true }
```

**`src/components/ui/CountdownTimer.tsx`**
```typescript
// Props: { endsAt: Date | string }
// Shows DD:HH:MM:SS with labels
// useEffect interval (1s), cleanup on unmount
// When expired: show "Sale ended"
// When < 1hr: text turns wine/red (urgency)
```

**`src/components/ui/StarRating.tsx`**
```typescript
// Props: { rating: number, size: 'sm'|'md', interactive?: boolean, onChange?: (r: number) => void }
// Interactive (for review form): hover to preview, click to set
// Display: filled stars gold, empty stars ivory-dark/border
// Half stars: clip-path technique for .5 ratings
```

**`src/components/shop/SizeGuideModal.tsx`** (client component)
```
Radix Dialog, max-w-lg
Title: "Size Guide"
Tabs (Radix Tabs): Dresses · Suits · Kiddies
Each tab: HTML table
  Columns: Size Label | Bust (cm) | Waist (cm) | Hips (cm) | Height (cm)
  Data (use these exact values):
  
  DRESSES/SUITS:
  XS  | 76-80  | 58-62  | 84-88  | 155-162
  S   | 82-86  | 64-68  | 90-94  | 158-165
  M   | 88-92  | 70-74  | 96-100 | 162-168
  L   | 94-98  | 76-80  | 102-106| 165-172
  XL  | 100-104| 82-86  | 108-112| 168-175
  XXL | 106-112| 88-94  | 114-120| 170-178
  
  UK SIZES:
  UK 8  | 81     | 63     | 89     | 158-163
  UK 10 | 86     | 68     | 94     | 160-165
  UK 12 | 91     | 73     | 99     | 162-167
  UK 14 | 96     | 78     | 104    | 164-169
  UK 16 | 101    | 83     | 109    | 166-171
  
  KIDDIES:
  Age 2-3  | 54 | 51 | 55 | 88-96
  Age 4-5  | 58 | 54 | 59 | 98-108
  Age 6-7  | 62 | 57 | 63 | 110-120
  Age 8-10 | 67 | 61 | 68 | 122-135
  Age 9-12 | 73 | 65 | 74 | 135-150

Note at bottom: "For bespoke pieces, we take exact measurements. All sizes in centimetres."
[Book Bespoke] link at bottom
```

**`src/components/common/StockAlertForm.tsx`** (client component)
```typescript
// Inline, shown below variant selector when stock === 0
// Email input (pre-filled if logged in: session.user.email)
// [Notify Me When Back] button
// POST /api/stock-alert { email, productId, variantId }
// Success: "We'll email you when this is back in stock ✓" (replace form)
```

**`src/app/api/stock-alert/route.ts`** (POST)
```typescript
// Body: { email, productId, variantId }
// Upsert StockAlert (@@unique email+variantId)
// No auth required
// Return: { success: true }
```

---

## TASK E — RECENTLY VIEWED INTEGRATION

**`src/components/common/RecentlyViewed.tsx`** (client component)
```typescript
// Read IDs from recentlyViewedStore
// If empty: render nothing
// If has IDs: fetch GET /api/products?ids=[comma,separated]&limit=8
// Render horizontal scrollable row of ProductCards
// Section label: "RECENTLY VIEWED"
// Heading: "Picked Up Where You Left Off"
```

Add to product detail page:
```typescript
// In shop/[slug]/page.tsx — add a client wrapper component:
// 'use client'
// On mount: recentlyViewedStore.addViewed(product.id)
// This is a thin client-only wrapper that does nothing visual
// Call it <ViewTracker productId={product.id} />
```

---

## TASK F — CART API (server persistence for logged-in users)

**`src/app/api/cart/route.ts`** (GET, POST)
```typescript
// GET: Auth required. Return user's CartItems with product + variant data.
//      Response: { items: CartItemWithProduct[] }

// POST: Auth required. Body: { productId, variantId, colorId?, quantity }
//   Check variant exists + has stock
//   Upsert CartItem (@@unique userId+variantId+colorId)
//   If exists: increment quantity
//   Return: { success: true, cartItem }
```

**`src/app/api/cart/[itemId]/route.ts`** (PATCH, DELETE)
```typescript
// PATCH: { quantity: number }
//   Validate quantity >= 1 and <= variant.stock
//   Update CartItem.quantity
//   Return updated item

// DELETE: Remove CartItem
//   Verify CartItem belongs to current user
//   Return { success: true }
```

**`src/providers/CartSyncProvider.tsx`**
```typescript
// 'use client'
// On mount + on session change to 'authenticated':
//   Fetch GET /api/cart
//   Merge server cart into cartStore (union of local + server items)
//   If local cart has items and user just logged in: POST each to /api/cart
// This runs silently in background — no UI
```

---

## TASK G — HOMEPAGE SECTIONS (needed for demo)

**Replace `src/app/(storefront)/page.tsx`** with the full homepage.

This is a Server Component that fetches:
```typescript
// Parallel fetches:
const [featuredProducts, newArrivals] = await Promise.all([
  fetch(NEXT_PUBLIC_APP_URL + '/api/products?featured=true&limit=8&isPublished=true'),
  fetch(NEXT_PUBLIC_APP_URL + '/api/products?newArrival=true&limit=4&isPublished=true'),
])
```

Build all homepage sections as individual components in `src/components/home/`:

**`Hero.tsx`** (client — needs animation)
```
Full viewport (100svh). Relative, overflow-hidden.

Background: next/image fill, object-cover, object-position top
  src: high-quality editorial (use: https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=1400)
  priority: true
  alt: "Prudential Atelier — Luxury Nigerian Fashion"

Overlay: absolute inset-0, bg-gradient-to-t from-charcoal/80 via-charcoal/20 to-transparent

CONTENT (absolute, bottom: 15%, left: 50%, translateX -50%, text-center, w-full max-w-3xl px-4):
  
  Framer Motion stagger (on mount, once):
    [0] SectionLabel "THE NEW COLLECTION" (ivory)
        delay: 0ms
    
    [1] h1 (Display XL, Cormorant italic, ivory, leading-none):
        "Dressed in Stories,<br/>Draped in Legacy."
        delay: 200ms
    
    [2] p (Body L, ivory/80, max-w-lg mx-auto):
        "Bespoke couture and ready-to-wear for the woman who commands every room."
        delay: 400ms
    
    [3] Button row (flex gap-4 justify-center):
        [Shop The Collection] → /shop, variant="primary"
        [Book Bespoke] → /bespoke, variant="ghost" (ivory outlined)
        delay: 600ms

Scroll indicator (absolute bottom-8, left-50% transform):
  Thin vertical line 40px, wine color
  CSS animation: opacity pulse 2s infinite
  ArrowDown icon below

All entrance: opacity 0→1, translateY 30→0, 700ms easeOut
```

**`BrandMarquee.tsx`** (client)
```
Height: 48px, bg-wine, border-y border-gold/30
overflow: hidden, position: relative

Two divs side by side (duplicate for seamless loop):
  Content: "PRUDENTIAL ATELIER · BESPOKE COUTURE · LAGOS, NIGERIA · EST. 2019 · OVER 5,000 DESIGNERS TRAINED · "
  Font: var(--font-label), 11px, gold, letter-spacing 0.2em
  
  CSS animation: marquee (translateX 0 → -100%), linear, 40s, infinite
  (duplicate the text div so loop is seamless)
```

**`CollectionsGrid.tsx`** (server or client)
```
Section padding: var(--space-3xl) 0
Container: max-w-site mx-auto px-4

Header (text-center, mb-16):
  SectionLabel: "THE COLLECTIONS"
  h2 (Display M, Cormorant): "Crafted for Every Chapter"

GRID (CSS Grid, desktop 3-col × 2-row, mobile 2-col):
  
  Cell 1 (col 1, rows 1-2, portrait tall): BRIDAL
  Cell 2 (col 2, row 1, square): EVENING WEAR
  Cell 3 (col 3, row 1, square): FORMAL
  Cell 4 (col 2-3, row 2, wide landscape): READY-TO-WEAR
  
  Implementation:
    grid-template-columns: 1fr 1fr 1fr
    grid-template-rows: auto auto
    Cell 1: grid-row: span 2
    Cell 4: grid-column: span 2
  
  Each cell: relative overflow-hidden, min-height 300px
    Background image: next/image fill object-cover
    Hover: image scale 1.05 (CSS group-hover transition 600ms ease)
    
    Overlay (always): gradient bottom-to-top, charcoal/0 → charcoal/70
    
    Content (absolute bottom-0 left-0 p-6):
      Category name (font-label, 13px, ivory/80)
      Collection heading (Cormorant, 28px, ivory)
      
      "Explore →" (DM Sans, 14px, gold):
        translateY 20px → 0 on group-hover, opacity 0→1
        transition 300ms
    
    Each cell is a Link → /shop?category=[BRIDAL|EVENING_WEAR|FORMAL|CASUAL]

Images:
  Bridal: https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=800
  Evening: https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800
  Formal: https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=800
  RTW: https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800
```

**`NewArrivals.tsx`** (receives products as props)
```
Section: bg-ivory, padding var(--space-3xl) 0

Header row (flex justify-between items-end mb-12):
  Left:
    SectionLabel: "JUST IN"
    h2 (Heading L, Cormorant): "New Arrivals"
  Right:
    [View All →] Link → /shop?sort=newest, gold text, hover underline

Product grid: 4-column desktop / 2-column mobile
  ProductCard for each product
  Framer Motion stagger on useInView:
    Each card: opacity 0→1, translateY 30→0
    Delay: index × 100ms
    Trigger: once, threshold 0.1
```

**`BespokeStory.tsx`** (client — for scroll animation)
```
Section: bg-ivory-dark, overflow-hidden
Two columns (60/40) desktop, stacked mobile

LEFT (60%): 
  Full-height image, object-cover, no border-radius
  src: https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=1200
  Framer Motion: useScroll + useTransform
    y: ["-5%", "5%"] over section scroll range (parallax)

RIGHT (40%):
  Vertically centered, padding 60px 80px desktop / 40px 20px mobile
  
  SectionLabel: "THE ATELIER"
  h2 (Display M, Cormorant):
    "Every Stitch,<br/>A Signature."
  
  p (Body M, charcoal-mid, mb-8):
    "From our Lagos atelier to your most important moments — each piece 
     begins with a conversation and ends as a legacy."
  
  3 numbered steps (mt-8):
    Each step: flex items-start gap-4
    Number: Cormorant, 48px, wine/30, italic, leading-none, w-12 shrink-0
    Content:
      Step title: DM Sans, 14px, 500 weight, charcoal
      Step desc: DM Sans, 13px, charcoal-light
    
    01: "Consultation" — "A call, a vision, a plan built around you."
    02: "Crafting" — "Pattern, fabric, hand-sewn by our master tailors."
    03: "Delivery" — "Your piece, your story, delivered to perfection."
  
  Button mt-10: [Begin Your Journey] → /bespoke, variant="primary"

Section entrance: Framer Motion useInView, stagger right column content
```

**`BrandStats.tsx`** (client — for count-up)
```
Section: bg-charcoal, padding 80px 0

4-stat grid (2-col mobile, 4-col desktop):
  Thin gold vertical dividers between desktop columns (hidden mobile)
  
  Stats:
    "5,000+"  → "Designers Trained"
    "2019"    → "Est. in Lagos"
    "85+"     → "Team Members"
    "4"       → "Continents Served"
  
  Each stat:
    Number: Display L, Cormorant italic, gold (CountUp animation on inView)
    Label: font-label, 12px, ivory/60, letter-spacing 0.15em, uppercase, mt-2
  
  CountUp: use react-countup with enableScrollSpy={true}, scrollSpyOnce={true}
           Duration: 2s, separator ","
           For "5,000+": end=5000, suffix="+"
           For "2019": start=2010, end=2019, useEasing=false (no decimal)
           For "85+": end=85, suffix="+"
           For "4": end=4
```

**`Testimonials.tsx`** (client — Swiper)
```
Section: bg-ivory, padding var(--space-3xl) 0

Header (text-center):
  SectionLabel: "CLIENT LOVE"
  h2 (Display M, Cormorant): "From Our Women"

Swiper carousel (below header, mt-12):
  effect: "fade" OR slides with centered mode
  autoplay: { delay: 5000, disableOnInteraction: false }
  loop: true
  
  Each slide (max-w-2xl mx-auto text-center px-8):
    Opening quote mark: Cormorant, 120px, gold, opacity 0.25, absolute top-0 left-8
    
    Quote text (Display S, Cormorant italic, charcoal, mb-6):
      (see testimonials data below)
    
    Author section:
      Name (font-label, 13px, charcoal)
      Occasion (DM Sans, 12px, gold)
      Star row (5 gold stars, StarRating size="sm" rating={5})
  
  Navigation:
    Custom prev/next buttons: thin 36×36 squares, wine border, wine arrow icon
    Position: vertically centered sides of carousel
  
  Pagination: dots, wine fill, bottom

TESTIMONIALS DATA (hardcode these):
  [
    {
      quote: "I wore the Amore Bridal Gown and every single guest could not stop staring. Mrs. Gabriel-Okopi understood my vision completely. This is not just a dress — it is an heirloom.",
      name: "Amara O.",
      occasion: "Bride, Lagos 2024"
    },
    {
      quote: "The Lagos Power Suit made me walk into that boardroom and own every second. The tailoring is sharper than anything I have bought abroad. Nigerian excellence at its finest.",
      name: "Chidinma E.",
      occasion: "Corporate Client, Abuja"
    },
    {
      quote: "I ordered the Celestial Sequin Gown from London and it arrived better than the photos. The packaging was luxurious, the quality was extraordinary. I will shop nowhere else.",
      name: "Ngozi O.",
      occasion: "Client, London UK"
    },
    {
      quote: "From my first consultation to the delivery of my bespoke piece, everything was handled with such professionalism and heart. This brand is the future of Nigerian fashion.",
      name: "Temi A.",
      occasion: "Bespoke Client, Lagos"
    }
  ]
```

**`NewsletterSection.tsx`** (client)
```
Section: bg-wine, position relative, overflow-hidden

Grain overlay: pseudo-element with SVG noise filter (or CSS filter: url(#noise))
  opacity: 0.08, position absolute inset-0

Content (relative z-10, text-center, max-w-lg mx-auto, padding 80px 20px):
  SectionLabel (ivory/70): "INNER CIRCLE"
  h2 (Display M, Cormorant italic, gold): "Join the Atelier Community"
  p (Body M, ivory/70, mb-8):
    "Early access to collections, exclusive offers, and stories from the atelier."
  
  Form (React Hook Form):
    Row: email Input + [Subscribe] Button (gold variant)
    Input: dark variant — bg transparent, border-ivory/40, ivory text, focus:border-gold
    On submit: POST /api/newsletter { email }
    Success: Replace form with "✓ You're on the list. Welcome to the inner circle."
    
  Privacy note: "No spam, ever. Unsubscribe anytime." (tiny, ivory/40)
```

Add to page.tsx in order:
```
<Hero />
<BrandMarquee />
<CollectionsGrid />
<NewArrivals products={newArrivals} />
<BespokeStory />
<BrandStats />
<Testimonials />
<PFABanner />
<NewsletterSection />
```

---

## TASK H — NEWSLETTER API

**`src/app/api/newsletter/route.ts`** (POST)
```typescript
// Body: { email: string }
// Validate email with Zod
// Option A: if RESEND_API_KEY set — add to Resend audience (create 'newsletter' audience)
// Option B: store in DB — create a simple NewsletterSubscriber model
//   OR just log it (for now) and return success
// Return: { success: true }
// No auth required
// Rate limit: check if email already exists, return success without duplicate
```

For now: store in a simple `NewsletterSubscriber` table.
Add to prisma schema:
```prisma
model NewsletterSubscriber {
  id        String   @id @default(cuid())
  email     String   @unique
  createdAt DateTime @default(now())
}
```
Run `npx prisma db push` after adding.

---

## FINAL CHECKS BEFORE ENDING SESSION

After completing all tasks:

1. `npx tsc --noEmit` — must pass with zero errors
2. `npx next build` — must succeed
3. Verify these routes render without 500 errors:
   - `/` — homepage with all sections
   - `/shop` — product grid with 14 products from seed
   - `/shop/amore-bridal-gown` — full product detail
   - `/shop/ebony-evening-dress` — shows sale price + countdown
   - `/auth/login` — login page
   - `/auth/register?ref=AMARA-REF-001` — referral banner shows
4. Verify these API routes return valid JSON:
   - `/api/products` — returns 14 products
   - `/api/products/amore-bridal-gown` — returns full product
   - `/api/currency/rates` — returns { NGN, USD, GBP }

---

## SESSION END SUMMARY FORMAT

End this session with:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SESSION COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Task A — Stage 3 complete
✅ Task B — Products API complete
✅ Task C — Shop page complete
✅ Task D — Product detail page complete
✅ Task E — Recently viewed complete
✅ Task F — Cart API complete
✅ Task G — Homepage sections complete
✅ Task H — Newsletter API complete

NEXT SESSION: 
  - Stage 5 (Checkout + Payment)
  - Stage 6 (Account Dashboard)
  Begin with: CheckoutStepper, CartReview, CouponInput
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

*Prudential Atelier · Cursor Session 2*
*Prepared by Nony | SonsHub Media*
