# Claude handover: Prudential Atelier staging audit

**Date:** 19 Aug 2026  
**Branch to work from:** `staging` (not `main`)  
**App:** `prudential-atelier/`  
**Verify against:** https://staging.prudentgabriel.com  
**VPS if DNS fails:** `5.189.168.55 staging.prudentgabriel.com`  
**This document:** code audit of security, speed, and UI/UX, plus ordered work. Not a live exploit pass.

Paste this whole file into a new Claude session. Do not also paste `docs/PIPELINE_AUDIT.md`. That file is from 7 Aug and is wrong on several shipped systems (see §0).

---

## 0. Read this first

### What this product is

Prudential Atelier is a Next.js 14 App Router fashion house: RTW shop, CMS marketing site, consultation booking, quotations/invoices, and a 13-stage bespoke atelier with client approvals. Auth.js v5 (JWT cookies), Prisma/Postgres, Cloudinary, Paystack/Flutterwave/Stripe/Monnify, Resend, Docker standalone behind Traefik on a Coolify VPS.

Public URL on staging: https://staging.prudentgabriel.com  
Production (do not treat as the working environment): https://prudentgabriel.com

### Hard rules

- Create feature work from `staging`. Merge to `main` only when the user explicitly asks to ship production.
- Do not change production compose, `.env.production`, Traefik production routers, or the `main` deploy workflow unless asked.
- Prisma naming is camelCase, primary key `id` (cuid). Do **not** add `tbl_` prefixes. Do not rename existing columns.
- Do not commit `.env` files.
- Do not start a visual redesign. Keep chocolate / cream / gold / Cormorant+Lora+Jost. Session 7 olive/Bodoni was reverted on purpose.
- Do not re-implement systems that already shipped (next subsection).

### Already shipped after the 7 Aug pipeline audit. Do not rebuild.

| System | Evidence |
|---|---|
| Stage gates (notes, media, deposit, client approval, zero balance on delivery) | `src/lib/atelier/can-complete-stage.ts`, `stage-requirements.ts`. Tests: `scripts/test-stage-walk.ts`, `test-stage-gate.ts` |
| Payment ledger model | `prisma/schema.prisma` model `Payment` (~1862). `src/lib/payments/ledger.ts` |
| Quotation PDF, versioning, sequence numbers | commit `d9ac84d` (Sprint C) |
| Post-delivery: receipt confirm, alterations, archive | commit `4983f2a` (Sprint D) |
| Staging/production Docker + Traefik + GHCR | commits through `2cf988f` |

`docs/PIPELINE_AUDIT.md` still says those are missing. Ignore it for those items.

### Stale docs (do not follow as source of truth)

- `prudential-atelier/CHECKLIST.md` still talks about Vercel. Runtime is GHCR + VPS compose.
- `doc/DEMO-GUIDE.md` uses `admin@prudentialatelier.com`. Seed email is `admin@prudentgabriel.com`.
- `doc/cursor-session-7-design-overhaul.md` specifies olive/Bodoni. Live tokens are choc/cream.
- `doc/cursor-session-8-admin-redesign-darkmode-scroll.md` says admin stays light. Live admin has a theme toggle.

---

## 1. What is built and working

### Storefront

- Home: hero carousel (CMS), best sellers, categories, bespoke journey, testimonials, brand quote, PFA banner, journal preview. Eight sections, not the ten in DEMO-GUIDE.
- Shop `/shop`, PDP `/shop/[slug]`, RTW `/rtw`, collections `/collections`, bridal `/bridal`, kids `/kids`, atelier `/atelier`.
- Cart + drawer, 3-step checkout, payment success/pending/failed.
- Consultation booking `/consultation` with slot logic and four gateways.
- Journal, about (CMS), contact, size guide, careers, legal pages, maintenance mode.
- Public quote `/quote/[approvalToken]`, invoice `/invoice/[token]`, track `/track`.
- Galleries live on atelier/bridal/kids with keyboard lightbox. There is no dedicated `/gallery` route. That is fine unless someone asks for one.

### Account

Far beyond the original 7-page spec: dashboard, profile, addresses, RTW orders, bespoke orders + pay, consultations, wishlist, loyalty, wallet, referrals, measurements, moodboards, style profile, notifications, transactions, reviews.

### Admin / staff

