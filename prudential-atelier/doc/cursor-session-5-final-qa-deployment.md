# CURSOR SESSION PROMPT — SESSION 5 (FINAL)
## Gap Filling · QA · Performance · Vercel Deployment · Presentation Prep
### Prudential Atelier · Picks up from Session 4 completion

---

> ## ⚠️ MANDATORY PRE-FLIGHT
>
> 1. **Never recreate files that exist.** Read File before creating.
> 2. **No `any` types.** Derive from Prisma or define explicit interfaces.
> 3. **This session is about completion, not new features.**
>    Fix what is broken, fill identified gaps, polish the UX, then deploy.
> 4. **Work through tasks in order.** Do not skip to deployment until code tasks pass build.
> 5. After every task: `npx tsc --noEmit` must pass.

---

## WHAT IS ALREADY BUILT (Sessions 1–4)

### ✅ Complete
- Full auth (login, register, Google OAuth, forgot/reset, referral cookie)
- All storefront pages (homepage, shop, product detail, bespoke, our story, contact, legal, 404)
- Full checkout (3-step, Paystack/Flutterwave/Stripe/Monnify, webhooks)
- Account dashboard (7 pages + all account APIs)
- Admin dashboard (layout, analytics, products, orders, bespoke, coupons, shipping, customers, reviews, referrals, settings)
- React Email templates (8 templates, wired into lib/email.tsx)
- Seed data (14 products, 4 users, 8 orders, 8 bespoke requests, coupons, shipping zones)
- DEPLOYMENT.md

### ❌ IDENTIFIED GAPS (this session fills these)
From Session 4 honest gaps report:
1. UI primitives: `Input`, `Select`, `Toggle` using native controls — replace with branded versions
2. Product admin: "Complete the Look" search UI, bulk publish, AlertDialog for delete
3. Orders: CSV export, refund modal
4. Missing storefront pages: Press page stub
5. Email preview entry compatibility for `react-email` CLI
6. Performance: image optimization, ISR, bundle size
7. Accessibility: focus rings, aria labels on icon-only buttons
8. Mobile: admin tables on small screens
9. TypeScript: any remaining TS errors or unsafe patterns
10. Deployment: Vercel config, migrate + seed in CI

---

## TASK A — UI PRIMITIVES (FILL GAPS)

Check each file. Only build if missing or using native controls without brand styling.

### A1 — Input Component

**`src/components/ui/Input.tsx`** — Check if exists and has floating label + brand styling.

If missing or incomplete, build:
```typescript
// 'use client'
// Props:
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  icon?: React.ReactNode      // left icon
  suffix?: React.ReactNode    // right element (e.g. show/hide button)
  hint?: string               // helper text below
}

// FLOATING LABEL PATTERN:
// Container: relative, pb-1 (space for error)
//
// Label: absolute, left-0, top-3.5 (when empty/unfocused)
//        transform: scale(0.75) translateY(-20px) (when focused OR has value)
//        transition: 200ms ease
//        Color: charcoal-light → wine on focus
//        Font: DM Sans, 14px
//        pointer-events: none
//
// Input:
//   width: 100%, pt-5, pb-1, px-0 (no padding-x for bottom-border effect)
//   Background: transparent
//   Border: none (remove default)
//   Border-bottom: 1px solid var(--border) default
//                  2px solid var(--wine) on focus
//                  2px solid var(--error) if error
//   Outline: none (outline-none)
//   Font: DM Sans, 16px, charcoal
//   Transition: border-color 200ms
//
// Error text: text-[var(--error)], 12px DM Sans, mt-1
// Hint text: text-charcoal-light, 12px, mt-1 (only if no error)
//
// Password variant (type="password"):
//   Show/hide toggle button (absolute right-0 top-3):
//   Eye / EyeOff from lucide-react
//   type toggles between "password" and "text"
//
// Icon: absolute left-0 top-3.5, adjusts input padding-left if present
//
// Disabled: opacity-50, cursor-not-allowed

// Export as default AND named: export { Input }
```

### A2 — Select Component

**`src/components/ui/Select.tsx`** — Check if exists with brand styling.

If missing, wrap Radix Select:
```typescript
// 'use client'
// Props:
interface SelectProps {
  label: string
  value: string
  onValueChange: (v: string) => void
  options: { value: string; label: string; disabled?: boolean }[]
  placeholder?: string
  error?: string
  disabled?: boolean
}

// Use: @radix-ui/react-select (already installed)
// TRIGGER: same visual as Input (bottom border only, floating label effect)
//   SelectTrigger: border-none, border-bottom 1px var(--border), bg-transparent
//   Focus: border-bottom 2px wine
//   ChevronDown icon right side (14px, charcoal-light)
//
// CONTENT (dropdown):
//   bg-cream, border border-border, shadow-lg, rounded-sm, z-50
//   max-height: 280px, overflow-y: auto
//   animation: slideDown 150ms ease
//
// ITEM:
//   padding: 10px 16px, text-charcoal, 14px
//   hover: bg-wine-muted (wine at 8% opacity), text-wine
//   Selected: gold CheckIcon left side
//   Disabled: opacity-40, cursor-not-allowed
//
// Label above trigger (same floating label style as Input — position absolute)
// Error text below (same as Input)
```

