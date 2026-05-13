# CURSOR SESSION PROMPT — SESSION 8
## Admin Redesign · Admin Login Page · Scroll Fixes · Dark Mode
### Prudent Gabriel · prudentgabriel.com
### Prepared by Nony | SonsHub Media

---

> ## ⚠️ MANDATORY PRE-FLIGHT
>
> 1. **Never recreate files that exist.** Read File before creating.
> 2. **No `any` types.** All types explicit or derived from Prisma.
> 3. **This session is VISUAL + UX** — no new features, no new DB models.
>    You are fixing scrolling, redesigning admin UI, adding admin login,
>    and implementing dark mode. Zero changes to API routes or DB schema.
> 4. **Dark mode must NOT affect the admin area** — admin is always light.
> 5. After every task: `npx tsc --noEmit` must pass.

---

## WHAT EXISTS (do not rebuild)

### ✅ Complete
- Full storefront, shop, checkout, account, consultation, bespoke pages
- Admin dashboard with all management pages
- `src/components/admin/AdminShell.tsx`, `AdminSidebar.tsx`, `AdminTopbar.tsx`
- `src/styles/tokens.css` — design tokens
- `src/providers/RootProvider.tsx` — wraps the app
- `src/middleware.ts` — handles auth + admin role check
- `src/app/(admin)/layout.tsx` — admin layout

---

## TASK A — SCROLL FIXES

This is the most impactful fix. Pages, forms, and sidebars are not scrolling.
The root cause is Lenis smooth scroll conflicting with overflow on certain containers,
and some containers having `overflow: hidden` or fixed heights without `overflow-y: auto`.

### A1 — Fix Lenis Provider

**Check `src/providers/LenisProvider.tsx`** and update:

```typescript
'use client'
import { useEffect, useRef } from 'react'
import Lenis from '@studio-freight/lenis'

export function LenisProvider({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null)

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.0,          // reduced from default — less floaty
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 0.8,   // reduced — prevents over-scrolling feel
      touchMultiplier: 1.5,
      infinite: false,
    })

    lenisRef.current = lenis

    function raf(time: number) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }
    requestAnimationFrame(raf)

    return () => {
      lenis.destroy()
    }
  }, [])

  return <>{children}</>
}
```

### A2 — Fix overflow on admin sidebar

**In `src/components/admin/AdminSidebar.tsx`**:

Find the sidebar container div and ensure:
```typescript
// Sidebar outer: fixed height, scrollable
className="... h-screen overflow-y-auto overflow-x-hidden"

// Navigation items container:
className="... flex-1 overflow-y-auto"
// Add: style={{ overscrollBehavior: 'contain' }}
```

### A3 — Fix overflow on account sidebar

**In `src/components/account/AccountLayout.tsx`** (or wherever account sidebar lives):

Same fix — sidebar must be `h-screen overflow-y-auto`, content area must be
`flex-1 overflow-y-auto min-h-0` (min-h-0 is critical in flex containers).

### A4 — Fix main content area scrolling

**In `src/app/(admin)/layout.tsx`**:
```typescript
// Main content wrapper must be:
<main className="flex-1 overflow-y-auto min-h-0 bg-white">
  {children}
</main>

// Outer shell:
<div className="flex h-screen overflow-hidden">
  <AdminSidebar />
  <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
    <AdminTopbar />
    <main className="flex-1 overflow-y-auto p-8 bg-white">
      {children}
    </main>
  </div>
</div>
```

**In `src/app/(account)/layout.tsx`**:
Same pattern — `h-screen overflow-hidden` outer, `flex-1 overflow-y-auto` content.

### A5 — Fix CartDrawer scroll

**In `src/components/layout/CartDrawer.tsx`**:

Cart items list must scroll independently:
```typescript
// Items container:
className="flex-1 overflow-y-auto overscroll-contain"
// Add data-lenis-prevent so Lenis doesn't intercept this scroll
data-lenis-prevent
```

### A6 — Fix SearchModal scroll

