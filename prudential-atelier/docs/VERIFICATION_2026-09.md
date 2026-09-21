# Verification — what is actually done (2026-09-21)

Read-only pass over `prudential-atelier/` at `staging` = `48737d5`, the running site at `https://staging.prudentgabriel.com`, and GitHub Actions. Nothing in the app, database or hosts was changed. Where an earlier report and the code disagree, the code wins and the disagreement is called out.

**Verdicts:** `DONE` = in code, committed, and live on staging. `PARTIAL` = some of it, or built but not live. `NOT DONE`, `REGRESSED`, `UNCLEAR` (with what would settle it).

Staging probes were made with `curl` on 2026-09-21 between 22:30 and 23:30 UTC. HTTP evidence below is quoted from those responses.

---

## 0. Where things stand

| Item | Finding | Evidence |
|---|---|---|
| `staging` HEAD, local vs origin | Both `48737d5` | `git rev-parse --short staging origin/staging` → `48737d5 48737d5` |
| `main` / production | `origin/main` = `48737d5`. `staging` is 0 ahead, 0 behind | `git rev-list --count origin/main..origin/staging` → `0` |
| Production running that commit | Deploy run `35662417680` (docker-publish-ghcr-production, SHA `48737d5`) completed `success` 22:29 UTC | `gh run list` |
| Uncommitted tracked changes | None | `git status --short` shows untracked files only |
| Untracked files | `scripts/tmp-ad3-product-audit.ts`, `scripts/tmp-check-urls.sh`, `scripts/tmp-measure-shop.mjs`, `scripts/tmp-probe-media.ts`, `scripts/tmp-probe-private.ts`, `scripts/tmp-x7-backup.sh`, `scripts/tmp-x7-check.sh`, `tmp-email-previews/`, `tmp-gallery-preview/` (contains `unpublish-allure.mjs`, see AU) | `git status --short` |
| `tsc --noEmit` | Pass | CI run `35662412314` (staging, `48737d5`) step "Typecheck" success; local run exit 0 |
| `next lint` | Pass, 16 `no-img-element` warnings, 0 errors | local `npx next lint` exit 0; CI step "Lint" success |

### Test suite — all 61 `test:*` scripts

Run locally against the Neon **dev** database (`ep-young-rice…`, from `.env.local`), 300 s timeout each, no `ALLOW_FIXTURES`.

**54 pass:** slice-au, slice-as, slice-am, slice-ar, slice-at, slice-av, slice-aw, slice-az12, shop-categories, slice-ai, slice-al, slice-aj, stage-gate, cron, email-outbox, slice-y, slice-z1, slice-z2, slice-z3, slice-z4, slice-z5, slice-ae, slice-af, slice-ah, slice-ad, slice-ad2, slice-ad2b, slice-ad3, slice-ab, slice-x, slice-w, slice-v, slice-u, slice-ag, slice-aq, slice-aq2, slice-s, slice-r, slice-q, slice-p, slice-o, slice-l, slice-k, slice-n, slice-m, slice-j, slice-i, slice-h, payment-bind, bespoke-balance-bind, token-rate-limits, ci, rtw-launch, authz.

**7 fail:**

| Script | Cause (from the log) |
|---|---|
| `test:slice-aa`, `test:slice-an`, `test:slice-ao`, `test:post-delivery` | ``The column `BespokeOrder.trackingTokenEnc` does not exist in the current database.`` |
| `test:slice-ac`, `test:quotation` | ``The column `Quotation.approvalTokenEnc` does not exist in the current database.`` |
| `test:stage-walk` | `refused — set ALLOW_FIXTURES=true to run demo/fixture seeds.` |

The six column failures are the dev database lacking the AZ3 migration, not a code defect. `npx prisma migrate status` against dev: `The migration have not yet been applied: 20260921_slice_az3_capability_tokens`. No Neon connection errors (P1001/P1017) or timeouts occurred in any log.

Dev database also carries two stale migration names not in the repo: `20260808_stage_completion_live_unique` and `20260808121130_cron_run_has_more`. They were renamed to `20260809_…` / `20260808123100_…` in `81d472d` and `ddeb8e1`. Bookkeeping drift on dev only.

### Pending migrations on staging's database — `DONE` (indirect)