### A3 — Toggle Component

**`src/components/ui/Toggle.tsx`** — Check if exists. Admin uses toggle switches for published/featured/active states.

```typescript
// 'use client'
// Props:
interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  size?: 'sm' | 'md'
  label?: string    // optional visible label
  srLabel: string   // always required for screen readers
}

// TRACK:
//   sm: w-9 h-5  |  md: w-11 h-6
//   rounded-full
//   bg-[var(--border)] unchecked → bg-[var(--wine)] checked
//   transition-colors 200ms
//   cursor-pointer (not-allowed when disabled)
//   opacity-40 when disabled
//
// THUMB:
//   sm: w-3.5 h-3.5  |  md: w-4.5 h-4.5
//   bg-white, rounded-full, shadow-sm
//   absolute, top-[2px]
//   Framer Motion: x: 2 (unchecked) → track-width - thumb-width - 2 (checked)
//   transition: spring, stiffness 500, damping 30
//
// onClick: call onChange(!checked) unless disabled
//
// If label prop: render label text to right of toggle (flex row, items-center, gap-3)
// Always: <span className="sr-only">{srLabel}</span>
```

### A4 — AlertDialog Component

**`src/components/ui/AlertDialog.tsx`** — Used for delete confirmations in admin.

```typescript
// Wraps @radix-ui/react-alert-dialog (already installed as part of radix)
// If @radix-ui/react-alert-dialog not installed: use Modal.tsx with variant="danger"

// Props:
interface AlertDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string    // default "Confirm"
  cancelLabel?: string     // default "Cancel"
  variant?: 'danger' | 'warning'
  onConfirm: () => void | Promise<void>
  loading?: boolean
}

// OVERLAY: charcoal/60 backdrop-blur-sm
// CONTENT: bg-cream, border-border, rounded-sm, max-w-md, p-6, shadow-xl
// TITLE: Cormorant, 22px, charcoal (red if variant=danger)
// DESCRIPTION: DM Sans, 14px, charcoal-mid
// BUTTONS ROW (right-aligned, mt-6):
//   Cancel: ghost button (charcoal outlined)
//   Confirm: wine if danger, amber if warning
//            shows Spinner if loading=true
```

---

## TASK B — ADMIN PRODUCT TABLE POLISH

**Update `src/components/admin/ProductsTable.tsx`**:

### B1 — Replace confirm dialogs with AlertDialog
```typescript
// Replace window.confirm("Delete...?") with AlertDialog component
// State: deleteTarget: { id: string, name: string } | null
//
// [Delete] icon click: setDeleteTarget({ id, name })
// AlertDialog:
//   open: deleteTarget !== null
//   title: "Delete Product"
//   description: 'Are you sure you want to delete "[name]"? This cannot be undone.'
//   variant: "danger"
//   confirmLabel: "Delete Product"
//   onConfirm: async () => {
//     DELETE /api/admin/products/[id]
//     Remove row from local state (optimistic)
//     toast.success("Product deleted")
//     setDeleteTarget(null)
//   }
//   loading: isDeleting state
```

### B2 — Bulk Actions
```typescript
// State: selectedIds: Set<string>
//
// Header checkbox: selects/deselects all visible rows
// Row checkboxes: toggle individual selection
//
// BULK ACTION BAR (appears when selectedIds.size > 0):
//   Floats above table bottom OR pinned above table
//   "[X] selected" + action buttons:
//     [Publish] [Unpublish] [Mark as New Arrival] [Delete Selected]
//   Delete: uses AlertDialog
//     "Delete [X] products? This cannot be undone."
//
// Bulk API calls: Promise.all([...ids].map(id => PATCH /api/admin/products/[id]))
// On complete: refresh table, clear selection, toast summary
```

### B3 — "Complete the Look" Product Search in ProductFormPage

In `ProductFormPage.tsx`, the bundle section needs a working product search:
```typescript
// State: bundleSearch: string, bundleResults: Product[], selectedBundleIds: string[]
//
// Search input: type to search, debounced 400ms
// Fetch: GET /api/products?search=[query]&limit=5&isPublished=true
// Results dropdown (absolute positioned, z-10):
//   Each result: 36×48px thumbnail + name + category
//   Click: add to selectedBundleIds (if < 4 and not already added)
//   Exclude current product from results
//
// Selected bundles display (pill chips):
//   Product name + small thumbnail + X remove button
//   Max 4 chips, disable search if 4 reached
//
// Save as bundleProductIds in form state
```

