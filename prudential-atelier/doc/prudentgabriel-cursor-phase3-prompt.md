# CURSOR AI — PRUDENTGABRIEL.COM
## Phase 3: Payment Infrastructure + Client Auto-Onboarding
### Prepared by SonsHub Media Ltd (Nony — Okafor Chinonso Daniel)

---

## CRITICAL INSTRUCTIONS — READ BEFORE WRITING A SINGLE LINE

1. This is **Phase 3** of a 5-phase build. Phases 1, 2A, and 2B are complete and live on Vercel.
2. **DO NOT touch any existing model** in `prisma/schema.prisma` except to add new fields where explicitly instructed.
3. **DO NOT modify** any existing pages or components unless explicitly told to extend them.
4. All payment flows must work in **test mode first**. All gateway keys in `.env.local` and Vercel are test keys. Do not hardcode any keys.
5. Every payment must create a record in the existing `Order` or `ConsultationBooking` or `BespokeOrder` model — no payment should exist without a linked record.
6. Bank transfer receipt upload uses **Cloudinary** — same upload utility already in the project.
7. Read the entire prompt before writing any code.
8. Design system unchanged — Cormorant Garamond + Lora + Jost, chocolate/cream palette.

---

## ENVIRONMENT VARIABLES REQUIRED

Confirm these are set in Vercel and `.env.local`:

```env
# Paystack
PAYSTACK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_...

# Flutterwave
FLUTTERWAVE_SECRET_KEY=FLWSECK_TEST-...
NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY=FLWPUBK_TEST-...

# Stripe
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Monnify
MONNIFY_API_KEY=MK_TEST_...
MONNIFY_SECRET_KEY=...
MONNIFY_CONTRACT_CODE=...
MONNIFY_BASE_URL=https://sandbox.monnify.com

# Bank Transfer
BANK_NAME=Guaranty Trust Bank
BANK_ACCOUNT_NUMBER=0123456789
BANK_ACCOUNT_NAME=Prudential Atelier Limited

# App
NEXT_PUBLIC_APP_URL=https://prudentgabriel.vercel.app
```

---

## PHASE 3 DELIVERABLES

---

### 1. PAYMENT GATEWAY LIBRARY

Build `src/lib/payments/` with one file per gateway:

#### `src/lib/payments/paystack.ts`
```typescript
export async function initializePaystackPayment(params: {
  email: string;
  amount: number; // in kobo (multiply NGN by 100)
  reference: string;
  currency?: 'NGN';
  metadata?: Record<string, unknown>;
  callback_url: string;
}): Promise<{ authorization_url: string; reference: string }>

export async function verifyPaystackPayment(
  reference: string
): Promise<{
  status: 'success' | 'failed' | 'abandoned';
  amount: number; // in kobo
  currency: string;
  reference: string;
  paidAt: string;
  metadata: Record<string, unknown>;
}>
```

#### `src/lib/payments/flutterwave.ts`
```typescript
export async function initializeFlutterwavePayment(params: {
  email: string;
  amount: number; // in NGN, USD, or GBP
  currency: 'NGN' | 'USD' | 'GBP';
  reference: string;
  name: string;
  phone?: string;
  redirect_url: string;
  meta?: Record<string, unknown>;
}): Promise<{ payment_link: string; reference: string }>

export async function verifyFlutterwavePayment(
  transactionId: string
): Promise<{
  status: 'successful' | 'failed' | 'pending';
  amount: number;
  currency: string;
  reference: string;
  charged_amount: number;
}>
```

#### `src/lib/payments/stripe.ts`
```typescript
export async function createStripePaymentIntent(params: {
  amount: number; // in smallest currency unit (cents/pence)
  currency: 'usd' | 'gbp';
  metadata?: Record<string, string>;
  description?: string;
}): Promise<{ clientSecret: string; paymentIntentId: string }>

export async function retrieveStripePaymentIntent(
  paymentIntentId: string
): Promise<{
  status: string;
  amount: number;
  currency: string;
}>
```

