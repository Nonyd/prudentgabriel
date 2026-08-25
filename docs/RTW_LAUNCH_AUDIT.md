# RTW-First Launch Audit

**Repo:** `github.com/Nonyd/prudentgabriel` → `prudential-atelier/`  
**Branch:** `staging`  
**Date:** 25 Aug 2026  
**Scope:** read-only. Verdicts are `BUILT` / `PARTIAL` / `MISSING` / `UNCLEAR`.  
**Ignore:** `docs/PIPELINE_AUDIT.md` (pre-Sprints A–D).

**Already known (not re-proven):**

- All 464 variants are at stock 0 on both databases. The Woo importer writes `stock: 0` (`prudential-atelier/src/app/api/admin/import/execute/route.ts:84`).
- No PSP keys or usable bank details are configured, so `getSupportedGateways` returns an empty list and checkout shows no methods (`prudential-atelier/src/lib/payments/config.ts:147–157`, `prudential-atelier/src/components/checkout/PaymentMethodSelector.tsx:126–129`).

Those two facts block a live purchase. They are noted wherever they intersect a launch item. The rest of this document is what the code actually does.

---

## Section 1 — Inventory the split

Tagging: **RTW** = ready-to-wear commerce (`Order`, cart, catalog). **Atelier** = commissions, consultations, quotations, 13-stage pipeline (`BespokeOrder`). **Shared** = both, or brand/ops that are not commerce-specific.

### 1.1 Storefront routes — `src/app/(storefront)/`

Layout (shared): `prudential-atelier/src/app/(storefront)/layout.tsx:23` mounts `Navbar`, `Footer`, `CartDrawer`, `SearchModal`.

| Tag | Route | File |
|-----|-------|------|
| Shared | `/` | `prudential-atelier/src/app/(storefront)/page.tsx:12` — Hero + BestSellers + CategoryGrid + BespokeJourney + testimonials + PFA + journal |
| RTW | `/shop` | `prudential-atelier/src/app/(storefront)/shop/page.tsx:16` |
| RTW | `/shop/[slug]` | `prudential-atelier/src/app/(storefront)/shop/[slug]/page.tsx:88` |
| RTW | `/rtw` | `prudential-atelier/src/app/(storefront)/rtw/page.tsx:23` — forces `type=RTW`, excludes BRIDAL |
| RTW | `/rtw/[slug]` | `prudential-atelier/src/app/(storefront)/rtw/[slug]/page.tsx:3` — redirect → `/shop/[slug]` |
| RTW | `/rtw/collections/[slug]` | `prudential-atelier/src/app/(storefront)/rtw/collections/[slug]/page.tsx:5` — redirect → `/collections/[slug]` |
| RTW | `/collections` | `prudential-atelier/src/app/(storefront)/collections/page.tsx:15` |
| RTW | `/collections/[slug]` | `prudential-atelier/src/app/(storefront)/collections/[slug]/page.tsx:49` |
| RTW | `/cart` | `prudential-atelier/src/app/(storefront)/cart/page.tsx:11` |
| RTW | `/checkout` | `prudential-atelier/src/app/(storefront)/checkout/page.tsx:3` |
| RTW | `/checkout/success` | `prudential-atelier/src/app/(storefront)/checkout/success/page.tsx:93` |
| Atelier | `/atelier` | `prudential-atelier/src/app/(storefront)/atelier/page.tsx:27` |
| Atelier | `/bespoke` | `prudential-atelier/src/app/(storefront)/bespoke/page.tsx:3` — redirect → `/atelier` |
| Atelier | `/bridal` | `prudential-atelier/src/app/(storefront)/bridal/page.tsx:177` — bridal gallery |
| Atelier | `/bridesals` | `prudential-atelier/src/app/(storefront)/bridesals/page.tsx:3` — redirect → `/bridal` |
| Atelier | `/consultation` | `prudential-atelier/src/app/(storefront)/consultation/page.tsx:24` |
| Atelier | `/consultation/[bookingNumber]` | `prudential-atelier/src/app/(storefront)/consultation/[bookingNumber]/page.tsx:21` |
| Atelier | `/consultation/success` | `prudential-atelier/src/app/(storefront)/consultation/success/page.tsx:149` |
| Atelier | `/track` | `prudential-atelier/src/app/(storefront)/track/page.tsx:20` — looks up `bespokeOrder` by `orderRef` (`:37`) |
| Atelier | `/track/[trackingToken]` | `prudential-atelier/src/app/(storefront)/track/[trackingToken]/page.tsx:25` — `prisma.bespokeOrder.findUnique` (`:28`) |
| Shared | `/kids` | `prudential-atelier/src/app/(storefront)/kids/page.tsx:17` — kids gallery + shop CTA |
| Shared | `/about`, `/our-story`, `/press`, `/contact` | brand pages under `(storefront)/` |
| Shared | `/journal`, `/journal/[slug]` | journal |
| Shared | `/careers`, `/careers/[slug]` | careers |
| Shared | `/size-guide` | `prudential-atelier/src/app/(storefront)/size-guide/page.tsx:23` — women/kids/bridal charts |
| Shared | `/payment/success`, `/payment/pending`, `/payment/failed` | branch on `type=consultation\|bespoke\|order` |
| Shared | CMS legal: `/cookie-policy`, `/privacy-policy`, `/returns-policy`, `/shipping-policy`, `/terms-and-conditions` | CMS-backed |
| Shared | Hardcoded legal: `/legal/privacy`, `/legal/returns`, `/legal/terms` | static copy covering shop + atelier |

**Outside the storefront group, still customer-reachable:**

| Tag | Route | File |
|-----|-------|------|
| Atelier | `/quote/[approvalToken]` | `prudential-atelier/src/app/quote/[approvalToken]/page.tsx:13` — public quotation approval |

Middleware allow-lists `/atelier`, `/bespoke`, `/consultation`, `/track`, `/quote` as public (`prudential-atelier/src/middleware.ts:92–98`).

### 1.2 Account routes — `src/app/(account)/`

Layout (shared): `prudential-atelier/src/app/(account)/layout.tsx:8` — auth gate; counts RTW `Order` + `bespokeOrder` (`:22–34`); always `getOrCreateClientProfile` (`:20`).

