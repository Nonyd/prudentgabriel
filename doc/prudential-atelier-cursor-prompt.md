# CURSOR AI PROMPT — PRUDENTIAL ATELIER FULL-STACK WEBSITE
### By Nony | SonsHub Media | For Mrs. Prudent Gabriel-Okopi

---

> **IMPORTANT INSTRUCTION FOR CURSOR:**
> Read this entire document before writing a single line of code.
> Build every stage sequentially. Do not skip or combine stages.
> After each stage, confirm completion before moving to the next.

---

## BRAND BRIEF

**Brand:** Prudential Atelier  
**Owner:** Mrs. Prudent Gabriel-Okopi  
**Category:** Luxury Nigerian Fashion — Ready-to-Wear (RTW) + Bespoke Couture  
**Target Audience:** Affluent Nigerian women (25–50), diaspora clients, bridal market (Africa, UK, US, Australia)  
**Academy (Separate Site — Link Only):** https://pfacademy.ng  
**Competitor Reference (Do Better Than):** https://tubowoman.com  

**Brand Positioning:** Nigeria's premier bespoke atelier. Where culture meets couture. Every stitch is a story.

---

## DESIGN SYSTEM

### Color Palette
```css
--color-wine:        #6B1C2A;   /* Primary — deep burgundy */
--color-wine-light:  #8B2D3E;   /* Hover states */
--color-wine-dark:   #4A1019;   /* Dark variant */
--color-gold:        #C9A84C;   /* Accent — antique gold */
--color-gold-light:  #E2C470;   /* Hover accent */
--color-gold-muted:  #A8893A;   /* Muted gold */
--color-ivory:       #FAF6EF;   /* Background — warm ivory */
--color-ivory-dark:  #F0E8D8;   /* Card backgrounds */
--color-charcoal:    #1A1A1A;   /* Body text */
--color-charcoal-mid:#3D3D3D;   /* Secondary text */
--color-cream:       #FEFAF3;   /* White alternative */
--color-border:      #E8DDD0;   /* Borders */
```

### Typography
```
Display Font:    "Cormorant Garamond" — weights 300, 400, 500, 600 (Google Fonts)
Body Font:       "DM Sans" — weights 300, 400, 500 (Google Fonts)
Accent/Label:    "Cormorant SC" (Small Caps) — for labels, tags, eyebrows
```

### Motion Philosophy
- Lenis for smooth scroll
- Framer Motion for page transitions and entrance animations
- All entrance animations: `opacity: 0 → 1` + `y: 30 → 0`, duration 0.7s ease
- Stagger children: 0.1s delay between items
- Hover states: scale(1.02) on cards, gold underline on nav links
- No bouncy or playful easing — only `ease` or `easeOut`

### Grid & Spacing
- Max container width: 1400px
- Section vertical padding: 120px desktop / 80px mobile
- Component gap standard: 24px / 32px / 48px / 80px

---

## TECH STACK

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v3 + custom CSS variables |
| Animation | Framer Motion + Lenis |
| ORM | Prisma |
| Database | PostgreSQL |
| Auth | NextAuth.js v5 (Credentials + Google OAuth) |
| File Upload | Cloudinary (product images) |
| Payments | Paystack · Flutterwave · Stripe · Monnify |
| Currency | Multi-currency: NGN, USD, GBP |
| Email | Resend + React Email templates |
| State | Zustand (cart, wishlist, currency) |
| Forms | React Hook Form + Zod validation |

---

## DATABASE SCHEMA (Prisma)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id              String    @id @default(cuid())
  name            String?
  email           String    @unique
  emailVerified   DateTime?
  password        String?
  image           String?
  phone           String?
  role            Role      @default(CUSTOMER)
  
  // Loyalty & Referral
  referralCode    String    @unique @default(cuid())
  referredById    String?
  referredBy      User?     @relation("Referrals", fields: [referredById], references: [id])
  referrals       User[]    @relation("Referrals")
  pointsBalance   Int       @default(0)  // 1 point = ₦1 / $0.001 / £0.001
  
  // Relations
  orders          Order[]
  addresses       Address[]
  wishlist        WishlistItem[]
  reviews         Review[]
  pointsHistory   PointsTransaction[]
  sessions        Session[]
  accounts        Account[]
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model PointsTransaction {
  id          String              @id @default(cuid())
  userId      String
  user        User                @relation(fields: [userId], references: [id])
  type        PointsType
  amount      Int
  description String
  orderId     String?
  createdAt   DateTime            @default(now())
}

model Product {
  id              String          @id @default(cuid())
  name            String
  slug            String          @unique
  description     String          @db.Text
  details         String?         @db.Text
  category        ProductCategory
  type            ProductType     @default(RTW)
  
  // Pricing (store in NGN base, convert on frontend)
  priceNGN        Float
  priceUSD        Float?
  priceGBP        Float?
  
  // Media
  images          ProductImage[]
  
  // Inventory
  inStock         Boolean         @default(true)
  isFeatured      Boolean         @default(false)
  isNewArrival    Boolean         @default(false)
  
  // Variants
  sizes           ProductSize[]
  colors          ProductColor[]
  
  // Relations
  orderItems      OrderItem[]
  wishlistItems   WishlistItem[]
  reviews         Review[]
  
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
}

model ProductImage {
  id          String   @id @default(cuid())
  url         String
  alt         String?
  isPrimary   Boolean  @default(false)
  productId   String
  product     Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
}

model ProductSize {
  id          String   @id @default(cuid())
  label       String   // XS, S, M, L, XL, XXL, or custom (6, 8, 10...)
  productId   String
  product     Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
}

model ProductColor {
  id          String   @id @default(cuid())
  name        String
  hex         String
  productId   String
  product     Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
}