#### `src/lib/payments/monnify.ts`
```typescript
export async function getMonnifyAccessToken(): Promise<string>

export async function initializeMonnifyPayment(params: {
  amount: number;
  currency: 'NGN';
  reference: string;
  email: string;
  name: string;
  description: string;
  redirect_url: string;
}): Promise<{ checkout_url: string; reference: string }>

export async function verifyMonnifyPayment(
  reference: string
): Promise<{
  status: 'PAID' | 'PENDING' | 'FAILED' | 'OVERPAID';
  amount: number;
  reference: string;
}>
```

#### `src/lib/payments/index.ts`
Central payment utility:
```typescript
export type PaymentGateway = 
  'PAYSTACK' | 'FLUTTERWAVE' | 'STRIPE' | 'MONNIFY' | 'BANK_TRANSFER';

export type Currency = 'NGN' | 'USD' | 'GBP';

export function generatePaymentReference(prefix: string): string {
  // e.g. "PA-CONSULT-1717459200-ABC123"
  return `PA-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
}

export function toKobo(ngn: number): number {
  return Math.round(ngn * 100);
}

export function fromKobo(kobo: number): number {
  return kobo / 100;
}

// Determine which gateways support a given currency
export function getSupportedGateways(currency: Currency): PaymentGateway[] {
  if (currency === 'NGN') 
    return ['PAYSTACK', 'FLUTTERWAVE', 'MONNIFY', 'BANK_TRANSFER'];
  if (currency === 'USD') 
    return ['FLUTTERWAVE', 'STRIPE'];
  if (currency === 'GBP') 
    return ['FLUTTERWAVE', 'STRIPE'];
  return [];
}
```

---

### 2. PAYMENT METHOD SELECTOR COMPONENT

Build `src/components/checkout/PaymentMethodSelector.tsx`:

A reusable component used across all payment surfaces (RTW checkout, consultation booking, bespoke balance payment).

```
Props:
  currency: 'NGN' | 'USD' | 'GBP'
  amount: number
  onSelect: (gateway: PaymentGateway) => void
  selected: PaymentGateway | null