---

## TASK C — ORDERS: CSV EXPORT

**Update `src/components/admin/OrdersTable.tsx`** — add working CSV export:
```typescript
// [Export CSV] button (top right of toolbar)
// Uses current filter state (same params as table)
// Fetch: GET /api/admin/orders?[current filters]&limit=1000&format=csv
//
// Client-side build (if API returns JSON):
// const csvRows = [
//   ['Order #', 'Customer', 'Email', 'Items', 'Subtotal', 'Shipping', 'Discount', 'Total', 'Currency', 'Gateway', 'Payment', 'Status', 'Date'],
//   ...orders.map(o => [
//     o.orderNumber,
//     o.user?.name || o.guestName || 'Guest',
//     o.user?.email || o.guestEmail || '',
//     o.items?.length || 0,
//     o.subtotalNGN,
//     o.shippingNGN || 0,
//     o.discountNGN || 0,
//     o.totalNGN,
//     o.currency,
//     o.paymentGateway || '',
//     o.paymentStatus,
//     o.status,
//     new Date(o.createdAt).toLocaleDateString('en-NG'),
//   ])
// ]
//
// const csv = csvRows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
// const blob = new Blob([csv], { type: 'text/csv' })
// const url = URL.createObjectURL(blob)
// const a = document.createElement('a'); a.href = url; a.download = 'pa-orders-[date].csv'; a.click()
// URL.revokeObjectURL(url)
```

---

## TASK D — ORDERS: REFUND MODAL

**Update `src/app/(admin)/admin/orders/[id]/page.tsx`** and order detail component:
```typescript
// [Issue Refund] button (only visible when paymentStatus === 'PAID')
// Opens RefundModal (build inline or as separate component):
//
// RefundModal content:
//   Title: "Issue Refund — #[orderNumber]"
//   Description: "Refunds are processed manually in your payment gateway dashboard."
//
//   Amount type: radio
//     ● Full Refund (₦[totalNGN])
//     ○ Partial Refund → number input
//
//   Reason: textarea (required)
//
//   Warning box (amber bg/10):
//     "⚠️ This records the refund in Prudential Atelier.
//      You must also issue the refund in your [gateway] dashboard separately."
//
//   [Cancel] [Record Refund] button
//
//   On confirm: PATCH /api/admin/orders/[id] {
//     paymentStatus: 'REFUNDED',
//     status: amount === total ? 'REFUNDED' : 'PROCESSING',  // partial = still processing
//     adminNotes: existing notes + '\n[DATE] Refund recorded: ₦[amount]. Reason: [reason]'
//   }
//   toast.success("Refund recorded")
//   Close modal + refresh order data
```

---

## TASK E — MOBILE ADMIN TABLES

Admin tables on mobile (< 768px) currently overflow. Fix:

**Pattern for all admin tables** (apply to ProductsTable, OrdersTable, BespokeTable, CustomersTable):
```typescript
// Add responsive wrapper: overflow-x-auto, -mx-8 on mobile to use full width
// Table: min-w-[700px] (prevents column collapse on small screens)
// Mobile: hide lower-priority columns via hidden md:table-cell
//
// In ProductsTable:
//   Mobile: hide "Category", "Type" columns — show only Name, Stock, Published, Actions
//
// In OrdersTable:
//   Mobile: hide "Gateway", "Currency" — show Order#, Customer, Total, Status, Date
//
// In BespokeTable:
//   Mobile: hide "Budget", "Timeline" — show Name, Occasion, Status, Date
//
// In CustomersTable:
//   Mobile: hide "Points", "Referrals" — show Name, Orders, Spent, Action
```

---

## TASK F — ACCESSIBILITY FIXES

Fix these specific accessibility issues:

### F1 — Icon-only buttons need aria-labels
```typescript
// Search all files for icon-only buttons:
//   Navbar search icon button: add aria-label="Search"
//   Navbar cart button: aria-label="Open cart" + aria-live count
//   Navbar wishlist button: aria-label="View wishlist"
//   CartDrawer close: aria-label="Close cart"
//   SearchModal close: aria-label="Close search"
//   ProductCard wishlist heart: handled by WishlistButton (check it has aria-label)
//   Admin sidebar toggle (if mobile): aria-label="Toggle navigation"
//   All X / close icon buttons: aria-label="Close" or contextual label
```

### F2 — Form error associations
```typescript
// All Input components: ensure input has aria-describedby pointing to error element id
// Example:
//   <input aria-describedby={error ? `${name}-error` : undefined} ... />
//   {error && <p id={`${name}-error`} role="alert"> {error} </p>}
```

