# CURSOR AI MASTER PROMPT — PRUDENTIAL ATELIER
### Full-Stack Luxury E-Commerce · Version 2.0
### Prepared by Nony | SonsHub Media · For Mrs. Prudent Gabriel-Okopi

---

> ## ⚠️ CURSOR OPERATING INSTRUCTIONS
>
> 1. **Read this ENTIRE document before writing a single line of code.**
> 2. **Build stages in strict sequential order. Never skip or merge stages.**
> 3. **After completing each stage, output a summary of what was built before proceeding.**
> 4. **Every component must be typed with TypeScript. No `any` types.**
> 5. **Every form must use React Hook Form + Zod. No raw useState for forms.**
> 6. **Every API route must validate input and return typed JSON responses.**
> 7. **Every Prisma write that touches two tables must use `$transaction()`.**
> 8. **Deployment target: Vercel (primary) → Coolify/VPS (secondary). Build for Vercel first.**

---

## 0. BRAND BRIEF

| Field | Value |
|---|---|
| Brand Name | Prudential Atelier |
| Owner | Mrs. Prudent Gabriel-Okopi |
| Domain | prudentialatelier.com (or prudentgabriel.com) |
| Category | Luxury Nigerian Fashion |
| Offerings | Ready-to-Wear (RTW) · Bespoke Couture · Bridal |
| Academy (External) | https://pfacademy.ng — link only, do not rebuild |
| Est. | Lagos, Nigeria, 2019 |
| Clients | Nigeria · UK · US · Australia · Europe |
| Beat This | https://tubowoman.com |
| Standard | $10,000 website. Vogue editorial × luxury e-commerce. |

---

## 1. DESIGN SYSTEM

### 1.1 Color Tokens
```css
/* src/styles/tokens.css */
:root {
  /* Brand Colors */
  --wine:           #6B1C2A;
  --wine-hover:     #7D2233;
  --wine-dark:      #4A1019;
  --wine-muted:     #6B1C2A1A;   /* 10% opacity — for tints */

  --gold:           #C9A84C;
  --gold-hover:     #D9BB62;
  --gold-muted:     #C9A84C26;   /* 15% opacity */
  --gold-dark:      #A8893A;

  --ivory:          #FAF6EF;
  --ivory-dark:     #F0E8D8;
  --ivory-deeper:   #E8D9C0;

  --charcoal:       #1A1A1A;
  --charcoal-mid:   #3D3D3D;
  --charcoal-light: #6B6B6B;

  --cream:          #FEFAF3;
  --border:         #E8DDD0;
  --border-dark:    #C8B89A;

  /* Semantic */
  --success:        #2D6A4F;
  --error:          #C1121F;
  --warning:        #E76F51;
  --info:           #457B9D;

  /* Typography */
  --font-display:   'Cormorant Garamond', Georgia, serif;
  --font-body:      'DM Sans', system-ui, sans-serif;
  --font-label:     'Cormorant SC', Georgia, serif;

  /* Spacing Scale */
  --space-xs:   4px;
  --space-sm:   8px;
  --space-md:   16px;
  --space-lg:   24px;
  --space-xl:   40px;
  --space-2xl:  64px;
  --space-3xl:  96px;
  --space-4xl:  128px;

  /* Radius */
  --radius-sm:  2px;
  --radius-md:  4px;
  --radius-lg:  8px;
  --radius-xl:  16px;

  /* Shadows */
  --shadow-sm:  0 1px 3px rgba(26,26,26,0.08);
  --shadow-md:  0 4px 16px rgba(26,26,26,0.10);
  --shadow-lg:  0 8px 40px rgba(26,26,26,0.14);
  --shadow-gold: 0 4px 24px rgba(201,168,76,0.20);

  /* Transitions */
  --ease:       cubic-bezier(0.25, 0.1, 0.25, 1);
  --ease-out:   cubic-bezier(0, 0, 0.2, 1);
  --duration:   300ms;
}
```

### 1.2 Typography Scale
```
Display XL:  Cormorant Garamond · 96px · weight 400 · italic · line-height 1.0
Display L:   Cormorant Garamond · 72px · weight 400 · italic · line-height 1.05
Display M:   Cormorant Garamond · 56px · weight 500 · line-height 1.1
Display S:   Cormorant Garamond · 40px · weight 500 · line-height 1.15
Heading L:   Cormorant Garamond · 32px · weight 600 · line-height 1.2
Heading M:   Cormorant Garamond · 24px · weight 600 · line-height 1.3
Label:       Cormorant SC · 12px · weight 500 · letter-spacing 0.15em · uppercase
Body L:      DM Sans · 18px · weight 400 · line-height 1.7
Body M:      DM Sans · 16px · weight 400 · line-height 1.65
Body S:      DM Sans · 14px · weight 400 · line-height 1.6
Caption:     DM Sans · 12px · weight 400 · line-height 1.5
```

### 1.3 Animation Standards
```
Page entrance:   opacity 0→1 + translateY 24px→0 · duration 700ms · easeOut
Stagger delay:   100ms between siblings
Hover scale:     transform scale(1.02) · 200ms ease
Card hover:      translateY(-4px) + shadow upgrade · 250ms ease
Button shimmer:  pseudo-element sweep on hover (CSS only)
Drawer:          translateX(100%) → 0 · 350ms easeOut (Framer Motion)
Modal:           scale(0.96)→1 + opacity · 250ms easeOut (Framer Motion)
Marquee:         CSS infinite scroll · 40s linear
Number countup:  Framer Motion useMotionValue on scroll entry
```

---

## 2. TECH STACK

```
Framework:        Next.js 14 — App Router, TypeScript strict mode
Styling:          Tailwind CSS v3 + CSS custom properties
Animation:        Framer Motion v11 + Lenis (smooth scroll)
ORM:              Prisma 5
Database:         PostgreSQL via Neon.tech (Vercel-compatible, serverless)
Auth:             NextAuth.js v5 (Auth.js) — Credentials + Google OAuth
File Storage:     Cloudinary (products, reviews, bespoke uploads)
Payments:         Paystack · Flutterwave · Stripe · Monnify
Currency:         NGN · USD · GBP (exchange rates via Open Exchange Rates API)
Email:            Resend + React Email
State (client):   Zustand v4 (cart, wishlist, currency, recently viewed)
Forms:            React Hook Form v7 + Zod v3
UI Primitives:    Radix UI (Dialog, Select, Dropdown, Accordion, Tabs, Slider, Toast)
Data Fetching:    TanStack Query v5 (client-side) + Next.js fetch (server)
Date:             date-fns v3
Rich Text:        Tiptap (product descriptions in admin)
Charts:           Recharts (admin analytics)
Tables:           TanStack Table v8 (admin)
Image Crop:       react-easy-crop (admin product image)
Slugs:            slugify
IDs:              nanoid
Utilities:        clsx + tailwind-merge (cn())
```

---

## 3. DATABASE SCHEMA

```prisma
// prisma/schema.prisma
// Full production schema — copy exactly

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL") // Required for Neon serverless
}

// ─────────────────────────────────────────
// AUTH MODELS (NextAuth v5 required)
// ─────────────────────────────────────────

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime
  @@unique([identifier, token])
}

model PasswordResetToken {
  id        String   @id @default(cuid())
  email     String
  token     String   @unique
  expires   DateTime
  createdAt DateTime @default(now())
}

// ─────────────────────────────────────────
// USER
// ─────────────────────────────────────────

model User {
  id            String    @id @default(cuid())
  name          String?
  firstName     String?
  lastName      String?
  email         String    @unique
  emailVerified DateTime?
  phone         String?
  password      String?
  image         String?
  role          Role      @default(CUSTOMER)

  // Loyalty & Referral
  referralCode    String  @unique @default(cuid())
  referredById    String?
  referredBy      User?   @relation("Referrals", fields: [referredById], references: [id])
  referrals       User[]  @relation("Referrals")
  pointsBalance   Int     @default(0)  // 1 point = ₦1 store credit

  // Relations
  orders          Order[]
  addresses       Address[]
  wishlistItems   WishlistItem[]
  reviews         Review[]
  pointsHistory   PointsTransaction[]
  stockAlerts     StockAlert[]
  accounts        Account[]
  sessions        Session[]
  cartItems       CartItem[]   // Persisted server cart

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([email])
  @@index([referralCode])
}

// ─────────────────────────────────────────
// PRODUCT SYSTEM
// ─────────────────────────────────────────

model Product {
  id          String          @id @default(cuid())
  name        String
  slug        String          @unique
  description String          @db.Text
  details     String?         @db.Text  // Materials, care instructions (Tiptap HTML)
  category    ProductCategory
  type        ProductType     @default(RTW)
  tags        String[]        // ["bridal","evening","modest","bespoke-available"]

  // Base price (NGN) — variants override this per size
  basePriceNGN Float
  basePriceUSD Float?
  basePriceGBP Float?

  // Sale
  isOnSale        Boolean   @default(false)
  saleEndsAt      DateTime? // null = no timer, set date = show countdown

  // Status flags
  inStock         Boolean   @default(true)
  isFeatured      Boolean   @default(false)
  isNewArrival    Boolean   @default(false)
  isPublished     Boolean   @default(false)
  isBespokeAvail  Boolean   @default(false)

  // SEO
  metaTitle       String?
  metaDescription String?

  // Relations
  images          ProductImage[]
  variants        ProductVariant[]  // ← size-based pricing lives here
  colors          ProductColor[]    // colors are product-level, not variant-level
  orderItems      OrderItem[]
  wishlistItems   WishlistItem[]
  reviews         Review[]
  stockAlerts     StockAlert[]
  bundleItems     BundleItem[]      @relation("BundleSource")
  bundledIn       BundleItem[]      @relation("BundleTarget")
  cartItems       CartItem[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([slug])
  @@index([category])
  @@index([isPublished, isFeatured])
}

// Each variant = one size option with its own price + stock
model ProductVariant {
  id          String   @id @default(cuid())
  productId   String
  product     Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  size        String   // "XS" | "S" | "M" | "L" | "XL" | "XXL" | "Custom" | "UK6" etc.
  sku         String   @unique  // Auto-generated: SLUG-SIZE e.g. "red-gown-xl"

  // Variant-specific pricing (overrides base product price)
  priceNGN    Float
  priceUSD    Float?
  priceGBP    Float?

  // Sale pricing per variant
  salePriceNGN Float?  // null = not on sale
  salePriceUSD Float?
  salePriceGBP Float?

  // Inventory
  stock       Int      @default(0)
  lowStockAt  Int      @default(3)  // Trigger "Only X left" warning

  orderItems  OrderItem[]
  cartItems   CartItem[]
  stockAlerts StockAlert[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([productId])
  @@index([sku])
}

model ProductColor {
  id        String  @id @default(cuid())
  productId String
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  name      String  // "Wine Red"
  hex       String  // "#6B1C2A"
  imageUrl  String? // Optional color-specific hero image
}

model ProductImage {
  id        String  @id @default(cuid())
  productId String
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  url       String
  alt       String?
  isPrimary Boolean @default(false)
  sortOrder Int     @default(0)
}

// "Complete the Look" bundles
model BundleItem {
  id       String  @id @default(cuid())
  sourceId String  // The product shown on
  source   Product @relation("BundleSource", fields: [sourceId], references: [id])
  targetId String  // The suggested product
  target   Product @relation("BundleTarget", fields: [targetId], references: [id])
}

// ─────────────────────────────────────────
// CART (server-persisted for logged-in users)
// ─────────────────────────────────────────

model CartItem {
  id        String         @id @default(cuid())
  userId    String
  user      User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  productId String
  product   Product        @relation(fields: [productId], references: [id])
  variantId String
  variant   ProductVariant @relation(fields: [variantId], references: [id])
  colorId   String?
  quantity  Int            @default(1)
  createdAt DateTime       @default(now())
  updatedAt DateTime       @updatedAt

  @@unique([userId, variantId, colorId])
}

// ─────────────────────────────────────────
// COUPONS
// ─────────────────────────────────────────

model Coupon {
  id              String       @id @default(cuid())
  code            String       @unique  // "WELCOME10", "FLASH500"
  description     String?
  type            CouponType
  value           Float        // % value OR fixed NGN amount

  // Restrictions
  minOrderNGN     Float?       // Minimum order to apply
  maxUsesTotal    Int?         // null = unlimited
  maxUsesPerUser  Int          @default(1)
  usedCount       Int          @default(0)

  // Scope
  appliesToAll    Boolean      @default(true)
  categoryScope   ProductCategory[]  // If not appliesToAll
  productScope    String[]           // Specific product IDs

  // Validity
  isActive        Boolean      @default(true)
  startsAt        DateTime     @default(now())
  expiresAt       DateTime?    // null = never expires

  // Relations
  orders          Order[]
  usages          CouponUsage[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([code])
}

model CouponUsage {
  id       String   @id @default(cuid())
  couponId String
  coupon   Coupon   @relation(fields: [couponId], references: [id])
  userId   String?
  email    String   // Support guest usage tracking
  orderId  String
  usedAt   DateTime @default(now())

  @@unique([couponId, orderId])
}

// ─────────────────────────────────────────
// SHIPPING
// ─────────────────────────────────────────

model ShippingZone {
  id              String   @id @default(cuid())
  name            String   // "Lagos", "Other Nigeria", "UK", "US", "International"
  countries       String[] // ISO codes: ["NG"] or ["GB"] or ["*"] for catch-all
  states          String[] // Nigerian states if applicable: ["Lagos"]
  flatRateNGN     Float    // Flat rate base in NGN
  perKgNGN        Float    @default(0)  // Additional per kg
  freeAboveNGN    Float?   // Free if order above this NGN value, null = never free
  estimatedDays   String   // "1-2 days", "3-5 days", "7-14 days"
  isActive        Boolean  @default(true)

  orders Order[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// ─────────────────────────────────────────
// ORDERS
// ─────────────────────────────────────────

model Order {
  id          String @id @default(cuid())
  orderNumber String @unique  // "PA-2024-00042" — human readable

  // Customer
  userId      String?
  user        User?   @relation(fields: [userId], references: [id])
  guestEmail  String?
  guestName   String?
  guestPhone  String?

  // Items
  items       OrderItem[]

  // Pricing breakdown (all stored in NGN, display currency saved for reference)
  currency         Currency  @default(NGN)
  subtotalNGN      Float
  shippingNGN      Float     @default(0)
  discountNGN      Float     @default(0)  // From coupon
  pointsDiscNGN    Float     @default(0)  // From points redemption
  totalNGN         Float

  // Coupon
  couponId    String?
  coupon      Coupon? @relation(fields: [couponId], references: [id])
  couponCode  String?

  // Points
  pointsUsed  Int     @default(0)

  // Shipping
  shippingZoneId  String?
  shippingZone    ShippingZone? @relation(fields: [shippingZoneId], references: [id])
  addressSnapshot Json          // Snapshot of address at time of order

  // Gift
  isGift      Boolean @default(false)
  giftMessage String?

  // Payment
  paymentGateway  PaymentGateway?
  paymentRef      String?
  paymentStatus   PaymentStatus   @default(PENDING)
  paidAt          DateTime?

  // Order lifecycle
  status      OrderStatus @default(PENDING)
  notes       String?     // Customer notes at checkout
  adminNotes  String?     // Internal only

  // Bespoke flag
  isBespoke   Boolean @default(false)

  // Timestamps
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([orderNumber])
  @@index([userId])
  @@index([paymentStatus])
  @@index([status])
}

model OrderItem {
  id        String         @id @default(cuid())
  orderId   String
  order     Order          @relation(fields: [orderId], references: [id])
  productId String
  product   Product        @relation(fields: [productId], references: [id])
  variantId String
  variant   ProductVariant @relation(fields: [variantId], references: [id])

  quantity  Int
  size      String
  color     String?
  colorHex  String?

  // Price snapshot at time of purchase (NGN)
  unitPriceNGN Float
  totalNGN     Float
}

// ─────────────────────────────────────────
// BESPOKE REQUESTS
// ─────────────────────────────────────────

model BespokeRequest {
  id              String        @id @default(cuid())
  requestNumber   String        @unique  // "BQ-2024-0012"
  name            String
  email           String
  phone           String
  country         String
  source          String?       // "Instagram", "Referral", "Google" etc.
  occasion        String
  description     String        @db.Text
  budgetRange     String
  timeline        String
  referenceImages String[]      // Cloudinary URLs
  measurements    Json?         // { bust, waist, hips, height, notes }
  preferredDate   DateTime?
  status          BespokeStatus @default(PENDING)
  adminNotes      String?
  estimatedPrice  Float?
  userId          String?       // Link to user if logged in

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([status])
}

// ─────────────────────────────────────────
// ADDRESSES
// ─────────────────────────────────────────

model Address {
  id         String  @id @default(cuid())
  userId     String
  user       User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  label      String? // "Home", "Office"
  firstName  String
  lastName   String
  phone      String
  line1      String
  line2      String?
  city       String
  state      String
  postalCode String?
  country    String  @default("NG")
  isDefault  Boolean @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// ─────────────────────────────────────────
// WISHLIST
// ─────────────────────────────────────────

model WishlistItem {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  productId String
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@unique([userId, productId])
}

// ─────────────────────────────────────────
// REVIEWS
// ─────────────────────────────────────────

model Review {
  id          String  @id @default(cuid())
  userId      String
  user        User    @relation(fields: [userId], references: [id])
  productId   String
  product     Product @relation(fields: [productId], references: [id])
  orderId     String? // Verified purchase badge if linked
  rating      Int     // 1–5
  title       String?
  body        String? @db.Text
  isVerified  Boolean @default(false)
  isApproved  Boolean @default(false) // Admin must approve before showing
  helpfulVotes Int    @default(0)

  createdAt DateTime @default(now())

  @@unique([userId, productId])
  @@index([productId, isApproved])
}

// ─────────────────────────────────────────
// LOYALTY & REFERRAL
// ─────────────────────────────────────────

model PointsTransaction {
  id          String     @id @default(cuid())
  userId      String
  user        User       @relation(fields: [userId], references: [id])
  type        PointsType
  amount      Int        // Positive = earned, negative = redeemed
  balance     Int        // Running balance after this transaction
  description String
  orderId     String?
  referralId  String?

  createdAt DateTime @default(now())

  @@index([userId])
}

// ─────────────────────────────────────────
// STOCK ALERTS
// ─────────────────────────────────────────

model StockAlert {
  id        String         @id @default(cuid())
  email     String
  userId    String?
  user      User?          @relation(fields: [userId], references: [id])
  productId String
  product   Product        @relation(fields: [productId], references: [id])
  variantId String
  variant   ProductVariant @relation(fields: [variantId], references: [id])
  notified  Boolean        @default(false)
  createdAt DateTime       @default(now())

  @@unique([email, variantId])
}

// ─────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────

enum Role {
  CUSTOMER
  ADMIN
  SUPER_ADMIN
}

enum ProductCategory {
  BRIDAL
  EVENING_WEAR
  CASUAL
  FORMAL
  KIDDIES
  ACCESSORIES
}

enum ProductType {
  RTW
  BESPOKE
}

enum OrderStatus {
  PENDING
  CONFIRMED
  PROCESSING
  SHIPPED
  DELIVERED
  CANCELLED
  REFUNDED
}

enum PaymentStatus {
  PENDING
  PAID
  FAILED
  REFUNDED
  PARTIALLY_REFUNDED
}

enum PaymentGateway {
  PAYSTACK
  FLUTTERWAVE
  STRIPE
  MONNIFY
}

enum BespokeStatus {
  PENDING
  REVIEWED
  CONFIRMED
  IN_PROGRESS
  READY
  DELIVERED
  CANCELLED
}

enum PointsType {
  EARNED_PURCHASE     // 1pt per ₦100 spent
  EARNED_REFERRAL     // Referrer gets 250pts when friend signs up
  EARNED_SIGNUP       // New user via referral gets 500pts
  EARNED_REVIEW       // 50pts for leaving a verified review
  EARNED_BIRTHDAY     // Annual birthday bonus
  REDEEMED
  ADJUSTED_ADMIN      // Manual adjustment by admin
  EXPIRED
}

enum CouponType {
  PERCENTAGE          // e.g. 20% off
  FIXED_AMOUNT        // e.g. ₦5,000 off (stored in NGN, converted at checkout)
  FREE_SHIPPING       // Waive shipping fee
}

enum Currency {
  NGN
  USD
  GBP
}
```