```

**Design:**
- Section label: "HOW WOULD YOU LIKE TO PAY?" (Jost 10px uppercase, var(--lightbr))
- Gateway cards in a vertical list, each selectable:

```
┌─────────────────────────────────────────────┐
│  ○  [Icon]  Card Payment              NGN   │  ← Paystack
│             Visa, Mastercard, Verve          │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│  ○  [Icon]  Pay with Flutterwave      NGN   │
│             Cards, Mobile Money, Bank        │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│  ○  [Icon]  International Card       USD/£  │  ← Stripe
│             Visa, Mastercard                 │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│  ○  [Icon]  Bank Transfer / USSD      NGN   │  ← Monnify
│             Direct bank payment              │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│  ○  [Icon]  Direct Bank Transfer      NGN   │
│             Upload proof of payment          │
└─────────────────────────────────────────────┘
```

- Selected card: border 1.5px solid var(--choc), 
  radio filled var(--nut), background rgba(68,41,19,0.04)
- Unselected: border 0.5px solid var(--sand), background white
- Only show gateways supported by the selected currency
- Stripe only shown for USD/GBP orders
- All others shown for NGN

**Bank Transfer selected state:**
When Bank Transfer is selected, expand a section below:
```
┌─────────────────────────────────────────────┐
│  Bank: Guaranty Trust Bank                  │
│  Account: 0123456789                        │
│  Name: Prudential Atelier Limited           │
│  Amount: ₦150,000                          │
│                                             │
│  [Upload Payment Receipt]                  │
│  Accepted: JPG, PNG, PDF · Max 5MB         │
│                                             │
│  After uploading, click confirm below.      │
│  Our team will verify within 2–4 hours.     │
└─────────────────────────────────────────────┘
```
- Bank details read from env vars
- Receipt upload via Cloudinary
- `onReceiptUploaded: (url: string) => void` callback

---

### 3. RTW SHOP — FULL CHECKOUT FLOW

#### 3a. Product Detail Page (`/shop/[slug]`)

Build `src/app/(public)/shop/[slug]/page.tsx`:

**Layout (two column):**
Left: product images — main image (portrait 3:4) + thumbnail strip below
Right: product info
- Category label (Jost 10px uppercase, var(--lightbr))
- Product name (Cormorant Garamond 42px)
- Price (Cormorant 28px, var(--choc)) — show NGN by default, 
  with USD/GBP toggle if priceUSD/priceGBP are set
- Description (Lora 14px, line-height 1.85)
- Size selector: pill buttons for each variant
  - Show stock level: "Only 2 left" if stock ≤ 3
  - Disabled + strikethrough if stock = 0
- Color selector (if ProductColor records exist)
- Quantity selector (+ / - buttons, min 1, max stock)
- "ADD TO CART" button (full width, var(--choc) background)
- "ADD TO WISHLIST" link below (heart icon + text)
- Details accordion: Materials, Care Instructions, 
  Delivery & Returns (content from product.details field)

Fetch product server-side by slug. 
If `isPublished = false` → 404.

#### 3b. Cart (`/cart`)

Build `src/app/(public)/cart/page.tsx`:

**Layout:**
Left column (wider): cart items list
Right column: order summary

Cart item row:
- Product image (portrait, 80px wide)
- Product name (Cormorant 18px)
- Size + Color (Jost 11px, var(--text-light))
- Quantity: +/- buttons with inline update
- Price (Jost 13px)
- Remove button (× icon)

Order summary card:
- Subtotal
- Shipping (calculated based on ShippingZone, 
  or "Calculated at checkout" if not yet known)
- Discount (if coupon applied)
- Points discount (if points redeemed)
- Total (Cormorant 24px)
- Coupon code input + "APPLY" button
- Points redemption toggle (if user has points)
- "PROCEED TO CHECKOUT →" button

Cart state managed by Zustand cartStore 
(already in project — extend if needed).
Persist cart to database for logged-in users 
via existing CartItem model.

#### 3c. Checkout (`/checkout`)

3-step checkout: **Details → Payment → Confirmation**

**Step 1 — Details:**
- If logged in: pre-fill from user profile
- Fields: Full Name, Email, Phone
- Shipping address: Street, City, State, Country
  (saves to Address model)
- Order notes (optional textarea)
- "CONTINUE TO PAYMENT →"

**Step 2 — Payment:**
- Order summary (compact, right sidebar)
- Currency selector: NGN / USD / GBP
  - Switching currency updates prices and available gateways
  - Exchange rates read from SiteSetting keys: 
    `exchange_rate_usd` and `exchange_rate_gbp`
- `PaymentMethodSelector` component
- For Paystack/Flutterwave/Monnify: 
  "PAY ₦[amount]" button → calls initialize API → 
  redirects to gateway checkout URL
- For Stripe: Stripe Elements card form embedded inline
  (no redirect — pay in page)
- For Bank Transfer: upload receipt → "CONFIRM ORDER"

**Step 3 — Confirmation:**
- Order confirmed card (dark chocolate background)
- Order number, items summary, delivery estimate
- "Track your order" link → /track/[orderNumber]
- "Continue shopping" link

#### 3d. Payment API Routes for RTW

```
POST /api/checkout/initialize
  Body: { gateway, currency, cartItems, addressId, couponCode, pointsToRedeem }
  Creates Order record with status PENDING
  Initializes payment with chosen gateway
  Returns: { orderId, paymentUrl or clientSecret, reference }

GET /api/checkout/verify?reference=[ref]&gateway=[gateway]
  Verifies payment with gateway
  Updates Order.paymentStatus = PAID
  Updates Order.status = CONFIRMED  
  Deducts stock from ProductVariant
  Awards loyalty points to user
  Sends order confirmation email
  Returns: { success, orderId, orderNumber }