### F3 — Focus rings
```typescript
// Add to globals.css (or tailwind config):
// All interactive elements must have visible focus-visible ring:
//   *:focus-visible { outline: 2px solid var(--wine); outline-offset: 2px; }
// Override for dark admin: admin area uses gold focus ring
//   .admin-area *:focus-visible { outline-color: var(--gold); }
// Add class "admin-area" to AdminShell outer div
```

---

## TASK G — PERFORMANCE OPTIMIZATIONS

### G1 — next.config.ts additions
```typescript
// Update next.config.ts:
const config: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
    formats: ['image/avif', 'image/webp'],  // add AVIF
    minimumCacheTTL: 31536000,              // 1 year for product images
  },
  // Compress responses
  compress: true,
  // Experimental: partial prerendering if Next 14.2+
  // experimental: { ppr: true },  — skip if causes build errors
  output: 'standalone',  // Required for Coolify/Docker later
}
```

### G2 — ISR and caching review
```typescript
// Verify these pages have correct revalidate exports:
// src/app/(storefront)/page.tsx:          export const revalidate = 3600 (1hr — homepage)
// src/app/(storefront)/shop/page.tsx:     export const revalidate = 300  (5min — product list)
// src/app/(storefront)/shop/[slug]/page: export const revalidate = 60   (1min — product detail)
// src/app/(storefront)/our-story/page:   export const revalidate = 86400 (24hr — static content)
// src/app/(storefront)/bespoke/page:     export const revalidate = 86400
// src/app/(storefront)/contact/page:     export const revalidate = 86400
// src/app/(storefront)/legal/*:          export const revalidate = 604800 (1 week)

// All admin pages: export const dynamic = 'force-dynamic' (never cache admin data)
// All API routes under /api/admin: add no-store cache headers
```

### G3 — Dynamic imports for heavy components
```typescript
// In src/app/(storefront)/shop/[slug]/page.tsx or its client wrapper:
const ReviewsSection = dynamic(() => import('@/components/product/ReviewsSection'), {
  loading: () => <Skeleton className="h-64 w-full" />,
})
const RelatedProducts = dynamic(() => import('@/components/product/RelatedProducts'), {
  loading: () => <div className="grid grid-cols-4 gap-6">{[...Array(4)].map((_, i) => <ProductCardSkeleton key={i} />)}</div>,
})

// In admin ProductFormPage:
const TiptapEditor = dynamic(() => import('@/components/admin/TiptapEditor'), { ssr: false })

// In checkout success page:
// canvas-confetti is already likely dynamic — verify it's not SSR'd
const loadConfetti = () => import('canvas-confetti').then(m => m.default)
// Call: const confetti = await loadConfetti(); confetti({...})
```

### G4 — Image priority audit
```typescript
// Ensure priority={true} on:
//   Hero image in Hero.tsx (above the fold, LCP element)
//   First 4 ProductCards in NewArrivals section
//   First image in ProductGallery on product detail page
//   All images in CollectionsGrid (above fold on desktop)
//
// Ensure loading="lazy" (default in next/image) on:
//   All images below the fold
//   All product images in shop grid
//   All admin thumbnails
```

---

## TASK H — TYPESCRIPT CLEANUP

### H1 — Audit and fix unsafe patterns

Run `npx tsc --noEmit` and fix ALL errors. Common patterns to fix:

```typescript
// 1. Prisma relation types — use explicit includes:
//    Instead of: const order = await prisma.order.findUnique(...)
//    Typed with: Prisma.OrderGetPayload<{ include: { items: { include: { product: true } } } }>

// 2. NextAuth session extensions — ensure src/types/next-auth.d.ts has:
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: string
      referralCode: string
      pointsBalance: number
      email: string
      name?: string | null
      image?: string | null
    }
  }
}

// 3. API route response types — all routes should return typed NextResponse:
//    import { NextResponse } from 'next/server'
//    return NextResponse.json<ApiResponse>({ ... })

// 4. React Hook Form with Zod — use zodResolver properly:
//    const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) })

// 5. cartStore items — ensure CartItem type has all fields used in checkout:
interface CartStoreItem {
  id?: string          // server CartItem id (for PATCH/DELETE)
  productId: string
  productName: string
  productSlug: string
  variantId: string
  size: string
  color?: string
  colorHex?: string
  image: string        // primary image URL
  priceNGN: number
  salePriceNGN?: number | null
  stock: number
  quantity: number
  category?: string    // for coupon category scope validation
}
```

### H2 — Remove remaining console.logs
```typescript
// Search all src/ files for console.log and console.error
// Remove debug logs
// Keep: console.error in email.ts (intentional fallback logging)
// Keep: console.log in seed.ts (intentional progress output)
```