model Order {
  id              String        @id @default(cuid())
  orderNumber     String        @unique @default(cuid())
  userId          String?
  user            User?         @relation(fields: [userId], references: [id])
  
  // Guest checkout support
  guestEmail      String?
  
  // Items & pricing
  items           OrderItem[]
  subtotal        Float
  discount        Float         @default(0)
  pointsUsed      Int           @default(0)
  total           Float
  
  // Currency
  currency        Currency      @default(NGN)
  
  // Address
  addressId       String?
  address         Address?      @relation(fields: [addressId], references: [id])
  
  // Payment
  paymentGateway  PaymentGateway?
  paymentRef      String?
  paymentStatus   PaymentStatus @default(PENDING)
  
  // Order status
  status          OrderStatus   @default(PENDING)
  notes           String?
  
  // Bespoke
  isBespoke       Boolean       @default(false)
  bespokeDetails  String?       @db.Text
  
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
}

model OrderItem {
  id          String   @id @default(cuid())
  orderId     String
  order       Order    @relation(fields: [orderId], references: [id])
  productId   String
  product     Product  @relation(fields: [productId], references: [id])
  quantity    Int
  size        String?
  color       String?
  price       Float
}

model BespokeRequest {
  id              String              @id @default(cuid())
  name            String
  email           String
  phone           String
  occasion        String
  description     String              @db.Text
  budget          String?
  timeline        String?
  measurements    Json?
  referenceImages String[]
  status          BespokeStatus       @default(PENDING)
  adminNotes      String?
  preferredDate   DateTime?
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt
}

model Address {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  label       String?  // "Home", "Office"
  firstName   String
  lastName    String
  phone       String
  street      String
  city        String
  state       String
  country     String
  isDefault   Boolean  @default(false)
  orders      Order[]
}

model WishlistItem {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  productId   String
  product     Product  @relation(fields: [productId], references: [id])
  createdAt   DateTime @default(now())
  @@unique([userId, productId])
}

model Review {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  productId   String
  product     Product  @relation(fields: [productId], references: [id])
  rating      Int
  title       String?
  body        String?
  isVerified  Boolean  @default(false)
  createdAt   DateTime @default(now())
}

// NextAuth required models
model Account { ... }  // Standard NextAuth Account model
model Session { ... }  // Standard NextAuth Session model

// Enums
enum Role             { CUSTOMER ADMIN SUPER_ADMIN }
enum ProductCategory  { BRIDAL EVENING_WEAR CASUAL FORMAL KIDDIES ACCESSORIES }
enum ProductType      { RTW BESPOKE }
enum OrderStatus      { PENDING CONFIRMED PROCESSING SHIPPED DELIVERED CANCELLED REFUNDED }
enum PaymentStatus    { PENDING PAID FAILED REFUNDED }
enum PaymentGateway   { PAYSTACK FLUTTERWAVE STRIPE MONNIFY }
enum BespokeStatus    { PENDING REVIEWED CONFIRMED IN_PROGRESS READY DELIVERED }
enum PointsType       { EARNED_PURCHASE EARNED_REFERRAL EARNED_SIGNUP REDEEMED EXPIRED }
enum Currency         { NGN USD GBP }
```

---

## STAGE 1 — PROJECT SETUP & CONFIGURATION

```
Create a new Next.js 14 project with the following setup:

1. Initialize project:
   npx create-next-app@latest prudential-atelier \
     --typescript \
     --tailwind \
     --eslint \
     --app \
     --src-dir \
     --import-alias "@/*"

2. Install all dependencies:
   npm install \
     framer-motion \
     @studio-freight/lenis \
     prisma \
     @prisma/client \
     next-auth@beta \
     @auth/prisma-adapter \
     zustand \
     react-hook-form \
     @hookform/resolvers \
     zod \
     cloudinary \
     next-cloudinary \
     resend \
     react-email \
     @react-email/components \
     paystack \
     flutterwave-node-v3 \
     stripe \
     axios \
     lucide-react \
     @radix-ui/react-dialog \
     @radix-ui/react-dropdown-menu \
     @radix-ui/react-select \
     @radix-ui/react-toast \
     @radix-ui/react-tabs \
     @radix-ui/react-accordion \
     @radix-ui/react-slider \
     swiper \
     date-fns \
     slugify \
     nanoid \
     clsx \
     tailwind-merge

3. Install dev dependencies:
   npm install -D \
     @types/node \
     prettier \
     prettier-tailwindcss \
     prisma

4. Initialize Prisma:
   npx prisma init

5. Configure tailwind.config.ts with:
   - Custom font families: cormorant (Cormorant Garamond), dm-sans (DM Sans)
   - Custom colors mapping to CSS variables
   - Custom animations: fadeUp, fadeIn, shimmer
   - Extended spacing, screens as needed

6. Create src/styles/globals.css with:
   - Google Fonts import (Cormorant Garamond 300,400,500,600,700i + DM Sans 300,400,500)
   - All CSS custom properties (colors, fonts, spacing)
   - Base styles: html smooth-scroll, body font, selection color (wine/gold)
   - Lenis scroll base styles
   - Custom scrollbar styled in wine/gold

7. Create src/lib/ folder with:
   - prisma.ts         — Prisma client singleton
   - auth.ts           — NextAuth.js v5 config
   - cloudinary.ts     — Cloudinary config
   - currency.ts       — Multi-currency conversion utility
   - points.ts         — Points calculation helpers
   - referral.ts       — Referral code helpers
   - utils.ts          — cn(), slugify(), formatPrice(), formatDate()
   - validations.ts    — All Zod schemas

8. Create .env.local with all required keys (placeholders):
   DATABASE_URL=
   NEXTAUTH_SECRET=
   NEXTAUTH_URL=
   GOOGLE_CLIENT_ID=
   GOOGLE_CLIENT_SECRET=
   CLOUDINARY_CLOUD_NAME=
   CLOUDINARY_API_KEY=
   CLOUDINARY_API_SECRET=
   PAYSTACK_SECRET_KEY=
   PAYSTACK_PUBLIC_KEY=
   FLUTTERWAVE_SECRET_KEY=
   FLUTTERWAVE_PUBLIC_KEY=
   STRIPE_SECRET_KEY=
   STRIPE_PUBLIC_KEY=
   STRIPE_WEBHOOK_SECRET=
   MONNIFY_API_KEY=
   MONNIFY_SECRET_KEY=
   MONNIFY_CONTRACT_CODE=
   RESEND_API_KEY=
   NEXT_PUBLIC_APP_URL=
   NEXT_PUBLIC_CURRENCY_API_KEY=   # For exchange rate API