Staging's database is on the VPS and was not read. Evidence it has `20260921_slice_az3_capability_tokens`:
- `entrypoint.sh:20` runs `prisma migrate deploy` on every container start. Staging was recreated by run `35662412080` ("Container prudentgabriel-staging Started").
- The lookups read every column (`findUnique` without `select`, `capability-token-lookup.ts:14,25`). On a database without the new columns they fail, as the dev tests above show. On staging all return a clean 404: `/api/invoice/not-a-real-token`, `/api/track/not-a-real-token`, `/api/approve/not-a-real-token`, `/api/receipt/not-a-real-token/confirm`, `/api/quote/not-a-real-token/pdf` → `{"error":"Not found"} [404]`.
- A failed `migrate deploy` does not stop the container unless `PRISMA_MIGRATE_DEPLOY_FATAL` is set (`entrypoint.sh:23-27`). The container log is the direct check and needs host access.

---

## 1. Security — Slice AZ

### AZ1 — Next image optimiser (GHSA-2xp9-vwfh-vxw4): `DONE` (mitigated, not fixed)
- Running Next is **14.2.35**: `package.json:130`, `pnpm-lock.yaml:3472`, `node_modules/next/package.json`.
- AVIF is off: `next.config.mjs:20` `formats: ["image/webp"],`, with a warning comment on lines 16-19 (commit `bfd72eb`).
- Staging: `GET /_next/image?url=%2Fmedia%2F…%2F4326eb5c….png&w=256&q=75`
  - `Accept: image/avif` → `200 image/png`
  - `Accept: image/avif,image/webp,*/*` → `200 image/webp`
  - A product JPEG with `Accept: image/avif` → `200 image/jpeg`. AVIF is never returned.
- Handover wording is present: `../docs/ATELIER_HANDOVER.md:21` ("Mitigated, not fixed… Do not re-enable AVIF on 14.x… Next ≥15.5.24") and `:31` (the migration is blocking). `next.config.mjs:16-19` says the same.

### AZ1 follow-up — HEIC receipts: `PARTIAL`
- **Code: done.** `sharp` is 0.35.4 (`package.json:147`, lock `:4153`). The Linux libvips package is locked at `@img/sharp-libvips-linux-x64@1.3.3` (lock `:620`).
- **libheif version:** the installed Windows build's `versions.json` records `"heif": "1.23.2"`, and `src/lib/receipt-raster.ts:7` states the same. The Linux package in the image was not inspected.
- **`heic-convert` removed:** 0 matches in `package.json` and `pnpm-lock.yaml`, no import in `src/`. Decoding is sharp-only (`receipt-raster.ts:13-24`).
- **Live test not done.** No real iPhone camera HEIC was uploaded to staging in this pass. It needs a real device photo, and uploading writes a record. This is the check that proves the original bug has not returned. It is Nony's to run.
- **What a customer sees on failure:** `400` with `"Please send a screenshot or a JPG."`
  - Set in `image-upload-mime.ts:84` `RECEIPT_HEIC_FALLBACK_MESSAGE`.
  - Returned by `api/upload/receipt/route.ts:61` and `api/invoice/[token]/receipt/route.ts:61`.
  - Shown by `PaymentMethodSelector.tsx:107,128,132` as a toast.

### AZ2 — Auth.js: `PARTIAL`
- `next-auth` is **5.0.0-beta.32** (`package.json:131`, lock `:3450`). `@auth/core` is **0.41.3** (`package.json:91`, lock `:253`). Commit `bfd72eb`.
- The middleware fails closed: `src/middleware.ts:39` `const session = request.auth?.user ? request.auth : null;`.
- **A live sign-in → `/admin` → `/account` → sign-out → sign-in pass has not been done.** It needs a real password. It is Nony's to run.

### AZ3 — capability tokens: `DONE`, one caveat
- **Random:** 32 bytes from `randomBytes`, base64url (`capability-token.ts:36`).
- **Hashed:** SHA-256 stored in the public column, plus an AES-GCM copy in `*Enc` (`:34-40`).
- **Expiring:** stage approval 14 d, receipt 45 d, tracking 180 d, invoice 90 d after document expiry (`:11-23`).
- **Legacy links grandfathered:** cuid tokens are looked up as plaintext, and a null `*ExpiresAt` never expires. The migration only adds columns.
- **Every create site issues through `generateCapabilityToken()`:**
  - `api/admin/invoices/route.ts:326`
  - `api/bespoke/route.ts:112-113`
  - `api/quotations/route.ts:156`
  - `lib/alterations/service.ts:178`
  - `lib/atelier/stage-actions.ts:519`
  - `lib/quotation-convert.ts:191-193`
  - `lib/quotation-versioning.ts:61`