---

## 4. FOLDER STRUCTURE

```
prudential-atelier/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
│
├── src/
│   ├── app/
│   │   ├── (storefront)/              ← Public-facing layout group
│   │   │   ├── layout.tsx             ← Navbar + Footer + Lenis
│   │   │   ├── page.tsx               ← Homepage
│   │   │   ├── shop/
│   │   │   │   ├── page.tsx           ← Shop listing
│   │   │   │   └── [slug]/
│   │   │   │       └── page.tsx       ← Product detail
│   │   │   ├── bespoke/page.tsx
│   │   │   ├── our-story/page.tsx
│   │   │   ├── press/page.tsx
│   │   │   ├── contact/page.tsx
│   │   │   └── legal/
│   │   │       ├── privacy/page.tsx
│   │   │       ├── terms/page.tsx
│   │   │       └── returns/page.tsx
│   │   │
│   │   ├── (auth)/                    ← Auth layout group (no navbar/footer)
│   │   │   ├── layout.tsx
│   │   │   └── auth/
│   │   │       ├── login/page.tsx
│   │   │       ├── register/page.tsx
│   │   │       ├── forgot-password/page.tsx
│   │   │       └── reset-password/[token]/page.tsx
│   │   │
│   │   ├── (account)/                 ← Authenticated user area
│   │   │   ├── layout.tsx
│   │   │   └── account/
│   │   │       ├── page.tsx           ← Dashboard overview
│   │   │       ├── orders/
│   │   │       │   ├── page.tsx
│   │   │       │   └── [id]/page.tsx
│   │   │       ├── wishlist/page.tsx
│   │   │       ├── wallet/page.tsx
│   │   │       ├── referral/page.tsx
│   │   │       ├── addresses/page.tsx
│   │   │       └── profile/page.tsx
│   │   │
│   │   ├── (admin)/                   ← Admin area (role-gated)
│   │   │   ├── layout.tsx
│   │   │   └── admin/
│   │   │       ├── page.tsx           ← Analytics dashboard
│   │   │       ├── products/
│   │   │       │   ├── page.tsx
│   │   │       │   ├── new/page.tsx
│   │   │       │   └── [id]/
│   │   │       │       └── edit/page.tsx
│   │   │       ├── orders/
│   │   │       │   ├── page.tsx
│   │   │       │   └── [id]/page.tsx
│   │   │       ├── bespoke/
│   │   │       │   ├── page.tsx
│   │   │       │   └── [id]/page.tsx
│   │   │       ├── coupons/
│   │   │       │   ├── page.tsx
│   │   │       │   └── new/page.tsx
│   │   │       ├── shipping/page.tsx
│   │   │       ├── customers/
│   │   │       │   ├── page.tsx
│   │   │       │   └── [id]/page.tsx
│   │   │       ├── reviews/page.tsx
│   │   │       ├── referrals/page.tsx
│   │   │       └── settings/page.tsx
│   │   │
│   │   ├── checkout/
│   │   │   ├── page.tsx
│   │   │   └── success/page.tsx
│   │   │
│   │   ├── ref/[code]/page.tsx        ← Referral landing
│   │   │
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/route.ts
│   │   │   ├── auth/
│   │   │   │   ├── register/route.ts
│   │   │   │   ├── forgot-password/route.ts
│   │   │   │   └── reset-password/route.ts
│   │   │   ├── products/
│   │   │   │   ├── route.ts
│   │   │   │   └── [slug]/route.ts
│   │   │   ├── cart/
│   │   │   │   ├── route.ts           ← GET/POST cart items
│   │   │   │   └── [itemId]/route.ts  ← PATCH/DELETE
│   │   │   ├── wishlist/route.ts
│   │   │   ├── account/
│   │   │   │   ├── profile/route.ts
│   │   │   │   ├── orders/route.ts
│   │   │   │   ├── orders/[id]/route.ts
│   │   │   │   ├── addresses/route.ts
│   │   │   │   ├── addresses/[id]/route.ts
│   │   │   │   └── wallet/route.ts
│   │   │   ├── coupons/
│   │   │   │   └── validate/route.ts  ← POST: validate + preview discount
│   │   │   ├── shipping/
│   │   │   │   └── calculate/route.ts ← POST: return shipping options for address
│   │   │   ├── payment/
│   │   │   │   ├── paystack/
│   │   │   │   │   ├── initiate/route.ts
│   │   │   │   │   ├── verify/route.ts
│   │   │   │   │   └── webhook/route.ts
│   │   │   │   ├── flutterwave/
│   │   │   │   │   ├── initiate/route.ts
│   │   │   │   │   ├── verify/route.ts
│   │   │   │   │   └── webhook/route.ts
│   │   │   │   ├── stripe/
│   │   │   │   │   ├── initiate/route.ts
│   │   │   │   │   └── webhook/route.ts
│   │   │   │   └── monnify/
│   │   │   │       ├── initiate/route.ts
│   │   │   │       ├── verify/route.ts
│   │   │   │       └── webhook/route.ts
│   │   │   ├── bespoke/route.ts
│   │   │   ├── reviews/route.ts
│   │   │   ├── stock-alert/route.ts
│   │   │   ├── admin/
│   │   │   │   ├── products/route.ts
│   │   │   │   ├── products/[id]/route.ts
│   │   │   │   ├── orders/route.ts
│   │   │   │   ├── orders/[id]/route.ts
│   │   │   │   ├── coupons/route.ts
│   │   │   │   ├── coupons/[id]/route.ts
│   │   │   │   ├── shipping/route.ts
│   │   │   │   ├── customers/route.ts
│   │   │   │   ├── reviews/route.ts
│   │   │   │   ├── reviews/[id]/route.ts
│   │   │   │   ├── analytics/route.ts
│   │   │   │   └── upload/route.ts
│   │   │   ├── currency/rates/route.ts ← Cached exchange rates
│   │   │   └── email/route.ts
│   │   │
│   │   ├── layout.tsx                 ← Root layout (fonts, providers, metadata)
│   │   ├── not-found.tsx
│   │   ├── sitemap.ts
│   │   └── robots.ts
│   │
│   ├── components/
│   │   ├── ui/                        ← Primitive components
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Textarea.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Checkbox.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Drawer.tsx
│   │   │   ├── Toast.tsx
│   │   │   ├── Tooltip.tsx
│   │   │   ├── Tabs.tsx
│   │   │   ├── Accordion.tsx
│   │   │   ├── Skeleton.tsx
│   │   │   ├── Spinner.tsx
│   │   │   ├── Divider.tsx
│   │   │   ├── SectionLabel.tsx
│   │   │   ├── StarRating.tsx
│   │   │   └── CountdownTimer.tsx
│   │   │
│   │   ├── layout/
│   │   │   ├── Navbar.tsx
│   │   │   ├── MobileMenu.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── CartDrawer.tsx
│   │   │   ├── SearchModal.tsx
│   │   │   └── AnnouncementBar.tsx
│   │   │
│   │   ├── common/
│   │   │   ├── ProductCard.tsx
│   │   │   ├── ProductCardSkeleton.tsx
│   │   │   ├── QuickViewModal.tsx
│   │   │   ├── WishlistButton.tsx
│   │   │   ├── CurrencySwitcher.tsx
│   │   │   ├── PFABanner.tsx
│   │   │   ├── RecentlyViewed.tsx
│   │   │   └── StockAlertForm.tsx
│   │   │
│   │   ├── home/
│   │   │   ├── Hero.tsx
│   │   │   ├── BrandMarquee.tsx
│   │   │   ├── CollectionsGrid.tsx
│   │   │   ├── NewArrivals.tsx
│   │   │   ├── BespokeStory.tsx
│   │   │   ├── BrandStats.tsx
│   │   │   ├── Testimonials.tsx
│   │   │   ├── InstagramGrid.tsx
│   │   │   └── NewsletterSection.tsx
│   │   │
│   │   ├── shop/
│   │   │   ├── FilterPanel.tsx
│   │   │   ├── FilterDrawer.tsx       ← Mobile filter
│   │   │   ├── ProductGrid.tsx
│   │   │   ├── SortSelect.tsx
│   │   │   ├── ActiveFilters.tsx
│   │   │   ├── Pagination.tsx
│   │   │   └── SizeGuideModal.tsx
│   │   │
│   │   ├── product/
│   │   │   ├── ProductGallery.tsx
│   │   │   ├── VariantSelector.tsx    ← Size picker (updates price)
│   │   │   ├── ColorSelector.tsx
│   │   │   ├── QuantityControl.tsx
│   │   │   ├── PriceDisplay.tsx       ← Handles sale price + currency
│   │   │   ├── ReviewsSection.tsx
│   │   │   ├── ReviewForm.tsx
│   │   │   ├── RelatedProducts.tsx
│   │   │   └── CompleteTheLook.tsx
│   │   │
│   │   ├── checkout/
│   │   │   ├── CheckoutStepper.tsx
│   │   │   ├── CartReview.tsx
│   │   │   ├── CouponInput.tsx
│   │   │   ├── PointsRedemption.tsx
│   │   │   ├── DeliveryForm.tsx
│   │   │   ├── AddressSelector.tsx
│   │   │   ├── ShippingOptions.tsx
│   │   │   ├── GiftOptions.tsx
│   │   │   ├── PaymentSelector.tsx
│   │   │   ├── OrderSummary.tsx
│   │   │   └── GuestPrompt.tsx        ← Post-checkout account creation nudge
│   │   │
│   │   ├── account/
│   │   │   ├── AccountSidebar.tsx
│   │   │   ├── OrdersTable.tsx
│   │   │   ├── OrderTimeline.tsx
│   │   │   ├── WalletCard.tsx
│   │   │   ├── PointsHistory.tsx
│   │   │   ├── ReferralCard.tsx
│   │   │   ├── ReferralStats.tsx
│   │   │   └── AddressForm.tsx
│   │   │
│   │   ├── admin/
│   │   │   ├── AdminSidebar.tsx
│   │   │   ├── AdminTopbar.tsx
│   │   │   ├── AnalyticsCards.tsx
│   │   │   ├── RevenueChart.tsx
│   │   │   ├── ProductForm.tsx
│   │   │   ├── VariantManager.tsx     ← Add/edit size variants + prices
│   │   │   ├── ImageUploader.tsx
│   │   │   ├── OrdersDataTable.tsx
│   │   │   ├── OrderDetail.tsx
│   │   │   ├── CouponForm.tsx
│   │   │   ├── ShippingZoneForm.tsx
│   │   │   ├── ReviewModerator.tsx
│   │   │   ├── BespokeTable.tsx
│   │   │   ├── BespokeDetail.tsx
│   │   │   └── CustomerDetail.tsx
│   │   │
│   │   └── bespoke/
│   │       ├── BespokeForm.tsx
│   │       ├── BespokeSteps.tsx
│   │       └── BespokeGallery.tsx
│   │
│   ├── emails/
│   │   ├── WelcomeEmail.tsx
│   │   ├── OrderConfirmationEmail.tsx
│   │   ├── OrderShippedEmail.tsx
│   │   ├── OrderDeliveredEmail.tsx
│   │   ├── BespokeConfirmationEmail.tsx
│   │   ├── PasswordResetEmail.tsx
│   │   ├── ReferralSuccessEmail.tsx
│   │   ├── BackInStockEmail.tsx
│   │   ├── AbandonedCartEmail.tsx
│   │   └── AdminNotificationEmail.tsx
│   │
│   ├── lib/
│   │   ├── prisma.ts                  ← Prisma client singleton
│   │   ├── auth.ts                    ← NextAuth v5 config
│   │   ├── cloudinary.ts
│   │   ├── currency.ts                ← Exchange rates + conversion + formatting
│   │   ├── points.ts                  ← Points earn/redeem logic
│   │   ├── referral.ts                ← Referral tracking
│   │   ├── coupon.ts                  ← Coupon validation logic
│   │   ├── shipping.ts                ← Shipping calculation logic
│   │   ├── order-number.ts            ← "PA-2024-00042" generator
│   │   ├── payments/
│   │   │   ├── paystack.ts
│   │   │   ├── flutterwave.ts
│   │   │   ├── stripe.ts
│   │   │   └── monnify.ts
│   │   ├── email.ts                   ← Resend send helpers
│   │   └── utils.ts                   ← cn(), slugify(), truncate(), etc.
│   │
│   ├── hooks/
│   │   ├── useCart.ts
│   │   ├── useWishlist.ts
│   │   ├── useCurrency.ts
│   │   ├── useRecentlyViewed.ts
│   │   ├── useCountUp.ts
│   │   ├── useInView.ts
│   │   └── useMediaQuery.ts
│   │
│   ├── store/
│   │   ├── cartStore.ts               ← Zustand: cart items, open/close drawer
│   │   ├── wishlistStore.ts           ← Zustand: wishlist IDs
│   │   ├── currencyStore.ts           ← Zustand: selected currency + rates
│   │   └── recentlyViewedStore.ts     ← Zustand: last 8 viewed product IDs
│   │
│   ├── providers/
│   │   ├── RootProvider.tsx           ← Wraps all providers
│   │   ├── LenisProvider.tsx
│   │   ├── AuthProvider.tsx           ← SessionProvider wrapper
│   │   └── CartSyncProvider.tsx       ← Syncs Zustand cart ↔ server cart on login
│   │
│   ├── types/
│   │   └── index.ts                   ← All shared TypeScript interfaces + Prisma extensions
│   │
│   ├── validations/
│   │   ├── auth.ts                    ← loginSchema, registerSchema
│   │   ├── product.ts                 ← createProductSchema, updateProductSchema
│   │   ├── order.ts                   ← checkoutSchema
│   │   ├── coupon.ts                  ← couponSchema
│   │   ├── bespoke.ts                 ← bespokeRequestSchema
│   │   ├── address.ts                 ← addressSchema
│   │   └── review.ts                  ← reviewSchema
│   │
│   ├── middleware.ts
│   ├── auth.ts                        ← Auth.js (NextAuth v5) config
│   └── styles/
│       ├── globals.css
│       └── tokens.css
│
├── public/
│   ├── images/
│   │   ├── logo.svg
│   │   ├── logo-white.svg
│   │   ├── og-image.jpg
│   │   └── favicon/
│   └── fonts/                         ← Self-host if needed
│
├── .env.local
├── .env.example
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── vercel.json
└── package.json
```