| Tag | Route | File |
|-----|-------|------|
| Shared | `/account` | `prudential-atelier/src/app/(account)/account/page.tsx:42` — dashboard loads RTW orders, consultations, bespoke |
| Shared | `/account/orders` | `prudential-atelier/src/app/(account)/account/orders/page.tsx:6` — `bespokeOrders` + `rtwOrders` (`:11–31`) |
| RTW | `/account/orders/[id]` | `prudential-atelier/src/app/(account)/account/orders/[id]/page.tsx:10` — `prisma.order` |
| RTW | `/account/addresses` | `prudential-atelier/src/app/(account)/account/addresses/page.tsx:5` |
| RTW | `/account/wishlist` | `prudential-atelier/src/app/(account)/account/wishlist/page.tsx:5` |
| Atelier | `/account/consultations`, `/account/consultations/[id]` | consultation list/detail |
| Atelier | `/account/measurements`, `/account/moodboards` | atelier CRM |
| Atelier | `/account/orders/bespoke/[orderId]` | bespoke stages |
| Atelier | `/account/orders/bespoke/[orderId]/pay` | bespoke pay |
| Shared | `/account/loyalty`, `/wallet`, `/referrals`, `/referral`, `/notifications`, `/profile`, `/settings`, `/style-profile`, `/transactions`, `/reviews/new`, `/testimonial/new` | account chrome |

Sidebar labels the RTW orders link “Ready-to-Wear” and the same `/account/orders` href also “My Commissions” (`prudential-atelier/src/components/account/AccountSidebar.tsx:34–40`). Section title is `"My Atelier"` (`:172`). Eyebrow `/ ATELIER` (`:149`).

### 1.3 API routes — `src/app/api/` (271 `route.ts`)

#### RTW

`cart/route.ts`, `cart/[itemId]/route.ts`, `checkout/bank-transfer/route.ts`, `orders/create/route.ts`, `orders/[orderNumber]/route.ts`, `products/route.ts`, `products/[slug]/route.ts`, `products/[slug]/reviews/route.ts`, `collections/route.ts`, `collections/[slug]/route.ts`, `coupons/validate/route.ts`, `shipping/calculate/route.ts`, `wishlist/route.ts`, `stock-alert/route.ts`, `account/orders/rtw/route.ts`, `account/orders/rtw/[orderId]/route.ts`, `account/orders/[id]/route.ts`, `account/addresses/route.ts`, `account/addresses/[id]/route.ts`, `account/wishlist/route.ts`, `account/wishlist/[productId]/route.ts`, `account/stock-alert/route.ts`, `payment/{paystack,flutterwave,monnify,stripe}/initiate/route.ts`, `payment/{paystack,flutterwave,monnify}/verify/route.ts` (shop order verify).

Admin RTW: `admin/orders/*`, `admin/products/*`, `admin/collections/*`, `admin/coupons/*`, `admin/shipping/*`, `admin/import/*`.

Cron: `cron/abandoned-cart`, `cron/expired-coupons`, `cron/update-bestsellers`.

#### Atelier

`bespoke/route.ts` and all `bespoke/[orderId]/*`, `consultations/*`, `consultants/*`, `quotations/*`, `quote/[token]/pdf/route.ts`, `invoice/[token]/*`, `receipt/[token]/confirm/route.ts`, `track/[token]/route.ts`, `clients/*`, `moodboards/*`, `account/orders/bespoke/route.ts`, `account/bespoke/[orderId]/approvals/[approvalId]/route.ts`, `account/consultations/*`, `account/measurements/*`, `account/moodboards/*`, `account/events/*`, `payment/paystack/verify-bespoke/route.ts`, `attendance/*`, `qr/*`, `staff/*`.

Admin atelier: `admin/bespoke/*`, `admin/alterations/*`, `admin/consultations/*`, `admin/consultants/*`, `admin/clients/search`, `admin/invoices/*`, `admin/quotations/*`, `admin/gallery/*`, `admin/staff/performance`.

Cron: `cron/balance-reminders`, `cron/stage-approval-reminders`, `cron/receipt-reminders`, `cron/unsent-quote-alerts`, `cron/event-reminders`, `cron/late-alert`, `cron/rotate-qr`, `cron/update-performance`.

#### Shared

`auth/*`, `payment/*/webhook`, `payments/public-config/route.ts`, `webhooks/[gateway]/route.ts`, `upload/receipt*`, `currency/rates`, `settings/public`, `maintenance-status`, `contact`, `newsletter`, `gallery`, `blog/*`, `careers/*`, `reviews/*`, `account` chrome (profile, password, notifications, loyalty, wallet, referrals, reviews, testimonials, payment-methods, upload), `admin/payments/*` (SHOP \| CONSULTATION \| BESPOKE), `admin/reports/*`, `admin/customers/*`, `admin/reviews/*`, `admin/settings/*`, `admin/content/*`, `admin/careers/*`, `admin/team/*`, `admin/system/*`, `admin/logs` via `logs/*`, `cron/review-requests`, `cron/daily-report`, `cron/weekly-report`, `cron/email-outbox`.

### 1.4 Navigation

**Active chrome** is `prudential-atelier/src/components/public/Navbar.tsx` + `Footer.tsx`, wired from `layout.tsx:43–52`.

Navbar `PRIMARY_LINKS` (`Navbar.tsx:19–26`): Shop `/shop` (RTW), Bridal `/bridal` (atelier gallery), Atelier `/atelier` (atelier), Kids `/kids` (shared), Journal `/journal` (shared), About `/about` (shared). Desktop also renders `RtwDropdown` → `/rtw` (`:55–56`, `:364–368`).

Footer defaults (`Footer.tsx:16–31`): The Atelier `/atelier`, Ready-to-Wear `/rtw`, Bridal `/bridal`, Kids `/kids`, Careers, Fashion Academy, Journal, **Track Your Order `/track`** (atelier `bespokeOrder` lookup), Size Guide, Shipping & Returns, **Book Consultation `/consultation`**, Contact. Overridable via CMS `footer_house_links` / `footer_client_links` (`cms-config.ts:765–788`).

Homepage (`page.tsx:12–23`):