Executive dashboard, products, WooCommerce/CSV import, collections, orders, payments, coupons, invoices, quotations, bespoke pipeline + order detail, consultations, consultants, clients, team/staff/attendance, CMS (pages, blog, media, email templates, send-email), gallery, reviews, careers, settings (including developer), reports, activity/error logs, cron jobs UI (`/admin/system/jobs`). Staff portal: tasks, time, assigned orders.

### Auth and money (the parts that are sound)

- Auth.js v5 JWT, Prisma adapter, bcrypt cost 12, optional Google.
- `requireSuperAdminApi` for user role changes.
- Settings GET masks PASSWORD fields. Public settings exclude PASSWORD.
- Order create and Paystack initiate take amounts from the database, not the client.
- `/api/account/orders`, addresses, payment-methods scoped by `userId`.
- Paystack webhook HMAC-SHA512 of body is correct. Stripe `constructEvent` is correct.
- Docker: non-root `nextjs` user, compose binds `127.0.0.1:3010/3011`.
- Prisma `$queryRaw` is parameterized. No Prisma in client components.
- `NEXT_PUBLIC_*` are public keys / app URL only.

### Performance that is already good

- Shop cards: `next/image` + `sizes` + `priority` on first four + Cloudinary `w_600,q_auto,f_auto`.
- Shop list: `Promise.all([findMany, count])`, limit capped at 48, infinite scroll.
- PDP dynamically imports reviews and related products.
- QR scanner and checkout confetti dynamically imported.
- Logo `unstable_cache` + tag. HTTP `s-maxage` on collections/gallery/product-slug APIs.
- Docker `output: "standalone"`. Image `minimumCacheTTL` 1 year, AVIF/WebP.
- Crons are HTTP routes with `CRON_SECRET`, not in-request work. Batch/budget guards exist.
- Named lucide imports. No moment.

---

## 2. Security. Fix this first.

Middleware skips **all** `/api/` routes (`src/middleware.ts` ~26). Every API must auth itself. Admin **pages** are gated. That is not enough.

### P0

**S1. Payment verify GET can mark a different pending order paid**  
Files: `src/app/api/payment/paystack/verify/route.ts:8-35` (same pattern on Flutterwave, Monnify, consultation verify, verify-bespoke). `src/lib/order-payment.ts:23-36`.  
`fulfillPaidOrder` only checks `paymentStatus === PENDING`. It does not check amount, currency, or that the PSP reference belongs to that `orderId`.  
Exploit: pay a cheap PENDING order, then hit verify with that `reference` and an expensive `orderId`.  
Fix: bind `result.metadata.orderId === order.id` (or stored reference), compare paid amount to `order.total` in the right units, reject mismatch. Use `updateMany({ where: { id, paymentStatus: PENDING } })` inside the transaction. Apply the same bind on webhooks.

**S2. Any `*_MANAGER` is a full admin on APIs**  
File: `src/lib/admin-auth.ts:5-12` `isAdminRole` treats `role.endsWith("_MANAGER")` as admin. `ROLE_PERMISSIONS` exists in `src/lib/roles.ts` and is used in the sidebar UI, not APIs.  
Exploit: `CONTENT_MANAGER` can `PATCH /api/admin/settings/PAYMENTS`, confirm bank transfers, list orders, sign Cloudinary uploads.  
Fix: per-route `hasPermission` / `requireGeneralAdminApi` / `requireSuperAdminApi`. Payments, users, and encrypted settings are not content-manager work.

**S3. Known SUPER_ADMIN password, re-promoted on every staging boot**  
File: `prisma/seed.ts` ~598 hashes `Admin@PA2024!` for `admin@prudentgabriel.com`. Staging default `RUN_DB_SEED_ON_START=safe` runs on container start. The upsert `update` path re-sets `role: SUPER_ADMIN`.  
Fix: create admin only from `ADMIN_EMAIL` / `ADMIN_PASSWORD` env. Never hardcode. Do not upsert role on an existing user. Rotate the staging password now if it was ever used. Demo customer `Customer@2024` is in `seed-fixtures.ts`. Never run fixtures on staging/prod.