---

## STAGE 1 — PROJECT SETUP

```
TASK: Bootstrap the complete project foundation.

STEP 1.1 — Initialize Next.js project:
npx create-next-app@latest prudential-atelier \
  --typescript --tailwind --eslint --app --src-dir \
  --import-alias "@/*"

STEP 1.2 — Install ALL dependencies in one command:
npm install \
  framer-motion \
  @studio-freight/lenis \
  prisma \
  @prisma/client \
  next-auth@beta \
  @auth/prisma-adapter \
  bcryptjs \
  @types/bcryptjs \
  zustand \
  @tanstack/react-query \
  @tanstack/react-table \
  react-hook-form \
  @hookform/resolvers \
  zod \
  next-cloudinary \
  cloudinary \
  resend \
  @react-email/components \
  react-email \
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
  @radix-ui/react-checkbox \
  @radix-ui/react-tooltip \
  @radix-ui/react-popover \
  swiper \
  recharts \
  date-fns \
  slugify \
  nanoid \
  clsx \
  tailwind-merge \
  react-easy-crop \
  @tiptap/react \
  @tiptap/starter-kit \
  @tiptap/extension-placeholder \
  react-intersection-observer \
  react-countup \
  react-hot-toast

STEP 1.3 — Initialize Prisma:
npx prisma init

STEP 1.4 — Copy the full schema from Section 3 of this document into prisma/schema.prisma.

STEP 1.5 — Create .env.local with ALL the following keys (values as placeholders):
DATABASE_URL=""              # Neon PostgreSQL connection string (pooled)
DIRECT_URL=""                # Neon PostgreSQL direct URL (for migrations)
NEXTAUTH_SECRET=""           # openssl rand -base64 32
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
CLOUDINARY_CLOUD_NAME=""
CLOUDINARY_API_KEY=""
CLOUDINARY_API_SECRET=""
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=""
PAYSTACK_SECRET_KEY=""
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=""
FLUTTERWAVE_SECRET_KEY=""
NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY=""
STRIPE_SECRET_KEY=""
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=""
STRIPE_WEBHOOK_SECRET=""
MONNIFY_API_KEY=""
MONNIFY_SECRET_KEY=""
MONNIFY_CONTRACT_CODE=""
MONNIFY_BASE_URL="https://api.monnify.com"
RESEND_API_KEY=""
OPEN_EXCHANGE_RATES_APP_ID=""   # Free tier: openexchangerates.org
NEXT_PUBLIC_APP_URL="http://localhost:3000"
ADMIN_EMAIL=""               # Email for admin notifications

STEP 1.6 — Create .env.example copying all keys from .env.local (no values).

STEP 1.7 — Configure tailwind.config.ts:
- fontFamily: { display: ['Cormorant Garamond', 'Georgia', 'serif'], body: ['DM Sans', 'system-ui', 'sans-serif'], label: ['Cormorant SC', 'Georgia', 'serif'] }
- colors: Map all tokens (wine, gold, ivory, charcoal, cream, border, success, error, warning)
- extend animation: { shimmer, fadeUp, fadeIn, marquee, countup }
- extend keyframes for all custom animations
- screens: standard + '3xl': '1600px'

STEP 1.8 — Create src/styles/globals.css:
- @import Google Fonts: Cormorant Garamond (300,400,400i,500,600,700i), DM Sans (300,400,500), Cormorant SC (500)
- @import './tokens.css'
- html: scroll-behavior smooth, font-size 16px
- body: font-family var(--font-body), background var(--ivory), color var(--charcoal)
- ::selection: background var(--wine), color var(--ivory)
- ::-webkit-scrollbar: 8px, track ivory, thumb wine, thumb:hover wine-hover
- Lenis base: [data-lenis-prevent] { overscroll-behavior: contain }

STEP 1.9 — Create src/styles/tokens.css with EXACT CSS variables from Section 1.1.

STEP 1.10 — Create src/lib/prisma.ts:
import { PrismaClient } from '@prisma/client'
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ['query'] })
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

STEP 1.11 — Create src/lib/utils.ts:
export function cn(...inputs): string — clsx + tailwind-merge
export function formatPrice(amount: number, currency: Currency): string — returns "₦1,250,000", "$850.00", "£670.00"
export function slugify(text: string): string — lowercase, hyphenate
export function generateOrderNumber(): string — "PA-" + year + "-" + padded 5-digit random
export function generateSKU(productSlug: string, size: string): string — "SLUG-SIZE"
export function truncate(text: string, length: number): string

STEP 1.12 — Create next.config.ts:
const config: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
  experimental: { typedRoutes: true },
}

STEP 1.13 — Create vercel.json:
{
  "framework": "nextjs",
  "buildCommand": "prisma generate && next build",
  "installCommand": "npm install",
  "env": {
    "NEXTAUTH_URL": "@nextauth_url"
  }
}

STEP 1.14 — Create src/providers/RootProvider.tsx:
Wrap children in order: QueryClientProvider, SessionProvider, Toaster (react-hot-toast), CartSyncProvider

STEP 1.15 — Create src/providers/LenisProvider.tsx:
'use client' — initialize Lenis on mount, raf loop, return children. Expose useLenis hook.

STEP 1.16 — Create src/app/layout.tsx as root layout:
- next/font/google: cormorantGaramond (weights: 300,400,500,600, styles: normal/italic), dmSans (weights: 300,400,500)
- Apply font CSS variables to html element
- Wrap with RootProvider and LenisProvider
- Base metadata: title template, description, openGraph, twitter

CONFIRMATION: Stage 1 complete when `npm run dev` starts with no errors and Prisma is initialized.
```

---

## STAGE 2 — AUTHENTICATION SYSTEM