- Hero buttons default `/shop` and `/consultation` (`cms-config.ts:109–112`).
- BestSellers → `/shop`.
- CategoryGrid hardcodes `/atelier`, `/bridal`, `/shop` (`CategoryGrid.tsx:7–24`).
- BespokeJourney default CTA `/atelier`; hideable with `home_journey_enabled` (`BespokeJourney.tsx:13`, `cms-config.ts:165`).
- PFA banner, testimonials, journal: shared.

Shop listing filter row includes an **ATELIER** chip that sets `type=BESPOKE` (`ShopBrowse.tsx:30–36`).

### 1.5 Prisma models (75)

`prudential-atelier/prisma/schema.prisma`. **No FK between `Order` and `BespokeOrder`.**

**RTW (17):** Product `:291`, Collection `:335`, CollectionProduct `:359`, ProductImage `:372`, ProductVariant `:384`, ProductColor `:404`, BundleItem `:416`, CartItem `:427`, StockAlert `:444`, Order `:460`, OrderItem `:511`, Coupon `:649`, CouponUsage `:672`, ShippingZone `:685`, Address `:702`, WishlistItem `:720`, PointsTransaction `:279`.

**Atelier (27):** Consultant `:67`, ConsultantOffering `:86`, ConsultantAvailability `:103`, ConsultantBlockedDate `:115`, ConsultationBooking `:126`, BespokeRequest `:529`, Invoice `:565`, ClientProfile `:1326`, Measurement `:1353`, Moodboard `:1375`, EventDate `:1391`, ClientNote `:1403`, BespokeOrder `:1417`, AlterationRequest `:1522`, StageUpdate `:1558`, OrderStageCompletion `:1593`, OrderStageMedia `:1612`, OrderStageDraft `:1627`, StageApproval `:1639`, OrderAssignment `:1655`, Material `:1673`, Quotation `:1779`, StaffProfile `:1701`, StaffTask `:1724`, PerformanceRecord `:1736`, AttendanceLog `:1752`, QRCode `:1769`.

**Shared (31):** User `:11`, auth tokens/Account/Session, NewsletterSubscriber, Review `:731` (Product **or** ConsultationBooking), Testimonial, ReviewHelpfulVote, JobPosting/JobApplication/ApplicationEmail, SiteSetting `:882`, MediaItem, GalleryImage, Admin/Customer/StaffNotification, TeamInvitation, SavedPaymentMethod, ActivityLog, ErrorLog, JobRole, DocumentNumberSequence, BlogPost, **Payment `:1878`**, LoyaltyRule, ContactMessage, CronRun, EmailSendJob, EmailMessage.

**Entanglement:**

- `Payment` has optional FKs to `orderId`, `bespokeOrderId`, `invoiceId`, `consultationId` (`schema.prisma:1889–1896`). One append-only ledger.
- `Invoice` parents are atelier only (`bespokeRequestId`, `consultationId`, `quotationId`) — **no** `orderId`. RTW does not use Invoice.
- `User` is the identity hub. `ClientProfile` is atelier CRM; RTW `Order` does **not** FK to it. Guest RTW payment still **creates** a `ClientProfile` via `autoOnboardClient` (`client-onboarding.ts:92`).
- `Order.isBespoke` / `bespokeDetails` (`schema.prisma:495–496`) are flags on the RTW `Order` row, not a link to `BespokeOrder`.
- `Review` is shared (product or consultation).

### 1.6 Admin surfaces

Sidebar source: `prudential-atelier/src/components/admin/AdminSidebar.tsx:67–182`.

| Tag | Paths |
|-----|-------|
| RTW | `/admin/products`, `/products/new`, `/products/[id]/edit`, `/admin/shop/import`, `/admin/import`, `/admin/import/help`, `/admin/collections`, `/admin/collections/[id]`, `/admin/shop/collections` (redirect), `/admin/orders`, `/admin/orders/[id]` |
| RTW, not in sidebar | `/admin/coupons` (`coupons/page.tsx:4`), `/admin/shipping` (`shipping/page.tsx:4`) |
| Atelier | `/admin/bespoke`, `/bespoke/[orderId]`, `/bespoke/intake`, `/bespoke/intake/[id]`, `/admin/consultations`, `/consultations/[id]`, `/admin/consultants`, `/consultants/[id]/edit`, `/admin/quotations*`, `/admin/invoices*`, `/admin/clients`, `/clients/[clientId]`, `/admin/alterations`, `/admin/gallery`, `/admin/staff*`, `/admin/attendance` |
| Shared | `/admin` dashboard, `/admin/payments`, `/admin/reports`, `/admin/customers*`, `/admin/reviews`, `/admin/referrals`, `/admin/notifications`, `/admin/content*`, `/admin/careers*`, `/admin/settings*`, `/admin/team`, `/admin/system/*`, `/admin/logs/*`, `/admin/account-settings` |

### 1.7 Email templates

React Email under `prudential-atelier/src/emails/`:

| Tag | Files |
|-----|-------|
| RTW | `OrderConfirmationEmail.tsx`, `OrderShippedEmail.tsx`, `RtwOrderDeliveredEmail.tsx`, `BackInStockEmail.tsx` |
| Atelier | `BespokeConfirmationEmail.tsx`, `BespokeDeliveredEmail.tsx`, `StageAssignmentEmail.tsx`, `ReceiptReminderEmail.tsx`, `InvoiceEmail.tsx`, `ConsultationConfirmedEmail.tsx`, `ConsultationPendingEmail.tsx`, `ConsultationCancelledEmail.tsx`, `ConsultationMeetingLinkEmail.tsx`, `ConsultationRescheduleEmail.tsx`, `ConsultationSessionSummaryEmail.tsx` |
| Shared | `WelcomeEmail.tsx`, `WelcomeCredentialsEmail.tsx`, `AccountExistsEmail.tsx`, `PasswordResetEmail.tsx`, `ReferralSuccessEmail.tsx`, `ReferralRewardEmail.tsx`, `LoyaltyTierUpgradeEmail.tsx`, `ReviewRequestEmail.tsx` |
| HR | `JobApplicationConfirmationEmail.tsx`, `JobApplicationStatusEmail.tsx` |
| Infra | `ComposableTemplateEmail.tsx`, `BrandedHtmlEmail.tsx` |