**In `src/components/layout/SearchModal.tsx`**:

Results list:
```typescript
className="overflow-y-auto max-h-[60vh] overscroll-contain"
data-lenis-prevent
```

### A7 — Fix Radix Dialog/Modal scroll

Any Radix Dialog content that scrolls needs:
```typescript
// Dialog content:
className="overflow-y-auto max-h-[85vh]"
data-lenis-prevent
```

Add to `src/components/ui/Modal.tsx` — ensure the content div has
`overflow-y-auto` and `data-lenis-prevent`.

### A8 — Fix globals.css for Lenis

**In `src/styles/globals.css`** ensure this exists:
```css
/* Lenis scroll containers */
[data-lenis-prevent] {
  overscroll-behavior: contain;
}

/* Prevent Lenis on fixed/sticky elements */
.admin-area {
  /* Admin never uses Lenis */
}

html.lenis {
  height: auto;
}

.lenis.lenis-smooth {
  scroll-behavior: auto !important;
}

.lenis.lenis-smooth [data-lenis-prevent] {
  overscroll-behavior: contain;
}
```

### A9 — Disable Lenis in Admin

Lenis smooth scroll should NOT run in the admin area — admin needs native scroll.

**In `src/providers/LenisProvider.tsx`**:
```typescript
import { usePathname } from 'next/navigation'

export function LenisProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAdmin = pathname?.startsWith('/admin')
  
  useEffect(() => {
    if (isAdmin) return  // No Lenis in admin
    
    const lenis = new Lenis({ ... })
    // ... rest of setup
    
    return () => lenis.destroy()
  }, [isAdmin])

  return <>{children}</>
}
```

---

## TASK B — DARK MODE SYSTEM

### B1 — Theme Store

**Create `src/store/themeStore.ts`**:
```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ThemeStore {
  isDark: boolean
  toggle: () => void
  setDark: (dark: boolean) => void
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      isDark: false,
      toggle: () => set((s) => ({ isDark: !s.isDark })),
      setDark: (dark) => set({ isDark: dark }),
    }),
    { name: 'pg-theme' }  // localStorage key
  )
)
```

### B2 — Theme Provider

**Create `src/providers/ThemeProvider.tsx`**:
```typescript
'use client'
import { useEffect } from 'react'
import { useThemeStore } from '@/store/themeStore'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { isDark } = useThemeStore()

  useEffect(() => {
    const root = document.documentElement
    if (isDark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [isDark])

  return <>{children}</>
}
```

**Add ThemeProvider to `src/providers/RootProvider.tsx`**:
```typescript
// Wrap children with ThemeProvider alongside existing providers
<ThemeProvider>
  {/* existing providers */}
</ThemeProvider>
```

### B3 — Dark Mode CSS Variables

**In `src/styles/tokens.css`** add dark mode overrides:
```css
/* ── DARK MODE ── */
html.dark {
  /* Backgrounds */
  --white:       #0A0A0A;
  --off-white:   #111110;
  --light-grey:  #1A1A18;
  --mid-grey:    #2A2A28;
  --dark-grey:   #6A6A65;
  --charcoal:    #E8E8E4;
  --black:       #F8F8F6;

  /* Borders */
  --border:      #2A2A28;
  --border-dark: #3A3A38;

  /* Olive stays the same — it's the accent */
  --olive:       #37392d;
  --olive-hover: #4a4d3a;
  --olive-light: #37392d30;
  --olive-mid:   #6b6e58;

  /* Bride section — slightly adjusted for dark */
  --bride-bg:    #1A1512;
  --bride-accent:#C8A97A;
  --bride-dark:  #F5F0E8;
}

/* Ensure admin NEVER uses dark mode */
html.dark .admin-area {
  /* Override all dark vars back to light for admin */
  --white:       #FFFFFF;
  --off-white:   #F8F8F6;
  --light-grey:  #F2F2F0;
  --mid-grey:    #E8E8E4;
  --charcoal:    #2A2A28;
  --black:       #0A0A0A;
  --border:      #E8E8E4;
}
```

