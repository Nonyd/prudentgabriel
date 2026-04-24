# CURSOR SESSION PROMPT — SESSION 3
## Stage 5: Checkout + Payment · Stage 6: Account Dashboard
### Prudential Atelier · Picks up from Session 2 completion

---

> ## ⚠️ MANDATORY PRE-FLIGHT — READ BEFORE TOUCHING ANY FILE
>
> 1. **Never recreate a file that already exists.** Use `Read File` to check before creating.
> 2. **Never use `any` types.** Use `unknown` and narrow, or derive types from Prisma client.
> 3. **All multi-table writes use `prisma.$transaction([])`** — no exceptions.
> 4. **All financial totals are recalculated server-side** — never trust client-submitted prices.
> 5. **All payment webhook routes use raw body** — do NOT use Next.js body parser on webhook handlers.
> 6. **`lucide-react` in this repo has no `Instagram`/`Facebook` exports** — use `src/components/icons/SocialIcons.tsx`.
> 7. After every task: `npx tsc --noEmit` must pass before moving on.
> 8. **Complete every function fully.** No `// TODO`, no `throw new Error('not implemented')`.

---

## WHAT IS ALREADY BUILT (do not rebuild)

### ✅ Complete
- Stage 1: Project setup, tokens, providers, Lenis, layout
- Stage 2: Full auth system (login, register, Google OAuth, forgot/reset password, referral cookie)
- Stage 3: All global components (Navbar, Footer, CartDrawer, SearchModal, ProductCard, WishlistButton, PFABanner, QuickViewModal, StockAlertForm, RecentlyViewed)
- Stage 4: Products API, Shop page, Product detail page, Cart API, CartSyncProvider, Homepage (all 9 sections)
- Zustand stores: `cartStore`, `currencyStore`, `wishlistStore`, `recentlyViewedStore`
- `src/lib/currency.ts`: `getExchangeRates`, `convertFromNGN`, `formatPrice`
- `src/lib/prisma.ts`, `src/lib/utils.ts`
- `prisma/seed.ts`: 14 products, users, orders (partial)

### ❌ NOT YET BUILT (this session)
- Stage 5: Checkout flow, coupon validation, shipping calculation, all 4 payment gateways, order creation, success page
- Stage 6: Account dashboard layout, all account pages, all account API routes
- `src/lib/coupon.ts`, `src/lib/shipping.ts`, `src/lib/points.ts`, `src/lib/order-number.ts`
- All payment lib files: `src/lib/payments/paystack.ts`, `flutterwave.ts`, `stripe.ts`, `monnify.ts`
- Email lib and all email templates

---

## PRISMA SCHEMA ADDITIONS NEEDED

Before writing any code, check `prisma/schema.prisma`. Add these if missing:

```prisma
// Add to Order model if not present:
//   guestName   String?
//   guestPhone  String?
//   isGift      Boolean @default(false)
//   giftMessage String?
//   adminNotes  String?
//   paidAt      DateTime?
//   couponCode  String?  (denormalized for display)

// Add to Coupon model if not present:
//   categoryScope ProductCategory[]
//   productScope  String[]

// Verify CouponUsage model exists:
model CouponUsage {
  id       String   @id @default(cuid())
  couponId String
  coupon   Coupon   @relation(fields: [couponId], references: [id])
  userId   String?
  email    String
  orderId  String
  usedAt   DateTime @default(now())
  @@unique([couponId, orderId])
}

// Add CouponUsage relation to Coupon model:
//   usages CouponUsage[]
// Add CouponUsage relation to Order model:
//   couponUsage CouponUsage?

// Verify PasswordResetToken exists (was added in Session 1):
model PasswordResetToken {
  id        String   @id @default(cuid())
  email     String
  token     String   @unique
  expires   DateTime
  createdAt DateTime @default(now())
}
```

After any schema changes: `npx prisma generate` (do NOT run migrate — use `db push` only for dev).

---

## TASK A — LIBRARY FILES

### A1 — Order Number Generator

**`src/lib/order-number.ts`**
```typescript
// generateOrderNumber(): string
//   Format: "PA-" + last 2 digits of year + "-" + 5-digit zero-padded random
//   Example: "PA-24-00042"
//   Use: Math.floor(Math.random() * 99999) + 1, padStart(5, '0')
//   Collision chance is acceptable for this volume — no DB check needed

// generateBespokeNumber(): string
//   Format: "BQ-" + year + "-" + 5-digit
//   Example: "BQ-2024-00012"
```

### A2 — Points Library

**`src/lib/points.ts`**
```typescript
import { prisma } from './prisma'
import { PointsType } from '@prisma/client'

// awardPurchasePoints(userId: string, orderTotalNGN: number, orderId: string): Promise<number>
//   Points = Math.floor(orderTotalNGN / 100)  — 1pt per ₦100
//   If points === 0: return 0 (no transaction)
//   Use prisma.$transaction:
//     1. user.update pointsBalance: { increment: points }
//     2. pointsTransaction.create {
//          userId, type: EARNED_PURCHASE, amount: points,
//          balance: updatedUser.pointsBalance,
//          description: `Points earned from order`,
//          orderId
//        }
//   Return points awarded

// redeemPoints(userId: string, pointsToRedeem: number, orderId: string): Promise<void>
//   Validate: pointsToRedeem > 0
//   Fetch user.pointsBalance — throw if insufficient
//   Use prisma.$transaction:
//     1. user.update pointsBalance: { decrement: pointsToRedeem }
//     2. pointsTransaction.create {
//          userId, type: REDEEMED, amount: -pointsToRedeem,
//          balance: updatedBalance,
//          description: `Points redeemed at checkout`,
//          orderId
//        }

// getPointsValue(points: number): number
//   1 point = ₦1 store credit
//   return points (as NGN value)

// awardReferralPoints(referrerId: string, newUserId: string): Promise<void>
//   Award 250 pts to referrer (type: EARNED_REFERRAL)
//   Award 500 pts to new user (type: EARNED_SIGNUP)
//   Use $transaction for both
//   (Called from register route — check if already implemented there)
```

### A3 — Coupon Library

**`src/lib/coupon.ts`**
```typescript
import { prisma } from './prisma'
import { ProductCategory, CouponType } from '@prisma/client'

export interface CouponValidationResult {
  valid: boolean
  coupon?: {
    id: string
    code: string
    type: CouponType
    value: number
    description: string | null
  }
  discountNGN: number
  isFreeShipping: boolean
  error?: string
}

export interface CartLineForCoupon {
  priceNGN: number
  quantity: number
  category?: ProductCategory
}

// validateCoupon(
//   code: string,
//   subtotalNGN: number,
//   email: string,         // for per-user limit check (works for guests too)
//   userId: string | null,
//   cartLines: CartLineForCoupon[]
// ): Promise<CouponValidationResult>
//
// Checks IN ORDER (return first failure):
//   1. Exists: coupon with this code.toUpperCase()
//      → error: "Invalid coupon code"
//
//   2. isActive
//      → error: "This coupon is no longer active"
//
//   3. Date range: now >= startsAt AND (expiresAt === null OR now <= expiresAt)
//      → error: "This coupon has expired"
//
//   4. Total uses: if maxUsesTotal !== null → usedCount < maxUsesTotal
//      → error: "This coupon has reached its usage limit"
//
//   5. Per-user limit: count CouponUsage where email = email
//      → if count >= maxUsesPerUser: error: "You have already used this coupon"
//
//   6. Minimum order: if minOrderNGN !== null → subtotalNGN >= minOrderNGN
//      → error: `Minimum order of ₦${formatAmount} required`
//
//   7. Scope check: if !appliesToAll
//      → if categoryScope.length > 0: at least one cartLine.category must be in categoryScope
//      → if productScope.length > 0: (skip for now — product-level scope is admin-only)
//      → error: "This coupon does not apply to items in your bag"
//
// Calculate discount:
//   PERCENTAGE:    Math.floor(subtotalNGN * coupon.value / 100)
//   FIXED_AMOUNT:  Math.min(coupon.value, subtotalNGN)  — cap at subtotal
//   FREE_SHIPPING: discountNGN = 0, isFreeShipping = true
//
// Return: { valid: true, coupon, discountNGN, isFreeShipping }
```