SiteSetting overrides: `prudential-atelier/src/lib/email-templates.ts:3–42`. Admin catalog keys include `rtw_order_confirmed` / `_shipped` / `_delivered` and `low_stock` (`admin-email-catalog.ts:14–16`, `:27`).

### 1.8 Cron registry

Catalog: `prudential-atelier/src/lib/cron/catalog.ts:13–105`. Handlers wired in `jobs.ts:12–21` (`handler: null` when `migrated: false`).

| Job | Side | Migrated |
|-----|------|----------|
| `abandoned-cart` | RTW | true |
| `expired-coupons` | RTW | false |
| `update-bestsellers` | RTW | false |
| `balance-reminders` | Atelier | true |
| `stage-approval-reminders` | Atelier | true |
| `receipt-reminders` | Atelier | true |
| `unsent-quote-alerts` | Atelier | true |
| `event-reminders` | Atelier (client events) | false |
| `rotate-qr`, `late-alert`, `update-performance` | Atelier / HR | mixed |
| `review-requests` | Shared (RTW `isBespoke: false` + consult + bespoke) | true (`jobs/review-requests.ts:18–22`) |
| `daily-report`, `weekly-report` | Shared | false |
| `email-outbox` | Shared infra | true |

### 1.9 Central question: can atelier be hidden without breaking RTW?

**Yes for the buy path.** Cart, checkout, `POST /api/orders/create`, Paystack/bank initiate, and `fulfillPaidOrder` operate on `Order` / `CartItem` / `ProductVariant`. They do not call bespoke stage APIs.

**Runtime ties that remain if atelier customer routes are gated:**

1. Guest RTW payment calls `autoOnboardClient({ source: "RTW_ORDER" })` (`order-payment.ts:111–118`), which **creates `ClientProfile`** (`client-onboarding.ts:92`) and emails a track URL of `/track/{orderNumber}` (`client-onboarding.ts:147–148`). `/track` queries `bespokeOrder`, not `Order` (`track/page.tsx:37`). That URL does not show an RTW order today.
2. Bank-transfer confirm email uses the same `/track/{orderNumber}` (`admin/payments/[id]/confirm/route.ts:102`).
3. Account layout always creates a `ClientProfile` and counts bespoke orders (`account/layout.tsx:20–34`). Empty counts do not crash.
4. Shared `Payment` ledger and `User` stay required.
5. Homepage CategoryGrid, navbar Atelier link, shop ATELIER filter, PDP `isBespokeAvail` accordion (`ProductDetailClient.tsx:331–344`), footer Track + Consultation are still live unless those files or middleware change.

Hiding nav links only is not hiding: middleware still serves `/atelier`, `/consultation`, `/track`, `/quote`, `/bespoke` (`middleware.ts:92–98`).

---

## Section 2 — The RTW purchase path, end to end

### 2.1 Discover — **PARTIAL**

**BUILT:** Homepage BestSellers (`page.tsx:16`). Shop listing `queryProductList` with category, type, tags, sort, search, sizes, price, in-stock (`products-list-query.ts:27–119`). `/rtw` forces `type=RTW` and excludes BRIDAL (`rtw/page.tsx:29–30`). Collections listing (`collections/page.tsx:19`). Search modal hits `/api/products?search=` (`SearchModal.tsx:78–79`). Filters in `ShopBrowse.tsx:30–36`.

**Missing from a pure RTW storefront:** Shop “ALL” includes bridal/atelier types; ATELIER filter is a live `type=BESPOKE` query (`ShopBrowse.tsx:34`). CategoryGrid first card is `/atelier` (`CategoryGrid.tsx:7–12`). Hero second button defaults to `/consultation` (`cms-config.ts:111–112`).

Stock 0: `inStock=true` filter would hide everything (`products-list-query.ts:113–118`). Default listing does not require in-stock.

### 2.2 Product page — **BUILT**

`shop/[slug]/page.tsx:88` loads published product with images, variants, colors, reviews. Gallery, size buttons disabled at `stock === 0` (`ProductDetailClient.tsx:214–228`). Low-stock copy when `stock <= product.lowStockAt` (`:89–90`, `:235`). Size guide modal (`:200`, `SizeGuideModal.tsx:1`). Out-of-stock → `StockAlertForm` (`:238–239`).

PDP accordion hardcodes “Free Lagos delivery on orders over ₦150,000” (`ProductDetailClient.tsx:327`). Seed Lagos zone `freeAboveNGN` is `250_000` (`prisma/seed.ts:34`). Those two numbers do not match.

`isBespokeAvail` accordion links to `/atelier` (`ProductDetailClient.tsx:331–344`).

### 2.3 Add to bag — **PARTIAL**

Guest: `addItem` writes Zustand + `localStorage` key `pa-cart` (`cartStore.ts:42–103`). No `CartItem` row (model requires `userId`, `schema.prisma:427–441`).

Logged-in: PDP `addToBag` only calls Zustand (`ProductDetailClient.tsx:92–120`). The only `fetch('/api/cart')` is `CartSyncProvider` on `status === "authenticated"` (`CartSyncProvider.tsx:51–87`) — once per provider mount, not on each add. Checkout for logged-in users reads **server** `cartItem` (`orders/create/route.ts:78–86`) and does **not** send `cartLines` (`CheckoutClient.tsx:387–397`). A logged-in add that never syncs produces “Your bag is empty” (`orders/create/route.ts:88–90`) while the drawer still shows lines.

Guest checkout sends `cartLines` from Zustand (`CheckoutClient.tsx:387–396`). Guest buy path works.

### 2.4 Cart — **PARTIAL**

`/cart`: quantity +/−, remove, subtotal, CTA to checkout (`cart/page.tsx:51–91`). Coupon is **not** on the cart page. Coupon is on checkout (`CheckoutClient.tsx:61–68`, `applyCoupon` `:218`, `POST /api/coupons/validate` `coupons/validate/route.ts:12`).

Logged-in qty changes on `/cart` also stay in Zustand only (`cart/page.tsx:56`). `PATCH /api/cart/[itemId]` exists but this page does not call it.

### 2.5 Checkout — **BUILT** (blocked operationally by stock 0 and empty gateways)