POST /api/checkout/bank-transfer
  Body: { orderId, receiptUrl }
  Saves receipt URL to Order
  Sets Order.paymentStatus = PENDING (awaiting admin confirmation)
  Sends "receipt received" email to client
  Sends admin notification to orders@prudentgabriel.com
  Returns: { success }

POST /api/webhooks/paystack
  Validates Paystack signature
  Handles: charge.success event
  Updates Order or ConsultationBooking paymentStatus
  Logs to ActivityLog

POST /api/webhooks/flutterwave
  Validates Flutterwave signature  
  Handles: charge.completed event
  Same update logic as Paystack webhook

POST /api/webhooks/stripe
  Validates Stripe webhook signature (STRIPE_WEBHOOK_SECRET)
  Handles: payment_intent.succeeded event
  Same update logic

POST /api/webhooks/monnify
  Validates Monnify hash
  Handles: SUCCESSFUL_TRANSACTION event
  Same update logic
```

---

### 4. CONSULTATION BOOKING — PAYMENT INTEGRATION

The consultation booking 3-step wizard at `/consultation` 
already has the UI. Wire the payment step:

**Step 3 — Confirm & Pay:**

Full consultation summary card:
- Type: "In-Person with Mrs. Prudent"
- Date & time selected
- Platform (if virtual)
- Duration
- Price in selected currency

Client details form (if not logged in):
- Name, Email, Phone, Country
- Occasion (what they're dressing for)
- Description (textarea: tell us about your vision)
- Reference images upload (Cloudinary, up to 5 images)

Payment:
- Currency selector: NGN / USD / GBP
- `PaymentMethodSelector` component
- "CONFIRM & PAY →" button

**On successful payment:**
1. Create `ConsultationBooking` record with status `CONFIRMED`
2. Set `paymentStatus = PAID`, `paymentGateway`, `paymentRef`
3. **AUTO-ONBOARD CLIENT** (see Section 6 below)
4. Send booking confirmation email to client
5. Send admin notification to `orders@prudentgabriel.com`
6. Redirect to `/consultation/success?booking=[bookingNumber]`

**Consultation success page** (`/consultation/success`):
- "Booking confirmed" heading (Cormorant 42px)
- Booking details card
- "What happens next" — 3 steps:
  1. You'll receive a confirmation email with your booking details
  2. We'll confirm your exact time within 24 hours
  3. Your meeting link will be sent 1 hour before (if virtual)
- Tracking link: "Follow your commission at [link]" 
  (even before bespoke order is created — links to /track 
  with a "Your consultation is confirmed" state)
- "Return to site" button

**Consultation payment API:**
```
POST /api/consultations/initialize-payment
  Body: { offeringId, consultantId, clientDetails, 
          preferredDates, currency, gateway, referenceImages }
  Creates ConsultationBooking with status PENDING_PAYMENT
  Initializes gateway payment
  Returns: { bookingId, paymentUrl or clientSecret, reference }

GET /api/consultations/verify?reference=[ref]&gateway=[gateway]
  Verifies payment
  Updates ConsultationBooking status → CONFIRMED
  Triggers auto-onboarding
  Sends confirmation email
  Returns: { success, bookingNumber }

POST /api/consultations/bank-transfer
  Body: { bookingId, receiptUrl }
  Sets receipt, status stays PENDING_PAYMENT until admin confirms
```

---

### 5. BESPOKE ORDER BALANCE PAYMENT

From the client dashboard `/account/orders` — 
the "Pay Balance" button on a bespoke order:

**Balance payment page** (`/account/orders/bespoke/[orderId]/pay`):

- Order summary: outfit name, order ref, total, paid, balance
- Currency selector (default NGN)
- Amount to pay input:
  - Default: full balance outstanding
  - Client can pay partial amount (minimum ₦10,000)
- `PaymentMethodSelector` component
- "PAY ₦[amount]" button

**API:**
```
POST /api/bespoke/[orderId]/initialize-payment
  Body: { amount, currency, gateway }
  Validates amount ≤ balance
  Initializes gateway payment
  Returns: { paymentUrl or clientSecret, reference }