### A4 — Shipping Library

**`src/lib/shipping.ts`**
```typescript
import { prisma } from './prisma'

export interface AddressForShipping {
  city: string
  state: string
  country: string  // ISO 2-letter code: 'NG', 'GB', 'US', etc.
}

export interface ShippingOption {
  zoneId: string
  zoneName: string
  costNGN: number
  isFree: boolean
  estimatedDays: string
}

// calculateShippingOptions(
//   address: AddressForShipping,
//   subtotalNGN: number,
//   totalWeightKg: number,
//   isFreeShippingCoupon: boolean
// ): Promise<ShippingOption[]>
//
// Fetch all active ShippingZones from DB
//
// For each zone, check if it matches the address:
//   MATCH LOGIC:
//     - If zone.countries includes '*': always matches
//     - If zone.countries includes address.country: 
//         If zone.states.length === 0: matches (country-level)
//         If zone.states.length > 0: matches only if address.state is in zone.states
//     - Otherwise: no match
//
// For each matching zone, calculate cost:
//   baseCost = zone.flatRateNGN + (zone.perKgNGN * totalWeightKg)
//   isFree = isFreeShippingCoupon || (zone.freeAboveNGN !== null && subtotalNGN >= zone.freeAboveNGN)
//   finalCost = isFree ? 0 : baseCost
//
// Return array of ShippingOption (sorted: free first, then cheapest)
// If no zone matches: return a single fallback option:
//   { zoneId: 'manual', zoneName: 'Custom Quote', costNGN: 0, isFree: false, estimatedDays: 'Contact us' }
```

### A5 — Payment Libraries

**`src/lib/payments/paystack.ts`**
```typescript
// PAYSTACK_SECRET_KEY from env

export interface PaystackInitResult {
  authorizationUrl: string
  accessCode: string
  reference: string
}

// initializeTransaction(params: {
//   email: string
//   amountKobo: number     // amount in kobo (NGN × 100)
//   reference: string      // orderNumber
//   callbackUrl: string    // NEXT_PUBLIC_APP_URL + '/api/payment/paystack/verify'
//   metadata: { orderId: string; orderNumber: string }
// }): Promise<PaystackInitResult>
//
// POST https://api.paystack.co/transaction/initialize
// Headers: Authorization: Bearer PAYSTACK_SECRET_KEY, Content-Type: application/json
// Body: { email, amount, reference, callback_url, metadata }
// Return data.data: { authorization_url, access_code, reference }
// Throw on non-2xx

// verifyTransaction(reference: string): Promise<{
//   status: string  // 'success' | 'failed' | 'abandoned'
//   amount: number  // in kobo
//   reference: string
//   metadata: { orderId: string }
// }>
// GET https://api.paystack.co/transaction/verify/:reference
// Return data.data

// verifyWebhookSignature(rawBody: string, signature: string): boolean
// crypto.createHmac('sha512', PAYSTACK_SECRET_KEY).update(rawBody).digest('hex') === signature
```

**`src/lib/payments/flutterwave.ts`**
```typescript
// FLUTTERWAVE_SECRET_KEY from env

export interface FlutterwaveInitResult {
  paymentLink: string
  txRef: string
}

// initializeTransaction(params: {
//   txRef: string          // orderNumber
//   amount: number         // in the currency unit (NGN, USD, or GBP)
//   currency: 'NGN'|'USD'|'GBP'
//   email: string
//   name: string
//   phone?: string
//   redirectUrl: string    // NEXT_PUBLIC_APP_URL + '/api/payment/flutterwave/verify'
//   meta: { orderId: string }
// }): Promise<FlutterwaveInitResult>
//
// POST https://api.flutterwave.com/v3/payments
// Headers: Authorization: Bearer FLUTTERWAVE_SECRET_KEY
// Body: { tx_ref, amount, currency, redirect_url, customer: {email, name, phonenumber}, meta }
// Return: { paymentLink: data.data.link, txRef }

// verifyTransaction(transactionId: string): Promise<{
//   status: string  // 'successful' | 'failed'
//   txRef: string
//   amount: number
//   currency: string
//   meta: { orderId: string }
// }>
// GET https://api.flutterwave.com/v3/transactions/:id/verify
// Headers: Authorization: Bearer FLUTTERWAVE_SECRET_KEY

// verifyWebhookSignature(rawBody: string, signature: string): boolean
// crypto.createHmac('sha256', FLUTTERWAVE_SECRET_KEY).update(rawBody).digest('hex') === signature
```

**`src/lib/payments/stripe.ts`**
```typescript
// Import Stripe SDK: import Stripe from 'stripe'
// const stripe = new Stripe(STRIPE_SECRET_KEY)

// createPaymentIntent(params: {
//   amountCents: number    // amount in smallest currency unit (USD cents, GBP pence)
//   currency: 'usd'|'gbp'
//   orderId: string
//   orderNumber: string
//   customerEmail: string
// }): Promise<{ clientSecret: string; paymentIntentId: string }>
// 
// stripe.paymentIntents.create({
//   amount, currency,
//   metadata: { orderId, orderNumber },
//   receipt_email: customerEmail
// })

// verifyWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event
// stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET)
// — throws on failure, caller catches
```

**`src/lib/payments/monnify.ts`**
```typescript
// MONNIFY_API_KEY, MONNIFY_SECRET_KEY, MONNIFY_CONTRACT_CODE, MONNIFY_BASE_URL

// getMonnifyToken(): Promise<string>
//   POST {MONNIFY_BASE_URL}/api/v1/auth/login
//   Headers: Authorization: Basic base64(API_KEY:SECRET_KEY)
//   Return: responseBody.responseBody.accessToken
//   Cache token for 50 minutes (module-level)

// initializeTransaction(params: {
//   amountNGN: number
//   reference: string      // orderNumber
//   customerEmail: string
//   customerName: string
//   description: string    // "Prudential Atelier Order #PA-24-00042"
//   redirectUrl: string
// }): Promise<{ checkoutUrl: string; transactionReference: string }>
//
// POST {MONNIFY_BASE_URL}/api/v1/merchant/transactions/init-transaction
// Headers: Authorization: Bearer [token]
// Body: { amount, customerName, customerEmail, paymentDescription, currencyCode: 'NGN',
//         contractCode: MONNIFY_CONTRACT_CODE, paymentReference: reference,
//         redirectUrl, paymentMethods: ['CARD', 'ACCOUNT_TRANSFER', 'USSD'] }

// verifyTransaction(paymentReference: string): Promise<{
//   status: string  // 'PAID' | 'PENDING' | 'FAILED'
//   amountPaid: number
//   paymentReference: string
// }>
// GET {MONNIFY_BASE_URL}/api/v2/merchant/transactions/query?paymentReference=:ref

// verifyWebhookSignature(rawBody: string, signature: string): boolean
// const hash = crypto.createHmac('sha512', MONNIFY_SECRET_KEY).update(rawBody).digest('hex')
// return hash === signature
```

### A6 — Email Library

**`src/lib/email.ts`**
```typescript
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'Prudential Atelier <hello@prudentialatelier.com>'

// If RESEND_API_KEY is not set: log email to console instead of sending (dev mode)

// sendEmail(params: { to: string; subject: string; html: string }): Promise<void>
//   If no API key: console.log('[EMAIL]', to, subject); return
//   resend.emails.send({ from: FROM, to, subject, html })
//   Catch and log errors — never throw to caller

// Named helpers (build HTML inline — no React Email needed for now):

// sendWelcomeEmail(to: string, firstName: string, pointsBalance: number): Promise<void>
//   Subject: "Welcome to Prudential Atelier, [firstName] ✨"
//   HTML: Simple branded HTML — wine header bar, ivory body
//   Body: "Welcome to the inner circle." + points info if pointsBalance > 0

// sendOrderConfirmationEmail(params: {
//   to: string
//   firstName: string
//   orderNumber: string
//   items: { name: string; size: string; qty: number; priceNGN: number }[]
//   totalNGN: number
//   shippingNGN: number
//   discountNGN: number
//   pointsDiscNGN: number
// }): Promise<void>
//   Subject: "Order Confirmed — #[orderNumber] | Prudential Atelier"

// sendPasswordResetEmail(to: string, resetUrl: string): Promise<void>
//   Subject: "Reset your Prudential Atelier password"

// sendBespokeConfirmationEmail(to: string, name: string, requestNumber: string): Promise<void>
//   Subject: "Bespoke Request Received — [requestNumber]"

// sendReferralSuccessEmail(to: string, referrerName: string, friendFirstName: string): Promise<void>
//   Subject: "You just earned 250 points! 🌟"

// All HTML: minimal, inline styles, fallback-safe
// Wine header: background #6B1C2A, gold text #C9A84C
// Body: background #FAF6EF, font: Georgia, charcoal text
```