**S4. Public track API returns the entire Prisma row**  
File: `src/app/api/track/[token]/route.ts:9-21`. Includes `clientEmail`, `clientPhone`, `sessionNotes`, `paymentRef`, `paymentReceiptUrl`, `receiptConfirmToken`. `/track?ref=` maps guessable `BQ-YYYY-NNNNN` to the token with no auth.  
Fix: public DTO only (stage, status, first name). Never return tokens, emails, phones, notes, payment refs. Rate-limit enumeration.

**S5. Receipt confirm token is not bound to the logged-in customer**  
File: `src/lib/bespoke-receipt.ts:66-77`. The email-mismatch branch is empty. Combined with S4, any logged-in CUSTOMER with the leaked token can confirm.  
Fix: require email match or ownership even on the token path. Stop leaking the token from track.

**S6. Encryption fallback is a string in the repo**  
File: `src/lib/encryption.ts:9-14` falls back to `"prudent-gabriel-settings-key-2024"`.  
Fix: throw if `ENCRYPTION_KEY` / `SETTINGS_ENCRYPTION_KEY` is missing. Rotate payment secrets after setting a real key. Confirm staging env actually has the key.

### P1

| ID | Finding | File |
|---|---|---|
| S7 | Flutterwave webhook HMAC of body. Real `verif-hash` is a static dashboard secret. Webhooks likely 401, so fulfillment depends on the broken GET verify. | `src/lib/payments/flutterwave.ts:96-101` |
| S8 | Bespoke Flutterwave/Stripe verify credits **stored** `order.balance`, not paid amount. | `src/app/api/bespoke/[orderId]/verify-payment/route.ts:93-141` |
| S9 | Unauthenticated Cloudinary uploads. MIME from `file.type` only. | `api/careers/upload`, `api/consultations/upload`, `api/upload/receipt` |
| S10 | No rate limit on login/register/forgot-password. Register returns 409 "Email already registered". `checkRateLimit` is in-memory Map, used only on careers apply. | `src/lib/rate-limit.ts`, `api/auth/register` |
| S11 | Password reset is unfinished. Token stored, email never sent (`TODO: Stage 9`). UI posts token to `/api/auth/reset-password`. That route **ignores the token** and requires a session. Template `sendPasswordResetEmail` in `src/lib/email.tsx:236` is unused. | `api/auth/forgot-password/route.ts:31`, `api/auth/reset-password/route.ts` |
| S12 | Consultation success by `CB-YY-NNNNN` returns full booking JSON with no auth after payment. | `api/account/consultations/[id]/route.ts:45-49` |
| S13 | Guest RTW order lookup: `PA-YY-NNNNN` (5-digit space) + email. | `api/orders/[orderNumber]/route.ts:37-44` |
| S14 | `fulfillPaidOrder` reads PENDING outside the transaction, then updates without `paymentStatus: PENDING`. Two concurrent verifies can both decrement stock. Consultation fulfill is the better pattern. | `src/lib/order-payment.ts:23-47` vs `consultation-payment.ts:86-90` |
| S15 | `api/cron/update-performance` skips auth when `CRON_SECRET` is unset. Other crons use `verifyCronRequest` (fail-closed). Always use that helper. | `update-performance/route.ts:19-23` |
| S16 | `PFA_VERIFY_METHOD` defaults to `mock` (always valid for `PFA/YYYY/NNN`). Unauthenticated. | `src/lib/pfa-verify.ts:12-50` |
| S17 | No CSP / HSTS / X-Frame-Options in `next.config.mjs`. Traefik file only does HTTP→HTTPS + gzip. |
| S18 | Saved Paystack auth codes: looks up customer by attacker-supplied email, stores client-supplied `authCode`. | `api/account/payment-methods/route.ts:79-108` |

### P2 (do after P0/P1)

- Webhook URLs still documented as Vercel in `src/lib/payments/config.ts`. Staging is Coolify. If PSP dashboards still point at Vercel, webhooks never arrive and everything depends on GET verify (S1).
- CMS HTML via `dangerouslySetInnerHTML` with no sanitizer: journal, product details, careers, legal. Combined with S2 this is storefront XSS.
- Unauthenticated `POST /api/invoice/[token]/email-copy` is a mail bomb (token is cuid, entropy is OK, still rate-limit).
- Contact / newsletter / stock-alert / coupon-validate: no rate limit.
- Bank-transfer fallback dummy account `0123456789` if env unset (`src/lib/payments/index.ts:36-40`).
- Invite-accept password policy is `min(8)` vs register uppercase+digit.
- JWT default lifetime ~30 days. No session revoke on password change.
- HMAC compares use `===`. Use `timingSafeEqual`.