```
TASK: Build complete authentication with NextAuth v5, Google OAuth, credentials,
referral handling, and all auth pages.

STEP 2.1 — Create src/auth.ts (NextAuth v5 config):

import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      async authorize(credentials) {
        // Validate with Zod loginSchema
        // Find user by email
        // Compare bcrypt password
        // Return user object or null
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.referralCode = user.referralCode
        token.pointsBalance = user.pointsBalance
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.id as string
      session.user.role = token.role as string
      session.user.referralCode = token.referralCode as string
      session.user.pointsBalance = token.pointsBalance as number
      return session
    },
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },
})

STEP 2.2 — Create src/app/api/auth/[...nextauth]/route.ts:
export { GET, POST } from '@/auth'

STEP 2.3 — Create src/middleware.ts:
- Use auth() from NextAuth v5
- Protected paths: /account/*, /checkout, /admin/*
- Admin-only paths: /admin/* — check session.user.role in ['ADMIN','SUPER_ADMIN']
- Public paths: everything else
- On unauthorized: redirect to /auth/login?callbackUrl=[current path]
- On non-admin accessing /admin: redirect to /account

STEP 2.4 — Create src/app/api/auth/register/route.ts (POST):
Inputs: { firstName, lastName, email, phone, password, confirmPassword, referralCode? }
Validate with Zod registerSchema.
Steps:
  1. Check email not already registered → 409 if exists
  2. Hash password: bcrypt.hash(password, 12)
  3. If referralCode: look up referrer by referralCode field. Store referredById.
  4. Create user with Prisma $transaction:
     a. Create User record
     b. If referralCode valid:
        - Add 500 points to new user (type: EARNED_SIGNUP)
        - Add 250 points to referrer (type: EARNED_REFERRAL)
        - Create both PointsTransaction records
        - Update both users' pointsBalance
  5. Send welcome email via Resend
  6. If referrer: send ReferralSuccessEmail to referrer
  7. Return { success: true, message: "Account created" }

STEP 2.5 — Create src/app/api/auth/forgot-password/route.ts (POST):
  1. Find user by email (don't reveal if not found — return same success msg)
  2. Generate token: nanoid(32)
  3. Store in PasswordResetToken (expires: now + 1hr)
  4. Send PasswordResetEmail with link: /auth/reset-password/[token]

STEP 2.6 — Create src/app/api/auth/reset-password/route.ts (POST):
  1. Find valid unexpired token
  2. Hash new password
  3. Update user password
  4. Delete used token
  5. Delete all other reset tokens for this email

STEP 2.7 — Create src/app/(auth)/layout.tsx:
  Clean layout — no navbar/footer. Centered. Background: ivory with subtle wine grain overlay.

STEP 2.8 — Create src/app/(auth)/auth/login/page.tsx:
  Layout: 50/50 split on desktop, stacked on mobile.
  LEFT panel: 
    - Full-height editorial image (use next/image with Cloudinary placeholder or Unsplash URL)
    - Overlay with Cormorant Garamond italic quote:
      "She is clothed in strength and dignity, and she laughs without fear of the future."
    - Brand logo at top-left
  RIGHT panel:
    - "Welcome Back" (Display S, wine)
    - "Sign in to your Prudential Atelier account"
    - React Hook Form with Zod validation:
        Email field (Input.tsx)
        Password field (Input.tsx with show/hide toggle)
        "Forgot password?" link right-aligned
        [Sign In] button (primary, full-width, loading state)
    - Divider "or"
    - [Continue with Google] button (outlined, Google logo SVG)
    - "New to Prudential Atelier? Create account →" link to /auth/register
  
  On success: router.push(callbackUrl || '/account')
  On error: show toast with error message

STEP 2.9 — Create src/app/(auth)/auth/register/page.tsx:
  Same split layout.
  RIGHT panel form:
    - "Create Your Account" heading
    - First Name + Last Name (side by side)
    - Email, Phone
    - Password + Confirm Password
    - Referral Code field:
        - If URL has ?ref=CODE → pre-fill this field, show gold banner:
          "🎉 You were invited! You'll receive 500 bonus points when you join."
        - Field is editable (user can also type a code manually)
    - Checkbox: "I agree to Terms & Conditions and Privacy Policy"
    - [Create Account] button (loading state)
    - Google OAuth button
    - "Already have an account? Sign in" link

STEP 2.10 — Create src/app/(auth)/auth/forgot-password/page.tsx
STEP 2.11 — Create src/app/(auth)/auth/reset-password/[token]/page.tsx

STEP 2.12 — Create src/app/ref/[code]/page.tsx:
  On render (server component):
    - Set cookie: 'pa_ref_code' = params.code, HttpOnly, SameSite=Lax, 30-day expiry
    - Redirect to /auth/register?ref=[code]
  
  Use middleware or route handler (cookies().set()) for the cookie.

CONFIRMATION: Stage 2 complete when registration, login, Google OAuth, and forgot/reset password all work end-to-end.
```

---

## STAGE 3 — GLOBAL COMPONENTS & LAYOUT

```
TASK: Build the entire layout system and all reusable UI components.
These must be perfect — every page depends on them.

STEP 3.1 — Build ALL UI primitives in src/components/ui/:

Button.tsx:
  Props: variant ('primary'|'secondary'|'ghost'|'gold'|'danger'), size ('sm'|'md'|'lg'), 
         loading, disabled, asChild (for link wrapping)
  primary: bg-wine text-ivory hover:bg-wine-hover, shimmer pseudo on hover
  secondary: border-wine text-wine hover:bg-wine hover:text-ivory
  ghost: transparent, text-charcoal, hover:text-wine
  gold: bg-gold text-charcoal hover:bg-gold-hover
  All: transition-all duration-200, rounded-sm (2px), uppercase tracking-[0.1em] font-label text-xs
  Loading: replace children with Spinner, maintain width

Input.tsx:
  Floating label pattern (label moves up on focus/filled)
  Bottom border only (not box), wine color on focus
  Error state: red underline + error message below
  Password variant: eye icon toggle

Badge.tsx:
  Variants: wine (default), gold, success, outline-gold, outline-wine
  Sizes: sm, md
  Used for: "New Arrival", "Bespoke", "Sale", "Limited", "Verified Purchase"

SectionLabel.tsx:
  Layout: ——  LABEL TEXT  ——
  Uses font-label (Cormorant SC), 11px, gold, letter-spacing 0.2em
  Lines are thin (1px) gold, 40px wide, centered

Divider.tsx:
  Thin line with centered decorative diamond ◆ in gold
  Full width of container

CountdownTimer.tsx:
  Props: endsAt: Date
  Shows: DD:HH:MM:SS with labels
  Red when under 1hr remaining
  Used on sale product pages

StarRating.tsx:
  Props: rating (0–5), size ('sm'|'md'), interactive (boolean, for review form)
  Filled stars: gold. Empty: border. Half: half-filled.

Skeleton.tsx:
  Animated shimmer skeleton. Props: className, variant ('card'|'text'|'circle')

STEP 3.2 — Build src/components/layout/AnnouncementBar.tsx:
  Thin bar above navbar (16px height)
  Background: wine. Text: gold/ivory, font-label size-11
  Rotating messages (3s interval, CSS animation):
    "Free shipping on orders over ₦150,000 within Lagos"
    "New collection now available — Shop The Edit"
    "Book a bespoke consultation today"
  Dismissable (X button, stores dismissed state in localStorage)

STEP 3.3 — Build src/components/layout/Navbar.tsx:
  Client component with scroll detection (useScrollY).
  
  Structure (desktop):
    [AnnouncementBar above]
    Main nav row:
      LEFT: Nav links — SHOP · BESPOKE · OUR STORY · PRESS
      CENTER: Logo (SVG, links to /)
      RIGHT: Currency switcher | Search icon | Wishlist icon (count badge) | Account icon | Cart icon (count badge)
    
    PFA link styled as subtle text link: "FASHION ACADEMY ↗" in gold, opens pfacademy.ng in new tab
  
  Scroll behavior:
    scrollY === 0: transparent bg, ivory text (for hero overlap)
    scrollY > 50: bg-cream/95 backdrop-blur-sm, charcoal text, border-b border-border
    Transition: all 300ms ease
  
  Active link: gold bottom border 2px, animate in on mount
  
  Mobile (< lg breakpoint):
    LEFT: Hamburger (AnimatePresence open/close)
    CENTER: Logo
    RIGHT: Search + Cart icon
    Hamburger opens MobileMenu.tsx (full-screen)

STEP 3.4 — Build src/components/layout/MobileMenu.tsx:
  Full viewport overlay, bg-charcoal
  Logo at top, X close button
  Nav links stagger in from left (Framer Motion, 100ms delays):
    SHOP, BESPOKE, OUR STORY, PRESS, PFA ACADEMY ↗
    divider
    Account, Wishlist, Track Order
    divider
    Currency switcher (NGN | USD | GBP chips)
  Social icons at bottom: Instagram, Facebook, TikTok (gold icons)
  Framer Motion: x: -100% → 0, opacity, duration 350ms easeOut

STEP 3.5 — Build src/components/layout/CartDrawer.tsx:
  Slides from right. Framer Motion: x:100%→0.
  Header: "Your Bag (X items)" with close X
  
  Cart items list (scrollable if long):
    Each item: product image (60×80px, object-cover), name, size, color, qty +/–, price, remove (trash icon)
    Qty +/– calls PATCH /api/cart/[itemId]
    Remove calls DELETE /api/cart/[itemId] (optimistic update with TanStack Query)
  
  Empty state:
    Decorative empty hanger illustration (SVG inline)
    "Your bag is empty"
    [Start Shopping] button
  
  Footer (sticky):
    Subtotal: right-aligned
    Points banner: "You'll earn X points with this order" (gold bg, small)
    [View Bag & Checkout] → /checkout button
    Continue Shopping link
  
  Zustand: cartStore has isOpen, items[], totalItems, totalNGN, open(), close(), addItem(), updateQty(), removeItem(), clearCart()

STEP 3.6 — Build src/components/layout/SearchModal.tsx:
  Full-screen takeover (fixed, z-50)
  Background: charcoal/95 backdrop-blur
  Large centered search input (48px height, Cormorant Garamond font, bottom border, ivory)
  As user types (debounced 300ms): fetch /api/products?search=query&limit=6
  Results list below: image thumbnail, name, category, price
  Click result → close modal + navigate to /shop/[slug]
  Recent searches: stored in localStorage (last 5)
  Press Escape to close

STEP 3.7 — Build src/components/layout/Footer.tsx:
  Background: charcoal. Text: ivory. Links: ivory/70 hover:ivory.
  
  4-column grid (1 col mobile, 2 col tablet, 4 col desktop):
  
  Col 1 — Brand:
    Logo white SVG
    "Luxury Nigerian fashion for the woman who commands every room."
    Social icons row: Instagram · TikTok · Facebook · YouTube (gold on hover)
  
  Col 2 — Shop:
    New Arrivals · RTW Collection · Bespoke Couture · Bridal · Sale
  
  Col 3 — Company:
    Our Story · Press · Contact Us · PFA Academy ↗ · Careers
  
  Col 4 — Newsletter:
    "Join the Inner Circle" (Cormorant, gold)
    "Early access & atelier stories"
    Email input + [Subscribe] button (inline, gold)
    POST /api/newsletter on submit (store email in DB or send to Resend audience)
  
  Bottom bar (border-t border-charcoal-mid):
    © 2024 Prudential Atelier · All Rights Reserved
    Privacy Policy · Terms · Returns Policy
    "Made with ♡ in Lagos"
  
  Micro divider: thin gold line at very top of footer

STEP 3.8 — Build src/components/common/ProductCard.tsx:
  Props: product (with variants array), currency (from Zustand)
  
  Container: group cursor-pointer
  
  Image wrapper (aspect-[3/4], overflow-hidden):
    Primary image: always visible
    Secondary image: opacity-0 → opacity-100 on group-hover (absolute, same size)
    Both use next/image
    Top-left: Badge (New, Sale, Bespoke Available)
    Top-right: WishlistButton.tsx (heart, auth-gated)
    Bottom (slides up on group-hover): QuickView button
  
  Info section:
    Product name (font-display text-lg)
    
    PriceDisplay.tsx:
      If on sale: strikethrough original price + sale price in wine
      Show price in selected currency
      If multiple variants: show "From ₦45,000" (lowest variant price)
    
    Color swatches row (if product has colors): small circles
  
  Click anywhere (not buttons): navigate to /shop/[slug]
  Hover: translateY(-4px) + shadow-md transition 250ms

STEP 3.9 — Build src/components/common/CurrencySwitcher.tsx:
  3 buttons: ₦ NGN | $ USD | £ GBP
  Selected: wine bg, ivory text. Unselected: ghost.
  Updates currencyStore (Zustand) globally
  Currency preference persisted to localStorage
  On mount: fetch exchange rates from /api/currency/rates (cached)

STEP 3.10 — Build src/components/common/PFABanner.tsx:
  Full-width strip. Background: charcoal. Padding: 20px.
  Left: Cormorant italic gold heading "Aspire to Create"
  Center: "Learn from the master. Prudential Fashion Academy has trained over 5,000 designers."
  Right: [Explore PFA Academy →] button (gold outlined, opens pfacademy.ng in new tab)

STEP 3.11 — Build src/app/(storefront)/layout.tsx:
  Import and render: AnnouncementBar, Navbar (sticky top-0 z-40), {children}, Footer
  CartDrawer (always in DOM, toggled by Zustand)
  SearchModal (always in DOM, toggled by Zustand)
  Lenis scroll wrapper

CONFIRMATION: Stage 3 complete when you can navigate the site, open/close cart and search, switch currencies, and see the full header/footer on all pages.
```

---

## STAGE 4 — PRODUCT SYSTEM & SHOP

```
TASK: Build the complete shop experience — listing, filtering, product detail,
variant-based pricing, sale pricing, reviews, stock alerts, and related products.

STEP 4.1 — Create src/lib/currency.ts:

// Exchange rates cached in memory (refresh every hour)
let ratesCache: { rates: Record<string, number>; fetchedAt: number } | null = null

export async function getExchangeRates(): Promise<{ NGN: number; USD: number; GBP: number }> {
  const now = Date.now()
  if (ratesCache && now - ratesCache.fetchedAt < 3600000) return ratesCache.rates
  
  const res = await fetch(`https://openexchangerates.org/api/latest.json?app_id=${process.env.OPEN_EXCHANGE_RATES_APP_ID}&symbols=NGN,GBP`)
  const data = await res.json()
  // data.rates is relative to USD
  // NGN per USD, GBP per USD
  ratesCache = { rates: { NGN: data.rates.NGN, USD: 1, GBP: data.rates.GBP }, fetchedAt: now }
  return ratesCache.rates
}

export function convertPrice(amountNGN: number, toCurrency: 'NGN'|'USD'|'GBP', rates: Record<string, number>): number {
  if (toCurrency === 'NGN') return amountNGN
  const usdAmount = amountNGN / rates.NGN
  if (toCurrency === 'USD') return usdAmount
  if (toCurrency === 'GBP') return usdAmount * rates.GBP
  return amountNGN
}

export function formatPrice(amount: number, currency: 'NGN'|'USD'|'GBP'): string {
  const formatters = {
    NGN: new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }),
    USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
    GBP: new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }),
  }
  return formatters[currency].format(amount)
}

STEP 4.2 — Create src/app/api/currency/rates/route.ts:
  GET: Return current exchange rates (fetched and cached via getExchangeRates())
  Cache-Control: max-age=3600

STEP 4.3 — Create src/app/api/products/route.ts (GET):
  Query params: category, type, tag, sort, page (default 1), limit (default 24), 
                search, newArrival, featured, sale, minPrice, maxPrice (NGN)
  
  Build Prisma where clause dynamically.
  Include: images (where isPrimary true), variants (orderBy price asc), colors
  
  Sort options:
    newest: orderBy createdAt desc
    price-asc: orderBy basePriceNGN asc
    price-desc: orderBy basePriceNGN desc
    featured: orderBy isFeatured desc
  
  Return: { products, total, page, totalPages, hasNext, hasPrev }

STEP 4.4 — Create src/app/api/products/[slug]/route.ts (GET):
  Fetch product by slug.
  Include ALL relations: images (sorted), variants (sorted by price asc), colors, reviews (where isApproved, include user), bundleItems.target (with images, variants)
  Compute averageRating from reviews.
  Return full product object + averageRating + reviewCount