### B4 — Dark Mode Toggle Component

**Create `src/components/common/DarkModeToggle.tsx`**:
```typescript
'use client'
import { Moon, Sun } from 'lucide-react'
import { useThemeStore } from '@/store/themeStore'
import { motion } from 'framer-motion'

export function DarkModeToggle() {
  const { isDark, toggle } = useThemeStore()

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="relative flex items-center justify-center w-8 h-8
                 text-charcoal hover:text-olive transition-colors duration-200"
    >
      <motion.div
        key={isDark ? 'moon' : 'sun'}
        initial={{ opacity: 0, rotate: -90, scale: 0.8 }}
        animate={{ opacity: 1, rotate: 0, scale: 1 }}
        exit={{ opacity: 0, rotate: 90, scale: 0.8 }}
        transition={{ duration: 0.2 }}
      >
        {isDark
          ? <Sun size={17} strokeWidth={1.5} />
          : <Moon size={17} strokeWidth={1.5} />
        }
      </motion.div>
    </button>
  )
}
```

### B5 — Add Toggle to Navbar

**Update `src/components/layout/Navbar.tsx`**:

Desktop — add `<DarkModeToggle />` in the RIGHT icons group:
```typescript
// Right icons: Currency | Search | DarkModeToggle | Wishlist | Account | Cart
<DarkModeToggle />
```

Mobile menu — add in `src/components/layout/MobileMenu.tsx`:
```typescript
// Near bottom of mobile menu, with label:
<div className="flex items-center justify-between px-6 py-4 border-t border-mid-grey">
  <span className="font-body text-sm text-dark-grey uppercase tracking-widest">
    {isDark ? 'Dark Mode' : 'Light Mode'}
  </span>
  <DarkModeToggle />
</div>
```

### B6 — Ensure Tailwind supports dark mode

**In `tailwind.config.ts`**:
```typescript
// Add at top level:
darkMode: 'class',  // uses .dark class on html element
```

---

## TASK C — ADMIN LOGIN PAGE

### C1 — Create Admin Login Page

**Create `src/app/admin-login/page.tsx`**:

```typescript
// This is a SEPARATE page from the storefront login
// URL: /admin-login
// No navbar, no footer — completely isolated
// After successful login: redirect to /admin
// If already admin: redirect to /admin immediately
```

```
PAGE DESIGN: Clean, minimal, professional. Not branded like the storefront.

Background: white (#FFFFFF)

CENTER CARD (max-w-sm, mx-auto, mt-[15vh]):
  
  TOP: Logo mark + text
    Logo: /images/logo.png (black, 40px)
    Below: "PRUDENT GABRIEL" (Jost 11px uppercase tracking 0.2em, black, mt-3)
    Below: "Admin Portal" (Jost 12px weight-300, dark-grey, mt-1)
  
  DIVIDER: 1px solid mid-grey, mt-8 mb-8
  
  FORM:
    Heading: "Sign In" (Bodoni Moda 28px, black, mb-6)
    
    Email field (Input component, label "Email Address")
    Password field (Input component, label "Password", type password)
    
    [SIGN IN] button:
      Full-width, bg-olive, white text
      Jost 12px uppercase tracking 0.15em
      Height: 48px, no border-radius
      Loading state: spinner
    
    Error message (if wrong credentials):
      Red text, Jost 13px, mt-3, text-center
      "Invalid credentials. Please try again."
  
  FOOTER (mt-8, text-center):
    "← Back to Website" link → /
    Jost 11px, dark-grey, hover olive

SECURITY: This page is NOT linked from anywhere on the storefront.
The URL /admin-login is only for Mrs. Prudent and her team.
```

### C2 — Admin Login API

The existing `/api/auth/callback/credentials` handles login — no new API needed.