9. Configure src/app/layout.tsx as root layout:
   - Load Google Fonts via next/font/google
   - Wrap app with: LenisProvider, AuthProvider (SessionProvider), CurrencyProvider, CartProvider
   - Include Toaster component
   - Meta: Open Graph, Twitter card, base metadata for Prudential Atelier

10. Create src/providers/ folder with:
    - LenisProvider.tsx   — Smooth scroll init
    - CartProvider.tsx    — Zustand cart store provider
    - CurrencyProvider.tsx — Currency context with localStorage persistence
```

---

## STAGE 2 — DESIGN SYSTEM & GLOBAL COMPONENTS

```
Build the global design system components. Every component must use the Prudential Atelier 
design tokens and feel like a $10,000 brand.

── src/components/ui/

1. Button.tsx
   Variants: primary (wine bg, gold text on hover), secondary (outlined wine), 
   ghost (transparent), gold (gold bg, wine text)
   Sizes: sm, md, lg
   States: loading (spinner), disabled
   All variants have a subtle shimmer animation on hover

2. Input.tsx
   Elegant underline style (not box). Label floats up on focus.
   Focus ring: gold. Error state: wine/red.

3. Select.tsx (wraps Radix UI Select)
   Styled to match Input.tsx aesthetic

4. Badge.tsx
   Variants: wine, gold, cream, outline
   Used for "New Arrival", "Bespoke", "Limited"

5. Card.tsx
   Base card with ivory background, subtle border, soft shadow

6. Modal.tsx (wraps Radix UI Dialog)
   Centered. Backdrop blur. Smooth scale-in animation via Framer Motion.

7. Toast.tsx
   Bottom-right. Variants: success (gold), error (wine), info.
   Auto-dismiss after 4s.

8. Divider.tsx
   Decorative horizontal rule with centered ornament (small diamond ◆)
   Used between sections

9. SectionLabel.tsx
   Small caps gold text + line decorations either side
   e.g.:  ——  COLLECTIONS  ——

10. LoadingSpinner.tsx
    Thin circular spinner in gold

11. Skeleton.tsx
    Shimmer skeleton loader for product cards

── src/components/layout/

12. Navbar.tsx
    Desktop layout:
    - Top micro-bar: currency switcher (NGN | USD | GBP) + "Free shipping on orders over ₦150,000"
    - Main nav: Logo centered, nav links left, icons right (search, wishlist, account, cart)
    - Links: SHOP, BESPOKE, OUR STORY, PRESS, PFA ACADEMY↗
    - On scroll: navbar shrinks, gets white/ivory bg with subtle shadow
    - Active link: gold underline
    - Cart icon: animated badge counter

    Mobile layout:
    - Hamburger → full-screen slide-in menu (from left)
    - Menu items stagger in with Framer Motion
    - Currency switcher included in mobile menu

13. Footer.tsx
    Four columns:
    Col 1: Logo + brand tagline + social icons (Instagram, Facebook, TikTok)
    Col 2: Shop links (RTW, Bespoke, New Arrivals, Sale)
    Col 3: Company (Our Story, Press, Careers, Contact)
    Col 4: Newsletter signup form (email input + subscribe button)
    Bottom bar: © 2024 Prudential Atelier · Privacy · Terms · All rights reserved
    Background: var(--color-charcoal). Text: ivory/cream. Accent: gold.

14. CartDrawer.tsx
    Slides in from right
    Shows cart items with thumbnail, name, size, color, quantity controls
    Subtotal + "Proceed to Checkout" button
    Empty state with elegant illustration/icon

15. SearchModal.tsx
    Full-screen takeover (dark overlay)
    Large search input, centered
    Shows recent searches + featured products below

── src/components/common/

16. CurrencySwitcher.tsx
    Dropdown: NGN ₦ | USD $ | GBP £
    Stores preference in localStorage
    Updates all prices site-wide via Zustand

17. ProductCard.tsx
    - Portrait image (3:4 ratio) with hover: secondary image crossfade
    - Badge (New, Bespoke, Limited)
    - Name (Cormorant Garamond), Price (formatted by currency)
    - Wishlist heart icon (top right, toggles)
    - "Quick View" button appears on hover (slides up)
    - Add to cart button slides up on hover

18. ProductCardSkeleton.tsx
    Matching skeleton for ProductCard.tsx

19. QuickViewModal.tsx
    Opens on "Quick View" click
    Shows main image, name, price, size selector, color selector, add to cart

20. WishlistButton.tsx
    Heart icon. Filled if in wishlist. Requires auth — prompts login if not.

21. PFABanner.tsx
    Elegant horizontal banner linking to https://pfacademy.ng
    Copy: "Learn from the Master — Enroll at Prudential Fashion Academy"
    Background: charcoal, gold text, arrow icon
    Opens in new tab
```

---

## STAGE 3 — HOMEPAGE

```
Build src/app/page.tsx (Homepage) — this is the flagship page. Make it unforgettable.
It should feel like a Vogue editorial crossed with a luxury e-commerce site.

── SECTION 1: HERO
Full-viewport hero section.
  - Background: full-bleed video loop OR high-quality editorial image (use placeholder from 
    Unsplash: luxury fashion editorial, African woman, dark/wine aesthetic)
  - Dark overlay gradient: from black/60 at bottom, transparent at top
  - Centered content:
      EYEBROW (SectionLabel): "The New Collection"
      HEADLINE (Cormorant Garamond, 96px desktop / 56px mobile, italic):
        "Dressed in Stories,<br/>Draped in Legacy."
      SUBHEADING (DM Sans, 18px, ivory/80): 
        "Bespoke couture and ready-to-wear for the woman who commands every room."
      TWO BUTTONS: [Shop Collection] [Book Bespoke]
  - Scroll indicator at bottom: thin line animating downward