STEP 4.5 — Build src/app/(storefront)/shop/page.tsx:
  Server component. Accepts searchParams for all filters.
  
  HERO section (280px tall):
    Background: editorial image overlay
    Heading: "The Edit" (Display L, ivory, Cormorant italic)
    Subtext: "Discover pieces that tell your story"
    Filter chips row below: ALL · BRIDAL · EVENING WEAR · FORMAL · CASUAL · KIDDIES · ACCESSORIES
    Selected chip: wine bg. Unselected: ivory outlined.
  
  MAIN CONTENT below hero:
    Desktop: sidebar (280px fixed left) + product grid (flex-1 right)
    Mobile: no sidebar, filter button opens FilterDrawer
  
  SIDEBAR (FilterPanel.tsx):
    Title: "Refine" with "Clear All" link
    Sections (Radix Accordion):
      CATEGORY: checkbox list
      TYPE: Radio — All, Ready-to-Wear, Bespoke
      PRICE RANGE: Radix Slider (₦0 to ₦1,000,000, step ₦10,000)
                   Shows formatted min-max below slider
      SIZE: chip buttons — XS S M L XL XXL Custom
      TAGS: chips — Bridal, Evening, Modest, Classic, Office
      IN STOCK ONLY: toggle checkbox
    [Apply Filters] button at bottom (wine, full-width)
    All filter changes update URL searchParams (no page reload)
  
  PRODUCT GRID HEADER:
    "Showing X of Y pieces" (left)
    Sort select (right): Newest · Price: Low to High · Price: High to Low · Featured
  
  PRODUCT GRID:
    Responsive: 1/2/3/4 columns based on breakpoint
    Render ProductCard for each product
    Loading: ProductCardSkeleton x8
    Empty: "No pieces match your search" + [Clear Filters] button
  
  PAGINATION:
    Numbered pages, prev/next arrows
    Current page: wine bg, gold text
    Non-current: outlined

STEP 4.6 — Build src/components/product/VariantSelector.tsx:
  Props: variants: ProductVariant[], selectedVariant, onSelect, currency, rates
  
  Renders size chips:
    Available: white bg, wine border, selectable
    Selected: wine bg, ivory text
    Out of stock: strikethrough, disabled, 50% opacity
  
  On select:
    Update selectedVariant state in parent
    Price display updates immediately
    If stock ≤ lowStockAt: show "Only X left!" badge in gold
    If stock === 0: show "Out of Stock" + StockAlertForm

STEP 4.7 — Build src/components/product/PriceDisplay.tsx:
  Props: variant: ProductVariant | null, product: Product, currency, rates
  
  Logic:
    If variant selected: use variant.priceNGN (and salePriceNGN if set)
    Else: use product.basePriceNGN (show "From X" if multiple variants)
  
  On sale:
    <span strikethrough grey> original price </span>
    <span wine bold> sale price </span>
    <Badge wine> Save X% </Badge>
  
  Below price: show equivalent in other 2 currencies (smaller, grey)
    e.g. "Also: $850 · £670"
  
  If product.saleEndsAt: render CountdownTimer.tsx below price

STEP 4.8 — Build src/app/(storefront)/shop/[slug]/page.tsx:
  generateStaticParams: fetch all product slugs from DB, return array
  revalidate: 60
  
  Metadata: generateMetadata — product name, description, OG image
  
  Layout: 
    Breadcrumb: Shop / Category / Product Name
    
    TWO COLUMN LAYOUT (product.images left, info right, switch to stacked on mobile):
    
    LEFT — ProductGallery.tsx:
      Main image: full height, object-cover, aspect-[3/4]
      Thumbnail strip (vertical on desktop, horizontal on mobile):
        Clicking thumbnail swaps main image (Framer Motion crossfade, key prop change)
      Zoom on hover: CSS transform scale(1.3) on a clipped inner div
      Image counter: "1 / 5" overlay
    
    RIGHT — Product Info (sticky top-32):
      Breadcrumb
      Category badge
      Product name (Display M, Cormorant)
      
      PriceDisplay.tsx (reacts to selectedVariant)
      
      Review summary: ★★★★☆ (averageRating) · X reviews · link scrolls to reviews
      
      Divider
      
      ColorSelector.tsx:
        Swatch circles with name tooltip
        Selected: wine ring border
        Clicking color: if productImage for that color exists, update gallery
      
      VariantSelector.tsx (sizes → price updates)
      
      QuantityControl.tsx: — / [number] / + (min 1, max available stock)
      
      [Add to Bag] button — full width, wine/gold, adds to cartStore + server CartItem
      [Add to Wishlist] ghost button (heart icon, toggles)
      
      Trust badges row (small, grey):
        🔒 Secure Checkout · ✈️ Ships Worldwide · 📏 Free Size Guide
      
      Accordion (Radix):
        "Product Details" — full HTML description (Tiptap output)
        "Size & Fit" — opens SizeGuideModal
        "Delivery & Returns" — policy text
        "Bespoke Version Available?" — if isBespokeAvail: 
          "Have this made to your exact measurements. Lead time: 3–6 weeks."
          [Book Bespoke Consultation →] links to /bespoke
    
    BELOW FOLD:
      ReviewsSection.tsx:
        Rating summary bar (5★ 4★ etc. with fill bars)
        "Write a Review" button (auth-gated, only if has purchased product)
        ReviewForm.tsx (star click + title + body, POST /api/reviews)
        Approved reviews list (sorted newest first)
        Each review: stars, title, body, date, "Verified Purchase" badge if orderId
        "Helpful? 👍" vote button
      
      CompleteTheLook.tsx:
        "Complete the Look" section header
        Horizontal scroll of bundle product cards (from product.bundleItems)
        Only shows if product has bundles defined
      
      RelatedProducts.tsx:
        "You May Also Like"
        4 ProductCards with same category, exclude current

STEP 4.9 — Build src/components/common/StockAlertForm.tsx:
  Small inline form: email input (pre-filled if logged in) + [Notify Me] button
  POST /api/stock-alert with { email, productId, variantId }
  Success: "We'll email you when this is back in stock ✓"

STEP 4.10 — Build src/app/api/stock-alert/route.ts:
  POST: Upsert StockAlert record. Return success.

STEP 4.11 — Build src/components/common/QuickViewModal.tsx:
  Triggered from ProductCard hover button.
  Modal (Radix Dialog): 900px max-width
  Left: primary product image
  Right: name, price, ColorSelector, VariantSelector, qty, [Add to Bag], [View Full Details →]

STEP 4.12 — Build src/store/recentlyViewedStore.ts (Zustand):
  State: ids: string[] (max 8)
  Actions: addViewed(id), clearViewed()
  Persisted to localStorage

  In shop/[slug]/page.tsx (client component wrapper):
  On mount: call addViewed(product.id)

STEP 4.13 — Build src/components/common/RecentlyViewed.tsx:
  Reads from recentlyViewedStore
  Fetches product data: GET /api/products?ids=[id,id,id]
  Horizontal scroll row of ProductCards
  "Recently Viewed" heading

CONFIRMATION: Stage 4 complete when you can browse products, filter, select variants and see price update, add to cart, and view product details with working reviews.
```

---

## STAGE 5 — COUPON, SHIPPING & CHECKOUT SYSTEM

```
TASK: Build the complete checkout pipeline — cart, coupon validation, shipping
calculation, points redemption, multi-gateway payment, and order creation.
This is the financial core. Every function must be airtight.

STEP 5.1 — Create src/lib/coupon.ts:

interface CouponValidationResult {
  valid: boolean
  coupon?: Coupon
  discountNGN?: number
  isFreeShipping?: boolean
  error?: string
}

export async function validateCoupon(
  code: string,
  subtotalNGN: number,
  userId: string | null,
  email: string,
  categoryIds?: ProductCategory[]
): Promise<CouponValidationResult> {
  const coupon = await prisma.coupon.findUnique({
    where: { code: code.toUpperCase() },
    include: { usages: true }
  })
  
  // Checks (return error string if fails):
  // 1. Exists
  // 2. isActive
  // 3. startsAt <= now <= expiresAt (if expiresAt set)
  // 4. usedCount < maxUsesTotal (if maxUsesTotal set)
  // 5. Per-user limit: count usages where email = email, check < maxUsesPerUser
  // 6. minOrderNGN: subtotalNGN >= minOrderNGN (if set)
  // 7. Category scope: if !appliesToAll, check cart has matching categories
  
  // Calculate discount:
  let discountNGN = 0
  let isFreeShipping = false
  
  if (coupon.type === 'PERCENTAGE') {
    discountNGN = subtotalNGN * (coupon.value / 100)
  } else if (coupon.type === 'FIXED_AMOUNT') {
    discountNGN = Math.min(coupon.value, subtotalNGN) // Can't discount more than subtotal
  } else if (coupon.type === 'FREE_SHIPPING') {
    isFreeShipping = true
  }
  
  return { valid: true, coupon, discountNGN, isFreeShipping }
}

STEP 5.2 — Create src/app/api/coupons/validate/route.ts (POST):
  Input: { code, subtotalNGN, email, userId?, cartItems }
  Validate coupon using validateCoupon()
  Return: { valid, discountNGN, isFreeShipping, type, description, error? }
  Do NOT record usage here — only on successful payment.

STEP 5.3 — Create src/lib/shipping.ts:

export async function calculateShipping(
  address: { city: string; state: string; country: string },
  subtotalNGN: number,
  totalWeightKg: number
): Promise<ShippingZone[]> {
  // Fetch all active shipping zones
  // Match zone to address:
  //   - Check states array (Nigerian states)
  //   - Check countries array (international)
  //   - '*' matches all
  // For each matched zone:
  //   - If freeAboveNGN set and subtotalNGN >= freeAboveNGN: cost = 0
  //   - Else: cost = flatRateNGN + (perKgNGN * totalWeightKg)
  // Return array of applicable zones with calculated costs
}

STEP 5.4 — Create src/app/api/shipping/calculate/route.ts (POST):
  Input: { address, cartItems, couponCode? (if FREE_SHIPPING) }
  Calculate total weight (assume 0.5kg per item default if no weight field)
  Call calculateShipping()
  Return: { zones: [ { id, name, costNGN, estimatedDays } ] }

STEP 5.5 — Build src/app/checkout/page.tsx:
  Client component. Auth check: if no session → redirect to /auth/login?callbackUrl=/checkout
  
  3-step stepper: Cart Review → Delivery → Payment
  Progress bar: wine fill, 3 labeled steps, gold checkmark on complete
  
  LEFT COLUMN (flex-1): Step content
  RIGHT COLUMN (360px, sticky): OrderSummary.tsx (always visible, updates live)
  
  ── STEP 1: CART REVIEW
  
  Component: CartReview.tsx
  
  Cart items table:
    Image (64×80) | Name + size + color | Qty control | Unit price | Total | Remove
    Qty uses PATCH /api/cart/[itemId] with optimistic UI
    Remove uses DELETE /api/cart/[itemId]
  
  CouponInput.tsx:
    Text input + [Apply] button
    On apply: POST /api/coupons/validate
    Success: show green checkmark + "₦X,XXX discount applied"
    Error: show error message (red)
    Coupon saved in checkout state (Zustand or local React state lifted to page)
    [Remove] button (X) to clear coupon
  
  PointsRedemption.tsx:
    Only show if user logged in AND pointsBalance > 0
    Toggle: "Use my X points (worth ₦X,XXX)"
    When toggled on: reduce total by pointsBalance (NGN) OR total, whichever is less
    Cannot use points + coupon simultaneously? → Allow both (combine discounts)
    Show resulting new total
  
  GiftOptions.tsx:
    Checkbox: "This is a gift"
    If checked → show textarea: "Gift message (optional, max 200 chars)"
  
  [Continue to Delivery] button
  
  ── STEP 2: DELIVERY
  
  Component: DeliveryForm.tsx
  
  If logged in + has saved addresses:
    AddressSelector.tsx:
      Radio cards showing each saved address with label
      "Default" badge on default address
      [+ Use a different address] expands new address form
  
  If not logged in OR no saved addresses:
    Full address form (React Hook Form + Zod addressSchema):
      First Name, Last Name, Email, Phone
      Address Line 1, Line 2 (optional)
      City, State/Province, Postal Code (optional), Country (default: Nigeria)
      Checkbox: "Save this address" (only if logged in)
  
  ShippingOptions.tsx:
    After address entered: POST /api/shipping/calculate (debounced on address change)
    Loading: skeleton
    Show shipping options as radio cards:
      Zone name, estimated days, cost (formatted in selected currency)
      Free if applicable: show "FREE" in gold
      Selected: wine border
    
    If FREE_SHIPPING coupon applied: show all options as free
  
  Order notes textarea: "Any special instructions?"
  
  [Continue to Payment] button
  
  ── STEP 3: PAYMENT
  
  Component: PaymentSelector.tsx
  
  Order summary (mobile: collapsible, desktop: always visible right panel)
  
  Currency selector: NGN | USD | GBP chips
    Note: changing currency re-displays prices but payment is processed in NGN (Paystack/Monnify/Flutterwave)
    or in selected currency (Stripe for USD/GBP)
  
  Payment methods (radio cards — show/hide based on selected currency):
    ● PAYSTACK — Logo + "Pay with card, bank transfer" — NGN only
    ● FLUTTERWAVE — Logo + "Cards, mobile money, USSD" — NGN, USD, GBP
    ● STRIPE — Logo + "International cards" — USD, GBP only
    ● MONNIFY — Logo + "Bank transfer & USSD" — NGN only
  
  ORDER SUMMARY in right panel:
    Each item × qty × unit price
    Subtotal
    Shipping: zone name + cost (or FREE)
    Coupon discount: -₦X,XXX (green)
    Points discount: -₦X,XXX (gold)
    ─────────────────────
    TOTAL (bold, Display S)
    Equivalent: "$XXX · £XXX" (smaller grey)
  
  [Pay ₦XX,XXX Now] button (wine, large, full-width)
    On click:
      1. POST /api/orders/create — creates Order in DB with status PENDING, payment status PENDING
      2. Based on selected gateway, POST to relevant /api/payment/[gateway]/initiate
      3. Redirect to payment URL (Paystack/Flutterwave popup or Stripe Elements)
      4. On return/webhook: verify payment → update order to PAID → redirect to /checkout/success
  
  Padlock icon row: "256-bit SSL encrypted · Secured by [gateway logo]"
  
  ── GUEST POST-CHECKOUT PROMPT
  
  After successful payment, if guest:
    GuestPrompt.tsx (shown in success page):
    "Create an account to track your order and earn loyalty points on this purchase."
    [Create Account] → /auth/register?email=[guestEmail]&callbackUrl=/account/orders