Use NextAuth's `signIn('credentials', { email, password, redirect: false })` 
in the form, then:
- On success + role is ADMIN/SUPER_ADMIN: `router.push('/admin')`
- On success + role is CUSTOMER: show error "You do not have admin access."
- On failure: show "Invalid credentials."

### C3 — Update Middleware

**Update `src/middleware.ts`**:

```typescript
// Admin routes (/admin/*) should redirect to /admin-login (not /auth/login)
// Change the redirect for non-admin accessing /admin:

if (pathname.startsWith('/admin')) {
  if (!session) {
    return NextResponse.redirect(new URL('/admin-login', request.url))
  }
  if (!['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
    return NextResponse.redirect(new URL('/admin-login', request.url))
  }
}
```

### C4 — Remove Admin Link from Main Navbar

**Update `src/components/layout/Navbar.tsx`**:

Remove the "Admin" link that shows for admin users in the main navbar.
Admin access is only via direct URL `/admin-login`.

**Update `src/components/account/AccountLayout.tsx`** (account sidebar):
Remove the "Admin Panel" link from the account sidebar if it exists.

---

## TASK D — ADMIN FULL VISUAL REDESIGN

### Design System for Admin

```
PALETTE:
  Background:   #FFFFFF (pure white)
  Sidebar:      #FAFAFA (near-white, barely off)
  Cards:        #FFFFFF with border: 1px solid #F0F0EE
  Text primary: #0A0A0A (black)
  Text secondary:#6B6B68 (medium grey)
  Text muted:   #A8A8A4 (light grey)
  Border:       #EBEBEA
  Active/Olive: #37392d
  Hover bg:     #F5F5F3
  
TYPOGRAPHY (same as storefront):
  Headings:     Bodoni Moda
  Body/Labels:  Jost

NO dark backgrounds anywhere. NO rounded corners (consistent with brand).
Thin 1px borders instead of shadows.
```

### D1 — AdminShell Layout

**Update `src/components/admin/AdminShell.tsx`**:
```typescript
// Add 'admin-area' class to outermost div
// This prevents dark mode from affecting admin
<div className="admin-area flex h-screen overflow-hidden bg-white">
  <AdminSidebar session={session} />
  <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
    <AdminTopbar />
    <main className="flex-1 overflow-y-auto bg-white p-8">
      {children}
    </main>
  </div>
</div>
```

### D2 — AdminSidebar Redesign

**Update `src/components/admin/AdminSidebar.tsx`**:

```
WIDTH: 220px (reduced from 240px — tighter, more premium)
BACKGROUND: #FAFAFA
BORDER-RIGHT: 1px solid #EBEBEA
HEIGHT: 100vh, overflow-y-auto
NO box-shadow

TOP SECTION (padding: 24px 20px):
  Logo: /images/logo.png (black, 32px, object-contain)
  Below logo (mt-3):
    "PRUDENT GABRIEL" (Jost 9px uppercase tracking-[0.2em], #A8A8A4)

NAVIGATION (mt-8, px-3):
  Section labels:
    Jost 9px weight-500 uppercase tracking-[0.15em]
    color: #A8A8A4
    padding: 0 8px, mb-1, mt-6 (first has no mt)
  
  Nav items:
    Flex items-center gap-2.5
    Padding: 8px 10px
    Border-radius: 0  ← brand rule
    
    DEFAULT:
      Text: Jost 12px weight-400, #6B6B68
      Icon: 15px, #A8A8A4
      hover: bg-[#F5F5F3], text-black, icon-black
    
    ACTIVE:
      bg-[#37392d] (olive)
      text-white
      icon-white
      NO border-radius
    
    Transition: 150ms ease

SECTIONS:
  OVERVIEW
    Dashboard
  
  CATALOGUE  
    Products
    Bespoke Requests
    Consultations
    Consultants
    Reviews
  
  COMMERCE
    Orders
    Coupons
    Shipping Zones
  
  CUSTOMERS
    All Customers
    Referral Analytics

  SYSTEM
    Settings

BOTTOM (mt-auto, border-top: 1px solid #EBEBEA, padding: 16px 20px):
  User info row:
    Initials circle: 28px, bg-[#F0F0EE], black text, Jost 11px
    Name: Jost 12px weight-400, black (truncate)
    Role: Jost 10px, #A8A8A4
  
  "Back to Store" link (mt-2):
    Jost 11px, #A8A8A4, hover olive
    ArrowLeft icon 12px left
  
  "Sign Out" button:
    Jost 11px, #A8A8A4, hover red-500
    LogOut icon 12px left
```