---

## TASK B — VALIDATION SCHEMAS

**`src/validations/order.ts`**
```typescript
import { z } from 'zod'

export const addressSchema = z.object({
  firstName:  z.string().min(1),
  lastName:   z.string().min(1),
  phone:      z.string().min(7),
  line1:      z.string().min(3),
  line2:      z.string().optional(),
  city:       z.string().min(1),
  state:      z.string().min(1),
  postalCode: z.string().optional(),
  country:    z.string().length(2).default('NG'),
  saveAddress: z.boolean().optional().default(false),
})

export const checkoutSchema = z.object({
  // Step 1 — Cart (no additional input needed, read from cart API)
  
  // Step 2 — Delivery
  addressId:      z.string().cuid().optional(),  // existing saved address
  address:        addressSchema.optional(),       // new address (one of these required)
  shippingZoneId: z.string(),
  notes:          z.string().max(500).optional(),
  isGift:         z.boolean().optional().default(false),
  giftMessage:    z.string().max(200).optional(),
  
  // Step 3 — Payment
  currency:       z.enum(['NGN', 'USD', 'GBP']),
  gateway:        z.enum(['PAYSTACK', 'FLUTTERWAVE', 'STRIPE', 'MONNIFY']),
  couponCode:     z.string().optional(),
  pointsToRedeem: z.number().int().min(0).optional().default(0),
  
  // Guest info (if not logged in)
  guestEmail:     z.string().email().optional(),
  guestName:      z.string().optional(),
  guestPhone:     z.string().optional(),
})

export type CheckoutInput = z.infer<typeof checkoutSchema>
export type AddressInput  = z.infer<typeof addressSchema>
```

**`src/validations/coupon.ts`**
```typescript
import { z } from 'zod'

export const couponValidateSchema = z.object({
  code:        z.string().min(1).max(50),
  subtotalNGN: z.number().positive(),
  email:       z.string().email(),
  cartLines:   z.array(z.object({
    priceNGN:  z.number(),
    quantity:  z.number().int().positive(),
    category:  z.string().optional(),
  })),
})

export const couponAdminSchema = z.object({
  code:           z.string().min(3).max(30).toUpperCase(),
  description:    z.string().optional(),
  type:           z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING']),
  value:          z.number().min(0),
  minOrderNGN:    z.number().optional(),
  maxUsesTotal:   z.number().int().optional(),
  maxUsesPerUser: z.number().int().min(1).default(1),
  appliesToAll:   z.boolean().default(true),
  categoryScope:  z.array(z.string()).optional(),
  isActive:       z.boolean().default(true),
  startsAt:       z.coerce.date().optional(),
  expiresAt:      z.coerce.date().optional(),
})
```

---

## TASK C — CHECKOUT API ROUTES

### C1 — Coupon Validate

**`src/app/api/coupons/validate/route.ts`** (POST)
```typescript
// Input: couponValidateSchema
// Call validateCoupon() from lib/coupon.ts
// Return CouponValidationResult as JSON
// No auth required (works for guests)
// Do NOT record usage here — only on order creation
// Rate limit: 10 req/min per IP (optional — skip if complex)
```

### C2 — Shipping Calculate

**`src/app/api/shipping/calculate/route.ts`** (POST)
```typescript
// Input: {
//   address: { city, state, country },
//   subtotalNGN: number,
//   totalWeightKg: number,      // default 0.5 per item if not provided
//   isFreeShippingCoupon: boolean
// }
// Call calculateShippingOptions() from lib/shipping.ts
// Return: { options: ShippingOption[] }
```

### C3 — Order Create

**`src/app/api/orders/create/route.ts`** (POST)
```typescript
// Auth: session OR guest (guestEmail required if no session)
// Input: checkoutSchema

// ── SERVER-SIDE RECALCULATION (never trust client) ──

// 1. Get cart items:
//    If logged in: fetch CartItems from DB for this user (include variant + product)
//    If guest: accept cartLines from request body:
//      { productId, variantId, quantity, size, color?, colorHex? }[]
//    If cart is empty: return 400 "Your bag is empty"

// 2. Validate each variant still has sufficient stock
//    If any variant.stock < requested quantity: return 400 with item name

// 3. Recalculate subtotal server-side:
//    subtotalNGN = sum of (variant.salePriceNGN ?? variant.priceNGN) × quantity

// 4. Validate shipping zone exists and is active

// 5. Calculate shipping cost:
//    Get address from addressId or address input
//    Call calculateShippingOptions() — find the selected zone
//    shippingNGN = zone cost (0 if free)

// 6. Validate + apply coupon (if provided):
//    Call validateCoupon() — return 400 if invalid
//    discountNGN from result

// 7. Validate + calculate points (if pointsToRedeem > 0):
//    If not logged in: return 400 "Must be logged in to use points"
//    Check user.pointsBalance >= pointsToRedeem
//    pointsDiscNGN = pointsToRedeem (1pt = ₦1)
//    Cap: pointsDiscNGN cannot exceed (subtotalNGN + shippingNGN - discountNGN)

// 8. Final total:
//    totalNGN = subtotalNGN + shippingNGN - discountNGN - pointsDiscNGN
//    If totalNGN < 0: totalNGN = 0

// 9. Resolve address snapshot:
//    If addressId: fetch Address from DB, verify belongs to user
//    Else: use address from input
//    Build addressSnapshot: plain JSON object (firstName, lastName, line1, city, state, country, phone)

// 10. If saveAddress && logged in: create Address record

// ── DATABASE TRANSACTION ──
// Use prisma.$transaction(async (tx) => { ... })

// Inside transaction:
//   a. Create Order:
//      orderNumber: generateOrderNumber()
//      userId / guestEmail / guestName / guestPhone
//      currency, subtotalNGN, shippingNGN, discountNGN, pointsDiscNGN, totalNGN
//      shippingZoneId, addressSnapshot
//      couponId (if coupon), couponCode
//      pointsUsed: pointsToRedeem
//      isGift, giftMessage, notes
//      paymentStatus: PENDING, status: PENDING
//
//   b. Create OrderItems for each cart line:
//      productId, variantId, quantity, size, color, colorHex
//      unitPriceNGN: variant.salePriceNGN ?? variant.priceNGN
//      totalNGN: unitPriceNGN × quantity
//
//   c. Decrement variant stock:
//      variant.update stock: { decrement: quantity }
//      For EACH cart line
//
//   d. If coupon used:
//      coupon.update usedCount: { increment: 1 }
//      couponUsage.create { couponId, userId, email, orderId: order.id }
//
//   e. If pointsToRedeem > 0:
//      Call redeemPoints(userId, pointsToRedeem, order.id) — inside tx using tx client
//      (Pass tx as parameter or inline the logic)
//
//   f. If logged in: clear CartItems for this user
//      tx.cartItem.deleteMany({ where: { userId } })

// ── AFTER TRANSACTION ──
// Send order confirmation email (don't await — fire and forget)
// sendOrderConfirmationEmail(...)

// Return: { orderId: order.id, orderNumber: order.orderNumber, totalNGN, currency }
// (No payment initiation here — client initiates payment separately)
```

### C4 — Payment Routes

**`src/app/api/payment/paystack/initiate/route.ts`** (POST)
```typescript
// Auth: session OR guest (validate orderId belongs to them)
// Input: { orderId: string }
// Fetch order, verify paymentStatus === 'PENDING'
// Verify order belongs to current user (userId match OR guestEmail match)
// Call paystack.initializeTransaction({
//   email: user.email || order.guestEmail,
//   amountKobo: Math.round(order.totalNGN * 100),
//   reference: order.orderNumber,
//   callbackUrl: NEXT_PUBLIC_APP_URL + '/api/payment/paystack/verify?orderId=' + orderId,
//   metadata: { orderId, orderNumber: order.orderNumber }
// })
// Return: { authorizationUrl, reference }
```