- Commit `9951541`. Live on staging (section 0).
- **Caveat:** `schema.prisma:890, 2020, 2033, 2219, 2431` still carry `@default(cuid())` on the token columns. Any future `create` that omits the token field silently gets an unhashed, non-expiring cuid. Seed and test scripts do exactly that.

### AZ4 — security headers: `NOT DONE`
- Staging `GET /`, `GET /shop/hazel-dress`, `GET /track/not-a-real-token`, `GET /invoice/not-a-real-token` each return **no** security headers. Only `X-Powered-By: Next.js`.
- No CSP (enforced or report-only), HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy or X-Content-Type-Options.
- No `Referrer-Policy: no-referrer` on token routes.
- In code, `next.config.mjs` `headers()` only sets the Apple Pay `.well-known` file's type. Traefik `deploy/traefik/pg-compose-stacks.yaml:9-33` has only redirect, gzip and www→apex middlewares.

### AZ5 — public upload limits: `PARTIAL`
- **Careers and consultations uploads need no sign-in.**
  - Careers: 5 MB cap, magic-byte check, private storage, `rateLimitOr429(req,"careers-upload",8,15*60*1000)` (`api/careers/upload/route.ts:15`).
  - Consultations: `"consultations-upload",8` (`api/consultations/upload/route.ts:19`).
- **Receipt ticket:** no sign-in, 8 per 15 min (`api/upload/receipt/ticket/route.ts:9`).
- **Receipt upload:** needs a session or signed ticket (`:30-36`), 5 MB cap, 12 per 15 min.
- Nothing prevents repeated anonymous uploads beyond per-IP limits, and those limits are in memory (AZ6).

### AZ6 — rate limits persisted: `NOT DONE`
- `src/lib/rate-limit.ts:5` `const store = new Map<string, Bucket>();`. Counts are per process and reset on restart.
- The client IP comes from the **first** `X-Forwarded-For` entry (`clientIpFromHeaders`). A caller controls that entry unless the proxy strips it.
- `6013215` added limits to every token route and page, and expiry sweeping. It did not add persistence.

### AZ7 — SSRF guard on image re-host: `NOT DONE`
- `src/lib/product-image-migrate.ts:12` calls bare `fetch(sourceUrl)`: no host allowlist, private-IP check, redirect control or size cap.
- The reupload route accepts any `z.string().url()` behind `requireAdminApi("shop.products")` (`api/admin/products/…/reupload/route.ts:11`).
- Admin-only, but reachable from any admin session.

### AZ8 — STAFF barred from receipt URLs and measurements: `NOT DONE`
- `src/lib/bespoke-roles.ts:4-10` includes `"STAFF"` in `BESPOKE_STAFF_ROLES`.
- `GET /api/bespoke/[orderId]` (`:27`) returns `clientProfile.measurements` and `payments[].receiptUrl`.
- `GET /api/clients/[clientId]` (`:13`) returns measurements.
- Opening the private receipt file itself goes through the admin media gate `requireAdminPortalApi` → `hasAnyAdminPermission` (`admin-auth.ts:103-107`). `STAFF: []` (`roles.ts:101`) fails it unless a per-user grant exists. So STAFF receive the URL but cannot open it by default.

### AZ9 — global session kill: `NOT DONE`
- Only per-user revocation exists: `passwordChangedAt` / `jwtIssuedBeforePasswordChange` (`password-reset.ts:54`, `auth.ts:186`).
- Sessions are JWT (`auth.config.ts:12`), with no session-version field.
- The only global kill is rotating `AUTH_SECRET` in the host env file, and the app has no control for that.