### Security acceptance (first slice)

1. Paying order A cannot mark order B paid. Covered by a test, not only a comment.
2. A `CONTENT_MANAGER` session gets 403 on payment settings, bank-transfer confirm, and user admin.
3. `GET /api/track/:token` JSON has no email, phone, paymentRef, or receiptConfirmToken.
4. `encrypt()` throws if `ENCRYPTION_KEY` is unset.
5. Seed no longer writes `Admin@PA2024!`. Staging admin password rotated out of band.
6. Forgot-password sends mail via existing `sendPasswordResetEmail`. Reset endpoint consumes the hashed token, single use, expiry, no session required.

---

## 3. Speed

The single highest-leverage bug: **ISR is declared on pages and cancelled by the layout.**

### High

**P1. `export const dynamic = "force-dynamic"` on the storefront layout**  
`src/app/(storefront)/layout.tsx:20`. Children set `revalidate = 300`. Next.js will not statically cache them. Every public HTML request hits Node + DB. Layout also `auth()`, `enforcePublicMaintenance()`, two CMS queries.  
Fix: drop `force-dynamic`. Cache CMS and maintenance (`unstable_cache` + `revalidateTag` on admin save). Session in a small client island, not a layout-wide dynamic render.

**P2. PDP is also `force-dynamic`**  
`src/app/(storefront)/shop/[slug]/page.tsx:16` plus dead `revalidate = 300` plus `generateStaticParams` for 20 slugs. Metadata query and page query load the same product twice.  
Fix: remove force-dynamic. One cached fetch. Draft/unpublished only for admin.

**P3. Navbar collections N+1**  
Every public page client-fetches `/api/collections`. That route loads all collection fields then, per collection, two `findMany`s to count products (`src/lib/collection-products.ts`). Navbar only needs `{ name, slug }`.  
Fix: pass names from the server layout, or add `/api/nav/collections` with a tight select and keep `s-maxage=300`.

**P4. Missing indexes**  
`Product`: unique `slug` only. Lists filter `isPublished`, `category`, `type`, `isFeatured`, `createdAt`, `orderCount`, `basePriceNGN`.  
`ProductImage` / `ProductColor`: no `productId` index (Prisma does not auto-index FKs on Postgres). Variants already have one.  
`Order` / `OrderItem`: zero indexes. Admin analytics and account order lists will seq-scan.  
`Review`: only `consultationId`. PDP loads `where: { isApproved: true }`.  
Add the composites listed in the canvas. `pg_trgm` on `Product.name` if search stays `contains`. Stop searching `description` (`@db.Text`) on typeahead.

**P5. Shop list over-fetch**  
`src/lib/products-list-query.ts:148-191` returns full rows including `description`/`details`. Cards never show description (`ShopBrowse.tsx`). Include all variants and color `imageUrl`.  
Fix: `select` list fields. Primary image only unless hover needs two.

**P6. Hero is LCP and unoptimized**  
`src/components/sections/HeroCarousel.tsx:107-126` raw `<img>` / `<video>`, no `sizes`, no `priority`, no `optimizeImageUrl`. Shop cards already do this right. Copy that pattern.

**P7. Lenis + Framer Motion on the chrome**  
`SmoothScroll` mounted from root `src/app/layout.tsx:75` on every public page (skips admin/staff/account only). `Navbar.tsx` imports `framer-motion`. That is the global JS tax.  
Fix: delete or disable Lenis on shop/PDP. CSS for nav dropdowns.

### Medium

- Collection pages load the entire tagged catalog then sort in JS. No `take`. `src/lib/collection-products.ts:80-137`.
- Homepage BestSellers: two sequential queries, full `variants: true`. Cards need one image + price.
- Root layout `await auth()` then `await getLogoSettings()` sequential; storefront layout `auth()` again. `Promise.all`. Consider two fonts, not three.
- Maintenance and CMS reads are uncached live queries (`src/lib/maintenance.ts`, `src/lib/cms.ts`).
- Account order list: no pagination, includes product images.
- Admin consultations: three sequential queries. Analytics `findMany` of a year of paid orders to sum in JS.
- `/api/products` is force-dynamic + `auth()` + `no-store`, so infinite-scroll cannot be CDN cached for anonymous shoppers.
- `FilterPanel` / `FilterDrawer` exist and are unused. Query layer already supports sizes, price, search, in-stock. Either wire them or delete them.
- `@tanstack/react-query` wraps the whole app in `RootProvider`. Mount it on admin/account only.
- Unused deps: `axios`, `next-cloudinary` (never imported).