**`src/app/api/payment/paystack/verify/route.ts`** (GET)
```typescript
// Query params: reference (Paystack adds this to callbackUrl), orderId
// Call paystack.verifyTransaction(reference)
// If status === 'success':
//   Update order: paymentStatus PAID, paidAt: new Date(), paymentRef: reference, status: CONFIRMED
//   Award purchase points (if userId): awardPurchasePoints(userId, totalNGN, orderId)
//   Send shipped email when status changes later (not here)
// If failed: update paymentStatus FAILED
// Redirect: /checkout/success?order=[orderNumber] (success)
//        OR /checkout?error=payment-failed (failure)
```

**`src/app/api/payment/paystack/webhook/route.ts`** (POST — RAW BODY)
```typescript
// IMPORTANT: This route must read the raw body for signature verification
// Use: const rawBody = await request.text()
// Get signature: request.headers.get('x-paystack-signature')
// Verify: paystack.verifyWebhookSignature(rawBody, signature)
// If invalid signature: return new Response(null, { status: 401 })
//
// Parse: const event = JSON.parse(rawBody)
// Handle:
//   'charge.success': same logic as verify — idempotent (check if already PAID)
//   'charge.failed':  set paymentStatus FAILED if still PENDING
// Always return 200 to acknowledge
```

**`src/app/api/payment/flutterwave/initiate/route.ts`** (POST)
```typescript
// Input: { orderId, currency: 'NGN'|'USD'|'GBP' }
// Get order, verify PENDING
// Get rates from getExchangeRates()
// Convert amount to selected currency:
//   NGN: order.totalNGN
//   USD: convertFromNGN(order.totalNGN, 'USD', rates) — round to 2dp
//   GBP: convertFromNGN(order.totalNGN, 'GBP', rates) — round to 2dp
// Call flutterwave.initializeTransaction({...})
// Return: { paymentLink }
```

**`src/app/api/payment/flutterwave/verify/route.ts`** (GET)
```typescript
// Query: transaction_id (Flutterwave adds to redirect URL), orderId
// Call flutterwave.verifyTransaction(transaction_id)
// Same PAID logic as Paystack verify
// Redirect to success or error
```

**`src/app/api/payment/flutterwave/webhook/route.ts`** (POST — RAW BODY)
```typescript
// Read raw body, verify signature (verifyWebhookSignature)
// Handle: 'charge.completed' event → same PAID logic
// Idempotent check: skip if already PAID
// Always return 200
```

**`src/app/api/payment/stripe/initiate/route.ts`** (POST)
```typescript
// Input: { orderId, currency: 'USD'|'GBP' }
// Get order, verify PENDING
// Get rates, convert amount to selected currency in cents/pence
// Call stripe.createPaymentIntent(...)
// Save paymentIntentId to order.paymentRef
// Return: { clientSecret }
// (Stripe Elements on frontend uses clientSecret to confirm payment)
```

**`src/app/api/payment/stripe/webhook/route.ts`** (POST — RAW BODY)
```typescript
// Use request.arrayBuffer() → Buffer for Stripe
// const sig = request.headers.get('stripe-signature')
// const event = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)
// Handle:
//   'payment_intent.succeeded':
//     Find order by paymentRef (paymentIntentId)
//     Set PAID, award points, send email
//   'payment_intent.payment_failed':
//     Set paymentStatus FAILED
// Return 200 always
```

**`src/app/api/payment/monnify/initiate/route.ts`** (POST)
**`src/app/api/payment/monnify/verify/route.ts`** (GET)
**`src/app/api/payment/monnify/webhook/route.ts`** (POST — RAW BODY)
```typescript
// Follow same pattern as Paystack but using monnify lib functions
// Webhook: MONNIFY_SUCCESSFUL_TRANSACTION event
// Verify: verify PAYMENT.STATUS === 'PAID'
```

---

## TASK D — CHECKOUT UI

### D1 — Checkout Page

**`src/app/(storefront)/checkout/page.tsx`** — Replace the shell with the full implementation.

```typescript
// Server component wrapper
// Check: if no session AND no cart items (server-side): show empty state
// Render CheckoutClient (client component)
```

**`src/components/checkout/CheckoutClient.tsx`** (client component)
```typescript
// State:
//   step: 1 | 2 | 3
//   cartItems: from cartStore + fetch /api/cart if logged in
//   couponState: { code, result: CouponValidationResult | null, loading }
//   pointsToRedeem: number (0 default)
//   selectedAddress: AddressInput | null
//   selectedZoneId: string | null
//   shippingOptions: ShippingOption[]
//   shippingLoading: boolean
//   isGift: boolean, giftMessage: string
//   selectedGateway: 'PAYSTACK'|'FLUTTERWAVE'|'STRIPE'|'MONNIFY' | null
//   selectedCurrency: 'NGN'|'USD'|'GBP' (from currencyStore)
//   isSubmitting: boolean
//   createdOrder: { orderId, orderNumber, totalNGN } | null
```

**Layout:**
```
Two-column (lg): LEFT (flex-1) = step content · RIGHT (360px sticky) = OrderSummary

STEPPER (top, full-width):
  3 steps: [1 Cart] [2 Delivery] [3 Payment]
  Completed: wine circle with checkmark ✓
  Current: wine circle with number, gold border
  Future: grey circle with number
  Lines between: wine if past step complete, grey otherwise
  Mobile: step title hidden, just circles + connector lines
```

### D2 — Step 1: Cart Review

**`src/components/checkout/CartReview.tsx`**
```
Cart items table:
  Columns: [Image 64×80] | [Name + size + color] | [Qty control] | [Price] | [Remove]
  
  Qty control: − / number / +
    On change: cartStore.updateQty() (optimistic) + PATCH /api/cart/[itemId] if logged in
    Minimum: 1, Maximum: variant.stock (from cartStore item — store stock on add)
  
  Remove: X icon → cartStore.removeItem() + DELETE /api/cart/[itemId] if logged in
  
  Each row: gentle fade-out animation on remove (Framer Motion AnimatePresence)

COUPON INPUT (CouponInput.tsx):
  Text input (uppercase transform) + [Apply] button
  On apply:
    POST /api/coupons/validate { code, subtotalNGN, email, cartLines }
    Loading spinner on button
    Success: green checkmark + "₦X,XXX discount applied" + coupon description
    Error: red message under input
    [×] button to remove applied coupon
  If coupon.type === 'FREE_SHIPPING': show "Free shipping applied" instead of amount

POINTS REDEMPTION (PointsRedemption.tsx):
  Only render if: session exists AND user.pointsBalance > 0
  
  Info row: "You have [X] points = ₦X,XXX store credit"
  
  Slider OR toggle:
    Toggle ON: "Apply [X] points (₦X,XXX off)"
    Can't exceed cart total after coupon discount
    Updates pointsToRedeem state in parent
  
  Show resulting new total impact: "Your total becomes ₦X,XXX"

GIFT OPTIONS (GiftOptions.tsx):
  Checkbox: [✓] "This is a gift"
  If checked → textarea: "Gift message (optional)"
  Max 200 chars, char counter shown

[Continue to Delivery] button — wine, full-width, bottom
  Disabled if: cart is empty
  Validate: at least 1 item in cart before proceeding
```

### D3 — Step 2: Delivery