── SECTION 2: BRAND MARQUEE
  - Infinite scrolling marquee (CSS animation, no JS library needed)
  - Text: "PRUDENTIAL ATELIER · BESPOKE COUTURE · LAGOS, NIGERIA · EST. 2019 · "
  - Background: wine. Text: gold. Thin line above and below.

── SECTION 3: FEATURED COLLECTIONS GRID
  Title (SectionLabel): "THE COLLECTIONS"
  Headline: "Crafted for Every Chapter"
  
  3-column editorial grid (asymmetric — 2 tall left, 1 tall right that spans 2 rows):
  Card 1: "Bridal Collection" — tall portrait image, wine overlay on hover, gold CTA
  Card 2: "Evening Wear" — tall portrait
  Card 3: "Ready-to-Wear" — tall portrait (spans full height right column)
  
  Each card: on hover, overlay fades in with collection name + "Explore →"

── SECTION 4: NEW ARRIVALS
  SectionLabel: "JUST IN"
  Headline: "New Arrivals"
  Subheading + "View All" link right-aligned
  
  Horizontal scrollable row on mobile, 4-column grid on desktop
  Shows 4 ProductCard components (fetched from /api/products?filter=newArrival)
  Framer Motion stagger animation on scroll entry

── SECTION 5: BESPOKE STORY (Split Section)
  Left (60%): Full-height editorial image — atelier/sewing/craft
  Right (40%): Sticky content while scrolling:
    SectionLabel: "THE ATELIER"
    Headline: "Every Stitch, A Signature."
    Body text: About the bespoke process — consultation, measurement, crafting, delivery.
    3 process steps with gold numbered indicators (01, 02, 03)
    CTA Button: "Begin Your Bespoke Journey"

── SECTION 6: BRAND NUMBERS (Stats)
  Background: charcoal
  4 stats in a row:
    "5,000+"  → Graduates Trained
    "2019"    → Est. in Lagos
    "85+"     → Team Members
    "4"       → Continents Served
  Each number in Cormorant Garamond italic, gold. Label in DM Sans, ivory.
  Count-up animation on scroll entry (use Framer Motion + custom hook)

── SECTION 7: TESTIMONIALS
  SectionLabel: "CLIENT LOVE"
  Headline: "What Our Women Say"
  
  Swiper carousel (1 visible, centered, auto-play)
  Each slide: large italic quote (Cormorant Garamond), client name, occasion
  Navigation: thin arrow buttons. Dots pagination in gold.
  Background: ivory-dark

── SECTION 8: INSTAGRAM / LOOKBOOK GRID
  SectionLabel: "FOLLOW THE STORY"
  "@prudent_gabriel on Instagram"
  6-image grid (2 rows × 3 cols). On hover: Instagram icon overlay + gold tint.
  Link to Instagram below grid.

── SECTION 9: PFA ACADEMY BANNER (PFABanner component)

── SECTION 10: NEWSLETTER
  Full-width section. Background: wine texture (subtle noise overlay on wine bg).
  Headline (gold, Cormorant): "Join the Inner Circle"
  Subtext: "Early access, exclusive offers, and stories from the atelier."
  Email input + Subscribe button (gold)
  Privacy note below in tiny text

All sections animate in on scroll (Framer Motion + useInView).
```

---

## STAGE 4 — SHOP & PRODUCT PAGES

```
── src/app/shop/page.tsx — SHOP PAGE

Layout:
  - Hero banner: "The Edit" headline over editorial image with filter chips below
  - Left sidebar (desktop) / Drawer (mobile): Filter panel
  - Right: Product grid

Filter Panel (src/components/shop/FilterPanel.tsx):
  - Category: Bridal, Evening Wear, Casual, Formal, Kiddies, Accessories
  - Type: Ready-to-Wear, Bespoke
  - Price Range: Radix Slider component (formatted in selected currency)
  - Size: toggle chip buttons
  - Color: color swatch dots
  - Sort: Newest, Price Low-High, Price High-Low, Featured
  - Clear All Filters link (gold)

Product Grid:
  - Responsive: 1 col mobile / 2 col tablet / 3 col desktop / 4 col wide
  - Loading state: ProductCardSkeleton components
  - Empty state: elegant "No pieces found" with reset button
  - Infinite scroll OR pagination (elegant numbered, wine/gold styled)
  - Total count shown: "Showing 24 of 48 pieces"

URL state: All filters reflected in URL params (?category=bridal&sort=newest)
Server-side filtering via Prisma queries in route handler.

── src/app/shop/[slug]/page.tsx — PRODUCT DETAIL PAGE

Layout: Full-width, editorial feel.

LEFT (55%): Image Gallery
  - Main image: large, portrait ratio
  - Thumbnail row below (horizontal scroll)
  - Click thumbnail → main image crossfades (Framer Motion)
  - "Zoom" on hover (CSS transform scale)

RIGHT (45%): Product Info (sticky on scroll)
  - Breadcrumb: Shop / Category / Product Name
  - Badge (New Arrival, Bespoke, Limited)
  - Product Name (Cormorant Garamond, 36px)
  - Price (formatted in selected currency, all 3 shown: ₦X / $X / £X)
  - Short description (2-3 lines)
  - Divider (ornamental)
  - Color Selector (color swatches with label)
  - Size Selector (elegant chip buttons)
  - Size Guide link → opens Modal with size chart table
  - Quantity: +/– control (minimal, elegant)
  - Add to Cart button (full-width, wine/gold)
  - Add to Wishlist (ghost button)
  - Divider
  - Accordion (Radix):
      "Product Details" — full description
      "Materials & Care" — fabric, wash instructions
      "Shipping & Returns" — policy summary
  - "This is a Bespoke piece?" CTA card:
      Soft card with gold border:
      "Want this tailored to your exact measurements?"
      [Book Bespoke Consultation] button → /bespoke

BELOW THE FOLD:
  - Reviews section (star rating summary + individual reviews)
  - "You May Also Like" — 4 related product cards

API: 
  - GET /api/products/[slug] — product data with images, sizes, colors
  - generateStaticParams for static generation of known product pages
  - revalidate: 60 (ISR)