### Speed acceptance

- Storefront layout is not `force-dynamic`. Homepage HTML can be cached ≥ 60s after a CMS save invalidates the tag.
- Navbar does not run per-collection count queries.
- Hero LCP uses `next/image` + Cloudinary width, `priority` on the centre slide.
- `EXPLAIN` on shop list uses an index on `(isPublished, createdAt)` or the active sort key.
- Lenis is gone from `/` and `/shop`.

---

## 4. UI / UX

### Polarised quality

Finished: navbar, galleries + lightbox, consultation booking, CMS marketing pages, account shell, admin executive home, notification centre, maintenance page, kids theme, email layout chrome.

Behind: checkout, cart a11y, press, our-story, leftover wine/gold on pay vs choc storefront, admin tables on a phone.

### Checkout (highest UX risk after password reset)

File: `src/components/checkout/CheckoutClient.tsx`

- Guest identity is step 2. Coupon apply is step 1 and requires email (`:112-116`). Guests cannot apply `WELCOME10` without bouncing. DEMO-GUIDE assumes they can.
- Stepper is numbered circles with no "Bag / Delivery / Payment" labels (`:343-356`).
- Guest fields are unlabeled placeholders (`:453-483`). The branded `Input` primitive exists and is unused here.
- "Continue to payment" does not validate address, email, or shipping (`:509-511`). Failures wait until Pay.
- Invalid coupon uses `text-error`. There is no `--error` in `tokens.css` (only `--success/--warning/--danger`). The message may render unstyled.
- Qty ± and Remove have no `aria-label` (`:372-396`). Same on cart page `:51-65`.
- Checkout CTAs are still wine/gold. Storefront is choc/cream. Shop → bag → pay feels like two products.
- Cart **drawer** shows points. Cart **page** does not.

### Accessibility

- No skip link anywhere.
- Global `*:focus-visible` exists. Checkout, contact, footer newsletter use `outline-none` without a replacement ring.
- Colour swatches: `title` only, no `aria-label` (`ProductDetailClient.tsx:177-186`). Size buttons: no `aria-pressed`.
- Product/cart/checkout/journal images often `alt=""`.
- Contact page uses emoji in visual labels (`📍` `📱`).
- Theme toggle renders a no-op button until hydrate (`ThemeToggle.tsx:15-24`).
- Lightbox keyboard + aria is good. Contact form labels are good. Nav icon buttons have aria-labels.

### Content / stubs

- Password reset page promises an email. API never sends it. This is both security S11 and a UX lie.
- Abandoned-cart cron: `src/app/api/cron/abandoned-cart/route.ts` returns `{ ok: true }` and does nothing (`TODO: Stage 9`).
- Press: most article URLs are `#` (`press/page.tsx:16-56`).
- About hero strip and `/our-story` use Unsplash. `/our-story` is a second, non-CMS narrative. `/about` is the CMS page. Deduplicate.
- Contact default phone `+2348012345678` (`contact/page.tsx:70-71`). About Abuja address `"Plot 1234, Wuse Zone 5"`.
- Account sidebar: "My Commissions" and "Ready-to-Wear" both go to `/account/orders` (`AccountSidebar.tsx:36-37`).
- Two navbars exist: live `public/Navbar`; leftover `layout/Navbar` via `StorefrontSiteHeader`.
- Admin tables: `min-w-[640px]`–`[900px]`, overflow-x only. Session 5 already flagged this.
- PFA verify default mock. `db` method returns "DB method not yet configured".
- Upload without Cloudinary returns a dummy PDF / sample video.

### Design system (do not churn)

Canonical live tokens: `--choc #442913`, cream, sand, `--gold #C9A84C`, fonts Cormorant Garamond / Lora / Jost. Leftover `--olive` and `--wine` still appear on shop hover, checkout, emails. Prefer choc/gold. Do not restyle admin as a side quest. Do not put the dark-mode toggle debate on the critical path.