---

## TASK I — EMAIL PREVIEW COMPATIBILITY

**Fix `src/emails/` for `react-email` CLI**:

```typescript
// Each email template needs a default export AND a named export of preview props
// Pattern for each file:

// At bottom of each email file, add:
export function PreviewProps() {
  return <WelcomeEmail firstName="Amara" pointsBalance={500} referralCode="AMARA-REF-001" />
}

// For react-email preview to work, index each template.
// Create src/emails/index.ts:
export { default as WelcomeEmail } from './WelcomeEmail'
export { default as OrderConfirmationEmail } from './OrderConfirmationEmail'
export { default as OrderShippedEmail } from './OrderShippedEmail'
export { default as BespokeConfirmationEmail } from './BespokeConfirmationEmail'
export { default as PasswordResetEmail } from './PasswordResetEmail'
export { default as ReferralSuccessEmail } from './ReferralSuccessEmail'
export { default as BackInStockEmail } from './BackInStockEmail'

// Update package.json email:dev script:
"email:dev": "email dev src/emails --port 3001"
// (older CLI versions): "email dev --dir src/emails --port 3001"
// Try both if one fails
```

---

## TASK J — PRESS PAGE

**`src/app/(storefront)/press/page.tsx`** — The stub from Session 3. Replace with real content:

```typescript
// Server component, revalidate: 86400
```

```
HERO (240px, bg-charcoal):
  Centered text (no image needed — clean editorial):
    SectionLabel (gold): "IN THE NEWS"
    h1 (Display M, ivory, Cormorant italic): "As Seen In"

PRESS FEATURES (bg-ivory, padding 80px 0):
  
  Grid (2-col desktop, 1-col mobile), gap 24px, max-w-4xl mx-auto
  
  Use these 6 hardcoded press items (realistic Nigerian fashion media):
  [
    {
      publication: "Vanguard Allure",
      headline: "Prudent Gabriel: Legacy Beyond Fashion",
      excerpt: "From a tiny room in Ajah to dressing celebrities across four continents — the story of one of Nigeria's most celebrated fashion entrepreneurs.",
      date: "September 2024",
      url: "https://allure.vanguardngr.com"
    },
    {
      publication: "Guardian Life",
      headline: "The Designer Putting Nigerian Bridal Fashion on the Global Map",
      excerpt: "Prudential Atelier's signature blend of French lace and West African silhouettes has captured the attention of brides from Lagos to London.",
      date: "August 2024",
      url: "#"
    },
    {
      publication: "Bella Naija Style",
      headline: "AMVCA 2024: Our Favourite Traditional Day Looks",
      excerpt: "Liquor Rose's jaw-dropping emerald aso-oke creation from Prudential Atelier was undeniably the standout of the AMVCA trad day red carpet.",
      date: "July 2024",
      url: "#"
    },
    {
      publication: "ThisDay Style",
      headline: "Nigeria's Fashion Academy Producing Thousands of Designers",
      excerpt: "Prudential Fashion Academy has quietly become one of the most impactful fashion training institutions in West Africa, with over 5,000 graduates.",
      date: "June 2024",
      url: "#"
    },
    {
      publication: "The Cable Lifestyle",
      headline: "Mercy Chinwo's Wedding: The Designers Behind the Looks",
      excerpt: "Gospel music's biggest wedding of 2022 featured a show-stopping Prudential Atelier creation for the traditional ceremony that trended for weeks.",
      date: "December 2022",
      url: "#"
    },
    {
      publication: "Pulse Nigeria",
      headline: "Meet the Self-Taught Designer Dressing Nigeria's Elite",
      excerpt: "With no formal training, Prudent Gabriel built an atelier employing 85 staff. Her story is a masterclass in determination and craft.",
      date: "March 2024",
      url: "#"
    },
  ]
  
  Each press card (bg-cream, border-border, p-6):
    Publication name (font-label, 11px, gold, uppercase)
    Headline (Cormorant, 20px, charcoal, font-semibold, line-clamp-2)
    Excerpt (DM Sans, 14px, charcoal-mid, line-clamp-3, mt-2)
    Footer row (mt-4): Date (small, grey) + [Read Article →] link (gold, if url !== '#')
    Hover: translateY(-2px) + shadow-md transition

PRESS CONTACT (bg-ivory-dark, padding 60px):
  Centered max-w-lg:
    SectionLabel: "PRESS ENQUIRIES"
    h2 (Heading L, Cormorant): "Media & Press Contact"
    p (Body M, charcoal-mid):
      "For interview requests, event coverage, and editorial collaborations:"
    Email link (Display S, Cormorant, wine): press@prudentialatelier.com
    Small note: "We typically respond within 48 hours."

PFABanner at bottom
```