GET /api/bespoke/[orderId]/verify-payment?reference=[ref]&gateway=[gateway]
  Verifies with gateway
  Updates BespokeOrder.amountPaid += amount
  Updates BespokeOrder.balance -= amount
  If balance = 0: advances order if stuck at PAYMENT_CONFIRMATION stage
  Sends payment confirmation email
  Logs to ActivityLog
```

---

### 6. CLIENT AUTO-ONBOARDING

This is critical. Every client who books a consultation 
or places an RTW order must get an account automatically.

Build `src/lib/client-onboarding.ts`:

```typescript
export async function autoOnboardClient(params: {
  name: string;
  email: string;
  phone?: string;
  source: 'CONSULTATION' | 'RTW_ORDER' | 'BESPOKE_ORDER';
  sourceId: string; // bookingId or orderId
}): Promise<{ userId: string; isNew: boolean; tempPassword?: string }>
```

Logic:
1. Check if `User` with this email already exists
2. **If exists:** link the booking/order to their account, 
   return `{ userId, isNew: false }`
3. **If new:**
   - Generate memorable temporary password:
     ```typescript
     const WORDS = ['AMBER', 'CORAL', 'IVORY', 'VELVET', 'SILK', 
                    'LINEN', 'SATIN', 'PEARL', 'ROUGE', 'EBONY'];
     const word = WORDS[Math.floor(Math.random() * WORDS.length)];
     const num = Math.floor(1000 + Math.random() * 9000);
     const tempPassword = `${word}-${num}`; // e.g. "SILK-4821"
     ```
   - Hash password with bcrypt
   - Create `User` record: name, email, phone, 
     role: CUSTOMER, password: hashedTempPassword,
     referralCode: auto-generated (already default)
   - Create `ClientProfile` linked to user
   - Award signup loyalty points 
     (from LoyaltyRule where action = 'SIGNUP')
   - Create `PointsTransaction` record
   - Send **welcome + credentials email**
   - Return `{ userId, isNew: true, tempPassword }`

**Welcome + credentials email template:**

Subject: "Welcome to Prudential Atelier — your account is ready"

```
[PRUDENTIAL ATELIER logo]

Welcome, [firstName].

Your account has been created so you can follow 
your [consultation / order] with us.

---

YOUR LOGIN DETAILS

Email: [email]
Temporary password: [SILK-4821]

→ Log in at prudentgabriel.com/login

---

TRACK YOUR ORDER (no login needed)

Follow your commission at any time:
[large button] → TRACK MY ORDER

---

ONCE YOU'RE LOGGED IN, YOU CAN:
✓ See your measurements saved forever
✓ View your moodboard and design references  
✓ Earn loyalty points on every order
✓ Refer friends and earn ₦5,000 credit
✓ Book your next consultation in seconds

---

[Footer: Prudential Atelier · Developed with love 
by SonsHub Media Ltd]
```

**Force password reset on first login:**
- Add `mustResetPassword Boolean @default(false)` to User model
  (add via prisma db push)
- Set `mustResetPassword = true` for auto-onboarded users
- In NextAuth callbacks, check this flag after sign in
- If true: redirect to `/reset-password?required=true`
- `/reset-password` page: simple form, new password + confirm
- On success: set `mustResetPassword = false`, 
  redirect to `/account`

**Password reset page design:**
- Same modal-style card as the login modal
- "Choose your password" heading (Cormorant 28px)
- "Set a password you'll remember" subtitle (Lora 13px)
- New password + confirm fields
- "SET PASSWORD →" button (wine background)
- No "current password" required since this is first login

---

### 7. ADMIN — BANK TRANSFER CONFIRMATION

In `/admin/finance/payments` (already exists from Phase 2A):

**Pending bank transfers section at top:**
- Filter to show payments where method = BANK_TRANSFER 
  and status = PENDING
- Each row: client name, order/booking ref, amount, 
  date submitted, "View Receipt" button, "Confirm" button, 
  "Reject" button

**View Receipt:** opens receipt image in a modal lightbox

**Confirm button:**
```
PATCH /api/admin/payments/[paymentId]/confirm
  Sets Payment.status = CONFIRMED (or PaymentStatus.PAID)
  Updates linked order/booking payment status
  Sends "payment confirmed" email to client
  If consultation: advances booking to CONFIRMED status
  If bespoke order: updates amountPaid and balance
  Logs to ActivityLog: PAYMENT_CONFIRM