### UI acceptance (first slice)

- Guest can apply a coupon after entering email, without a toast that tells them to "go to delivery first" as the only path.
- Continue-to-payment refuses empty address/email/shipping.
- Checkout error text is visible (map to `--danger`).
- Qty, Remove, colour, size controls have accessible names.
- Password-reset email actually arrives (ties to S11).
- Fake contact phone and Unsplash about strip removed or replaced with CMS.

---

## 5. Suggested order of work

Do not parallelise all three tracks. Security P0 can lose money.

### Slice A. Money and secrets (do now)

1. S1 payment bind + webhook amount checks + Flutterwave `verif-hash`.
2. S14 fulfillment race (`updateMany` PENDING).
3. S6 fail closed without `ENCRYPTION_KEY`.
4. S3 stop hardcoded seed password. Ask the user to rotate staging admin.
5. Confirm PSP webhook URLs point at `staging.prudentgabriel.com`, not Vercel.

### Slice B. Authz and PII

6. S2 permission checks on admin APIs (start with settings/PAYMENTS, payments confirm, users).
7. S4 track DTO. S5 receipt-confirm bind. S12 consultation public DTO.
8. S9 authenticate uploads. S10 rate-limit `/api/auth/*` and NextAuth credentials.
9. S11 send reset email + token-based reset route.
10. S15 always `verifyCronRequest`. S16 do not default PFA verify to mock in staging/prod.

### Slice C. Speed of the public site

11. Drop storefront + PDP `force-dynamic`. Cache CMS/maintenance.
12. Navbar light collections. Slim shop list select. Product/image/order indexes.
13. Hero `next/image`. Remove Lenis from storefront. Framer Motion off navbar.

### Slice D. Checkout and honesty

14. Checkout labels, stepper names, validation, guest coupon, `text-error` token, choc CTA.
15. Skip link + labelled qty/swatches. Real alt text on cart/PDP.
16. Replace fake contact/about/press content. Split or merge account Commissions vs RTW. Implement or disable abandoned-cart cron (do not leave a stub that reports success).

---

## 6. Files Claude will touch first

```
prudential-atelier/src/lib/order-payment.ts
prudential-atelier/src/app/api/payment/paystack/verify/route.ts
prudential-atelier/src/app/api/payment/flutterwave/verify/route.ts
prudential-atelier/src/app/api/payment/monnify/verify/route.ts
prudential-atelier/src/lib/payments/flutterwave.ts
prudential-atelier/src/lib/admin-auth.ts
prudential-atelier/src/lib/encryption.ts
prudential-atelier/prisma/seed.ts
prudential-atelier/src/app/api/track/[token]/route.ts
prudential-atelier/src/lib/bespoke-receipt.ts
prudential-atelier/src/app/api/auth/forgot-password/route.ts
prudential-atelier/src/app/api/auth/reset-password/route.ts
prudential-atelier/src/app/(storefront)/layout.tsx
prudential-atelier/src/app/(storefront)/shop/[slug]/page.tsx
prudential-atelier/src/components/checkout/CheckoutClient.tsx
```

Existing test style to copy: `prudential-atelier/scripts/test-stage-walk.ts`, `test-stage-gate.ts`. Add payment-bind tests in the same pattern.

---

## 7. Open questions for the user (do not guess)

1. Has `admin@prudentgabriel.com` / `Admin@PA2024!` been rotated on staging? If not, rotate before any public demo.
2. Is `ENCRYPTION_KEY` set in `/opt/prudentgabriel/deploy/.env.staging`?
3. Where do Paystack/Flutterwave/Stripe webhooks currently point (Vercel vs staging domain)?
4. Should `CONTENT_MANAGER` keep read access to orders, or UI-only?
5. Abandoned-cart email: implement, or remove the cron route so it stops reporting success?
6. `/our-story`: delete in favour of CMS `/about`, or make it CMS-backed?

---

## 8. Out of scope unless asked

- Production deploy / `main` / Traefik production routers
- Visual redesign, new typeface, olive revival
- Rebuilding stage gates, Payment ledger, quotation PDF, post-delivery
- Dedicated `/gallery` route
- Redis (none today; in-memory rate limit is a known limit, a simple per-process limit is still better than none)
- Lighthouse number-chasing before Slice C (force-dynamic makes the score a lie)