Guest and account: `CheckoutClient.tsx:110` `isGuest`. Guest requires email/name/phone (`:181–187`). Address: saved `addressId` or new fields; `country` length 2 (`validations/order.ts:3–14`, `orders/create/route.ts:59–61`). Shipping options from `POST /api/shipping/calculate` (`CheckoutClient.tsx:125`). Gateways from `/api/payments/public-config` (`PaymentMethodSelector.tsx:68`).

Order create is a transaction: order + line items + coupon usage + points + (logged-in) cart clear (`orders/create/route.ts:292–361`). Stock is **checked** before the transaction (`:133–143`), **not reserved**, **not decremented**.

Known: with dummy bank `0123456789` filtered out (`payments/config.ts:103`, `:156–157`) and no usable PSP keys, `gateways.length === 0` (`PaymentMethodSelector.tsx:126–129`).

### 2.6 Payment — **BUILT** in code; **cannot complete** without keys/bank

Paystack: `POST /api/payment/paystack/initiate` (`initiate/route.ts:14`) → `initializeTransaction` (`:53`). Verify redirects to `/checkout/success?order=` (`paystack/verify/route.ts:51–53`).

Bank transfer: order created with `BANK_TRANSFER` (`orders/create/route.ts:283–287`). Receipt upload then `POST /api/checkout/bank-transfer` (`bank-transfer/route.ts:19`) stores `paymentReceiptUrl` (`:53–56`), emails admin, does **not** mark paid. Admin confirms via `PATCH /api/admin/payments/[id]/confirm` kind `ORDER` (`confirm/route.ts:63–73`) which calls `fulfillPaidOrder`.

Flutterwave, Stripe, Monnify initiate routes exist; same key gate.

### 2.7 Confirmation — **BUILT**

`fulfillPaidOrder` (`order-payment.ts:19`): flips `PENDING` → `PAID` + `CONFIRMED` (`:54–61`), decrements variant stock (`:69–74`), inserts `Payment` purpose `RTW_ORDER` (`:78–90`), sends `sendOrderConfirmationEmail` (`:131`), customer notifications (`:151–164`). Idempotent if already `PAID` (`:38–40`).

Stock decrement is inside the same `$transaction` as the payment row (`:53–93`). It does **not** re-check remaining stock; Prisma `decrement` can go negative.

### 2.8 Post-purchase — **PARTIAL**

Account history: `/account/orders` lists RTW (`orders/page.tsx:20–30`). Detail `/account/orders/[id]` with `OrderTimeline` (`orders/[id]/page.tsx:10–17`). Timeline statuses PENDING → DELIVERED (`OrderTimeline.tsx:7`).

Guest lookup API: `GET /api/orders/[orderNumber]?email=` (`orders/[orderNumber]/route.ts:18–50`). Used by checkout success (`checkout/success/page.tsx:31–32`). Success “Track my order” for guests points at login (`:13`, `:73`), not a public RTW tracker.

`/track` is atelier-only (`track/page.tsx:13`, `:37`). Footer “Track Your Order” goes there (`Footer.tsx:27`).

### 2.9 Fulfilment — **BUILT**

Admin order list: search order # / email, filter status and paymentStatus (`admin/orders/page.tsx:14–31`, `:87–117`).