```

**Reject button:** opens modal with reason textarea
```
PATCH /api/admin/payments/[paymentId]/reject
  Sets status = FAILED
  Sends rejection email to client with reason
  Logs to ActivityLog
```

**Email: Payment confirmed:**
```
Subject: "Payment confirmed — [order/booking ref]"
Body: "We've confirmed your payment of ₦[amount]. 
Your [order/consultation] is now active."
[Track your order button]
```

**Email: Payment rejected:**
```
Subject: "Payment not confirmed — action needed"
Body: "Unfortunately we couldn't confirm your payment 
of ₦[amount]. Reason: [reason]. Please contact us or 
try again."
[Contact us button]
```

---

### 8. WEBHOOK HANDLERS

All webhooks go in `src/app/api/webhooks/`:

**Security — every webhook must:**
1. Validate the signature/hash from the gateway
2. Return 200 immediately (process async)
3. Use `prisma.payment.findFirst({ where: { reference } })` 
   to find the payment record
4. Never process the same reference twice 
   (check `payment.status !== 'PENDING'` → skip)
5. Log to `ActivityLog` on every processed event
6. Log to `ErrorLog` on any failure

**Paystack webhook** (`/api/webhooks/paystack`):
```typescript
// Validate: HMAC-SHA512 of raw body with PAYSTACK_SECRET_KEY
// Compare to x-paystack-signature header
// Event: charge.success
// Find payment by data.reference
// Update status, send confirmation email
```

**Flutterwave webhook** (`/api/webhooks/flutterwave`):
```typescript
// Validate: verify-hash header = HMAC-SHA256 of raw body 
//   with FLUTTERWAVE_SECRET_KEY
// Event: charge.completed, status: successful
// Find payment by data.txRef
```

**Stripe webhook** (`/api/webhooks/stripe`):
```typescript
// Use stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)
// Event: payment_intent.succeeded
// Find payment by paymentIntent.metadata.reference
// IMPORTANT: Stripe webhooks need raw body — 
//   add this to the route file:
export const config = { api: { bodyParser: false } };
// Use req.arrayBuffer() or similar to get raw body
```

**Monnify webhook** (`/api/webhooks/monnify`):
```typescript
// Validate: SHA512 of (MONNIFY_SECRET_KEY + | + paymentReference 
//   + | + amountPaid + | + paidOn + | + paymentDescription)
// Event: SUCCESSFUL_TRANSACTION
```

---

### 9. PAYMENT STATUS PAGES

**Payment success redirect** (`/payment/success`):
- URL: `/payment/success?reference=[ref]&gateway=[gateway]&type=[consultation|order|bespoke]`
- Page fetches verification server-side
- Shows: animated checkmark, "Payment successful", 
  order/booking summary, next steps
- Redirects to appropriate page after 3 seconds:
  - RTW order → `/account/orders`
  - Consultation → `/consultation/success?booking=[id]`
  - Bespoke → `/account/orders/bespoke/[id]`

**Payment failed page** (`/payment/failed`):
- URL: `/payment/failed?reference=[ref]&type=[type]`
- Shows: "Payment was not completed"
- Reason (if available from gateway)
- Two CTAs: "Try again" + "Pay by bank transfer instead"
- Does NOT delete the pending order — allows retry

**Payment pending page** (`/payment/pending`):
- For bank transfer only
- URL: `/payment/pending?reference=[ref]`
- Shows: bank details again, receipt upload again 
  (if they forgot to upload), 
  "We'll confirm within 2–4 hours"
- Link to track order (even while pending)

---

### 10. STRIPE ELEMENTS INTEGRATION

For USD/GBP payments via Stripe, embed the card form inline:

Build `src/components/checkout/StripeCheckout.tsx`:
```typescript
'use client'
// Uses @stripe/react-stripe-js and @stripe/stripe-js
// Props: { clientSecret: string; onSuccess: () => void; onError: (err: string) => void }
// Renders: CardElement from Stripe Elements
// Handles: confirmCardPayment with clientSecret
// On success: calls onSuccess()
// Styling: matches site design — no Stripe default blue
```

Install if not already:
```bash
pnpm add @stripe/stripe-js @stripe/react-stripe-js stripe
```

Stripe Elements appearance config:
```typescript
const appearance = {
  theme: 'flat',
  variables: {
    colorPrimary: '#442913',
    colorBackground: '#F7F2EC',
    colorText: '#2A1A0E',
    colorDanger: '#8B2020',
    fontFamily: 'Jost, sans-serif',
    borderRadius: '3px',
  },
};
```

---

### 11. CURRENCY & EXCHANGE RATE SYSTEM

Build `src/lib/currency.ts`:

```typescript
export type Currency = 'NGN' | 'USD' | 'GBP';