### AZ10 — off-box backups: `NOT DONE` (needs Nony)
- `deploy/backup-media.sh` dumps both Postgres databases (`pg_dump -Fc`, `:29`) and media to `BACKUP_DIR` (default `/home/deploy/prudentgabriel-backups`, `:7`) on the **same host**. It keeps 14 by default.
- It copies off-box only if `BACKUP_RCLONE_REMOTE` is set **and** `rclone` is installed. If `rclone` is missing, the copy is skipped silently (`:36`).
- Nothing is encrypted. No cron entry in `deploy/cron.d` or `install-host-cron.sh` runs the script.
- **Still required, by Nony on the VPS:**
  1. Install rclone.
  2. Configure a remote (B2/S3/Drive).
  3. Set `BACKUP_RCLONE_REMOTE`.
  4. Schedule the script.
  5. Run and time one full restore.

### `docs/SECURITY_AUDIT.md` versus the code
The audit (`3209f4c`) predates every AZ commit and was never updated. It still lists as exposed:
- AZ1: AVIF on (gap #2). AVIF is now off.
- AZ2: next-auth beta.31 (gap #3). It is now beta.32.
- AZ3: cuid tokens with no TTL (gap #5). New tokens are hashed and expire.
- Missing limits on approve and invoice pay (gap #9). `6013215` added them.

Gaps #1, #4, #6, #7, #8 and #10 still match the code.

---

## 2. SEO — Slices AS and AX

| Item | Verdict | Evidence |
|---|---|---|
| `robots.txt` | `PARTIAL` | See below |
| `noindex` on token pages | `DONE` | See below |
| Sitemap from database | `DONE` | See below |
| Unpublished product → 404 | `REGRESSED` | See below |
| Permanent redirect | `PARTIAL` | See below |
| Canonical on filtered shop URLs | `DONE` | `GET /shop?category=dresses&sort=newest` → `<link rel="canonical" href="https://staging.prudentgabriel.com/shop">`. `shopCanonicalPath` (`seo.ts:~85-104`) keeps only category, type and page |
| Favicon / `site.webmanifest` | `PARTIAL` | `/favicon.ico` → `200 image/x-icon`. `/site.webmanifest` → `404`, `/manifest.webmanifest` → `404`. The repo has only `src/app/favicon.ico`, no manifest or apple-icon |
| OG images | `PARTIAL` | See below |
| AI crawler decision / `llms.txt` | `NOT DONE` | One wildcard rule in `robots.txt`, no GPTBot/ClaudeBot/CCBot lines. `/llms.txt` → `404`, and nothing in the repo |
| PDP JSON-LD | `PARTIAL` | See below |

**`robots.txt`.** Staging `GET /robots.txt` → 200:
```
User-Agent: *
Allow: /
Disallow: /admin
Disallow: /account
Disallow: /api
Disallow: /auth
Disallow: /staff
Disallow: /approve
Disallow: /receipt
Disallow: /invoice
Disallow: /track
Disallow: /quote
Disallow: /unsubscribe
Disallow: /checkout/restore

Sitemap: https://staging.prudentgabriel.com/sitemap.xml
```
`/checkout` itself is **not** disallowed, only `/checkout/restore`. The checkout pages do send `noindex` metadata (`tokenRouteMetadata`).

**`noindex` on token pages.** `/track/x`, `/approve/x`, `/receipt/x`, `/invoice/x` and `/quote/x` each carry `<meta name="robots" content="noindex, nofollow"/>`. No `X-Robots-Tag` header is sent. Source: `seo.ts:192-197`.

**Sitemap.** `force-dynamic`, and products filtered on `isPublished: true` (`sitemap-build.ts:77`). Staging `/sitemap.xml` has 76 URLs, 52 of them `/shop/<slug>`. `GET /api/products` pages 1-2 → `total: 52`. The sets match exactly: 0 in the sitemap and not in the API, 0 the other way round. Product has no archived state. Finding: four published pieces carry junk slugs from duplication: `def` (Delphinium), `def-copy` (Poppy), `def-copy-copy` (Camellia), `def-copy-copy-copy` (Primrose).

**Unpublished product → 404: `REGRESSED`.** The code calls `notFound()` for unpublished or missing slugs (`shop/[slug]/page.tsx:41,81,97`). Staging nevertheless returns HTTP **200**:
- `GET /shop/this-slug-does-not-exist-xyz` → `200`. The body is the not-found UI (`NEXT_NOT_FOUND`), with two conflicting robots tags: `index, follow` and `noindex`.
- Every `notFound()` page does the same, for example `/invoice/not-a-real-token` → `200`.
- Unknown routes are real 404s (`/zzzz-nope` → `404`), as are API 404s.

So every dynamic-page 404 is a soft 404. A real unpublished slug was not tested, because none is publicly listable. It takes the same `notFound()` path.

**Permanent redirect: `PARTIAL`.** The redirects are real HTTP redirects, not a 200 shell with a 307 digest, but they are **308**, not 301:
- `/legal/privacy` → `308` → `/privacy-policy`
- `/bespoke` → `308` → `/atelier`
- `/rtw/hazel-dress` → `308` → `/shop/hazel-dress`
- `/rtw?category=KIDDIES` → `308` → `/shop?category=KIDDIES`

`redirects.mjs:1` says "Must be 301", and commit `bdf8144` says "301s". `permanent: true` makes Next send 308. Search engines treat 308 as permanent, so this is a report/code mismatch rather than an SEO fault.

**OG images.** All pages have an `og:image`:
- Homepage, `/collections`, `/journal`: the house logo `…/logos/4326eb5c….png`.
- PDP `/shop/hazel-dress`: the product photo.
- Collection `/collections/soft-shift`: its own image.
- Journal post `/journal/inside-the-beading-room`: `https://images.unsplash.com/photo-1558618666-…`, a stock placeholder.

There are no `opengraph-image` files.

**PDP JSON-LD.** `/shop/hazel-dress` has `Product` with `releaseDate: 2026-06-06T17:16:19.619Z`, taken from `publishedAt` (`seo-jsonld.ts:62-64`). `offers.availability` is `https://schema.org/InStock`, **hardcoded** for every product (`seo-jsonld.ts:70`) rather than computed from stock.

Also found: staging itself is indexable. PDPs send `robots: index, follow` and `robots.txt` allows `/`. Staging duplicates production content for any crawler that finds it.

---

## 3. Recent features

**AW publish dates: `DONE`** (`e5b3a00`)
- `Product.publishedAt` is at `schema.prisma:361`.
- Newest first orders by `publishedAt desc` (`products-list-query.ts:148-149,175-176`).
- Curated orders by `displayOrder`, then `publishedAt` (`:170-171`), so backdating does not move curated order.
- A future date is refused at the API with a 400 (`api/admin/products/route.ts:143-149`; `[id]/route.ts:137-145,228-235`) and the message *"Publish date cannot be in the future. Scheduled publishing is not available yet — pick today or earlier."* (`product-published-at.ts`).
- `test:slice-aw` passes.

**AV: `DONE`** (`78010c5`)
- The orders list defaults to excluding abandoned attempts (`admin-orders-filter.ts:~140-147`, used by `admin/orders/page.tsx:43` and `api/admin/orders/route.ts:39`). The "Abandoned attempts" filter is at `page.tsx:132-137`.
- The sweep sets `status: ABANDONED` (`checkout-reservations.ts:225-237`). It is scheduled as the `checkout-reservations` cron (`cron/jobs.ts:31`).
- Rising is on `/admin/reports` (`HouseNumbersPanel.tsx:123-126` via `HowWeAreDoingClient.tsx:130`).
- Drag-reorder writes `displayOrder` (`api/admin/products/reorder/route.ts:42`), and `/rtw` defaults to `sort=curated` (`rtw/page.tsx:45`).
- `test:slice-av` passes.
- **Report/code mismatch:** the brief names `test:slice-ad2` as the AV test. It passes, but it tests hero video and homepage tiles (last touched `50372c8`), not AV.

**AU product options: `PARTIAL`** (`b570745`)
- In code: `ProductOptionGroup` / `ProductOption` (`schema.prisma:515-548`), `effectiveUnitNGN(variant, isOnSale, optionAdjustmentNGN)` (`pricing.ts:26`, used at `orders/create/route.ts:150`), and the frozen `OrderItem.optionLabel` / `optionAdjustmentNGN` (`schema.prisma:788-792`, written at `create/route.ts:283-284`). `test:slice-au` passes.
- **The Allure suit still cannot demonstrate it.** Staging `/shop/allure-suit` is published, its page payload has `"optionGroup":null`, and its only image is one 12,140-byte PNG (`/media/public/prudential-atelier/products/435f90da….png`), not photography.
- The untracked `tmp-gallery-preview/unpublish-allure.mjs` would unpublish it. It has not been run against staging, since the piece is still published there.

**AT analytics: `DONE`**
- Staging `/cookie-policy` mentions `sessionStorage` 3 times (source `legal-copy.ts:432-434`, key `pa-visit-attribution`).
- The traffic panel states *"Same-session purchases only. A tag dies with the tab — return visits tomorrow show as direct."* (`HouseNumbersPanel.tsx:69`). `test:slice-at` passes.

**AR / AR5 legal figures: `PARTIAL`**
- Most figures resolve from live settings (`legal-tokens.ts:132-162`).
- **Both 48-hour figures are still hardcoded:**
  - `fabric-unavailable.ts:4` `export const FABRIC_PROMISE_HOURS = 48;` is passed through as a token (`legal-tokens.ts:137`), not read from a setting.
  - The post-delivery fault window is literal text at `legal-copy.ts:476` ("write within 48 hours of delivery with photographs"), not a token. Staging `/returns-policy` serves "48 hours of delivery with photographs".

---

## 4. The store — Slice AQ

**Phases committed and on staging: `DONE`, in two commits**
- Phase 1 is `b42cd17`.
- Phases 2 and 3 shipped together in `f7fde3a`. The schema labels them at `schema.prisma:2917` (phase 2) and `:3037` (phase 3).
- Follow-up fix: `c80abb5`.
- All are ancestors of `48737d5`. `test:slice-aq` and `test:slice-aq2` pass.

**Shortage panel states its comparison: `DONE`.** `store/ledger.ts:318-319`: "Comparing typed commission materials and product material lists against the shelf. A piece with no list does not appear here." Empty state at `StoreMorningClient.tsx:175-182`.

**Store-only actor refused orders and clients at the API: `DONE`**
- `roles.ts:102` `STORE_MANAGER: ["store"]`.
- Every `api/admin/orders*` route requires `shop.orders` (`route.ts:8`, `[id]/route.ts:63,81,340`, `bulk-delete:12`, `shipping-quote:21`).
- Client routes require `clients` (`clients/search:7`, `customers/route.ts:7`, `customers/[id]:8`, `customers/[id]/points:14`).
- `requireAdminApi` returns 403 without it (`admin-auth.ts:114-124`).
- `test:authz` passes, but it asserts page routes only (`test-authz.ts:235-236`). Per-user grants in the database (`roles.ts:183-186`) could widen a live account.

**`requisition.fund` refused to SUPER_ADMIN-without-ADMIN and FINANCE_MANAGER: `DONE`.** `requisition/states.ts:27-30` returns true only for `role === "ADMIN"`. `requisition/chain.ts:36-41` throws 403 *"Only General Admin (Mrs. Prudent) can release funds. Super Admin and finance cannot."* This runs before the super-admin bypass.

**`sameActorShortCircuit` on the record and the slip: `DONE`.** Record: `StoreRequisitionDetailClient.tsx:177,241` and list `StoreRequisitionsClient.tsx:108`. Slip: `admin/store/requisitions/[id]/print/page.tsx:65-67`.

---

## 5. Production, briefly (read-only)

**Mail failing on production: `UNCLEAR` — cannot be checked from here.** Production's database is on the VPS and this machine has no read access to it. `.env` and `.env.local` point to Neon dev. It needs a read-only `SELECT status, count(*) FROM "EmailMessage" WHERE "createdAt" > now() - interval '7 days' GROUP BY 1` on the production host.

**Is production's compose file still dated 11 August? No.**
- Every production deploy overwrites `/opt/prudentgabriel/deploy/compose.production.yaml` with the repo copy at the deployed SHA (`.github/workflows/docker-publish-ghcr-production.yml:121-124`, under `set -euo pipefail`, so a failed fetch fails the job).
- Run `35662417680` succeeded at 22:29 UTC 2026-09-21. The file on the host is therefore the repo version, last changed in `9e6970f` (2026-09-03).
- The file's mtime on the host was not read.

**Paystack and Resend keys on production: `UNCLEAR` — cannot be checked from here.**
- Paystack's secret is resolved by `getPaystackSecret()` (`src/lib/payments/config.ts:25`) from settings or env.
- Resend is `RESEND_API_KEY` (`credential-catalog.ts:167`), in `/opt/prudentgabriel/deploy/.env.production` or the settings table.
- Presence needs host or database access, or a look at Admin → Settings → Developer on production.

---

## Summary

### 1. Done and live
- AZ1: AVIF off on Next 14.2.35, and staging never returns AVIF. The handover note is present.
- AZ3: hashed, expiring capability tokens. Legacy links still work, and the migration is live on staging.
- Token routes and pages rate limited (`6013215`), in memory (see AZ6).
- Bespoke balance payments bound to reference, amount and currency (`c715608`).
- CI: typecheck, lint and 16 database-free tests on push (`48737d5`).
- robots.txt disallows the token routes, `/admin`, `/staff`, `/api` and `/account`.
- Token pages send `noindex, nofollow`.
- The sitemap is database-driven and matches the 52 published products exactly.
- Canonicals strip shop filters.
- PDP JSON-LD carries `releaseDate` from `publishedAt`.
- AW publish dates, with future dates refused with the scheduling message.
- AV abandoned-order filter and sweep, Rising, and drag-order driving `/rtw`.
- AT sessionStorage disclosure and the same-session note.
- AQ store phases 1-3, the shortage-panel wording, the API refusals, the fund gate and the same-actor flag.

### 2. Built but not on staging
- Nothing. Local `staging` = `origin/staging` = `origin/main` = `48737d5`.
- The only uncommitted items are the untracked `tmp-*` scripts and folders, which are scratch and not features.
- The Neon **dev** database is behind: `20260921_slice_az3_capability_tokens` is not applied. That is why 6 of 61 tests fail.

### 3. Not done — by customer impact

**Code:**
1. **Soft 404s (REGRESSED).** Every `notFound()` page returns HTTP 200, including missing or unpublished products and dead token links, with conflicting robots tags.
2. **Security headers (AZ4).** Staging sends no CSP, HSTS, frame, referrer or permissions headers, and no `no-referrer` on token routes.
3. **Rate limits spoofable and in memory (AZ6).** The first `X-Forwarded-For` entry is trusted, and counts reset on restart.
4. **STAFF can read measurements and receipt URLs (AZ8).**
5. **Anonymous careers and consultation uploads (AZ5).** Only per-IP limits, which are spoofable.
6. **Legal 48-hour figures hardcoded (AR5).** `FABRIC_PROMISE_HOURS` and the post-delivery fault window.
7. **JSON-LD `availability` hardcoded `InStock`.**
8. **Allure suit has no option group and no photography,** so AU cannot be demonstrated.
9. **Four products with junk `def-copy…` slugs** are in the sitemap.
10. **SSRF on admin image re-host (AZ7).**
11. **No global session kill (AZ9).**
12. **SEO gaps:**
    - No `site.webmanifest`.
    - No `llms.txt`.
    - No AI-crawler decision in `robots.txt`.
    - `/checkout` not disallowed.
    - Journal post OG is an Unsplash placeholder.
    - Staging is indexable.
13. **Redirects are 308, not 301** as `redirects.mjs:1` and `bdf8144` claim. It is functionally permanent.
14. **Token columns still `@default(cuid())`** in the schema, so any create that omits the field gets a legacy-style token.
15. **`docs/SECURITY_AUDIT.md` is stale.** It still lists AZ1-AZ3 as open.

**Needs Nony:**
1. **Off-box backups (AZ10).** rclone, remote, `BACKUP_RCLONE_REMOTE`, cron, and one timed restore.
2. **A real iPhone camera HEIC receipt upload on staging** (AZ1 follow-up).
3. **Live auth pass** (AZ2): sign in → `/admin` → `/account` → sign out → sign in.
4. **Production read-only checks:** `EmailMessage` status counts for 7 days, and whether Paystack and Resend keys are present.
5. **Rate-limit IP fix prerequisite:** confirm Cloudflare proxy is on for both hosts and the origin accepts only Cloudflare IPs.
6. **Apply the AZ3 migration to the Neon dev database** (`prisma migrate deploy`) so the 6 failing tests can run.