### D3 — AdminTopbar Redesign

**Update `src/components/admin/AdminTopbar.tsx`**:

```
HEIGHT: 52px (reduced)
BACKGROUND: white
BORDER-BOTTOM: 1px solid #EBEBEA
PADDING: 0 32px
NO shadow

LEFT:
  Breadcrumb: "Admin / [Page]"
  "Admin" → Jost 11px #A8A8A4
  "/" → Jost 11px #EBEBEA, mx-2
  "[Page]" → Jost 12px weight-500 black

RIGHT:
  Bell icon (Lucide Bell, 16px, #6B6B68)
    Badge: tiny 6px olive circle (if pending actions > 0)
  
  Divider: 1px vertical #EBEBEA, height 16px
  
  Admin avatar: 
    28px circle, bg-[#37392d], white initials
    Jost 11px weight-500
  
  Admin name: Jost 12px, black (desktop only)
```

### D4 — Analytics Dashboard Redesign

**Update the admin dashboard page and `src/components/admin/AnalyticsDashboard.tsx`**:

```
PAGE HEADER:
  "Dashboard" (Bodoni Moda 28px, black)
  Date: "Thursday, 24 April 2026" (Jost 12px weight-300, #6B6B68, mt-1)
  Right: "Last 30 days" period badge (Jost 11px, #6B6B68, border border-[#EBEBEA], px-3 py-1)

KPI CARDS (4-col grid, gap-4):
  Each card:
    Background: white
    Border: 1px solid #EBEBEA
    Padding: 24px
    NO border-radius, NO shadow
    
    Top row: Label (Jost 10px uppercase tracking #A8A8A4) + Icon (16px #A8A8A4, right)
    Value: Bodoni Moda 32px black, mt-2
    Sub: Jost 12px weight-300 #6B6B68, mt-1
    
    Positive growth: olive text
    Negative growth: #8B1A1A text

REVENUE CHART:
  Container: white, border 1px solid #EBEBEA, padding 24px, mt-6
  Title: Jost 12px uppercase tracking black, mb-4
  
  Recharts styling:
    Line: stroke #37392d (olive), strokeWidth 1.5
    Area fill: #37392d08 (very subtle)
    Grid: stroke #F5F5F3 (barely visible horizontal lines)
    XAxis/YAxis: Jost 11px, fill #A8A8A4
    Tooltip:
      bg white, border 1px solid #EBEBEA
      Jost 12px, black
      shadow: 0 4px 16px rgba(0,0,0,0.08)

RECENT ORDERS TABLE:
  Container: white, border 1px solid #EBEBEA, padding 0, mt-6, overflow hidden
  
  Header row (padding: 16px 24px, border-bottom 1px solid #EBEBEA):
    "Recent Orders" (Jost 12px uppercase tracking, black)
    "View All →" (Jost 11px olive, right)
  
  Table:
    Header: Jost 10px uppercase tracking #A8A8A4, bg-[#FAFAFA]
            border-bottom 1px solid #EBEBEA, padding 10px 24px
    
    Rows: padding 14px 24px, border-bottom 1px solid #F5F5F3
          hover bg-[#FAFAFA]
          Jost 13px black
    
    Order #: Jost 11px weight-500 olive
    Status badges: small, Jost 9px uppercase, NO border-radius
      PENDING:    bg-[#FFF8E7] text-[#92660A]
      CONFIRMED:  bg-[#E8F4FF] text-[#1A5FAD]
      PROCESSING: bg-[#FFF3E0] text-[#C45E0A]
      SHIPPED:    bg-[#F0E8FF] text-[#6B3FAD]
      DELIVERED:  bg-[#E8F5E9] text-[#1B5E20]
      CANCELLED:  bg-[#FDECEA] text-[#8B1A1A]
      
    Payment badges:
      PAID:     bg-[#E8F5E9] text-[#1B5E20]
      PENDING:  bg-[#FFF8E7] text-[#92660A]
      FAILED:   bg-[#FDECEA] text-[#8B1A1A]

ALERT PANELS ROW (3-col grid, gap-4, mt-6):
  Each panel: white, border 1px solid #EBEBEA, padding 20px
  
  Panel header: Jost 11px uppercase tracking black
    Count badge: tiny, Jost 9px
      Red badge (out of stock, urgent): bg-[#FDECEA] text-[#8B1A1A]
      Amber badge: bg-[#FFF8E7] text-[#92660A]
  
  Items: Jost 12px black, border-bottom 1px solid #F5F5F3, py-3
  Links: olive, Jost 11px
```