export async function getExchangeRates(): Promise<{
  NGN: 1;
  USD: number; // e.g. 0.00065 (1 NGN = 0.00065 USD)
  GBP: number;
}>
// Reads from SiteSetting keys: exchange_rate_usd, exchange_rate_gbp
// These are set manually by Super Admin in Settings → Developer

export function convertPrice(
  amountNGN: number, 
  toCurrency: Currency,
  rates: { USD: number; GBP: number }
): number

export function formatPrice(amount: number, currency: Currency): string
// Returns: "₦1,850,000" or "$1,204" or "£948"
```

Add to Admin Settings → General:
- "USD Exchange Rate" field (e.g. 0.00065)
- "GBP Exchange Rate" field (e.g. 0.00052)
- These update SiteSetting records

---

### 12. POINTS & LOYALTY — AWARD ON PURCHASE

When an RTW order is confirmed (payment successful):
1. Calculate points: 1 point per ₦100 spent
   (or read rate from LoyaltyRule where action = 'PURCHASE')
2. Add to `User.pointsBalance`
3. Create `PointsTransaction` record:
   ```
   type: EARNED_PURCHASE
   amount: [points earned]
   description: "Purchase — Order #[orderNumber]"
   orderId: [orderId]
   ```
4. Check if new points total crosses a tier threshold:
   - Read thresholds from SiteSetting:
     `loyalty_threshold_silver`, `loyalty_threshold_gold`, 
     `loyalty_threshold_platinum`
   - If tier upgrades: update `ClientProfile.loyaltyTier`
   - Send tier upgrade email

---

### 13. API ROUTES SUMMARY

```
# RTW Checkout
POST   /api/checkout/initialize
GET    /api/checkout/verify
POST   /api/checkout/bank-transfer

# Consultation
POST   /api/consultations/initialize-payment
GET    /api/consultations/verify
POST   /api/consultations/bank-transfer

# Bespoke balance
POST   /api/bespoke/[orderId]/initialize-payment
GET    /api/bespoke/[orderId]/verify-payment

# Admin payment management
PATCH  /api/admin/payments/[id]/confirm
PATCH  /api/admin/payments/[id]/reject
GET    /api/admin/payments/pending    ← list pending bank transfers

# Webhooks
POST   /api/webhooks/paystack
POST   /api/webhooks/flutterwave
POST   /api/webhooks/stripe
POST   /api/webhooks/monnify