---

## TASK K — SEED FINAL VERIFICATION

Run and verify the seed produces correct data. Fix any seed issues:

**`prisma/seed.ts`** — Verify and fix:
```typescript
// 1. All 14 products must be created (check for duplicate slug errors — wrap each in try/catch or use upsert)
// 2. All 6 coupons must exist (WELCOME10, FREESHIP, BRIDAL20, FLASH5000, VIP15, EXPIRED10)
// 3. All 5 shipping zones must exist
// 4. Admin user: admin@prudentialatelier.com / Admin@PA2024! (role: SUPER_ADMIN)
// 5. 3 customer accounts with correct referral chain (customer2 referred by customer1)
// 6. At least 1 review with isApproved: false (for admin review queue demo)
// 7. At least 1 bespoke request with status: PENDING (for admin bespoke queue demo)
// 8. At least 1 order in each major status: PENDING, PROCESSING, SHIPPED, DELIVERED

// Fix: use upsert pattern throughout to make seed idempotent:
// await prisma.user.upsert({
//   where: { email: 'admin@prudentialatelier.com' },
//   update: {},  // don't overwrite on re-seed
//   create: { ...adminData }
// })

// Fix: product upsert by slug:
// await prisma.product.upsert({
//   where: { slug: 'amore-bridal-gown' },
//   update: {},
//   create: { ...productData }
// })
// For nested creates (images, variants, colors): skip if product already exists (update: {})

// Final console.log output must show all counts clearly
```

---

## TASK L — VERCEL DEPLOYMENT PREPARATION

### L1 — Pre-deployment checklist file

Create **`CHECKLIST.md`** in project root:
```markdown
# Pre-Launch Checklist

## Code
- [ ] npx tsc --noEmit passes
- [ ] npx next build succeeds locally
- [ ] No console.log debug statements in production code
- [ ] All environment variables documented in .env.example

## Database
- [ ] DATABASE_URL (pooled) set in Vercel
- [ ] DIRECT_URL (unpooled) set in Vercel
- [ ] After deploy: npx prisma migrate deploy OR npx prisma db push
- [ ] After deploy: npx prisma db seed

## Auth
- [ ] NEXTAUTH_SECRET set (strong random value)
- [ ] NEXTAUTH_URL set to production domain
- [ ] NEXT_PUBLIC_APP_URL set to production domain
- [ ] Google OAuth: callback URL updated in Google Cloud Console (if using)

## Payments (test mode first)
- [ ] Paystack: test keys set, test payment completes
- [ ] Webhook URLs registered in payment dashboards
- [ ] STRIPE_WEBHOOK_SECRET matches registered webhook

## Email
- [ ] RESEND_API_KEY set OR emails logging to console is acceptable for demo
- [ ] ADMIN_EMAIL set to receiving email address

## Demo readiness
- [ ] Seed data loads: 14 products visible in /shop
- [ ] Admin login works: admin@prudentialatelier.com / Admin@PA2024!
- [ ] Customer login works: amara@example.com / Customer@2024
- [ ] Homepage loads without errors
- [ ] Product detail page shows variants + price switching
- [ ] Coupon WELCOME10 applies 10% discount at checkout
- [ ] /admin shows analytics with seeded data
- [ ] /admin/products shows 14 products
- [ ] /admin/bespoke shows 8 requests
- [ ] /admin/reviews shows 1 pending review

## Performance
- [ ] Lighthouse score > 80 on homepage (run after deploy)
- [ ] Core Web Vitals green in Vercel Analytics
```

### L2 — Environment variables final check

**Update `.env.example`** — ensure ALL keys are documented:
```bash
# DATABASE
DATABASE_URL=
DIRECT_URL=

# AUTH
NEXTAUTH_SECRET=
NEXTAUTH_URL=
NEXT_PUBLIC_APP_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# CLOUDINARY
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=

# PAYMENTS
PAYSTACK_SECRET_KEY=
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

# EMAIL
RESEND_API_KEY=

# CURRENCY
OPEN_EXCHANGE_RATES_APP_ID=

# APP
ADMIN_EMAIL=
ADMIN_PASSWORD=
CRON_SECRET=
```

### L3 — Build verification

Before Vercel deploy, run locally:
```bash
# Clean build (no cached .next)
rm -rf .next
npx prisma generate
npx tsc --noEmit
npx next build

# Verify build output:
# ✓ All pages should be either Static (○) or Dynamic (ƒ)
# ✓ No pages should show errors
# Expected static: /, /shop, /shop/[slugs], /bespoke, /our-story, /press, /contact, /legal/*
# Expected dynamic: /account/*, /admin/*, /checkout, /auth/*

# Verify standalone output (for Coolify later):
# .next/standalone/ directory should exist if output: 'standalone' set in next.config.ts
```