### D5 — Products Table Redesign

**Update `src/components/admin/ProductsTable.tsx`**:

```
TOOLBAR (mb-4):
  Search input:
    Height: 36px, border: 1px solid #EBEBEA, Jost 12px
    Padding: 0 12px, NO border-radius
    Search icon inside left: 14px #A8A8A4
    Focus: border-olive outline-none
  
  Filter selects: same height/style as search, inline row
  
  [+ Add Product] button:
    bg-olive, white, Jost 11px uppercase tracking
    Height: 36px, padding: 0 20px, NO border-radius

TABLE CONTAINER: white, border 1px solid #EBEBEA, overflow hidden

TABLE HEADER: bg-[#FAFAFA], border-bottom 1px solid #EBEBEA
  Jost 10px uppercase tracking #A8A8A4, padding 10px 16px

TABLE ROWS:
  Border-bottom: 1px solid #F5F5F3
  Hover: bg-[#FAFAFA]
  Padding: 12px 16px
  Jost 12px-13px black
  
  Product image: 36×48px, object-cover (NO border-radius for consistency with brand)
  
  Toggle switches (published/featured):
    Use Toggle.tsx component with olive active color
  
  Actions: small icon buttons (pencil, trash)
    Default: #A8A8A4, hover: black (pencil), hover: #8B1A1A (trash)

BULK ACTION BAR (when rows selected):
  Fixed at bottom of table area
  bg-olive, white text, Jost 11px
  "[X] selected" + action buttons
```

### D6 — Orders Table Redesign

**Update `src/components/admin/OrdersTable.tsx`**:

Same table pattern as products. Additionally:

```
Gateway badges (pill labels):
  PAYSTACK:     bg-[#E8F5E9] text-[#1B5E20]
  FLUTTERWAVE:  bg-[#E8F0FF] text-[#1A3FAD]
  STRIPE:       bg-[#F0E8FF] text-[#6B3FAD]
  MONNIFY:      bg-[#FFF3E0] text-[#C45E0A]
  All: Jost 9px uppercase, NO border-radius, px-2 py-0.5
```

### D7 — Product Form Redesign

**Update `src/components/admin/ProductFormPage.tsx`**:

```
PAGE LAYOUT:
  Header:
    Back link: "← Products" (Jost 12px olive)
    Title: "New Product" / "Edit: [name]" (Bodoni Moda 24px black, mt-1)
    Right: [Save Draft] + [Publish] buttons (36px height)
  
  SECTION CARDS:
    Background: white
    Border: 1px solid #EBEBEA
    Padding: 24px
    Margin-bottom: 16px
    NO border-radius
    
    Section title: Jost 11px uppercase tracking #A8A8A4, pb-4, 
                   border-bottom 1px solid #EBEBEA, mb-6
  
  INPUTS (override any remaining native controls):
    All use Input.tsx / SelectField.tsx components
    Bottom border only, 1px #EBEBEA → olive on focus
    Jost 14px, black
    Label: Jost 11px #6B6B68, mb-1
  
  VARIANT TABLE (VariantManager):
    Same table pattern — white, thin borders, Jost text
    [+ Add Size] button: outlined (1px olive, olive text), 32px height
    Delete icons: #A8A8A4 hover #8B1A1A
  
  TIPTAP EDITOR:
    Border: 1px solid #EBEBEA
    Toolbar: bg-[#FAFAFA], border-bottom 1px solid #EBEBEA
    Toolbar buttons: Jost 11px, #6B6B68, hover black
    Content area: Jost 15px weight-300 black, padding 16px
  
  IMAGE UPLOADER:
    Drop zone: border: 2px dashed #EBEBEA
                hover: border-olive, bg-[#FAFAFA]
                Jost 13px #A8A8A4 centered
    Image grid: 3-col, 2px gap (tight editorial)
    Delete X: white circle, black X, top-right of image
    Primary star: olive when selected
  
  STATUS CARD (sticky sidebar):
    [Publish] button: bg-olive, white, full-width, 40px
    [Save Draft]: outlined, full-width, 40px
    
    Toggles: use Toggle.tsx (olive active)
    Toggle row: flex justify-between items-center
                Jost 12px black label
                py-3, border-bottom 1px solid #F5F5F3
```

### D8 — Bespoke + Consultation Tables

Same table pattern as orders. Keep all functionality, just apply:
- White background
- `#EBEBEA` borders
- Jost typography
- Olive active states
- NO border-radius

Status badges follow same color coding pattern as orders.

### D9 — Customers Table

Same pattern. "Adjust Points" modal:
```
Modal: white, border 1px solid #EBEBEA, NO border-radius
Amount input: labeled "Points (+/-)" 
Description: textarea
[Apply] button: bg-olive, white
```

### D10 — Reviews Moderation

```
Pending reviews: subtle amber left border (3px solid #F59E0B)
Approved: subtle green left border (3px solid #22C55E)

Approve button: bg-[#E8F5E9] text-[#1B5E20], hover bg-[#22C55E] hover:text-white
                Jost 11px, NO border-radius, px-3 py-1.5
Reject button:  bg-[#FDECEA] text-[#8B1A1A], hover bg-[#8B1A1A] hover:text-white
```

### D11 — Admin Settings Page

```
Section cards: white, border 1px solid #EBEBEA
Section title: Jost 11px uppercase tracking #A8A8A4
Inputs: same as product form
[Save] button: bg-olive, white, 36px height, NO border-radius
```

---

## TASK E — ADMIN ANALYTICS SIDEBAR NUMBERS FIX

The revenue chart Y-axis was showing "₦0" for all values in the screenshot.
This is a data formatting issue.

**In `src/components/admin/AnalyticsDashboard.tsx`**:

```typescript
// Fix Y-axis formatter:
<YAxis
  tickFormatter={(value) => {
    if (value >= 1000000) return `₦${(value / 1000000).toFixed(1)}M`
    if (value >= 1000) return `₦${(value / 1000).toFixed(0)}k`
    return `₦${value}`
  }}
  tick={{ fontSize: 11, fontFamily: 'Jost', fill: '#A8A8A4' }}
  width={60}
/>

// Fix tooltip formatter:
<Tooltip
  formatter={(value: number) =>
    [`₦${value.toLocaleString('en-NG')}`, 'Revenue']
  }
  contentStyle={{
    background: 'white',
    border: '1px solid #EBEBEA',
    borderRadius: 0,
    fontFamily: 'Jost',
    fontSize: 12,
  }}
/>
```

---

## TASK F — STOREFRONT DARK MODE COMPONENT UPDATES

With dark mode variables set via `html.dark` class and CSS variables, most
components update automatically. But these need explicit dark mode classes:

### F1 — Navbar dark mode
```typescript
// Navbar background in dark:
// Light: bg-white border-mid-grey text-charcoal
// Dark:  bg-[var(--white)] border-[var(--mid-grey)] text-[var(--charcoal)]
// (Already uses CSS vars — should auto-update)

// BUT announcement bar stays olive regardless of dark mode:
className="bg-olive text-white"  // No dark variant
```

### F2 — Hero section dark mode
Hero is full-bleed image with overlay — looks great in both modes naturally.
No change needed.

### F3 — ProductCard dark mode
```typescript
// Card bg: bg-[var(--white)]  ← updates automatically
// Product name: text-[var(--charcoal)]  ← updates
// Price: text-[var(--charcoal)]  ← updates
// Image bg: bg-[var(--light-grey)]  ← updates

// Quick view overlay:
// Light: bg-white/90
// Dark:  dark:bg-[#0A0A0A]/90
className="bg-white/90 dark:bg-black/90"
```

### F4 — Footer dark mode
Footer is already black background — looks correct in both modes.
Ensure text colors use CSS variables not hardcoded.

### F5 — Auth pages dark mode
```typescript
// Left panel: always olive — no dark variant
// Right panel: bg-white → dark:bg-[#0A0A0A]
className="bg-white dark:bg-[#0A0A0A]"

// Form inputs in dark:
// Border: var(--mid-grey) → auto updates
// Text: var(--charcoal) → auto updates (charcoal becomes off-white in dark)
```

### F6 — CartDrawer dark mode
```typescript
// Background: bg-[var(--white)]  ← auto
// Header border: border-[var(--border)]  ← auto
// Product names/prices: text-[var(--charcoal)]  ← auto
// Footer: bg-[var(--off-white)]  ← auto
```

### F7 — Modals dark mode
```typescript
// All modals/dialogs: bg-[var(--white)]  ← auto
// Overlays: keep bg-black/60 (works in both modes)
```

---

## TASK G — FINAL INTEGRATION CHECKS

### G1 — Verify admin-area class is applied
Every admin page layout must have `admin-area` on the outermost div.
This prevents dark mode CSS variables from affecting admin.

Check:
- `src/app/(admin)/layout.tsx` → AdminShell has `admin-area` ✓
- `src/app/admin-login/page.tsx` → add `admin-area` class to page wrapper

### G2 — Test dark mode toggle
- Toggle on in navbar → `html.dark` class added → colors flip
- Toggle off → `html.dark` removed → colors restore
- Navigate to `/admin` → admin always light regardless of toggle state
- Refresh page → preference restored from localStorage

### G3 — Test scrolling
- Homepage: full page scroll smooth
- Shop page: product grid scrolls normally
- Cart drawer: items list scrolls independently
- Admin sidebar: scrolls when nav items overflow
- Admin products page: table scrolls horizontally on mobile
- Account sidebar: scrolls independently from content
- Modals: content scrolls when overflowing

---

## FINAL CHECKS

```bash
npx tsc --noEmit    # must pass
npx next build      # must pass
```

Verify live:
- `https://prudentgabriel.vercel.app/admin-login` → clean admin login page
- `https://prudentgabriel.vercel.app/admin` → redirects to /admin-login (not /auth/login)
- Admin dashboard → light, white, premium
- Navbar: moon/sun icon visible
- Click moon → site goes dark, preference saved
- Refresh → dark mode persists
- Go to /admin while in dark mode → admin still light

---

## SESSION END FORMAT

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SESSION 8 COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Task A — Scroll fixes (Lenis, sidebars, drawers, modals)
✅ Task B — Dark mode system (store, provider, CSS vars, toggle)
✅ Task C — Admin login page (/admin-login) + middleware update
✅ Task D — Admin full visual redesign (sidebar, topbar, all pages)
✅ Task E — Analytics chart number formatting fix
✅ Task F — Storefront dark mode component updates
✅ Task G — Integration checks

Build: ✅ passes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

*Prudent Gabriel · Session 8 — Admin Redesign + Dark Mode + Scroll*
*Prepared by Nony | SonsHub Media*