Detail toolbar: Confirm → Processing → **Mark shipped** (tracking # + carrier) → Mark delivered (`AdminOrderToolbar.tsx:21–26`, `:226–231`, `:241–254`). `PATCH /api/admin/orders/[id]` (`admin/orders/[id]/route.ts:12–18`, `:111–119`). SHIPPED sends `sendOrderShippedEmail` (`:134–142`). DELIVERED sends `sendRtwOrderDeliveredEmail` (`:152–157`). Transitions gated by `canTransitionOrder` (`order-status.ts:3–13`).

This is not a 13-stage pipeline. It is a shop status machine: PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED.

### 2.10 Delivery and after — **PARTIAL**

Delivery confirmation: admin marks DELIVERED; customer email + in-app notify (`admin/orders/[id]/route.ts:152–164`). No customer “I received it” flow for RTW (that exists for bespoke: `receipt/[token]/confirm` + `receipt-reminders` cron).

Review request: cron `review-requests` selects RTW `Order` with `status: DELIVERED`, `reviewRequestSent: false`, `isBespoke: false`, `userId` not null, `updatedAt` ≥ 24h (`jobs/review-requests.ts:18–24`). Guests who never linked a user are skipped.

Returns: **no** Return/RMA model in `schema.prisma`. Policy pages: CMS `/returns-policy` (`returns-policy/page.tsx:15`), hardcoded `/legal/returns` (`legal/returns/page.tsx:3`) — “email hello@prudentgabriel.com” (`:16`). PDP “Returns accepted within 14 days” (`ProductDetailClient.tsx:328`). No admin return queue, no stock restock-on-return.

---

## Section 3 — Shipping

### Model, zone, rate, method — **BUILT**

`ShippingZone` (`schema.prisma:685–700`): `name`, `countries[]`, `states[]`, `flatRateNGN`, `perKgNGN`, `freeAboveNGN`, `estimatedDays`, `isActive`, `sortOrder`.

Seed upserts three zones (`prisma/seed.ts:26–57`):

| Name | Match | Rate |
|------|-------|------|
| Lagos — Express | `countries: ["NG"]`, `states: ["Lagos"]` | ₦3,500 + ₦400/kg, free above ₦250,000, 2–4 days |
| Nigeria — Standard | `countries: ["NG"]`, `states: []` (all NG states) | ₦5,500 + ₦600/kg, free above ₦400,000, 4–7 days |
| International | `countries: ["*"]` | ₦45,000 + ₦2,500/kg, 10–14 days |

Admin UI: `/admin/shipping` (`shipping/page.tsx:4`) + `ShippingZonesClient`. Nigerian states list includes Lagos (`ShippingZoneModal.tsx:21`). **Not linked in AdminSidebar.**

Whether staging/production **rows** exist right now is not re-queried here. The bootstrap seed writes them. If zero active zones, `calculateShippingOptions` returns a single “Custom Quote” option `zoneId: "manual"`, `costNGN: 0`, `estimatedDays: "Contact us"` (`shipping.ts:64–73`).

### Cost at checkout — **BUILT**

`calculateShippingOptions` (`shipping.ts:28–76`): match country/state, `flatRateNGN + perKgNGN * totalWeightKg`, free if coupon or `subtotal >= freeAboveNGN`. Weight at order create: `max(0.5, qty * 0.5)` kg (`orders/create/route.ts:192–193`). Saved on `Order.shippingAmount` + `shippingZoneId` (`:301–308`).

A Lagos address matches **both** Lagos Express and Nigeria Standard (`zoneMatches`: empty `states` matches all, `shipping.ts:24–25`). Customer picks in the UI.

### Address captured, validated, stored — **BUILT**

Required: first/last name, phone ≥ 7 chars, street ≥ 3, city, state, ISO-2 country (`validations/order.ts:3–14`). Stored as `addressSnapshot` JSON (`orders/create/route.ts:307`) and optional `Address` row if `saveAddress` (`:363–378`). No NIPOST/postcode validation (`postalCode` optional, `:11`).

### Intra-Lagos vs interstate — **BUILT** (via zones)

Lagos vs rest-of-Nigeria is `states: ["Lagos"]` vs `states: []` (`seed.ts:31–41`). Checkout distinguishes them as two options when both match.

### Pickup — **MISSING**

No pickup flag, collection-point method, or “collect from Surulere” zone type on `ShippingZone`. Consultation in-person address exists (`consultation-payment.ts` ATELIER_ADDRESS) and is not wired to RTW checkout.

---

## Section 4 — Inventory

### Where stock is decremented — **BUILT** (on payment, in the payment transaction)

Only call site: `fulfillPaidOrder` `stock: { decrement: item.quantity }` inside `db.$transaction` after flipping `paymentStatus` to PAID (`order-payment.ts:53–74`). Not at order create.

### Reserved at checkout? Two buyers, one last item — **MISSING** reservation

Create-time check (`orders/create/route.ts:133–143`) is **outside** the create transaction and does not lock the row. Two guests can both create PENDING orders for quantity 1 when stock is 1. Both can pay. Both decrements run. There is no `stock >= quantity` predicate on the update. Over-sell is the coded outcome.

Cancel/refund do **not** increment stock (`admin/orders/[id]/route.ts:59–82` refund; `:111–119` status PATCH).

### Low-stock / out-of-stock admin notification — **MISSING** at runtime

`notifyLowStock` is defined (`notifications.ts:135–143`). Grep shows **no callers**. `LOW_STOCK` email catalog key exists (`admin-email-catalog.ts:27`, `:406`). Admin notification UI can display the type (`NotificationBell.tsx:39`). Nothing fires it on decrement.

Customer restock alerts: `StockAlert` model (`schema.prisma:444`) + `POST /api/stock-alert` + `processRestockAlerts` when admin **increases** stock from 0 (`admin/products/[id]/route.ts:254–258`). That is customer-facing, not admin low-stock.

### Can Mrs. Prudent edit stock per variant? — **BUILT**

`/admin/products/[id]/edit` → `ProductFormPage` → `VariantManager` stock input (`VariantManager.tsx:140–146`). PATCH writes `stock: v.stock` (`admin/products/[id]/route.ts:191`). Products list can filter `stock=out` / `stock=in` (`admin/products/page.tsx:42–43`).

### Bulk stock update — **MISSING**

No bulk stock endpoint. Woo import **preview** parses CSV stock (`import/preview/route.ts:157–168`); **execute** hardcodes `stock: 0` (`import/execute/route.ts:84`). Re-import cannot restock the 464 variants. One product form at a time.

---

## Section 5 — Admin readiness for RTW

### Order list: filter, search, needs-action — **PARTIAL**

Search order # or email; filter `OrderStatus` and `PaymentStatus`; pagination 20 (`admin/orders/page.tsx:7–31`, `:87–117`). CSV export. Bulk cancel / delete (`AdminOrdersListClient.tsx:105–140`).

No “needs action today” queue (e.g. PAID + PROCESSING, or unpaid bank receipts). Those are reachable by combining paymentStatus=PAID and status=CONFIRMED/PROCESSING, but not a dedicated view. Bank receipts also appear on `/admin/payments` (shared).

### Fulfil: mark shipped, tracking, notify — **BUILT**

See §2.9. Tracking + carrier fields on the order (`schema.prisma:497–498`) and toolbar (`AdminOrderToolbar.tsx:241–254`).

### Refund or cancel vs append-only ledger — **PARTIAL**

Cancel: PATCH `{ status: "CANCELLED" }` (`AdminOrderToolbar.tsx:261`). `canTransitionOrder` allows CANCELLED/REFUNDED from any status (`order-status.ts:12`). Does not restore stock. Does not append a `Payment` row.

Refund: `{ recordRefund: { full, amountNGN, reason } }` (`admin/orders/[id]/route.ts:21–82`). Sets `paymentStatus: REFUNDED`, writes a line into `adminNotes`, sets order `status` to `REFUNDED` (full) or `PROCESSING` (partial). UI copy: issue the refund in the PSP dashboard as well (`AdminOrderToolbar.tsx:185`).

Ledger rule: “Never mutates amount on an existing row — pass a new reference for corrections / refunds” (`ledger.ts:342–344`). Postgres trigger `payment_ledger_append_only` blocks UPDATE of amount/FKs and DELETE (`prisma/migrations/20260808_payment_ledger/migration.sql:114–173`). The RTW refund path **does not** `appendPayment` a negative/correction row. Order flags change; the ledger still shows the original CONFIRMED `RTW_ORDER` payment.

### Product management — **BUILT**

Create `/admin/products/new`, edit `/admin/products/[id]/edit` (name, publish, price, images, variants, stock, colors, bundles). List filters (`admin/products/page.tsx:14–43`). Collections, import (stock forced 0). Coupons at `/admin/coupons` (not in sidebar).

### What she must leave admin (or hunt URLs) to do

| Task | Where |
|------|--------|
| Shipping zones | `/admin/shipping` — no sidebar link (`AdminSidebar.tsx:89–96` Shop section is products/import/collections/orders only) |
| Coupons | `/admin/coupons` — same |
| Put stock on 464 variants | Product edit, one product at a time; import will not help (`import/execute/route.ts:84`) |
| Configure Paystack / bank | `/admin/settings/developer` (SUPER_ADMIN) (`AdminSidebar.tsx:163–168`) or env — not an ADMIN-daily screen |
| Issue PSP refund | Paystack (or bank) dashboard — UI says so (`AdminOrderToolbar.tsx:185`) |
| Process a return | Email; no admin return screen |
| Pickup / courier booking | Outside the app |

Daily RTW fulfilment (open order → mark shipped → tracking → delivered) stays inside `/admin/orders/[id]`.

---

## Section 6 — What must hide, and how

### Customer-reachable atelier surfaces

| Surface | File |
|---------|------|
| `/atelier`, `/bespoke` | `atelier/page.tsx:27`, `bespoke/page.tsx:3` |
| `/bridal`, `/bridesals` | bridal gallery (house brand; still atelier-made copy) |
| `/consultation`, `/consultation/[bookingNumber]`, `/consultation/success` | `consultation/page.tsx:24` |
| `/track`, `/track/[token]` | `track/page.tsx:20` |
| `/quote/[approvalToken]` | `quote/[approvalToken]/page.tsx:13` |
| Navbar Atelier | `Navbar.tsx:22` |
| Footer Atelier, Track, Consultation | `Footer.tsx:17`, `:27`, `:30` |
| Homepage CategoryGrid Atelier card | `CategoryGrid.tsx:7–12` |
| Homepage BespokeJourney | `page.tsx:18` |
| Hero “BOOK CONSULTATION” | `cms-config.ts:111–112` |
| Shop ATELIER filter | `ShopBrowse.tsx:34` |
| PDP “Atelier Version” | `ProductDetailClient.tsx:331–344` |
| Account “My Atelier” nav: commissions, consultations, measurements, moodboards | `AccountSidebar.tsx:34–40` |
| Account dashboard bespoke + consultation widgets | `account/page.tsx:48–80` |

Direct URL: all of the storefront atelier routes plus `/quote/[approvalToken]` are public in middleware (`middleware.ts:92–98`).

### Existing flag / CMS mechanism — **MISSING** dedicated flag

No `FeatureFlag` model. No `FEATURE_*` / `ATELIER_*` env keys (repo grep empty). Closest CMS levers:

| Key | Effect | Citation |
|-----|--------|----------|
| `home_journey_enabled` | Hides Bespoke Journey section only | `cms-config.ts:165`, `BespokeJourney.tsx:13` |
| `home_journey_button_link`, `home_hero_button_*_link` | Retarget CTAs | `cms-config.ts:109–112`, `:181` |
| `footer_house_links` / `footer_client_links` | Edit footer URLs | `cms-config.ts:765–788` |
| `consultation_type_*_enabled` | Disable consultation offerings | `cms-config.ts:58` |
| `maintenance_mode_enabled` | Entire public site | `middleware.ts:77–80` |

Navbar Atelier is **hardcoded** (`Navbar.tsx:22`). CMS cannot remove it.

**Cleanest approach given current CMS pattern:** a `SiteSetting` toggle (same `cmsBool` / `getSetting` pattern as `home_journey_enabled` and `maintenance_mode_enabled`) read in **middleware** (and the account layout) to 404/redirect atelier customer routes, plus the same flag to omit nav/homepage/account links. Footer CMS edits alone leave `/atelier` live. That is a statement of the current pattern, not an implementation.

### What breaks if atelier is hidden (routes gated, code kept)

| Surface | Effect |
|---------|--------|
| RTW cart/checkout/pay | Continues (no bespoke imports) |
| Account dashboard | Still queries bespoke/consultations; empty lists |
| Account sidebar | Dead links unless `AccountSidebar.tsx:34–40` is gated |
| Shared Payment / User / email outbox | Unchanged |
| Guest welcome / bank-confirm emails | Already point at `/track/{orderNumber}`; gating `/track` makes those links fail until the URL is changed to `/checkout/success` or `/account/orders` |
| `autoOnboardClient` | Still creates `ClientProfile` on guest RTW pay |
| Admin | Atelier Pipeline stays in sidebar unless `AdminSidebar.tsx:72` is gated; not a customer issue |
| Shop ATELIER filter | Still queries `ProductType.BESPOKE` unless `ShopBrowse.tsx:34` is removed |

---

## Section 7 — Gap register

Sorted by severity. “Blocks launch?” = customer cannot buy a garment **and** receive it, or Mrs. Prudent cannot fulfil, **in code after stock and PSP are set**. Known empty stock and missing keys are listed because they are the current stop.

| # | Gap | Severity | Blocks launch? | Files | Complexity |
|---|-----|----------|----------------|-------|------------|
| 1 | All variants stock 0; Woo execute ignores CSV stock and writes 0 | CRITICAL | Yes | `import/execute/route.ts:84`; `ProductVariant.stock` `schema.prisma:392` | M to set stock on a launch SKU set in admin; L to bulk-edit 464 |
| 2 | No usable Paystack/Flutterwave/Stripe/Monnify keys; dummy bank `0123456789` excluded | CRITICAL | Yes | `payments/config.ts:103–157`; `PaymentMethodSelector.tsx:126–129` | S (config) |
| 3 | Logged-in add-to-bag does not POST `/api/cart`; checkout uses server cart | HIGH | No (guest path works) | `ProductDetailClient.tsx:92–120`; `CartSyncProvider.tsx:51–87`; `orders/create/route.ts:78–90`; `CheckoutClient.tsx:387–397` | M |
| 4 | Stock not reserved; decrement has no remaining-stock guard | HIGH | No | `orders/create/route.ts:133–143`; `order-payment.ts:69–74` | M |
| 5 | Guest RTW has no public tracker; `/track` is bespoke-only; emails still send `/track/{orderNumber}` | HIGH | No | `track/page.tsx:37`; `client-onboarding.ts:147–148`; `admin/payments/[id]/confirm/route.ts:102`; `Footer.tsx:27` | M |
| 6 | No customer-facing atelier kill-switch; navbar Atelier hardcoded; routes public | HIGH | No (column definition); required for an RTW-only *site* | `Navbar.tsx:22`; `middleware.ts:92–98`; `cms-config.ts:165` | L (middleware + nav + account) |
| 7 | Refund/cancel do not append ledger rows or restock | HIGH | No | `admin/orders/[id]/route.ts:59–82`; `ledger.ts:342–344`; `order-status.ts:12` | M |
| 8 | `notifyLowStock` never called | MEDIUM | No | `notifications.ts:135–143` | S |
| 9 | No bulk stock update; import cannot restock | MEDIUM | No (edit UI exists) | `VariantManager.tsx:140–146`; `import/execute/route.ts:84` | L |
| 10 | No RTW return/RMA workflow | MEDIUM | No | no model in `schema.prisma`; `legal/returns/page.tsx:16` | L |
| 11 | No pickup option | MEDIUM | No (Lagos zone exists) | `ShippingZone` `schema.prisma:685–700` | M |
| 12 | Shipping + coupons admin screens omitted from sidebar | MEDIUM | No | `AdminSidebar.tsx:89–96`; `shipping/page.tsx:4`; `coupons/page.tsx:4` | S |
| 13 | No “action today” fulfilment queue | MEDIUM | No | `admin/orders/page.tsx:14–31` | M |
| 14 | Cart page has no coupon (coupon is checkout-only) | LOW | No | `cart/page.tsx`; `CheckoutClient.tsx:218` | S |
| 15 | PDP free-shipping threshold ₦150,000 vs seed Lagos ₦250,000 | LOW | No | `ProductDetailClient.tsx:327`; `seed.ts:34` | S |
| 16 | Shop listing ATELIER/BRIDAL filters and homepage atelier cards | LOW | No | `ShopBrowse.tsx:30–36`; `CategoryGrid.tsx:7–24` | S |
| 17 | Account chrome labelled “My Atelier” / `/ ATELIER` | LOW | No | `AccountSidebar.tsx:34–40`, `:149` | S |
| 18 | Review-request cron skips orders with `userId: null` | LOW | No | `jobs/review-requests.ts:18–23` | S |
| 19 | Staging/prod `ShippingZone` row presence not verified in this pass | UNCLEAR | No if seed ran; Custom Quote ₦0 if empty | `seed.ts:26–57`; `shipping.ts:64–73` | S to check DB |

---

## Section 8 — Minimum path to launch

Shortest ordered list for: **a customer in Lagos can buy a dress and receive it, and Mrs. Prudent can fulfil it.**

1. **Put stock on the garments that will sell.** Admin product edit, variant Stock column (`VariantManager.tsx:140–146`). Importer will not do this (`import/execute/route.ts:84`).
2. **Configure a payable method.** Usable Paystack keys and/or a real bank account (not `0123456789`) (`payments/config.ts:147–157`).
3. **Confirm shipping zones exist** (seed names Lagos — Express / Nigeria — Standard). If missing, run the bootstrap seed or create them at `/admin/shipping`. Lagos Express is the Lagos rate (`seed.ts:29–36`).
4. **Mrs. Prudent fulfils on `/admin/orders/[id]`:** Confirm → Processing → Mark shipped (tracking optional) → Mark delivered (`AdminOrderToolbar.tsx:21–26`). Shipped/delivered emails already send (`admin/orders/[id]/route.ts:134–157`).

Nothing else is required for that sentence. Guest checkout, address, shipping quote, order row, stock decrement on pay, confirmation email, and the shop status machine are in the tree.

### First month after launch

- Server-side atelier hide (middleware + nav + account + shop filter + homepage cards), using a `SiteSetting` toggle in the existing CMS pattern.
- Fix logged-in cart sync so `/api/cart` is written on add/qty/remove.
- Guest RTW track page (or retarget emails from `/track/{orderNumber}` to `/checkout/success` / `/account/orders`).
- Call `notifyLowStock` (or drop the dead helper).
- Bulk stock tool; stop execute from forcing `stock: 0` if CSV stock is meant to apply.
- Append refund/cancel correction rows on `Payment`; restore stock when appropriate.
- Sidebar links for Shipping and Coupons.
- Returns intake (even a status + restock checkbox).
- Pickup as a shipping option if the house wants Surulere collection.
- Align PDP free-shipping copy with the live Lagos zone threshold.
- Relabel account “My Atelier” for RTW-only customers.

---

## Verdict snapshot (purchase path)

| Step | Verdict |
|------|---------|
| 1 Discover | PARTIAL |
| 2 Product page | BUILT |
| 3 Add to bag | PARTIAL |
| 4 Cart | PARTIAL |
| 5 Checkout | BUILT |
| 6 Payment | BUILT (ops: no keys) |
| 7 Confirmation | BUILT |
| 8 Post-purchase | PARTIAL |
| 9 Fulfilment | BUILT |
| 10 Delivery / reviews / returns | PARTIAL (reviews cron BUILT for accounted users; returns MISSING) |
| Shipping model | BUILT |
| Pickup | MISSING |
| Stock decrement on pay | BUILT |
| Stock reservation | MISSING |
| Admin low-stock notify | MISSING |
| Per-variant stock UI | BUILT |
| Bulk stock | MISSING |
| Hide-atelier flag | SUPERSEDED (Slice G2: pages stay live; `atelier_bookings_enabled` gates new bookings only) |

---

## Slice G2 — Atelier visible, bookings disabled (26 Aug 2026)

Slice G's G4 hide (`atelier_storefront_enabled` + middleware rewrite to `/__storefront-hidden`) is withdrawn. Public atelier pages stay live for story and SEO.

- **Flag:** `atelier_bookings_enabled` (Admin → Settings → General). Missing or anything other than `"true"` is off (fail-closed).
- **UI:** `/consultation` renders offerings; type cards are not selectable; schedule and payment steps do not render. Enquire CTA → `/contact?subject=Atelier%20Commission`.
- **API:** `POST /api/consultations/create` and `POST /api/consultations/upload` return **403**. Consultation payment-initiate and bank-transfer stay open so existing bookings remain payable.
- **Nav:** Atelier / Bridal / Book Consultation restored. Footer **Track** stays hidden (bespoke-only; no RTW tracker).
- **Homepage:** CategoryGrid, ShopBrowse chips, hero BOOK CONSULTATION, and `BespokeJourney` (gated only by `home_journey_enabled`) restored.