── src/app/api/products/route.ts — Products API
  GET handler: 
    - Accepts query params: category, type, sort, page, limit, search, newArrival, featured
    - Prisma query with dynamic where clause
    - Returns: { products, total, page, totalPages }
  
  POST handler (admin only — middleware protected):
    - Create new product with images, sizes, colors

── src/app/api/products/[slug]/route.ts
  GET: Single product by slug with all relations
```

---

## STAGE 5 — AUTHENTICATION SYSTEM

```
Build complete auth system using NextAuth.js v5 with Prisma adapter.

── src/auth.ts — NextAuth Config
  Providers:
    1. Credentials (email + password with bcrypt)
    2. Google OAuth
  
  Callbacks:
    - jwt: include user id, role, referralCode, pointsBalance
    - session: expose id, role, referralCode, pointsBalance to client
  
  Pages:
    - signIn: /auth/login
    - error: /auth/error

── src/middleware.ts
  Protected routes: /account/*, /checkout, /admin/*
  Admin routes: /admin/* — check role === 'ADMIN' || 'SUPER_ADMIN'
  Redirect to /auth/login with callbackUrl if not authenticated

── src/app/auth/

1. login/page.tsx — LOGIN PAGE
   Split layout:
   Left (40%): Brand image + quote (Cormorant Garamond italic)
   Right (60%): Login form
     - "Welcome Back" heading
     - Email + Password fields (Input.tsx)
     - "Forgot password?" link
     - Sign In button (wine/gold)
     - Divider "or continue with"
     - Google OAuth button
     - "New here? Create account" link
   
   On success: redirect to callbackUrl or /account

2. register/page.tsx — REGISTER PAGE
   Same split layout.
   Fields: First Name, Last Name, Email, Phone, Password, Confirm Password
   Referral code field (auto-filled if URL has ?ref=CODE)
   If valid referral code:
     - Show "🎉 You were referred by [name]! You'll receive bonus points on signup."
   Terms checkbox
   Create Account button
   
   On success:
     - If referred: credit 500 points to new user + 250 points to referrer
     - Send welcome email via Resend
     - Redirect to /account

3. forgot-password/page.tsx — Email input → send reset link
4. reset-password/[token]/page.tsx — New password form

── src/app/api/auth/
  [...nextauth]/route.ts — NextAuth handler
  register/route.ts — POST: create user, handle referral, send welcome email
  forgot-password/route.ts — POST: generate token, send email
  reset-password/route.ts — POST: validate token, update password
```

---

## STAGE 6 — USER ACCOUNT & DASHBOARD

```
── src/app/account/layout.tsx
  Sidebar navigation + content area layout.
  Sidebar links (with icons):
    - Overview
    - My Orders
    - My Wishlist
    - Wallet & Points
    - Referral Program
    - Addresses
    - Profile Settings

── src/app/account/page.tsx — DASHBOARD OVERVIEW
  Welcome message: "Good [morning/afternoon], [First Name] 👑"
  
  Stats row (4 cards):
    - Total Orders
    - Points Balance (₦ value equivalent)
    - Wishlist items
    - Referral count
  
  Recent Orders (last 3) — mini order table
  Quick Actions: [Shop Now] [Book Bespoke] [Invite Friends]

── src/app/account/orders/page.tsx — MY ORDERS
  Table/list of all orders:
    - Order number, date, items count, total, status badge, "View Details" link
  
  src/app/account/orders/[id]/page.tsx — ORDER DETAIL
    - Order timeline (placed → confirmed → processing → shipped → delivered)
    - Items with images
    - Address, payment method, totals
    - "Need Help?" contact link

── src/app/account/wishlist/page.tsx — WISHLIST
  Grid of wishlisted ProductCards
  "Move to Cart" action on each item

── src/app/account/wallet/page.tsx — WALLET & POINTS
  
  Wallet Balance Card (full-width, wine gradient bg):
    Points Balance: "2,450 pts" = "₦2,450 store credit"
    Currency equivalent shown in all 3 currencies
    CTA: "Use Points at Checkout"
  
  Points History Table:
    Date | Description | Points | Type (earned/redeemed)
    Types color-coded: gold for earned, wine for redeemed

── src/app/account/referral/page.tsx — REFERRAL PROGRAM
  
  HOW IT WORKS section (3 steps):
    1. Share your unique link
    2. Friend signs up → you get 250 pts, they get 500 pts
    3. Friend makes first purchase → you get 10% of order value in points
  
  Your Referral Link card (wine bg, gold text):
    https://prudentialatelier.com/ref/[code]
    [Copy Link] [Share on WhatsApp] [Share on Instagram]
  
  Stats:
    - Total referrals: X
    - Points earned from referrals: X pts
  
  Referrals table: Name (masked), Date, Status, Points earned

── src/app/account/addresses/page.tsx
  List of saved addresses
  Add / Edit / Delete / Set Default actions
  Address form in Modal

── src/app/account/profile/page.tsx
  Edit: name, email, phone, profile picture (Cloudinary upload)
  Change password section (separate form)

── src/app/api/account/ (API routes)
  profile/route.ts       — GET/PATCH user profile
  orders/route.ts        — GET user orders
  orders/[id]/route.ts   — GET single order
  wishlist/route.ts      — GET/POST/DELETE wishlist items
  addresses/route.ts     — GET/POST addresses
  addresses/[id]/route.ts — PATCH/DELETE address
  wallet/route.ts        — GET points balance + history

── src/app/ref/[code]/page.tsx — REFERRAL LANDING
  Middleware: if user arrives at /ref/[code]:
    - Store referral code in cookie (30-day expiry)
    - Redirect to /auth/register?ref=[code]
  
  Register page reads cookie/param to auto-fill referral field
```

---

## STAGE 7 — BESPOKE CONSULTATION

```
── src/app/bespoke/page.tsx — BESPOKE PAGE

HERO: "Your Vision, Our Craft" — full-width editorial image, dark overlay
Subtext: "Every bespoke piece begins with a conversation."

HOW IT WORKS: 4-step visual timeline (horizontal on desktop):
  01 → Consultation (book a call / fill form)
  02 → Design & Fabric Selection
  03 → Measurements & Fitting
  04 → Delivery of Your Masterpiece

BESPOKE FORM (src/components/bespoke/BespokeForm.tsx):
  Multi-step form (3 steps with progress bar):
  
  Step 1 — About You:
    Full Name, Email, Phone, Country, How did you hear about us?
  
  Step 2 — Your Piece:
    Occasion (select: Wedding, Wedding Guest, Corporate, Event, Birthday, Other)
    Description (textarea: "Tell us about your dream piece...")
    Budget Range (select: Under ₦200k, ₦200k–₦500k, ₦500k–₦1M, Above ₦1M)
    Timeline (select: Under 2 weeks, 2-4 weeks, 1-2 months, 3+ months)
    Reference Images (Cloudinary upload, max 5 images)
  
  Step 3 — Your Measurements (optional):
    Bust, Waist, Hips, Height, Notes
    "Don't know your measurements? We'll take them at your fitting."
  
  Preferred consultation date (date picker)
  
  Submit → POST /api/bespoke → sends confirmation email via Resend → success page

GALLERY: "Previous Bespoke Creations" — masonry grid of past work

── src/app/api/bespoke/route.ts
  POST: Create BespokeRequest, send confirmation email to client + notification email to admin
```

---

## STAGE 8 — CHECKOUT & PAYMENT

```
── src/app/checkout/page.tsx — CHECKOUT PAGE
  3-step progress indicator: Cart → Details → Payment

  STEP 1 — CART REVIEW:
    Order items (image, name, size, color, qty, price)
    Quantity edit + remove item
    Coupon/promo code field
    Points redemption:
      Toggle: "Use my [X] points (= ₦X off)"
      Shows updated total if toggled on
    [Continue to Details] button

  STEP 2 — DELIVERY DETAILS:
    If logged in: show saved addresses + "Add new" option
    If guest: full address form
    Contact info: name, email, phone
    Order notes (optional textarea)
    [Continue to Payment] button

  STEP 3 — PAYMENT:
    Currency selector (NGN / USD / GBP)
    Order summary (right panel): items, subtotal, points discount, total
    
    Payment method selector (elegant radio cards with logos):
      🟢 Paystack (NGN only — show only if currency = NGN)
      🔵 Flutterwave (NGN, USD, GBP)
      🟣 Stripe (USD, GBP — show only if currency ≠ NGN)
      ⚫ Monnify (NGN only)
    
    [Pay Now ₦XX,XXX] button (wine, full-width)
    
    Padlock icon + "Secured by [Gateway]" text

── src/app/checkout/success/page.tsx
  Animated checkmark (Framer Motion draw SVG)
  "Your order has been placed!" 
  Order number, summary, "Track Order" + "Continue Shopping" buttons
  Trigger: award points (1 point per ₦100 spent), send confirmation email

── Payment API Routes:

src/app/api/payment/paystack/
  initiate/route.ts  — POST: Initialize Paystack transaction, return payment URL/reference
  verify/route.ts    — GET: Verify payment by reference, update order status
  webhook/route.ts   — POST: Paystack webhook handler (signature verification)

src/app/api/payment/flutterwave/
  initiate/route.ts  — POST: Initialize Flutterwave payment
  verify/route.ts    — GET: Verify by transaction ID
  webhook/route.ts   — POST: Flutterwave webhook

src/app/api/payment/stripe/
  initiate/route.ts  — POST: Create Stripe PaymentIntent, return client_secret
  webhook/route.ts   — POST: Stripe webhook (use raw body)

src/app/api/payment/monnify/
  initiate/route.ts  — POST: Initialize Monnify transaction
  verify/route.ts    — GET: Verify payment
  webhook/route.ts   — POST: Monnify webhook

── Points Award Logic (src/lib/points.ts):
  awardPurchasePoints(userId, orderTotal, currency):
    Convert total to NGN equivalent
    Award 1 point per ₦100 (minimum 10 points per order)
    Create PointsTransaction record
    Update user.pointsBalance
  
  redeemPoints(userId, pointsToRedeem):
    Validate user has enough points
    Deduct from pointsBalance
    Create PointsTransaction record (type: REDEEMED)
    Return NGN discount amount

── Currency Utils (src/lib/currency.ts):
  fetchExchangeRates() — Fetch from exchangerate-api.com, cache in Redis or memory (1hr TTL)
  convertPrice(amount: number, from: Currency, to: Currency): number
  formatPrice(amount: number, currency: Currency): string
    → ₦1,250,000 | $850.00 | £670.00
```

---

## STAGE 9 — ADMIN DASHBOARD

```
── src/app/admin/layout.tsx
  Dark sidebar layout (charcoal bg, gold accents)
  Sidebar navigation:
    - Dashboard Overview
    - Products (list, add, edit)
    - Orders (all, pending, processing, shipped)
    - Bespoke Requests
    - Customers
    - Referral Analytics
    - Settings

── src/app/admin/page.tsx — ADMIN OVERVIEW
  KPI cards:
    Total Revenue (NGN/USD/GBP toggle)
    Total Orders
    Active Customers
    Pending Bespoke Requests
  
  Revenue chart (last 30 days) — use recharts LineChart
  Recent orders table
  Low stock / out of stock products alert

── src/app/admin/products/page.tsx — PRODUCTS LIST
  Search + filter by category/type/stock
  Table: image, name, category, price, stock, status, actions
  Bulk actions: delete, toggle featured, toggle new arrival
  [+ Add Product] button → /admin/products/new

── src/app/admin/products/new/page.tsx — ADD PRODUCT
── src/app/admin/products/[id]/edit/page.tsx — EDIT PRODUCT
  
  Product form fields:
    Basic: name (auto-generates slug), description, details
    Category + Type selectors
    Pricing: NGN (required), USD (optional), GBP (optional)
    Images: Cloudinary multi-upload widget (drag & drop, set primary)
    Sizes: add/remove chip tags
    Colors: color picker + label, add/remove
    Toggles: inStock, isFeatured, isNewArrival
    [Save Product] / [Save & Publish]

── src/app/admin/orders/page.tsx — ORDERS
  Filterable table by status, date range, search by order# or email
  Status badges: color-coded
  Click row → order detail with status update dropdown + notes field
  Bulk status update

── src/app/admin/bespoke/page.tsx — BESPOKE REQUESTS
  Table: client name, occasion, budget, timeline, status, date
  Click → full request detail modal
  Status update: Pending → Reviewed → Confirmed → In Progress → Ready → Delivered
  Internal notes field (not visible to client)

── src/app/admin/customers/page.tsx
  Customer list with: name, email, total orders, total spend, points balance, referrals
  Click → customer detail (orders history, points history, referral chain)

── src/app/admin/referrals/page.tsx — REFERRAL ANALYTICS
  Total referrals, top referrers leaderboard
  Points issued vs redeemed chart
  Individual referral chain viewer

── src/app/api/admin/ (all routes protected by admin middleware)
  products/route.ts, products/[id]/route.ts
  orders/route.ts, orders/[id]/route.ts
  bespoke/route.ts, bespoke/[id]/route.ts
  customers/route.ts, customers/[id]/route.ts
  analytics/route.ts — revenue, orders, referrals data
  upload/route.ts — Cloudinary signed upload
```

---

## STAGE 10 — REMAINING PAGES

```
── src/app/our-story/page.tsx — ABOUT / BRAND STORY
  HERO: Full-bleed portrait of Mrs. Prudent Gabriel-Okopi with elegant overlay
  
  SECTION 1 — THE BEGINNING:
    Cormorant italic headline: "From a Tiny Room in Ajah to the World's Stage"
    Story copy (brand biography — pull from research)
  
  SECTION 2 — THE FOUNDER:
    Split layout: image left, bio right
    Quote pullout in Cormorant italic
  
  SECTION 3 — BRAND VALUES:
    3 pillars (cards):
    Heritage · Craftsmanship · Empowerment
  
  SECTION 4 — NOTABLE CLIENTS:
    "Dressed for Their Greatest Moments"
    Logo/name grid: Peggy Ovire, Mercy Chinwo, Mabel Makun, etc.
  
  SECTION 5 — PFA CALLOUT:
    "The Academy" section — brief about Prudential Fashion Academy
    CTA: [Visit PFA Academy ↗] linking to https://pfacademy.ng

── src/app/press/page.tsx — PRESS
  HERO: "As Seen In"
  Press feature cards: publication name, article title, date, excerpt, "Read More →" link
  Press contact section at bottom

── src/app/contact/page.tsx — CONTACT
  Split: Contact form (left) + Info (right)
  Info: address (Lagos), email, phone, Instagram link, working hours
  Form: Name, Email, Subject, Message, Send button
  Embedded Google Maps (optional)

── src/app/legal/privacy/page.tsx — PRIVACY POLICY
── src/app/legal/terms/page.tsx — TERMS & CONDITIONS
── src/app/legal/returns/page.tsx — RETURNS POLICY
  All legal pages: clean typographic layout, charcoal on ivory

── src/app/not-found.tsx — 404 PAGE
  Elegant: "404 — This Page Has Left the Atelier"
  Animated (Framer Motion), wine bg, gold text
  [Return Home] + [Browse Collections] buttons
```

---

## STAGE 11 — EMAIL TEMPLATES

```
Build all email templates using React Email + Resend.
Located in: src/emails/

All templates use Prudential Atelier brand colors (inline styles for email compatibility):
  Wine: #6B1C2A | Gold: #C9A84C | Ivory: #FAF6EF | Charcoal: #1A1A1A

1. WelcomeEmail.tsx
   Subject: "Welcome to Prudential Atelier, [Name] ✨"
   Body: Welcome message, points balance (if referred), shop CTA, social links

2. OrderConfirmationEmail.tsx
   Subject: "Order Confirmed — #[orderNumber]"
   Body: Order items table, total, delivery address, tracking note, contact link

3. OrderShippedEmail.tsx
   Subject: "Your Order is On Its Way! 🎉"
   Body: Tracking number, estimated delivery, order summary

4. BespokeConfirmationEmail.tsx
   Subject: "Bespoke Request Received — We'll Be in Touch"
   Body: Request summary, next steps, contact info

5. PasswordResetEmail.tsx
   Subject: "Reset Your Prudential Atelier Password"
   Body: Reset link (expires 1hr), security note

6. ReferralSuccessEmail.tsx
   Subject: "You just earned points! 🌟"
   Body: "[Friend Name] signed up using your link! +250 points added to your wallet."

7. AdminBespokeNotification.tsx (internal)
   Subject: "New Bespoke Request — [Client Name]"
   Body: Full request details for admin

── src/app/api/email/route.ts
  POST handler using Resend SDK to send any of the above templates
```

---

## STAGE 12 — SEO, PERFORMANCE & DEPLOYMENT

```
── SEO Configuration

1. src/app/layout.tsx — Root metadata:
   title: { template: '%s | Prudential Atelier', default: 'Prudential Atelier — Luxury Nigerian Fashion' }
   description: "Bespoke couture and ready-to-wear by Prudent Gabriel-Okopi. Luxury Nigerian fashion for the modern woman."
   keywords: ["Nigerian fashion", "bespoke couture", "luxury fashion Nigeria", "bridal fashion Lagos", "Prudent Gabriel"]
   openGraph: brand image, title, description
   Twitter: card, site, creator

2. Dynamic metadata for product pages (src/app/shop/[slug]/page.tsx):
   generateMetadata: fetch product, return name, description, images for OG

3. src/app/sitemap.ts — Dynamic sitemap generation:
   All static pages + all product slugs (fetched from DB)

4. src/app/robots.ts — robots.txt:
   Allow all, disallow /admin, /api

5. next.config.ts:
   Image domains: cloudinary, images.unsplash.com
   Strict mode: true
   Bundle analyzer (dev only)

── Performance

1. All product images via next/image with:
   - Cloudinary loader
   - Proper width/height
   - loading="lazy" for below-fold
   - priority on hero images

2. Dynamic imports for:
   - Admin dashboard components (no SSR)
   - Heavy animation components
   - Swiper carousel

3. ISR on product pages: revalidate: 60
4. Static generation for: /our-story, /press, /contact, /legal/*
5. React Suspense boundaries on all data-fetching components

── Deployment Config

Create the following files:

.env.production (with all env var keys, values to be filled):
  NODE_ENV=production
  DATABASE_URL=
  NEXTAUTH_URL=https://prudentialatelier.com
  [all other keys]

vercel.json:
  {
    "framework": "nextjs",
    "buildCommand": "prisma generate && next build",
    "env": { "NODE_ENV": "production" }
  }

OR for VPS deployment, create:
  Dockerfile (multi-stage Next.js Docker build)
  docker-compose.yml (app + PostgreSQL + optional Redis)
  ecosystem.config.js (PM2 config for process management)
  deploy.sh (pull, build, migrate, restart)

Package.json scripts:
  "dev": "next dev",
  "build": "prisma generate && next build",
  "start": "next start",
  "db:push": "prisma db push",
  "db:migrate": "prisma migrate dev",
  "db:studio": "prisma studio",
  "db:seed": "tsx prisma/seed.ts"

── Prisma Seed File (prisma/seed.ts):
  Create admin user (credentials from env)
  Create 12 sample products across categories
  Create 3 sample bespoke requests
  Assign sample referral codes
```

---

## FOLDER STRUCTURE (Final)

```
prudential-atelier/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── auth/login | register | forgot-password | reset-password
│   │   ├── (main)/
│   │   │   ├── page.tsx                    (Homepage)
│   │   │   ├── shop/page.tsx + [slug]/
│   │   │   ├── bespoke/page.tsx
│   │   │   ├── our-story/page.tsx
│   │   │   ├── press/page.tsx
│   │   │   ├── contact/page.tsx
│   │   │   └── legal/privacy | terms | returns
│   │   ├── account/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                    (Dashboard)
│   │   │   ├── orders/page.tsx + [id]/
│   │   │   ├── wishlist/page.tsx
│   │   │   ├── wallet/page.tsx
│   │   │   ├── referral/page.tsx
│   │   │   ├── addresses/page.tsx
│   │   │   └── profile/page.tsx
│   │   ├── admin/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── products/page.tsx + new | [id]/edit
│   │   │   ├── orders/page.tsx + [id]/
│   │   │   ├── bespoke/page.tsx
│   │   │   ├── customers/page.tsx
│   │   │   └── referrals/page.tsx
│   │   ├── checkout/
│   │   │   ├── page.tsx
│   │   │   └── success/page.tsx
│   │   ├── ref/[code]/page.tsx
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/route.ts
│   │   │   ├── auth/register | forgot-password | reset-password
│   │   │   ├── products/route.ts + [slug]/
│   │   │   ├── account/profile | orders | wishlist | addresses | wallet
│   │   │   ├── payment/paystack | flutterwave | stripe | monnify
│   │   │   ├── bespoke/route.ts
│   │   │   ├── admin/ (products | orders | bespoke | customers | analytics | upload)
│   │   │   └── email/route.ts
│   │   ├── layout.tsx
│   │   ├── not-found.tsx
│   │   └── sitemap.ts + robots.ts
│   ├── components/
│   │   ├── ui/             (Button, Input, Select, Badge, Card, Modal, Toast, ...)
│   │   ├── layout/         (Navbar, Footer, CartDrawer, SearchModal)
│   │   ├── common/         (CurrencySwitcher, ProductCard, WishlistButton, PFABanner, ...)
│   │   ├── shop/           (FilterPanel, ProductGrid, SizeGuideModal)
│   │   ├── bespoke/        (BespokeForm, BespokeGallery)
│   │   ├── account/        (Sidebar, OrderTable, WalletCard, ReferralCard)
│   │   ├── admin/          (AdminSidebar, ProductForm, OrdersTable, ...)
│   │   ├── checkout/       (CartReview, DeliveryForm, PaymentSelector)
│   │   └── home/           (Hero, CollectionsGrid, NewArrivals, BespokeStory, ...)
│   ├── emails/             (WelcomeEmail, OrderConfirmation, BespokeConfirmation, ...)
│   ├── lib/                (prisma, auth, cloudinary, currency, points, referral, utils, validations)
│   ├── providers/          (LenisProvider, CartProvider, CurrencyProvider)
│   ├── hooks/              (useCart, useWishlist, useCurrency, useCountUp, useInView)
│   ├── store/              (cartStore.ts, wishlistStore.ts, currencyStore.ts — Zustand)
│   ├── types/              (index.ts — all shared TypeScript interfaces)
│   ├── styles/
│   │   └── globals.css
│   ├── auth.ts
│   └── middleware.ts
├── public/
│   ├── fonts/              (if self-hosting any fonts)
│   ├── images/             (static brand assets: logo, favicon, og-image)
│   └── icons/
├── .env.local
├── .env.production
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── vercel.json / Dockerfile
└── package.json
```

---

## IMPLEMENTATION NOTES FOR CURSOR

1. **Build in strict order.** Each stage depends on the previous.
2. **Never use placeholder data in the UI** — always wire to real API routes.
3. **All forms must use React Hook Form + Zod.** No raw state for forms.
4. **All Prisma queries must handle errors** — wrap in try/catch, return typed responses.
5. **Payment webhooks must verify signatures** before processing any order update.
6. **All admin routes must be protected** — check role in both middleware AND the route handler.
7. **Referral code cookie must be HttpOnly and Secure** in production.
8. **Points transactions must be atomic** — use Prisma `$transaction()` when updating both balance and history.
9. **Currency conversion must be cached** — never call exchange rate API on every request.
10. **Product images must always go through Cloudinary** — no local file storage.

---

*Built for Prudential Atelier by Nony | SonsHub Media*  
*Cursor AI Full-Stack Prompt — Version 1.0*