**`src/components/checkout/DeliveryForm.tsx`**
```
If logged in + has saved addresses:
  
  SAVED ADDRESSES (AddressSelector.tsx):
    Radio cards (each address):
      Label badge (Home/Office/etc.), full address, "Default" badge if default
      Selected: wine border, wine radio dot
    
    [+ Use a different address] accordion:
      Opens NewAddressForm below
      "Save this address to my account" checkbox
  
  If not logged in OR no saved addresses:
    Full address form (React Hook Form, addressSchema):
      First Name, Last Name side by side
      Phone
      Address Line 1
      Address Line 2 (optional)
      City, State side by side
      Country (select, default Nigeria 🇳🇬)
      Postal Code (optional)
  
  GUEST CONTACT (if not logged in):
    Email, Name, Phone (required for guest — already part of addressSchema)
    Note: "💡 Create an account after checkout to earn loyalty points on this order"

SHIPPING OPTIONS (ShippingOptions.tsx):
  Auto-fetches when address is sufficiently filled (city + country set):
    POST /api/shipping/calculate with address + subtotal + isFreeCoupon
  
  Loading: 3 skeleton rows
  
  Options list (radio cards):
    Each: zone name | estimated days | cost (formatted in selected currency)
    Free: "FREE" in gold instead of price
    Selected: wine border
    Sort: free first, then by cost ascending
  
  Note below: "Shipping times are estimates and may vary"

ORDER NOTES (textarea, optional, max 500):
  "Any special instructions for your order?"

[Continue to Payment] button
  Disabled if: no address filled OR no shipping zone selected
```

### D4 — Step 3: Payment

**`src/components/checkout/PaymentSelector.tsx`**
```
CURRENCY SELECTOR (top):
  3 chips: ₦ NGN | $ USD | £ GBP
  Selected: wine bg, ivory text
  Affects: which gateways show, price display in summary
  Updates currencyStore (and local state for gateway visibility)

PAYMENT METHODS (radio cards):
  
  Show/hide rules:
    PAYSTACK:    show if currency === NGN
    FLUTTERWAVE: show always (supports all 3)
    STRIPE:      show if currency === USD or GBP
    MONNIFY:     show if currency === NGN
  
  Each card:
    Radio indicator (left)
    Gateway logo (SVG or text fallback)
    Name + short description
    
    PAYSTACK:    "Pay with card or bank transfer · Nigeria"
    FLUTTERWAVE: "Cards, mobile money, USSD · All currencies"  
    STRIPE:      "International cards · USD & GBP"
    MONNIFY:     "Bank transfer & USSD · Nigeria"
    
    Selected: wine border (2px), wine radio dot

[Pay ₦XX,XXX Now] button (or $ / £ equivalent):
  Full-width, large, wine/gold
  Shows amount in selected currency
  Disabled if: no gateway selected OR isSubmitting
  
  On click:
    1. Set isSubmitting = true
    2. POST /api/orders/create with all checkout state
    3. Get { orderId, orderNumber, totalNGN }
    4. Based on selected gateway:
    
       PAYSTACK:
         POST /api/payment/paystack/initiate { orderId }
         Get { authorizationUrl }
         window.location.href = authorizationUrl
       
       FLUTTERWAVE:
         POST /api/payment/flutterwave/initiate { orderId, currency }
         Get { paymentLink }
         window.location.href = paymentLink
       
       STRIPE:
         POST /api/payment/stripe/initiate { orderId, currency }
         Get { clientSecret }
         Load Stripe Elements inline (or redirect to Stripe-hosted page)
         // For simplicity: use Stripe Payment Link or redirect mode
         // Full Stripe Elements is complex — use PaymentIntent + redirect
       
       MONNIFY:
         POST /api/payment/monnify/initiate { orderId }
         Get { checkoutUrl }
         window.location.href = checkoutUrl
    
    5. Set isSubmitting = false on any error
    6. Show toast error if any step fails

SECURITY NOTE (below button):
  🔒 icon + "256-bit SSL secured · Your payment is encrypted"
  Small row of accepted card icons (Visa, Mastercard, Verve text labels)
```

### D5 — Order Summary (right panel)

**`src/components/checkout/OrderSummary.tsx`**
```typescript
// Props: { cartItems, couponResult, pointsToRedeem, shippingOption, currency, rates, step }
// Recalculates everything client-side for display (server recalculates for real on submit)

// Collapse/expand on mobile (accordion behavior)

ITEMS LIST (step > 1 ? collapsed summary count : full list):
  Full list: image thumbnail 48×60 + name + size + qty × price
  Collapsed: "[X] items" with expand link

PRICING BREAKDOWN:
  Subtotal:              ₦XXX,XXX
  Shipping:              ₦X,XXX  OR  "Free" (gold) OR "--" (not selected yet)
  Coupon discount:      -₦X,XXX (green, only if coupon applied)
  Points discount:      -₦X,XXX (gold, only if points used)
  ─────────────────────────────
  Total:                 ₦XXX,XXX (bold, Display S)
  
  Currency equivalents (if NGN selected):
    "≈ $XXX · £XXX" (small, grey, below total)

POINTS EARN PREVIEW:
  Gold pill at bottom: "🌟 Earn ~[X] points with this order"
  X = Math.floor(totalNGN / 100)
  Only show if step < 3 (before payment)
```

---

## TASK E — CHECKOUT SUCCESS PAGE

**`src/app/(storefront)/checkout/success/page.tsx`** (client component)
```typescript
// URL: /checkout/success?order=[orderNumber]
// If no orderNumber param: redirect to /shop

// Fetch order: GET /api/orders/[orderNumber] (create this route below)
// If order not found: show generic success (don't 404)
```

```
Page layout: centered, max-w-lg mx-auto, padding 80px 20px, text-center

Animated checkmark (Framer Motion):
  SVG circle (wine stroke, strokeWidth 2, r=40)
  SVG path: checkmark "M 20 40 L 35 55 L 60 25"
  Use Framer Motion pathLength: 0 → 1, delay 200ms, duration 600ms
  Circle draws first (duration 400ms), then check (400ms)

Below checkmark:
  "Order Placed!" (Display M, Cormorant, wine)
  "#[orderNumber]" (font-label, gold, large)
  "A confirmation email has been sent to [email]"
  
  ORDER SUMMARY CARD (bordered, ivory-dark bg, text-left):
    Each item: name · size · qty · price
    Divider
    Shipping: zone name · cost
    Total: bold
  
  Delivery address (smaller, grey)

Two buttons (flex, gap 4, justify-center, mt-8):
  [Track My Order] → /account/orders (wine)
  [Continue Shopping] → /shop (outlined)

GUEST PROMPT (GuestPrompt.tsx):
  Only show if NOT logged in (useSession().status === 'unauthenticated')
  
  Card (gold border, ivory bg, margin-top 32px):
    "💡 Save your order history and earn loyalty points"
    "Create a free account using the same email address to access your orders."
    [Create Account →] → /auth/register?email=[guestEmail] (wine button)
    [No thanks] link (small, grey, dismisses card)

CONFETTI on mount:
  import confetti from 'canvas-confetti'
  On component mount (useEffect, once):
  confetti({
    particleCount: 100,
    spread: 70,
    colors: ['#6B1C2A', '#C9A84C', '#FAF6EF'],
    origin: { y: 0.3 }
  })
```

**`src/app/api/orders/[orderNumber]/route.ts`** (GET)
```typescript
// Auth: verify order belongs to session user OR guestEmail matches session (basic check)
// Fetch order with items (include product name, variant size)
// Return order details for success page
// Public enough for success page redirect — don't expose sensitive payment details
```

---

## TASK F — ACCOUNT DASHBOARD

### F1 — Account Layout

**`src/app/(account)/layout.tsx`** — Replace the shell with full implementation.

```typescript
// Server component
// auth() — if no session: redirect to /auth/login?callbackUrl=/account
// Pass session to client layout
```

**`src/components/account/AccountLayout.tsx`** (client component)
```
Overall: flex, min-h-screen

SIDEBAR (desktop, 260px, fixed or sticky):
  bg-charcoal, text-ivory
  
  TOP: User card
    Avatar: if user.image → next/image 48×48 rounded-full
            else → initials circle (wine bg, gold initials, 48×48)
    Name (DM Sans, 14px, ivory, font-medium)
    Role badge: if ADMIN/SUPER_ADMIN → "Admin" badge (gold)
    Points: "[X] pts" (font-label, 11px, gold)
  
  NAV ITEMS (mt-8):
    Each: flex items-center gap-3, padding 10px 16px, rounded-sm
    Active: bg-wine, text-ivory
    Inactive: text-ivory/60, hover:bg-charcoal-mid hover:text-ivory
    
    Items (icon, label, href):
      LayoutDashboard  "Overview"        /account
      Package          "My Orders"       /account/orders
      Heart            "Wishlist"        /account/wishlist
      Wallet           "Wallet & Points" /account/wallet
      Users            "Referral"        /account/referral
      MapPin           "Addresses"       /account/addresses
      User             "Profile"         /account/profile
      ─── divider ───
      ShoppingBag      "Back to Shop"    /shop
      (if admin): Settings "Admin Panel" /admin
  
  BOTTOM: "Sign out" button (ghost, ivory/60, ChevronRight icon)
    calls signOut({ callbackUrl: '/' })

MOBILE: No sidebar.
  Topbar: back arrow + page title
  Bottom tab bar (5 tabs, fixed bottom):
    Home(Overview) · Orders · Wallet · Referral · Profile

CONTENT: flex-1, overflow-y-auto, bg-ivory, padding 40px (desktop) / 20px (mobile)
```