STEP 5.6 — Create src/app/api/orders/create/route.ts (POST):
  Input: { cartItems, addressData, shippingZoneId, couponCode?, pointsToRedeem?, isGift?, giftMessage?, currency }
  
  Run as Prisma $transaction:
    1. Validate all cart items: check each variant still has stock
    2. Validate coupon (if provided): re-run validateCoupon()
    3. Validate points (if redeeming): check user has sufficient balance
    4. Calculate final totals server-side (never trust client totals)
    5. Create Order with all items
    6. Decrement variant stock for each item
    7. If coupon: increment coupon.usedCount, create CouponUsage
    8. If pointsToRedeem: deduct from user.pointsBalance, create PointsTransaction (REDEEMED)
    9. If address should be saved: create Address record
    10. Send order confirmation email
  
  Return: { orderId, orderNumber, paymentRequired: true }

STEP 5.7 — Create src/app/api/payment/paystack/initiate/route.ts (POST):
  Input: { orderId, email, amountNGN }
  Call Paystack API: POST https://api.paystack.co/transaction/initialize
    Headers: Authorization Bearer PAYSTACK_SECRET_KEY
    Body: { email, amount: amountNGN * 100 (kobo), reference: orderNumber, callback_url, metadata: { orderId } }
  Return: { authorizationUrl, reference }

STEP 5.8 — Create src/app/api/payment/paystack/verify/route.ts (GET):
  Input: reference (query param)
  Call: GET https://api.paystack.co/transaction/verify/:reference
  If status === 'success':
    Update Order: paymentStatus PAID, paidAt, paymentRef
    Award purchase points (1pt per ₦100) in $transaction
    Send order confirmation email
  Return: { success, orderNumber, redirectUrl: '/checkout/success?order=' + orderNumber }

STEP 5.9 — Create src/app/api/payment/paystack/webhook/route.ts (POST):
  Verify webhook signature: crypto.createHmac('sha512', PAYSTACK_SECRET).update(rawBody).digest('hex')
  Compare to x-paystack-signature header
  If mismatch: return 401
  Handle events:
    charge.success → same logic as verify route
    charge.failed → update paymentStatus FAILED
  Return 200 always (to acknowledge)

STEP 5.10 — Create equivalent initiate/verify/webhook for Flutterwave, Stripe, Monnify.
  Follow same pattern. Each gateway has unique signature verification.
  
  Stripe specifics:
    Use Stripe Elements on frontend for card input (client-side)
    Create PaymentIntent server-side: amount in USD or GBP cents
    Webhook: use stripe.webhooks.constructEvent() for signature
    Handle: payment_intent.succeeded, payment_intent.payment_failed
  
  Flutterwave specifics:
    Redirect flow similar to Paystack
    Verify via GET https://api.flutterwave.com/v3/transactions/:id/verify
  
  Monnify specifics:
    Initialize transaction, get checkout URL
    Verify via GET https://api.monnify.com/api/v2/merchant/transactions/query?paymentReference=:ref

STEP 5.11 — Create src/lib/points.ts:

export async function awardPurchasePoints(userId: string, orderTotalNGN: number, orderId: string) {
  const pointsToAward = Math.floor(orderTotalNGN / 100) // 1pt per ₦100
  if (pointsToAward === 0) return
  
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { pointsBalance: { increment: pointsToAward } } }),
    prisma.pointsTransaction.create({ data: {
      userId, type: 'EARNED_PURCHASE', amount: pointsToAward, 
      description: `Points from order`, orderId,
      balance: 0 // Will compute running balance in a real impl
    }})
  ])
}

STEP 5.12 — Build src/app/checkout/success/page.tsx:
  Animated SVG checkmark (Framer Motion path draw)
  "Order Confirmed!" (Display M, wine)
  Order number (large, Cormorant)
  "A confirmation email has been sent to [email]"
  
  Order summary card: items list + total
  
  Two buttons: [Track My Order] → /account/orders/[id] · [Continue Shopping] → /shop
  
  GuestPrompt if no session (described in Step 5.5)
  
  Confetti on mount (use canvas-confetti in wine + gold colors)

CONFIRMATION: Stage 5 complete when full checkout flow works end-to-end: cart → coupon → shipping → payment initiation → order created in DB → success page.
```

---

## STAGE 6 — USER ACCOUNT DASHBOARD

```
TASK: Build the complete authenticated user area — all dashboard pages, wallet, referral, addresses.

STEP 6.1 — Build src/app/(account)/layout.tsx:
  Client component. useSession() — redirect if no session.
  
  Sidebar (desktop, 260px fixed):
    Top: User avatar (Cloudinary image or initials circle, wine bg), name, email
    
    Navigation items (with Lucide icons):
      Overview          (LayoutDashboard)
      My Orders         (Package)
      Wishlist          (Heart)
      Wallet & Points   (Wallet)
      Referral Program  (Users)
      Addresses         (MapPin)
      Profile           (User)
      ──────
      Back to Shop      (ArrowLeft)
    
    Active item: wine bg, ivory text, gold left border
    
  Mobile: No sidebar. Show a sticky tab bar at bottom (5 tabs: Overview, Orders, Wallet, Referral, Profile) + hamburger for full menu.
  
  Content area: flex-1, overflow-y-auto, padding 40px

STEP 6.2 — Build src/app/(account)/account/page.tsx (Overview):
  "Good morning/afternoon, [firstName]" with time-based greeting
  Gold crown emoji ♛ decorative
  
  Stats grid (4 cards):
    Total Orders (count from DB)
    Points Balance (user.pointsBalance formatted as "X pts = ₦X,XXX")
    Wishlist Items (count)
    Referrals (count of referred users)
  
  Recent Orders: last 3 orders with mini order card
    Order number, date, status badge, total, [View] link
  
  Points banner:
    Wine gradient card
    "You have [X] loyalty points"
    "= ₦X,XXX store credit"
    [Use Points at Checkout] button → /shop

STEP 6.3 — Build Orders pages:
  src/app/(account)/account/orders/page.tsx:
    Fetch: GET /api/account/orders
    Table (sortable by date/status):
      # | Date | Items preview (stacked images) | Total | Status badge | Actions
    Status badges: color-coded (pending=grey, confirmed=blue, processing=gold, shipped=purple, delivered=green, cancelled=red)
    Click row or View button → order detail
    Empty: "No orders yet" + [Start Shopping]
  
  src/app/(account)/account/orders/[id]/page.tsx:
    OrderTimeline.tsx: horizontal stepper showing: Placed → Confirmed → Processing → Shipped → Delivered
    Current step: filled wine. Future: outline. Past: gold checkmark.
    
    Order items: image, name, size, color, qty, price each, subtotal
    
    Address card, Payment method, Order notes
    
    Pricing breakdown: subtotal, shipping, coupon discount, points discount, total
    
    "Need help with this order?" → mailto link or contact form