---

## TASK M — FINAL BUILD FIXES

After running `npx tsc --noEmit`, fix ALL remaining TypeScript errors.

Common error patterns from sessions 1–4 that may still exist:

```typescript
// 1. Missing return type on async server component:
//    async function Page(): Promise<JSX.Element> — not required but helps
//    Actually: just fix the actual errors, not add return types everywhere

// 2. Prisma nullable fields — use optional chaining:
//    order.user?.email instead of order.user.email (user can be null for guest orders)
//    order.addressSnapshot as AddressSnapshot — cast JSON field with type assertion

// 3. cartStore item type mismatch — ensure CartStoreItem interface matches all usage

// 4. NextResponse type issues:
//    import type { NextRequest } from 'next/server'

// 5. Date handling:
//    new Date(order.createdAt) — createdAt is already a Date from Prisma, no conversion needed
//    When displaying: format with date-fns formatDate (already in lib/utils.ts)

// 6. env var undefined:
//    process.env.NEXTAUTH_URL!  — asserting non-null where required
//    OR: const url = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

// 7. Image src type:
//    next/image src must be string | StaticImport
//    If potentially undefined: provide fallback: src={product.images[0]?.url ?? '/images/placeholder.jpg'}
//    Create public/images/placeholder.jpg — a simple 800×1067 grey rectangle

// Create placeholder image for missing product images:
// public/images/placeholder.jpg — use a simple grey block
// Can be created with: sharp or just a small base64 inline

// 8. Zod enum values — ProductCategory from Prisma vs string enum in Zod:
//    z.nativeEnum(ProductCategory) — ensure ProductCategory is imported from '@prisma/client'
```

### M1 — Create placeholder image
```bash
# In project root, create a minimal placeholder:
# public/images/placeholder.jpg
# 800×1067px, #E8DDD0 (ivory-deeper color), no text
# Create with script or use a minimal JPEG binary
# This prevents broken img tags when Cloudinary is not configured
```

To create the placeholder without external tools, add to seed or a setup script:
```typescript
// scripts/create-placeholder.ts
// Copy any small grey JPEG from the internet or create inline base64
// Alternatively: use a data URL in code as fallback instead of file
// In next.config.ts: add fallback image handling
```

Actually: use an SVG placeholder inline in code:
```typescript
// In ProductCard.tsx and anywhere src might be undefined:
const PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='1067'%3E%3Crect width='100%25' height='100%25' fill='%23E8DDD0'/%3E%3C/svg%3E"

// Usage: src={image?.url ?? PLACEHOLDER}
```

---

## TASK N — DEMO SCRIPT (for presentation day)