### F2 — Account Overview

**`src/app/(account)/account/page.tsx`** — Replace shell.

```typescript
// Server component
// auth() to get session
// Fetch in parallel (Promise.all):
//   1. Recent orders: last 3 (prisma.order.findMany { where userId, orderBy createdAt desc, take 3 })
//   2. Wishlist count: prisma.wishlistItem.count { where userId }
//   3. Referral count: prisma.user.count { where referredById: userId }
//   4. User with points: prisma.user.findUnique { where id, select: pointsBalance, firstName }
```

```
GREETING:
  Time-based: Good morning/afternoon/evening
  "[firstName]" (Display S, Cormorant, wine)
  Subtext: "Welcome to your Prudential Atelier account."

STATS ROW (4 cards, grid 2×2 mobile / 4×1 desktop):
  Each card: bg-cream, border-border, padding 20px, rounded-sm
  
  Card 1: Total Orders
    Number (Display S, wine) + "Orders"
    Icon: Package (gold)
  
  Card 2: Points Balance
    "[X] pts" (Display S, gold) + "Store Credit"
    "= ₦[X]" (small, charcoal-mid)
    Icon: Zap (wine)
  
  Card 3: Wishlist Items
    Number (Display S, wine) + "Saved"
    Icon: Heart (gold)
  
  Card 4: Referrals
    Number (Display S, gold) + "Friends Referred"
    Icon: Users (wine)

RECENT ORDERS:
  "Recent Orders" heading (Heading M) + [View All] link
  
  3 order mini-cards:
    Left: order number (font-label, gold) + date (small grey)
    Middle: item count + product name snippet
    Right: total (font-medium) + Status badge
    [→] arrow (links to /account/orders/[id])
    
    Status badge colors:
      PENDING:    grey bg, charcoal text
      CONFIRMED:  blue bg/10, blue text
      PROCESSING: gold bg/20, gold-dark text
      SHIPPED:    purple bg/10, purple text
      DELIVERED:  green bg/10, green text
      CANCELLED:  red bg/10, red text
  
  Empty state: "No orders yet" + [Start Shopping] button

QUICK ACTIONS row:
  3 buttons: [Shop Now] [Book Bespoke] [Invite Friends →]
```

### F3 — Orders Pages

**`src/app/(account)/account/orders/page.tsx`**
```typescript
// Server: fetch all orders for userId
// Include: items (take 1, include product images.primary)
// OrderBy: createdAt desc
// Show full table
```

```
"My Orders" heading + item count

Table (mobile: cards, desktop: table):
  Columns: Order # | Date | Item Preview | Total | Status | Action
  Item preview: stacked thumbnails (max 3 images, overlap effect)
  
  Mobile card:
    Row 1: Order # + Status badge
    Row 2: Date + Total
    Row 3: Item previews (3 small images)
    [View Details] button
  
  Empty: "No orders yet" + [Browse Collection]
```

**`src/app/(account)/account/orders/[id]/page.tsx`**
```typescript
// Param: id = orderId (cuid)
// Fetch order + all items + product details + shipping zone
// Verify order.userId === session.user.id
```

```
Back link: ← My Orders

ORDER HEADER:
  Order number (Display S, Cormorant, wine)
  Date placed (small, grey)
  Payment status badge + Order status badge

ORDER TIMELINE (OrderTimeline.tsx):
  Horizontal steps (vertical on mobile):
    Placed → Confirmed → Processing → Shipped → Delivered
  
  Completed steps: wine filled circle + gold checkmark
  Current step: wine filled circle + animated pulse ring
  Future steps: grey outline circle
  Connector lines: wine if completed, grey if not
  
  Below current step: small date if known (paidAt, etc.)

ORDER ITEMS table:
  Image | Name | Size | Color | Qty | Unit Price | Total
  Each row: clean, borderless table style

PRICING SUMMARY (right-aligned card):
  Subtotal, Shipping, Coupon discount (-), Points discount (-), Total

DELIVERY DETAILS card:
  Address snapshot (display nicely)
  Shipping zone + estimated days

PAYMENT card:
  Gateway name + reference (last 6 chars if long)
  Status badge

NOTES (if order.notes):
  "Your note: [notes]"

FOOTER ACTIONS:
  "Need help with this order?" → mailto:hello@prudentialatelier.com?subject=Order #[number]
```

### F4 — Wishlist Page

**`src/app/(account)/account/wishlist/page.tsx`**
```typescript
// Server: fetch wishlist items with products (images, variants)
// Pass to client component
```

```
"My Wishlist ([count])" heading

Grid of ProductCard components (same as shop)
  Extra action on each card: [Move to Bag] button (below card)
    On click: cartStore.addItem + DELETE /api/wishlist?productId + remove from local wishlist state

Empty state:
  Heart icon (wine, 64px)
  "Nothing saved yet"
  "Tap the heart on any piece to save it here."
  [Browse Collection] button
```

### F5 — Wallet Page

**`src/app/(account)/account/wallet/page.tsx`**
```typescript
// Server: fetch user.pointsBalance + pointsTransactions (orderBy createdAt desc, take 50)
```

```
WALLET BALANCE CARD (full-width):
  bg: linear-gradient(135deg, #6B1C2A, #4A1019)
  Padding 40px, rounded-sm
  
  "Your Loyalty Wallet" (font-label, ivory/60)
  Points number: "[X]" (Display L, Cormorant italic, gold)
  "points" (font-label, ivory/60)
  
  Value row: "= ₦[X] store credit" (Body L, ivory)
  Equivalents: "≈ $[X] · £[X]" (small, ivory/50)
  
  [Shop & Earn More] button (gold outlined, right side)

HOW POINTS WORK card (below wallet card):
  4 rows (icon + label + value):
    🛍️ Purchase:   Earn 1 point per ₦100 spent
    👥 Refer:       Earn 250 pts when a friend signs up
    🎁 Be Referred: Receive 500 pts as a new member
    ⭐ Review:      Earn 50 pts for a verified review

POINTS HISTORY:
  "Transaction History" heading
  
  Table (or list on mobile):
    Date | Description | Amount | Type | Balance
    
    Type badges:
      EARNED_PURCHASE:  gold bg, "Earned"
      EARNED_REFERRAL:  green bg/10, green text, "Referral"
      EARNED_SIGNUP:    green bg/10, green text, "Welcome"
      EARNED_REVIEW:    blue bg/10, "Review"
      REDEEMED:         wine bg/10, wine text, "Redeemed"
      ADJUSTED_ADMIN:   grey, "Adjusted"
    
    Amount: + prefix for earned (gold), - prefix for redeemed (wine)
  
  Pagination: show 15 per page
  Empty: "No transactions yet. Start shopping to earn points!"
```

### F6 — Referral Page

**`src/app/(account)/account/referral/page.tsx`**
```typescript
// Server: 
//   fetch user referralCode
//   fetch referred users: prisma.user.findMany({ where: { referredById: userId }, select: { firstName, createdAt, orders: { select: { id } } } })
//   fetch referral points: prisma.pointsTransaction.findMany where type in [EARNED_REFERRAL] for userId
```