STEP 6.4 — Build src/app/(account)/account/wishlist/page.tsx:
  Fetch: GET /api/wishlist (user's wishlist products with variants)
  Grid of ProductCards (same as shop, all actions work)
  Each card: extra button "Move to Bag" (adds to cart + removes from wishlist)
  Empty: heart illustration + "Nothing saved yet"

STEP 6.5 — Build src/app/(account)/account/wallet/page.tsx:
  
  Wallet Balance Card (full-width, wine gradient, rounded):
    "Your Loyalty Wallet"
    Points balance: "2,450 pts" in Display M (gold)
    NGN value: "= ₦2,450 store credit"
    USD/GBP equivalent (smaller)
    [Shop Now] button (ivory outlined)
  
  How Points Work accordion:
    Purchase: Earn 1 point per ₦100 spent
    Referral signup: You earn 250 pts
    Being referred: You receive 500 pts
    Review: Earn 50 pts for verified review
    Redeem: 1 pt = ₦1 off your next order
  
  Points History table (paginated, 10/page):
    Date | Description | Amount (+ or -) | Type badge | Running balance
    Earned rows: gold. Redeemed rows: wine. Adjusted: grey.

STEP 6.6 — Build src/app/(account)/account/referral/page.tsx:
  
  REFERRAL STATS ROW:
    Total Referrals · Points From Referrals · Active Referred Users
  
  HOW IT WORKS (3-step card row):
    01: Share your unique link
    02: Friend signs up → They get 500pts, you get 250pts
    03: Friend shops → You earn 10% of their first order in pts
  
  YOUR REFERRAL LINK card:
    Big URL display: prudentialatelier.com/ref/[code]
    [📋 Copy Link] button (copies to clipboard, shows "Copied!" toast)
    [💬 Share on WhatsApp] — opens wa.me with pre-written message:
      "I just found the most amazing Nigerian fashion brand — Prudential Atelier! Use my link to get ₦500 store credit when you sign up: [link]"
    [📱 Share on Instagram] — opens instagram.com/direct (or copies message)
  
  REFERRALS TABLE:
    Name (first name + last initial only for privacy) | Joined date | Status | Pts earned
    Status: Signed Up (blue) | Made Purchase (gold) | Inactive (grey)

STEP 6.7 — Build src/app/(account)/account/addresses/page.tsx:
  Grid of address cards (3 per row desktop, 1 mobile):
    Each card: label badge, name, full address
    Default badge (wine, "Default")
    [Edit] [Delete] [Set as Default] actions
    [+ Add New Address] card (dashed border, centered + icon)
  
  AddressForm.tsx in Modal (create + edit reuse same form)

STEP 6.8 — Build src/app/(account)/account/profile/page.tsx:
  Two sections:
  
  1. Personal Info form:
     Avatar upload: click circle → Cloudinary widget → preview
     First Name, Last Name, Email (readonly), Phone
     [Save Changes] button
  
  2. Password section (separate form):
     Current Password, New Password, Confirm New Password
     Password strength indicator
     [Update Password] button

STEP 6.9 — Build all required API routes in src/app/api/account/:
  GET/PATCH profile/route.ts
  GET orders/route.ts + GET orders/[id]/route.ts
  GET/POST/DELETE wishlist/route.ts
  GET/POST addresses/route.ts + PATCH/DELETE addresses/[id]/route.ts
  GET wallet/route.ts — points balance + history

CONFIRMATION: Stage 6 complete when user can: view dashboard, track orders, manage wishlist, see points history, access referral link, manage addresses, and update profile.
```

---

## STAGE 7 — ADMIN DASHBOARD

```
TASK: Build the complete admin interface. Dark, data-dense, professional.
All routes protected by role check middleware AND server-side in each route handler.

STEP 7.1 — Build src/app/(admin)/layout.tsx:
  Background: #0F0F0F (near-black). Sidebar: #1A1A1A. Content: #0F0F0F.
  Font: DM Sans throughout admin.
  Gold accents for active states and highlights.
  
  Sidebar (fixed, 240px):
    Logo (white) at top
    Navigation sections:
      OVERVIEW: Dashboard
      CATALOGUE: Products, Bespoke Requests, Reviews
      COMMERCE: Orders, Coupons, Shipping Zones
      CUSTOMERS: All Customers, Referral Analytics
      SYSTEM: Settings, Upload Test
    
    Bottom: Admin name + role badge, Logout button
    Active item: gold left border + gold text
  
  Topbar (header): Page title, breadcrumb, notification bell (future), admin avatar
  Content: padding 32px, overflow-y-auto

STEP 7.2 — Build src/app/(admin)/admin/page.tsx (Analytics Dashboard):
  Date range picker: Today / This Week / This Month / This Year / Custom
  
  KPI CARDS ROW (4):
    Total Revenue (NGN) — with % change vs previous period (green/red arrow)
    Total Orders — with change
    New Customers — with change
    Conversion Rate — (orders / sessions, if analytics integrated)
  
  CHARTS ROW:
    Revenue Line Chart (Recharts): daily revenue for selected period, wine color
    Orders Bar Chart: orders per day, gold color
  
  TABLES ROW:
    Recent Orders: last 10, status badges, view link
    Top Products: by revenue, with image thumbnails
  
  ALERTS PANEL:
    Out of stock variants (links to edit)
    Pending bespoke requests (count)
    Reviews awaiting approval (count)
    Coupons expiring in 7 days

STEP 7.3 — Build src/app/(admin)/admin/products/page.tsx:
  Search bar (searches name, SKU, slug)
  Filters: category, type, status (published/draft), stock (in/out)
  
  TanStack Table:
    Columns: [ ] checkbox | Image (32px) | Name + slug | Category | Type | Price from | Stock status | Featured | Published | Actions
    
    Bulk actions (when rows selected): Delete, Toggle Published, Toggle Featured
    
    Row actions: Edit (pencil), Quick toggle Published (eye), Delete (trash with confirm dialog)
    
    Pagination: 20 per page

STEP 7.4 — Build src/app/(admin)/admin/products/new/page.tsx AND products/[id]/edit/page.tsx:
  (Reuse same ProductForm.tsx component with mode prop: 'create' | 'edit')
  
  ProductForm.tsx sections:
  
  BASIC INFO:
    Product Name (auto-generates slug, editable)
    Slug (editable text, shows live URL preview)
    Category (Select), Type (RTW/Bespoke radio), Tags (chip input, add/remove)
    Status toggles: Published, Featured, New Arrival, Bespoke Available
  
  MEDIA — ImageUploader.tsx:
    Cloudinary upload widget (react-dropzone area)
    Multiple images (max 10)
    Drag to reorder (sets sortOrder)
    Set primary (star icon)
    Delete with confirm
    Image preview grid (3 per row)
  
  DESCRIPTION:
    Tiptap rich text editor (bold, italic, lists, headings — styled simply)
    Product Details (Tiptap — for materials, care instructions)
  
  BASE PRICING:
    Base Price NGN (required — used as fallback if no variant override)
    Base Price USD (optional override — else auto-calculated from exchange rate)
    Base Price GBP (optional override)
    Sale checkbox: if checked → show "Sale ends" date picker (saleEndsAt)
  
  VARIANTS — VariantManager.tsx:
    This is the most important section — read carefully.
    
    Table of variants (one row per size):
      Size label (text input) | SKU (auto-generated, editable) | Price NGN | Price USD | Price GBP | Sale Price NGN | Stock | Low Stock At | Delete
    
    [+ Add Size Variant] button appends a new empty row
    All fields inline-editable
    Validation: every variant must have size label, priceNGN, and non-negative stock
    
    Quick-fill helper: "Apply same price to all variants" button sets basePriceNGN to all variant priceNGN fields
  
  COLORS:
    Color entries: Name input + hex color picker + optional image URL + delete
    [+ Add Color] button
  
  BUNDLES (Complete the Look):
    Product search input → add products to bundle list
    Max 4 bundle items
  
  SEO:
    Meta Title, Meta Description (with character counters: 60/160)
  
  ACTIONS:
    [Save as Draft] (sets isPublished: false)
    [Publish] (sets isPublished: true)
    [Delete Product] (danger, confirm dialog)

STEP 7.5 — Build Orders management:
  src/app/(admin)/admin/orders/page.tsx:
    TanStack Table, columns: Order# | Customer | Date | Items | Total | Payment | Status | Actions
    Filters: status, payment status, date range, search by order# or email
    CSV export button (builds CSV from filtered data, triggers download)
  
  src/app/(admin)/admin/orders/[id]/page.tsx:
    Full order detail + status management
    OrderTimeline.tsx (same as customer view)
    Status update dropdown → confirm → updates DB → sends email if shipped (tracking # input)
    Admin notes textarea (internal only)
    Refund button (partial/full — opens modal)

STEP 7.6 — Build Bespoke management:
  src/app/(admin)/admin/bespoke/page.tsx:
    BespokeTable.tsx: Request# | Name | Occasion | Budget | Timeline | Status | Date
    Click row → BespokeDetail.tsx (modal or separate page)
  
  BespokeDetail.tsx:
    All request fields displayed
    Reference images gallery
    Measurements display
    Status update: [Reviewed] [Confirmed] [In Progress] [Ready] [Delivered]
    Estimated price field (admin sets this)
    Admin notes field
    [Send Update Email] → triggers email to client with status + notes

STEP 7.7 — Build Coupons management:
  src/app/(admin)/admin/coupons/page.tsx:
    Table: Code | Type | Value | Uses | Expiry | Active | Actions
    [Toggle Active] quick action
    [+ Create Coupon] → new/page.tsx
  
  CouponForm.tsx:
    Code (uppercase, unique check on blur)
    Description
    Type: Percentage / Fixed Amount / Free Shipping (radio, changes label below)
    Value: "20" (% shown) or "5000" (₦ shown) or N/A for free shipping
    Minimum Order (NGN, optional)
    Max Total Uses (optional, 0 = unlimited)
    Max Per User (default 1)
    Applies To: All Products / Specific Categories / Specific Products
    Start Date, Expiry Date (optional)
    [Create Coupon] button

STEP 7.8 — Build Shipping Zones management:
  src/app/(admin)/admin/shipping/page.tsx:
    List of zones with ShippingZoneForm.tsx (create/edit in modal):
    Name, Countries (multi-select with country list), States (if NG), 
    Flat Rate NGN, Per Kg NGN, Free Above NGN (optional), Estimated Days

STEP 7.9 — Build Reviews moderation:
  src/app/(admin)/admin/reviews/page.tsx:
    Default filter: isApproved = false (awaiting moderation)
    Table: Product | Customer | Rating | Title | Body preview | Date | Actions
    [Approve] button (green) → sets isApproved: true
    [Reject/Delete] button (red) → deletes review
    Filter toggle: show approved vs pending

STEP 7.10 — Build Customers view:
  src/app/(admin)/admin/customers/page.tsx:
    Table: Name | Email | Orders | Total Spend (NGN) | Points Balance | Referrals | Joined | Actions
  
  src/app/(admin)/admin/customers/[id]/page.tsx:
    Customer header: avatar, name, email, phone, role badge
    Stats: orders, total spend, points, referrals
    Orders history table
    Points history table
    Referral tree (who they referred, who referred them)
    [Adjust Points] action: admin can add/subtract points with description

STEP 7.11 — Build all admin API routes in src/app/api/admin/:
  Every route: verify session server-side, check role = ADMIN or SUPER_ADMIN, return 403 if not.
  
  products/route.ts: GET (with all filters), POST (create)
  products/[id]/route.ts: GET, PATCH, DELETE
  orders/route.ts: GET, with full filter support + CSV export
  orders/[id]/route.ts: GET, PATCH (status, admin notes, tracking)
  bespoke/route.ts: GET, PATCH
  bespoke/[id]/route.ts: GET, PATCH
  coupons/route.ts: GET, POST
  coupons/[id]/route.ts: GET, PATCH, DELETE
  shipping/route.ts: GET, POST, PATCH, DELETE
  reviews/route.ts: GET (pending), PATCH (approve), DELETE
  customers/route.ts: GET
  customers/[id]/route.ts: GET, PATCH (adjust points, role)
  analytics/route.ts: GET with date range params
  upload/route.ts: POST (returns Cloudinary signed upload params)

CONFIRMATION: Stage 7 complete when admin can create a product with variants, publish it, see it in the shop, receive an order, update its status, and manage coupons.
```

---

## STAGE 8 — HOMEPAGE & REMAINING PAGES

```
TASK: Build the homepage as the flagship marketing experience.
Then build all remaining public pages.

STEP 8.1 — Build src/app/(storefront)/page.tsx (HOMEPAGE):
  Server component — fetch: featured products (4), new arrivals (4), testimonials.
  Pass to client components.
  
  ── Hero.tsx
  Full-viewport (100svh).
  Background: Video loop OR high-quality editorial image (Wine/dark-toned fashion)
  Use next/image with fill and priority.
  Gradient overlay: linear-gradient(to top, rgba(26,26,26,0.85) 0%, transparent 60%)
  
  Content (centered, bottom-40% from top):
    SectionLabel: "The New Collection" (gold)
    Headline (Display XL, ivory, Cormorant italic):
      "Dressed in Stories,<br/>Draped in Legacy."
    Subheading (Body L, ivory/80):
      "Bespoke couture and ready-to-wear for the woman who commands every room."
    Button row:
      [Shop The Collection] (primary wine button)
      [Book Bespoke] (ghost ivory button)
    
  Scroll indicator: thin 40px animated line (CSS pulsing down-arrow) bottom-center
  
  Framer Motion: content stagger on mount (SectionLabel → Headline → Sub → Buttons, 150ms delays)

  ── BrandMarquee.tsx
  Height: 48px. Background: wine. Border: 1px gold top + bottom.
  CSS infinite scroll marquee (duplicate text 2×):
    "PRUDENTIAL ATELIER · BESPOKE COUTURE · LAGOS, NIGERIA · EST. 2019 · OVER 5,000 LIVES TRANSFORMED · "
  Text: font-label, 11px, gold, letter-spacing 0.2em

  ── CollectionsGrid.tsx
  SectionLabel: "THE COLLECTIONS"
  Heading: "Crafted for Every Chapter" (Display M, charcoal)
  
  Asymmetric editorial grid (CSS Grid):
    3 columns, 2 rows on desktop:
    Cell 1 (col 1, rows 1-2): tall image — "Bridal"
    Cell 2 (col 2, row 1): square image — "Evening Wear"
    Cell 3 (col 3, row 1): square image — "Formal"
    Cell 4 (col 2-3, row 2): wide image — "Ready-to-Wear"
  
  Each cell: relative overflow-hidden, aspect maintained
    Background image (object-cover)
    On hover: scale(1.05) on image (transition 600ms ease)
    Overlay: gradient from black/0 to black/60 bottom, always visible with category name
    On hover: overlay opacity increases, "Explore →" button slides up from bottom

  ── NewArrivals.tsx
  SectionLabel: "JUST IN"
  Header row: "New Arrivals" (Heading L) + [View All] link (right, gold)
  
  4-column ProductCard grid (responsive)
  Framer Motion stagger on useInView entry
  
  ── BespokeStory.tsx
  Background: ivory-dark (slightly textured)
  
  Two-column (60% / 40%) on desktop:
  Left: tall editorial image (atelier/crafting scene), object-cover, no border-radius
  Right: vertically centered content
    SectionLabel: "THE ATELIER"
    Heading: "Every Stitch,<br/>A Signature." (Display M)
    Body: 2 paragraphs about the bespoke process
    
    3 numbered steps (01, 02, 03):
      Number: Cormorant, 48px, wine, italic
      Step title: DM Sans, bold
      Step description: DM Sans, small, grey
    
    [Begin Your Journey] button (wine, mt-8)
  
  Scroll-driven: left image has subtle parallax (Framer Motion useScroll + useTransform: y from 0 to -30px)

  ── BrandStats.tsx
  Background: charcoal. Full-width.
  4-stat row (responsive 2-col on mobile):
    "5,000+"    Designers Trained
    "2019"      Est. in Lagos
    "85+"       Team Members  
    "4"         Continents Served
  
  Number: Display L, gold, Cormorant italic
  Label: font-label, 12px, ivory/60
  
  Count-up animation: useCountUp hook triggers when section enters viewport
  Thin vertical dividers (1px, gold/20) between stats

  ── Testimonials.tsx
  Background: ivory
  SectionLabel: "CLIENT LOVE"
  Heading: "From Our Women"
  
  Swiper carousel (effect: fade or slide, autoplay 5s, centered):
    Large opening quote mark (Cormorant, 120px, gold, opacity 0.3, absolute top-left)
    Quote text (Display S, Cormorant italic, charcoal, centered)
    Author: name (DM Sans, small-caps), occasion (gold)
    Star rating (5 gold stars)
  
  Navigation: prev/next thin arrows (wine), dots in gold

  ── InstagramGrid.tsx
  SectionLabel: "FOLLOW THE STORY"
  "@prudent_gabriel" link header
  
  6-image masonry or uniform grid (3×2):
    Use placeholder editorial images (unsplash)
    On hover: wine tint overlay + Instagram logo icon centers
  
  [Follow on Instagram] button below

  ── PFABanner (imported component)
  
  ── NewsletterSection.tsx
  Full-width. Background: wine with subtle noise texture (SVG filter or CSS grain).
  
  Centered content:
    SectionLabel: "INNER CIRCLE" (ivory)
    Heading: "Join the Atelier Community" (Display M, gold, Cormorant italic)
    Subtext: "Early access to collections, exclusive offers, and stories from the atelier."
    Email + [Subscribe] inline form (gold outlined input, gold button)
    Privacy note: "No spam, ever. Unsubscribe anytime." (tiny ivory/50)

STEP 8.2 — Build src/app/(storefront)/bespoke/page.tsx:
  (Full spec in Stage 9 of original v1 — copy here with these additions):
  Add progress bar at top of multi-step form (3 dots, wine fill)
  Add Cloudinary upload in reference images step
  Add confirmation page after submit

STEP 8.3 — Build src/app/(storefront)/our-story/page.tsx:
  Hero: Full-bleed founder portrait image, dark overlay
    Heading (Display XL, ivory, italic): "A Stitch in Time"
    Subheading: "The story of Prudential Atelier"
  
  Story sections (alternating image left/right layout):
    Section 1: "From Ajah to the World" — origin story
    Section 2: Founder spotlight — Mrs. Prudent Gabriel-Okopi, bio, quote pullout
    Section 3: "The Atelier Today" — team, factory, stats
    Section 4: Notable clients grid (names + occasions)
    Section 5: "Empowering the Next Generation" — PFA Academy callout
  
  PFABanner at bottom

STEP 8.4 — Build src/app/(storefront)/press/page.tsx:
  Hero: "As Seen In" heading
  Press cards grid: publication name, headline, excerpt, date, [Read Article →]
  Press contact: "For press enquiries: press@prudentialatelier.com"

STEP 8.5 — Build src/app/(storefront)/contact/page.tsx:
  Split layout:
  Left: form (Name, Email, Subject, Message, [Send Message])
  Right: address, email, phone, working hours, Instagram link

STEP 8.6 — Build legal pages (privacy, terms, returns) — clean typographic prose layout.

STEP 8.7 — Build src/app/not-found.tsx:
  Full screen. Background: wine.
  Large "404" in Cormorant italic, gold
  "This page has left the atelier."
  [Return Home] + [Browse Collections] buttons

CONFIRMATION: Stage 8 complete when all public pages render, homepage sections are animated, and all components are wired to real data.
```

---

## STAGE 9 — EMAIL TEMPLATES

```
TASK: Build all 10 branded email templates using React Email.
All templates: inline styles only (email client compatibility), brand colors.

Create each in src/emails/:

Base wrapper for all emails:
  Background: #FAF6EF (ivory)
  Max-width: 600px, centered
  Header: wine bg, white logo, thin gold bottom border
  Footer: charcoal bg, social links, unsubscribe, © notice
  Body font: Georgia (not DM Sans — email safe font)
  Accent/headings: Georgia for Cormorant fallback

1. WelcomeEmail.tsx
   Subject: "Welcome to Prudential Atelier, [firstName] ✨"
   Body: 
     "You're now part of something rare." (italic header)
     Welcome paragraph
     If referred: "You have [500] loyalty points waiting for you."
     [Start Shopping] CTA button (wine bg, gold text)
     Social links

2. OrderConfirmationEmail.tsx
   Subject: "Order Confirmed — #[orderNumber] | Prudential Atelier"
   Body:
     "Thank you, [firstName]." heading
     Order number + date
     Items table: image thumbnail | name | size | qty | price
     Order totals section (subtotal, shipping, discount, total)
     Shipping address
     Estimated delivery
     [Track Your Order] CTA
     "Questions? Reply to this email."

3. OrderShippedEmail.tsx
   Subject: "Your Order is On Its Way! 📦"
   Tracking number (if available)
   Estimated delivery date
   Order summary
   [Track Your Order] button

4. OrderDeliveredEmail.tsx
   Subject: "Your Prudential Atelier order has arrived 🎉"
   "We hope you love it" message
   [Leave a Review] button (links to product review page)
   [Shop Again] button

5. BespokeConfirmationEmail.tsx
   Subject: "Bespoke Request Received — We'll be in touch, [firstName]"
   Request number
   Summary of their request
   Next steps (3 bullet points)
   "Our team will contact you within 24–48 hours."
   Contact info

6. PasswordResetEmail.tsx
   Subject: "Reset your password — Prudential Atelier"
   [Reset Password] button — expires in 1 hour
   "If you didn't request this, ignore this email."

7. ReferralSuccessEmail.tsx
   Subject: "You just earned 250 points! 🌟"
   "[Friend's first name] signed up using your referral link."
   Points earned: +250 pts
   Running total balance
   [View Your Wallet] button

8. BackInStockEmail.tsx
   Subject: "[Product Name] is back in stock!"
   Product image, name, size, price
   [Shop Now] button (urgency: "Limited stock available")

9. AbandonedCartEmail.tsx
   Subject: "You left something beautiful behind..."
   Triggered: 1 hour after user added to cart with no checkout
   Show cart items (up to 3) with images
   Gentle copy: "Your selections are still waiting."
   [Complete Your Order] button
   Optional: show a coupon code for 5% off (if configured)

10. AdminNotificationEmail.tsx (internal)
    Subject: "New [Bespoke Request / Order] — #[number]"
    Quick summary of key fields
    [View in Admin] button → links to admin dashboard

STEP 9.1 — Create src/lib/email.ts:
  import { Resend } from 'resend'
  const resend = new Resend(process.env.RESEND_API_KEY)
  
  export async function sendEmail({ to, subject, template }) {
    return resend.emails.send({ from: 'Prudential Atelier <hello@prudentialatelier.com>', to, subject, react: template })
  }
  
  Export named functions:
  sendWelcomeEmail(user), sendOrderConfirmation(order), sendOrderShipped(order, trackingNo),
  sendBespokeConfirmation(request), sendPasswordReset(email, token),
  sendReferralSuccess(referrer), sendBackInStock(email, product, variant),
  sendAbandonedCart(user, cartItems), sendAdminNotification(type, data)

CONFIRMATION: Stage 9 complete when emails render correctly in the React Email preview (npm run email).
```

---

## STAGE 10 — SEO, PERFORMANCE & DEPLOYMENT

```
TASK: Optimize for production. Configure Vercel deployment. Prepare Coolify migration notes.

STEP 10.1 — SEO Configuration:

src/app/layout.tsx — root metadata:
  title: { template: '%s | Prudential Atelier', default: 'Prudential Atelier — Luxury Nigerian Fashion & Bespoke Couture' }
  description: 'Bespoke couture and ready-to-wear by Mrs. Prudent Gabriel-Okopi. Luxury Nigerian fashion for the modern woman — bridal, evening, formal, and casual wear. Ships worldwide.'
  keywords: ['Nigerian fashion', 'bespoke couture Nigeria', 'luxury bridal Lagos', 'Prudent Gabriel', 'Prudential Atelier', 'Nigerian designer', 'African fashion']
  openGraph: { type: 'website', locale: 'en_NG', url, siteName: 'Prudential Atelier', images: [{ url: '/images/og-image.jpg', width: 1200, height: 630 }] }
  twitter: { card: 'summary_large_image', site: '@prudent_gabriel' }
  robots: { index: true, follow: true }
  icons: { icon: '/favicon.ico', apple: '/images/favicon/apple-touch-icon.png' }

src/app/(storefront)/shop/[slug]/page.tsx — generateMetadata:
  title: product.metaTitle || product.name
  description: product.metaDescription || product.description.slice(0, 155)
  openGraph: { images: [product.images[0].url] }

src/app/sitemap.ts — dynamic sitemap:
  Static URLs: /, /shop, /bespoke, /our-story, /press, /contact
  Dynamic: all published product slugs from DB
  Priority: homepage 1.0, shop 0.9, products 0.8, others 0.6

src/app/robots.ts:
  Allow: *
  Disallow: /admin, /api, /account, /checkout
  Sitemap: [NEXT_PUBLIC_APP_URL]/sitemap.xml

STEP 10.2 — Performance Optimizations:

Images:
  All product images: next/image with proper width/height props
  Hero images: priority={true}
  Below-fold: loading="lazy" (default)
  Configure Cloudinary as next/image loader in next.config.ts

Dynamic Imports (reduce initial bundle):
  Admin components: import('@/components/admin/...', { ssr: false })
  Swiper carousel: dynamic import
  Tiptap editor: dynamic import { ssr: false }
  React Easy Crop: dynamic import { ssr: false }
  canvas-confetti: dynamic import

ISR (Incremental Static Regeneration):
  shop/[slug]/page.tsx: export const revalidate = 60
  shop/page.tsx: export const revalidate = 300
  our-story, press, contact: export const revalidate = 3600

React Suspense:
  Wrap all TanStack Query-powered components in <Suspense fallback={<Skeleton />}>
  Wrap admin charts in Suspense

Route caching:
  Add cache('force-cache') headers on GET /api/products for public data
  Add cache('no-store') on all authenticated/user-specific routes

STEP 10.3 — Vercel Deployment Configuration:

vercel.json (final):
{
  "framework": "nextjs",
  "buildCommand": "npx prisma generate && next build",
  "installCommand": "npm install",
  "regions": ["lhr1"],
  "crons": [
    {
      "path": "/api/cron/abandoned-cart",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/cron/expired-coupons",
      "schedule": "0 0 * * *"
    }
  ]
}

Create src/app/api/cron/abandoned-cart/route.ts:
  Vercel cron — runs every hour
  Find CartItems updated > 1hr ago, userId has email, no order placed after cart update
  Send AbandonedCartEmail (max 1 per user per 24hr — check PointsTransaction or separate table)
  Protect with: if (request.headers.get('Authorization') !== 'Bearer ' + process.env.CRON_SECRET) return 401

Create src/app/api/cron/expired-coupons/route.ts:
  Find coupons where expiresAt < now and isActive = true
  Set isActive = false
  Log count

DATABASE — Use Neon.tech (free tier compatible with Vercel):
  1. Create project at neon.tech
  2. Get connection strings: DATABASE_URL (pooled) + DIRECT_URL (direct)
  3. Add both to Vercel environment variables
  4. Run: npx prisma migrate deploy (not db push — use migrations in production)

VERCEL ENV VARS — Add ALL keys from .env.local to Vercel dashboard.
Environments: Production + Preview should have all keys.
NEXTAUTH_URL: set to https://[your-vercel-domain].vercel.app for preview, https://prudentialatelier.com for production.

DEPLOY CHECKLIST:
  [ ] All env vars set in Vercel
  [ ] prisma generate runs in build command
  [ ] Database migrated: npx prisma migrate deploy
  [ ] Database seeded with admin user: npx prisma db seed
  [ ] Cloudinary configured and tested
  [ ] At least one payment gateway tested in test mode
  [ ] Google OAuth callback URL updated: https://[domain]/api/auth/callback/google
  [ ] Resend domain verified (or use onboarding@resend.dev for testing)

STEP 10.4 — Prisma Seed (prisma/seed.ts):
  Create SUPER_ADMIN user:
    email: process.env.ADMIN_EMAIL, password: hashed process.env.ADMIN_PASSWORD
    role: SUPER_ADMIN, referralCode: 'PA-ADMIN-000'
  
  Create sample shipping zones:
    Lagos: NG state Lagos, flat ₦3,500, free above ₦150,000, 1-2 days
    Other Nigeria: NG all states, flat ₦5,000, free above ₦200,000, 3-5 days
    UK: ['GB'], flat ₦35,000 (NGN equiv), 7-10 days
    US: ['US'], flat ₦40,000, 7-14 days
    International: ['*'], flat ₦45,000, 10-21 days
  
  Create 12 sample products with variants:
    2 Bridal (3 size variants with different prices each)
    3 Evening Wear
    2 Formal
    2 Casual
    2 Kiddies
    1 Accessories
  
  Create sample coupons:
    WELCOME10: 10% off, first use per user, no expiry
    FREESHIP: free shipping, min ₦50,000 order
    FLASH5000: ₦5,000 off, expires in 7 days, max 100 uses

STEP 10.5 — Coolify Migration Notes (for future reference):

When moving from Vercel to Coolify/VPS:

1. Create Dockerfile:
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT 3000
CMD ["node", "server.js"]

2. Add to next.config.ts: output: 'standalone'

3. Create docker-compose.yml:
version: '3.8'
services:
  app:
    build: .
    ports: ['3000:3000']
    env_file: .env.production
    depends_on: [db]
    restart: unless-stopped
  db:
    image: postgres:16-alpine
    volumes: ['pgdata:/var/lib/postgresql/data']
    environment:
      POSTGRES_DB: prudential_atelier
      POSTGRES_USER: prisma
      POSTGRES_PASSWORD: [strong-password]
    restart: unless-stopped
volumes:
  pgdata:

4. Update DATABASE_URL for self-hosted PostgreSQL
5. Remove DIRECT_URL (only needed for Neon serverless)
6. Set up Nginx reverse proxy with SSL (Coolify handles this automatically)
7. Run migrations: docker exec app npx prisma migrate deploy

CONFIRMATION: Stage 10 complete when the app deploys successfully on Vercel, all pages load, database is seeded, and at least one test payment completes successfully.
```

---

## IMPLEMENTATION RULES (READ BEFORE EVERY STAGE)

```
ARCHITECTURE RULES:
  ✓ Server Components by default — only add 'use client' where strictly necessary
  ✓ All data fetching in Server Components goes directly to Prisma (no API call to self)
  ✓ All data fetching in Client Components goes through /api routes or TanStack Query
  ✓ Prisma client: import from '@/lib/prisma' — never instantiate directly
  ✓ Never import server-only code into client components (prisma, bcrypt, server env vars)

SECURITY RULES:
  ✓ Every API route that modifies data: verify auth (getServerSession or auth())
  ✓ Every admin API route: verify role === 'ADMIN' || 'SUPER_ADMIN'
  ✓ Payment webhooks: verify signature before processing ANY order update
  ✓ User can only access their own orders/addresses/cart (check userId === session.user.id)
  ✓ Referral cookies: HttpOnly, Secure in production, SameSite=Lax
  ✓ Never expose PAYSTACK_SECRET_KEY, STRIPE_SECRET_KEY etc. to client (no NEXT_PUBLIC_ prefix)

DATA INTEGRITY RULES:
  ✓ Multi-table writes ALWAYS use prisma.$transaction()
  ✓ Never trust client-submitted prices — always recalculate totals server-side
  ✓ Coupon validation runs TWICE: once on UI preview, once server-side before order creation
  ✓ Stock decrement and order creation in same $transaction — prevents overselling
  ✓ Points award in same $transaction as order payment confirmation

TYPE SAFETY RULES:
  ✓ tsconfig.json: strict: true, noUncheckedIndexedAccess: true
  ✓ All API responses typed with shared interfaces from src/types/index.ts
  ✓ All Zod schemas exported from src/validations/ and reused in both client and server
  ✓ No 'any' types. Use 'unknown' and narrow with type guards.

DESIGN RULES:
  ✓ No Tailwind arbitrary values for colors — always use CSS variables via custom classes
  ✓ All spacing: use Tailwind classes (not arbitrary px values)
  ✓ Every page must work on mobile (320px+), tablet (768px+), desktop (1280px+)
  ✓ All interactive elements: visible focus rings (wine or gold, 2px offset)
  ✓ Loading states: every data-fetching component has a skeleton fallback
  ✓ Empty states: every list/grid has a designed empty state (not just blank)
  ✓ Error states: every API call has a user-visible error state

PERFORMANCE RULES:
  ✓ Never fetch data that isn't needed for the current route
  ✓ Paginate all lists (orders, products, customers) — never fetch all records
  ✓ Exchange rates: cache in memory, refresh max once per hour
  ✓ Product images: always specify width and height on next/image
  ✓ Heavy components (admin tables, Tiptap, charts): dynamic import with ssr: false
```

---

## ENVIRONMENT VARIABLES REFERENCE

```bash
# === DATABASE ===
DATABASE_URL=""           # Neon pooled connection (use for app)
DIRECT_URL=""             # Neon direct connection (use for migrations)

# === AUTH ===
NEXTAUTH_SECRET=""        # Run: openssl rand -base64 32
NEXTAUTH_URL=""           # http://localhost:3000 (dev) | https://domain.com (prod)
GOOGLE_CLIENT_ID=""       # Google Cloud Console → OAuth 2.0 Client
GOOGLE_CLIENT_SECRET=""

# === CLOUDINARY ===
CLOUDINARY_CLOUD_NAME=""
CLOUDINARY_API_KEY=""
CLOUDINARY_API_SECRET=""
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=""  # Same as above, safe for client

# === PAYMENTS ===
PAYSTACK_SECRET_KEY=""
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=""
FLUTTERWAVE_SECRET_KEY=""
NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY=""
STRIPE_SECRET_KEY=""
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=""
STRIPE_WEBHOOK_SECRET=""
MONNIFY_API_KEY=""
MONNIFY_SECRET_KEY=""
MONNIFY_CONTRACT_CODE=""
MONNIFY_BASE_URL="https://api.monnify.com"  # Use sandbox for testing

# === EMAIL ===
RESEND_API_KEY=""

# === CURRENCY ===
OPEN_EXCHANGE_RATES_APP_ID=""   # Free at openexchangerates.org

# === APP ===
NEXT_PUBLIC_APP_URL=""    # http://localhost:3000 or https://domain.com
ADMIN_EMAIL=""            # For seed script + admin notifications
ADMIN_PASSWORD=""         # For seed script — change after first login

# === CRON (Vercel) ===
CRON_SECRET=""            # openssl rand -base64 32 — protects cron endpoints
```

---

*Prudential Atelier — Full-Stack Luxury E-Commerce*
*Cursor AI Master Prompt v2.0*
*Prepared by Nony | SonsHub Media*
*For Mrs. Prudent Gabriel-Okopi · Lagos, Nigeria*
```