Create **`DEMO-SCRIPT.md`** in project root:
```markdown
# Prudential Atelier — Presentation Demo Script
## Website: https://prudential-atelier.vercel.app
## Prepared for: Mrs. Prudent Gabriel-Okopi

---

## OPENING (2 min)
Visit: / (homepage)
- Scroll slowly through hero → marquee → collections grid
- Point out: "The grid layout, the editorial feel, the Cormorant typography"
- Click "Ebony Evening Dress" in the Evening Wear collection card

## STOREFRONT EXPERIENCE (5 min)

### Product Discovery
Visit: /shop
- Show filters: click "Bridal" category chip → shows 3 bridal products
- Click price range slider: drag to ₦500k–₦1M
- Show "Clear All Filters" resets
- Sort by "Price: High to Low"

### Product Detail — Price Variants
Click: The Amore Bridal Gown
- Select UK 10 → price shows ₦850,000
- Select UK 16 → price updates to ₦920,000  ← SIZE CHANGES PRICE
- Switch currency: ₦ → $ → £ (top navbar) → price updates in real time
- Add to bag → cart drawer slides in
- Show: "You'll earn ~8,500 points with this order"

### Sale Product
Visit: /shop/ebony-evening-dress
- Show: crossed-out original price + sale price + countdown timer
- Show: "Save 20%" badge

### Cart + Checkout Demo
Add 2 items to cart, proceed to checkout
- Step 1: Apply coupon WELCOME10 → "10% discount applied — ₦X,XXX"
- Toggle points redemption (if logged in as Amara — 2,350 pts)
- Step 2: Fill Lagos address → shipping options appear → select "Free delivery" (order > ₦150k)
- Step 3: Select Paystack → click Pay → (in test mode, Paystack popup appears)
  OR: Show the payment gateway selection UI without completing

## ACCOUNT DASHBOARD (3 min)
Login as: amara@example.com / Customer@2024
Visit: /account

- Overview: 3 orders, 2,350 points = ₦2,350 credit, 2 referrals
- Wallet page: show points history (purchase, 2 referral bonuses)
- Referral page: copy link → "Share on WhatsApp"
  Point out: "Every person who signs up with her link earns both of them points"
- Orders page: click delivered order → show timeline (all steps completed)

## BESPOKE (1 min)
Visit: /bespoke
- Show 3-step form, fill Step 1, Step 2 briefly
- "This replaces WhatsApp DMs — every inquiry is organized and tracked"

## ADMIN DASHBOARD (5 min)
Login as: admin@prudentialatelier.com / Admin@PA2024!

### Analytics
Visit: /admin
- Revenue chart (last 30 days with seed data)
- 4 KPI cards
- Alert panels: out of stock, pending bespoke, expiring coupons

### Products
Visit: /admin/products
- 14 products in table, toggle published/featured live
- Click Edit on "Amore Bridal Gown"
  Show: VariantManager — 6 sizes, each with different price
  Show: Image uploader area
  Show: SEO preview

### Orders
Visit: /admin/orders
- 8 orders in various statuses
- Click a PROCESSING order → change status to SHIPPED → tracking number input
- "The customer receives an automatic email the moment you click Confirm"

### Bespoke Requests
Visit: /admin/bespoke
- 8 requests at different stages
- Click BQ-2024-00001 (Confirmed status)
  Show: full request details, measurements, reference images
  Show: [Email Client] [WhatsApp] buttons
  "All inquiries in one place — no more lost DMs"

### Coupons
Visit: /admin/coupons
- Show all 6 coupons
- Click Create Coupon
  Create: "LAUNCH20" — 20% off, 72 hours expiry
  "You can run a flash sale in 30 seconds"

### Reviews
Visit: /admin/reviews
- 1 pending review from Folake
- Click Approve → moves to approved tab instantly
  "Every review is moderated before your customers see it"

## CLOSE (1 min)
"This is your store. You own the data, you control the pricing,
 you manage every order, bespoke request, and customer relationship
 from one dashboard — no monthly Shopify fees, built exactly for
 Prudential Atelier."

---

## BACKUP: If internet/DB is slow
Have screenshots ready of:
- Homepage (full scroll)
- Product detail with price variants
- Admin dashboard
- Bespoke request detail
```

---

## FINAL BUILD + DEPLOYMENT COMMANDS

After all code tasks complete:

```bash
# Step 1 — Final local verification
cd prudential-atelier
npx prisma generate
npx tsc --noEmit
npx next build

# Step 2 — If DATABASE_URL is set locally:
npx prisma db push
npx prisma db seed
# Verify: visit http://localhost:3000 and confirm 14 products in /shop

# Step 3 — Push to GitHub
git add -A
git commit -m "feat: complete Prudential Atelier full-stack build"
git push origin main

# Step 4 — Vercel deployment
# (In Vercel dashboard after importing repo)
# Set all env vars from .env.example
# Build command: npx prisma generate && next build
# Deploy

# Step 5 — After Vercel deploy:
# In Vercel dashboard → Deployments → Functions → Terminal (or use Vercel CLI):
npx prisma db push          # apply schema to Neon DB
npx prisma db seed          # load demo data
# OR run locally with production DATABASE_URL:
# DATABASE_URL="[neon-pooled-url]" DIRECT_URL="[neon-direct-url]" npx prisma db seed
```

---

## SESSION END SUMMARY FORMAT

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SESSION 5 COMPLETE — PRUDENTIAL ATELIER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Task A — UI primitives: Input, Select, Toggle, AlertDialog
✅ Task B — Admin products: AlertDialog confirms, bulk actions, bundle search
✅ Task C — Orders CSV export
✅ Task D — Refund modal
✅ Task E — Mobile table overflow fixes
✅ Task F — Accessibility: aria-labels, error associations, focus rings
✅ Task G — Performance: next.config, ISR, dynamic imports, image priority
✅ Task H — TypeScript cleanup (zero errors)
✅ Task I — Email preview compatibility
✅ Task J — Press page (full content)
✅ Task K — Seed verified and idempotent
✅ Task L — Deployment prep: CHECKLIST.md, .env.example, build verified
✅ Task M — Build fixes (placeholder image, TS errors resolved)
✅ Task N — DEMO-SCRIPT.md created

BUILD STATUS:
  npx tsc --noEmit: ✅ 0 errors
  npx next build: ✅ succeeded

READY FOR VERCEL DEPLOYMENT.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AFTER DEPLOY — run in sequence:
  1. npx prisma db push (apply schema to Neon)
  2. npx prisma db seed (load demo data)
  3. Verify: /shop (14 products), /admin (login works)
  4. Run CHECKLIST.md items
  5. Present with DEMO-SCRIPT.md
```

---

*Prudential Atelier · Cursor Session 5 (Final)*
*Prepared by Nony | SonsHub Media*