```
HOW IT WORKS (3 steps row):
  01: Share your link
      "Send your unique referral link to friends"
  02: Friend signs up  
      "They get 500 pts · You get 250 pts"
  03: Friend shops
      "You earn 10% of their first order in points"

REFERRAL LINK CARD (wine gradient bg):
  "Your referral link" (font-label, ivory/60)
  URL: big monospace display — https://[APP_URL]/ref/[referralCode]
  
  3 action buttons:
    [📋 Copy Link] — uses navigator.clipboard.writeText, toast "Copied! ✓"
    [💬 Share on WhatsApp] — href="https://wa.me/?text=I found the most amazing Nigerian fashion brand...%0A%0Ahttps://[url]"
    [📤 Share] — native Web Share API if available, else copy fallback

STATS ROW (3 cards):
  Total Referrals | Points from Referrals | Successful Purchases

REFERRALS TABLE:
  Name (first name + last initial for privacy e.g. "Chidinma E.")
  Joined date
  Orders placed (count)
  Status: "Signed Up" | "Has Shopped" (gold if shopped)
  
  Empty: "Share your link to start earning!"
```

### F7 — Addresses Page

**`src/app/(account)/account/addresses/page.tsx`**
```typescript
// Server: fetch addresses for userId
// Client component for CRUD
```

```
Grid (3-col desktop, 2-col tablet, 1-col mobile):

Each address card (bg-cream, border-border):
  Top-right: "Default" badge (wine, if isDefault)
  Label badge (Home/Office/etc., gold outlined)
  Name, Phone
  Full address (line1, line2?, city, state, country)
  
  Bottom actions row:
    [Edit] (grey text) | [Delete] (red text) | [Set Default] (only if not default)

ADD NEW card (dashed border, centered):
  + icon (large, wine)
  "Add New Address"
  onClick: open AddressModal in 'create' mode

AddressModal (Radix Dialog):
  Title: "Add Address" / "Edit Address"
  Form: React Hook Form + addressSchema
  [Save Address] button
  API: POST/PATCH /api/account/addresses
```

### F8 — Profile Page

**`src/app/(account)/account/profile/page.tsx`**

```
Two-card layout:

PERSONAL INFO CARD:
  Avatar section:
    Circle 80×80, if image → next/image, else initials (wine bg, gold text, 28px Cormorant)
    [Change Photo] button below → opens Cloudinary widget OR file input
    If file input: POST /api/admin/upload → get URL → display preview
  
  Form (React Hook Form):
    First Name, Last Name (side by side)
    Email (disabled — show lock icon, "Contact support to change")
    Phone
    [Save Changes] button (wine)
  
  API: PATCH /api/account/profile

SECURITY CARD:
  Title: "Change Password"
  Form (separate, React Hook Form):
    Current Password
    New Password (show strength indicator)
    Confirm New Password
    [Update Password] button
  
  Password Strength Indicator:
    Weak (< 8 chars or no mix): red
    Fair (8+ with some mix): amber
    Strong (12+ mixed): green
  
  API: PATCH /api/account/profile/password
```

### F9 — Account API Routes

**`src/app/api/account/profile/route.ts`** (GET, PATCH)
```typescript
// GET: return current user { firstName, lastName, email, phone, image, pointsBalance, referralCode }
// PATCH: validate { firstName?, lastName?, phone?, image? } with Zod
//   Update user — never allow email or role change via this route
//   Return updated user
```

**`src/app/api/account/profile/password/route.ts`** (PATCH)
```typescript
// Body: { currentPassword, newPassword, confirmPassword }
// Validate: newPassword === confirmPassword
// Verify currentPassword: bcrypt.compare(currentPassword, user.password)
// Hash new: bcrypt.hash(newPassword, 12)
// Update user.password
// Return { success: true }
// Never return password hash in response
```

**`src/app/api/account/orders/route.ts`** (GET)
```typescript
// Auth required
// Query: page (default 1), limit (default 20)
// Fetch orders for userId, orderBy createdAt desc
// Include: items (take 2, include product: { images where isPrimary })
// Return: { orders, total, page, totalPages }
```

**`src/app/api/account/orders/[id]/route.ts`** (GET)
```typescript
// Fetch by orderId
// Verify order.userId === session.user.id
// Include ALL: items.product.images, shippingZone, coupon
// Return full order
```

**`src/app/api/account/addresses/route.ts`** (GET, POST)
```typescript
// GET: list all addresses for user
// POST: create address (addressSchema)
//   If isDefault: set all other addresses isDefault: false first ($transaction)
//   Create new address
```

**`src/app/api/account/addresses/[id]/route.ts`** (PATCH, DELETE)
```typescript
// PATCH: update address (partial addressSchema)
//   If setting isDefault: clear others first
// DELETE: delete address
//   Cannot delete if it's the only address
// Both: verify address.userId === session.user.id
```

**`src/app/api/account/wallet/route.ts`** (GET)
```typescript
// Return: { pointsBalance, pointsNGN: pointsBalance * 1, transactions: PointsTransaction[] (last 50) }
// Paginated: ?page=1&limit=15
```

---

## TASK G — SHARED UI COMPONENTS NEEDED FOR ACCOUNT

**`src/components/account/OrderTimeline.tsx`**
```typescript
// Props: { status: OrderStatus }
// Horizontal stepper (vertical on mobile)
// Steps: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED']
// Derive step index from status
// CANCELLED: show red X on current step
```

**`src/components/ui/Input.tsx`** — Check if exists. If not or incomplete, build:
```typescript
// Props: name, label, type, placeholder, error, disabled, icon (left), suffix (right)
// Floating label pattern: label absolutely positioned, moves up on focus/filled
// Bottom border only (1px solid border, wine on focus)
// Error: red underline + error message below
// Password: toggle show/hide with Eye/EyeOff Lucide icon
```

**`src/components/ui/Modal.tsx`** — Check if exists. If not:
```typescript
// Wraps Radix Dialog
// Props: open, onClose, title, description?, children, size ('sm'|'md'|'lg'|'xl')
// Framer Motion: scale 0.96→1 + opacity, 250ms easeOut
// Backdrop: charcoal/60
// X close button top-right
```

**`src/components/ui/Tabs.tsx`** — Check if exists. If not:
```typescript
// Wraps Radix Tabs
// Props: tabs: { label, value, content }[]
// Style: underline tabs (not pill), wine active underline 2px
```

---

## TASK H — BESPOKE PAGE

**`src/app/(storefront)/bespoke/page.tsx`** — Replace stub with full implementation.

```typescript
// This is a client component (multi-step form needs state)
```

```
HERO (400px):
  Background: editorial image (bridal/atelier)
  Dark overlay
  Centered:
    SectionLabel: "THE ATELIER"
    h1 (Display L, ivory italic): "Your Vision,<br/>Our Craft."
    p (ivory/70): "Every bespoke piece begins with a conversation."

HOW IT WORKS (4-step horizontal timeline, bg-ivory-dark, padding 60px):
  01 → Consultation
  02 → Design & Fabric
  03 → Fitting
  04 → Delivery
  
  Each: number (Cormorant, 40px, wine/30) + title + 1-line description
  Connector line between each (1px, gold/30)

BESPOKE FORM (BespokeForm.tsx):
  3-step form with progress bar (wine fill, ivory bg)

  Step 1 — "About You":
    Full Name, Email, Phone, Country (select, default Nigeria)
    How did you hear about us? (select: Instagram, TikTok, Referral, Google, Word of Mouth, Other)
  
  Step 2 — "Your Piece":
    Occasion (select: White Wedding, Traditional Wedding, Wedding Guest, Corporate Event, Birthday, Naming Ceremony, Graduation, Other)
    Description (textarea, min 20 chars, "Tell us about your dream piece...")
    Budget Range (select: Under ₦200k, ₦200k–₦500k, ₦500k–₦1M, Above ₦1M)
    Timeline (select: Under 2 weeks, 2–4 weeks, 1–2 months, 3+ months)
    Reference Images (optional):
      File input, multiple, accept="image/*", max 5 files
      Preview thumbnails before submit
      On submit: upload to /api/admin/upload → get URLs → include in form data
  
  Step 3 — "Measurements" (optional):
    Note: "Don't know your measurements? We'll guide you at your fitting."
    Fields: Bust (cm), Waist (cm), Hips (cm), Height (cm), Additional notes
    Preferred consultation date (date picker, min: tomorrow)
    Checkbox: "I agree to a consultation fee of ₦10,000 (refundable on order)"

  On submit: POST /api/bespoke
  Success: replace form with:
    Animated checkmark (same as checkout success)
    "Request Received! #[requestNumber]"
    "Our team will contact you within 24–48 hours."
    [Back to Shop] button

GALLERY (bottom):
  "Previous Bespoke Work" heading
  6-image masonry grid (2 cols, varied heights)
  Use seed product images as placeholders
  On hover: wine overlay + "Bespoke" label
```