# Client onboarding
POST   /api/auth/reset-password       ← forced first-login reset
```

---

### 14. SCHEMA ADDITIONS

Add only these fields to existing models:

```prisma
// Add to User model:
mustResetPassword Boolean @default(false)

// Add to ConsultationBooking model (if not already present):
// These should already exist — verify before adding:
// userId, paymentRef, paymentGateway, paymentStatus, paidAt
```

After adding, run: `pnpm exec prisma db push`

---

### 15. WEBHOOK REGISTRATION

After deployment, register webhooks in each gateway dashboard:

**Paystack:** dashboard.paystack.com → Settings → API → Webhooks
```
URL: https://prudentgabriel.vercel.app/api/webhooks/paystack
Events: charge.success
```

**Flutterwave:** dashboard.flutterwave.com → Settings → Webhooks
```
URL: https://prudentgabriel.vercel.app/api/webhooks/flutterwave
Secret hash: set FLUTTERWAVE_SECRET_KEY as the hash
```

**Stripe:** dashboard.stripe.com → Developers → Webhooks
```
URL: https://prudentgabriel.vercel.app/api/webhooks/stripe
Events: payment_intent.succeeded
Copy the webhook signing secret → STRIPE_WEBHOOK_SECRET in Vercel
```

**Monnify:** sandbox.monnify.com → Settings → Webhooks
```
URL: https://prudentgabriel.vercel.app/api/webhooks/monnify
```

---

### 16. EXECUTION ORDER

Build in this exact sequence:

1. Install Stripe packages: `pnpm add stripe @stripe/stripe-js @stripe/react-stripe-js`
2. Add `mustResetPassword` to schema → `prisma db push`
3. Build `src/lib/payments/` (all 5 files)
4. Build `src/lib/client-onboarding.ts`
5. Build `src/lib/currency.ts`
6. Build `PaymentMethodSelector` component
7. Build `StripeCheckout` component
8. Build RTW product detail page (`/shop/[slug]`)
9. Build cart page (`/cart`)
10. Build checkout flow (`/checkout`)
11. Build checkout API routes
12. Wire consultation Step 3 payment
13. Build consultation payment API routes
14. Build consultation success page
15. Build bespoke balance payment page + API
16. Build client auto-onboarding flow
17. Build forced password reset page
18. Build welcome + credentials email template
19. Build admin bank transfer confirmation UI
20. Build payment status pages (success/failed/pending)
21. Build webhook handlers (all 4 gateways)
22. Add exchange rate settings to admin
23. Wire loyalty points on purchase
24. Run full build — fix all TypeScript errors
25. Deploy to Vercel

---

## COMPLETION CHECKLIST

Confirm all before calling Phase 3 done:

- [ ] `pnpm build` passes with zero TypeScript errors
- [ ] `/shop/[slug]` loads product detail, size selector works
- [ ] Add to cart works, cart persists on refresh
- [ ] Checkout flow: Details → Payment → Confirmation completes
- [ ] Paystack test payment: use card `4084 0840 8408 4081`, 
      expiry any future date, CVV 408, OTP 123456
- [ ] Bank transfer: receipt uploads, admin sees it in Finance → Payments
- [ ] Admin confirms bank transfer → client gets email
- [ ] Consultation booking payment completes end-to-end
- [ ] New client auto-onboarded: account created, welcome email sent
- [ ] Temporary password format: "WORD-1234" readable in email
- [ ] First login with temp password → forced reset page
- [ ] After reset → redirected to `/account` dashboard
- [ ] Bespoke balance payment works from client dashboard
- [ ] Webhook endpoints return 200 (test with Paystack test dashboard)
- [ ] Loyalty points awarded after RTW purchase
- [ ] All new cron/webhook routes validated with CRON_SECRET

---

*Prepared by SonsHub Media Ltd for Prudential Atelier — prudentgabriel.com*
*₦7,500,000 engagement · Phase 3 of 5*