**`src/app/api/bespoke/route.ts`** (POST)
```typescript
// No auth required (guests can submit)
// Validate with bespokeRequestSchema (create in src/validations/bespoke.ts)
// Generate requestNumber: generateBespokeNumber()
// Create BespokeRequest
// Link to userId if session exists
// Send BespokeConfirmationEmail to client
// Send AdminNotificationEmail to ADMIN_EMAIL env var
// Return: { success: true, requestNumber }
```

**`src/validations/bespoke.ts`**
```typescript
// bespokeRequestSchema: z.object({
//   name: z.string().min(2),
//   email: z.string().email(),
//   phone: z.string().min(7),
//   country: z.string().min(2),
//   source: z.string().optional(),
//   occasion: z.string().min(1),
//   description: z.string().min(20),
//   budgetRange: z.string().min(1),
//   timeline: z.string().min(1),
//   referenceImages: z.array(z.string().url()).max(5).optional().default([]),
//   measurements: z.object({
//     bust: z.string().optional(),
//     waist: z.string().optional(),
//     hips: z.string().optional(),
//     height: z.string().optional(),
//     notes: z.string().optional(),
//   }).optional(),
//   preferredDate: z.coerce.date().optional(),
// })
```

---

## TASK I — OUR STORY PAGE

**`src/app/(storefront)/our-story/page.tsx`** (Server Component, revalidate: 3600)

```
HERO: Full-bleed image overlay
  src: https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=1400
  Overlay: charcoal/70
  Centered:
    SectionLabel (ivory): "EST. 2019 · LAGOS, NIGERIA"
    h1 (Display XL, ivory, Cormorant italic): "A Stitch<br/>in Time"

SECTION 1 — "From Ajah to the World" (split layout, text left, image right):
  Text content (Cormorant heading + DM Sans body):
    "What began in 2018 with a borrowed sewing machine and a spoiled dress,
     became one of Nigeria's most celebrated fashion ateliers."
  Pull quote (Cormorant italic, 24px, wine):
    "I didn't plan to be a fashion designer. 
     I just couldn't let a spoiled dress defeat me."

SECTION 2 — Founder Spotlight (charcoal bg, ivory text):
  Split: image left (portrait), content right
  Name: "Mrs. Prudent Gabriel-Okopi" (Display M, Cormorant, gold)
  Title: (font-label, ivory/60): "Founder & Creative Director, Prudential Atelier"
  Bio paragraphs: career journey, values
  
  Notable clients row:
    SectionLabel (gold): "DRESSED FOR THEIR GREATEST MOMENTS"
    Names grid (2×3, gold text, font-label):
      Peggy Ovire · Mercy Chinwo · Mabel Makun
      Liquor Rose · Mary Lazarus · Miss Universe South Africa 2024

SECTION 3 — Stats Row (bg-wine):
  Same as homepage BrandStats but without animation (server-rendered)
  5,000+ Graduates · 2019 Est. · 85+ Team Members · 4 Continents

SECTION 4 — PFA Academy Callout (bg-ivory-dark):
  Large centered block:
    SectionLabel: "BEYOND THE ATELIER"
    h2 (Display M, Cormorant): "Training the Next Generation"
    p: "Through Prudential Fashion Academy, Mrs. Gabriel-Okopi has trained
        over 5,000 designers from across Nigeria and beyond."
    [Visit PFA Academy →] button → https://pfacademy.ng (new tab, gold)

PFABanner at bottom
```

---

## TASK J — REMAINING STATIC PAGES

**`src/app/(storefront)/contact/page.tsx`**
```
Split layout (60/40 desktop, stacked mobile):

LEFT — Contact Form:
  h1: "Get in Touch"
  Subtext: "We'd love to hear from you."
  
  React Hook Form:
    Name, Email, Subject (select: General, Order Enquiry, Press, Bespoke, Other), Message
    [Send Message] button
    
  POST /api/contact → just sends email to ADMIN_EMAIL
  Success: "Message sent! We'll respond within 24 hours. ✓"

RIGHT — Contact Info:
  Wine bg card, ivory text, padding 40px
  
  📍 Address:
     "Prudential Atelier, Lagos, Nigeria"
  
  📧 Email:
     hello@prudentialatelier.com (mailto link)
  
  📱 Instagram:
     @prudent_gabriel (link to Instagram)
  
  🕐 Hours:
     "Monday – Saturday: 9am – 6pm (WAT)"
     "Sunday: Closed"
  
  Social icons row: Instagram, TikTok, Facebook (from SocialIcons.tsx)
```

**`src/app/api/contact/route.ts`** (POST)
```typescript
// Body: { name, email, subject, message }
// Validate with Zod
// sendEmail to ADMIN_EMAIL with subject + content
// Return { success: true }
```

**`src/app/(storefront)/legal/privacy/page.tsx`**
**`src/app/(storefront)/legal/terms/page.tsx`**
**`src/app/(storefront)/legal/returns/page.tsx`**
```
All legal pages: same layout
  Max-w-3xl mx-auto, padding top 80px bottom 120px
  h1 (Display M, Cormorant, wine)
  Last updated date (small, grey)
  Prose content (DM Sans, 16px, charcoal, line-height 1.8)
  
  Content: Use realistic placeholder text appropriate for a Nigerian fashion brand
  
  Privacy: data collection, Cloudinary storage, cookies, rights
  Terms: order acceptance, payment, intellectual property, jurisdiction (Lagos, Nigeria)
  Returns: 14-day policy, original packaging required, bespoke items non-returnable
```

**`src/app/not-found.tsx`** (if not exists or minimal)
```
Full screen, bg-wine
Large "404" (Display XL, Cormorant italic, gold, opacity 0.3, position absolute centered)
Content over it:
  "This page has left the atelier." (Display M, Cormorant, ivory)
  "The piece you're looking for may have been moved or discontinued." (Body M, ivory/70)
  
  Two buttons:
    [Return Home] → / (ivory filled)
    [Browse Collections] → /shop (ivory outlined)
  
  Framer Motion entrance: fade up
```

---

## FINAL CHECKS

After completing all tasks:

1. `npx prisma generate` (after any schema changes)
2. `npx tsc --noEmit` — must pass with zero errors
3. `npx next build` — must succeed
4. Verify these routes render without 500:
   - `/checkout` — full 3-step checkout
   - `/checkout/success?order=PA-24-00001` — success page
   - `/account` — dashboard (logged in as amara@example.com)
   - `/account/orders` — order list
   - `/account/wallet` — points history
   - `/account/referral` — referral page
   - `/bespoke` — form loads
   - `/our-story` — full page
5. Verify API routes:
   - `POST /api/coupons/validate` with `{ code: "WELCOME10", subtotalNGN: 100000, email: "test@test.com", cartLines: [] }` → returns `{ valid: true, discountNGN: 10000 }`
   - `POST /api/shipping/calculate` with Lagos address → returns options
   - `GET /api/account/wallet` (authenticated) → returns points data

---

## SESSION END SUMMARY FORMAT

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SESSION 3 COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Task A — All library files (coupon, shipping, points, payments, email)
✅ Task B — Validation schemas (order, coupon, bespoke)
✅ Task C — Checkout API (coupon validate, shipping calc, order create, all 4 payment gateways)
✅ Task D — Checkout UI (3-step flow, all components)
✅ Task E — Success page (confetti, guest prompt)
✅ Task F — Account dashboard (all 7 pages + all API routes)
✅ Task G — Shared UI components (Input, Modal, Tabs, OrderTimeline)
✅ Task H — Bespoke page (3-step form + API)
✅ Task I — Our Story page
✅ Task J — Contact, Legal pages, 404

NEXT SESSION (Session 4):
  - Stage 7: Admin Dashboard (products CRUD, orders, bespoke, coupons, reviews, analytics)
  - Stage 9: Email templates (React Email)
  Begin with: Admin layout, Analytics dashboard, Product form with VariantManager
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

*Prudential Atelier · Cursor Session 3*
*Prepared by Nony | SonsHub Media*
