# Collection Launch Readiness Audit

**Repo:** `github.com/Nonyd/prudentgabriel` → `prudential-atelier/`  
**Branch:** `staging`  
**Date:** 26 Aug 2026  
**Scope:** read-only. Verdicts are `BUILT` / `PARTIAL` / `MISSING` / `UNCLEAR`.  
**Question this answers:** can Mrs. Prudent launch a collection (build privately → load → hold → announce → open → watch).  
**Question this does not answer:** can a customer buy a garment. That is `docs/RTW_LAUNCH_AUDIT.md`.

**Already known (not re-proven):**

- Production: maintenance ON, 47 published products, 464 variants at stock 0, no PSP keys installed (Paystack account exists).
- Email works via Resend; `hello@` and `admin@prudentgabriel.com` hard-bounce.
- Slice G shipped; Slice G2 (atelier pages visible, new bookings off) is on staging.
- Woo importer writes `stock: 0` (`prudential-atelier/src/app/api/admin/import/execute/route.ts:84`).

Those facts block a live sale. They are noted where they intersect a collection drop. The rest of this document is what the code does for the drop itself.

---

## Section 1 — Building a collection privately

**Verdict: PARTIAL.** Unpublished collections exist and are hidden from the storefront. Unpublished products exist and 404 for customers (Slice C). The two flags are independent: hiding a collection does not hide its products. There is no customer-facing preview.

### 1.1 Publish flag

`Collection.isPublished` defaults to **true** in schema (`prudential-atelier/prisma/schema.prisma:345`). The create form also defaults `isPublished: true` (`prudential-atelier/src/components/admin/CollectionFormModal.tsx:56`, `:130`). The checkbox is labelled “Published” (`:458`). The create API uses `d.isPublished ?? true` (`prudential-atelier/src/app/api/admin/collections/route.ts:62`).

That default is the trap. A new collection is live unless she unchecks the box.

Public listing filters `isPublished: true` (`prudential-atelier/src/app/(storefront)/collections/page.tsx:19–21`). The slug page loads `where: { slug, isPublished: true }` and calls `notFound()` otherwise (`prudential-atelier/src/app/(storefront)/collections/[slug]/page.tsx:37–38`, `:51–54`). The JSON API returns 404 for unpublished slugs (`prudential-atelier/src/app/api/collections/[slug]/route.ts:22–27`). Nav cache and sitemap use the same filter (`prudential-atelier/src/lib/storefront-cache.ts:30–31`; `prudential-atelier/src/app/sitemap.ts:40–42`).

Admin list and detail load collections regardless of publish (`prudential-atelier/src/app/api/admin/collections/route.ts:14–16`; `prudential-atelier/src/app/(admin)/admin/collections/[id]/page.tsx:14–16`). Toggle and bulk unpublish are on the list (`prudential-atelier/src/components/admin/CollectionsClient.tsx:40–49`, `:121–138`, `:278–282`). PATCH revalidates the slug (`prudential-atelier/src/app/api/admin/collections/[id]/route.ts:100`).

### 1.2 Assigning products before either is public

**BUILT.** `POST /api/admin/collections/[id]/products` loads the product by id and writes `CollectionProduct`. It does not check `product.isPublished` or `collection.isPublished` (`prudential-atelier/src/app/api/admin/collections/[id]/products/route.ts:67–84`). Cap is 100 manual products (`:62–65`). The create/edit modal can attach products at save (`prudential-atelier/src/components/admin/CollectionFormModal.tsx:191–192`, `:228–229`, `:282`).

The product form has no collection field (`prudential-atelier/src/components/admin/ProductFormPage.tsx` — grep of that file for `collection` is empty). Assignment is a collection-admin step.

### 1.3 Preview

**MISSING.** No draft URL, signed token, or `?preview=` path exists on `/collections/[slug]`. Admin `/admin/collections/[id]` shows drafts, including a `draftManual` count (`prudential-atelier/src/app/(admin)/admin/collections/[id]/page.tsx:46–47`, `:79`). “View on site ↗” is a plain `/collections/${slug}` link (`prudential-atelier/src/components/admin/CollectionDetailAdmin.tsx:139–146`). For an unpublished collection that URL is `notFound()`.

She can see the admin layout of the lookbook. She cannot see the customer page until it is published.

### 1.4 What unpublished does to products

**Unpublished collection:** 404 on `/collections/[slug]`. Products on it are **not** hidden with it.

Shop listing forces `isPublished: true` unless the caller is admin and explicitly asks for drafts (`prudential-atelier/src/lib/products-list-query.ts:43–48`). The PDP loads by slug then 404s if unpublished (`prudential-atelier/src/app/(storefront)/shop/[slug]/page.tsx:88–91`). The public product API does the same (`prudential-atelier/src/app/api/products/[slug]/route.ts:46–47`). That is the Slice C rule, confirmed at collection level: it applies to products, not to collection membership.

The public collection page only merges **published** products (`prudential-atelier/src/lib/collection-products.ts:102–107`, `:119–120`). So:

| Collection | Product | `/collections/[slug]` | `/shop` and PDP |
|---|---|---|---|
| unpublished | unpublished | 404 | 404 |
| unpublished | published | 404 | **visible** |
| published | unpublished | omitted from grid | 404 |
| published | published | visible | visible |

Private build therefore requires **both** flags off. Publishing products early leaks them into `/shop` while the collection page is still dark.

**Gotcha:** public `/collections` counts use `uniqueProductCountsForCollections`, which adds every manual `productId` with no `isPublished` filter (`prudential-atelier/src/lib/collection-products.ts:59–68`). Auto-tag products *are* filtered (`:74–75`). A published collection with draft manuals can show an inflated count on the listing page.

Product drafts default `isPublished: false` in the form and Zod schema (`prudential-atelier/src/components/admin/ProductFormPage.tsx:102`, `:348–356`; `prudential-atelier/src/validations/product.ts:59`). Prisma `Product.isPublished` defaults true (`prudential-atelier/prisma/schema.prisma:306`); the admin form overrides that on create.

---

## Section 2 — Loading the collection

**Verdict: PARTIAL.** One admin form can create a sellable product with images, sizes, colours, price and stock. There is no clone, no size×colour matrix, and no bulk tool for a new drop. Colour is not a SKU.

### 2.1 Product creation form

Route: `/admin/products/new` → `ProductFormPage` (`prudential-atelier/src/app/(admin)/admin/products/new/page.tsx:3–4`). Single page, not a wizard.

Required to save (`prudential-atelier/src/validations/product.ts:46–67`, variant rows `:13–29`):

- `name` (min 2)
- `slug` (`^[a-z0-9-]+$`); auto-filled from name on blur if empty (`prudential-atelier/src/components/admin/ProductFormPage.tsx:199`)
- `category`, `type`
- `basePriceNGN` (positive)
- ≥1 variant: `size`, `sku`, `priceNGN`, `stock`

Images, colours, description, details, SEO, tags, bundles are optional (`images` default `[]` at `:67`).

Actions: **Save draft** sets `isPublished: false`; **Publish** sets `true` (`prudential-atelier/src/components/admin/ProductFormPage.tsx:348–356`). New form starts unpublished (`:102`) with one size row, `stock: 0` (`:108–116`).

**Clicks / screens for one live product (images + 5 sizes + colours + price + stock):** 1 screen. Rough interaction count: open New Product → name → category/type → price → N image uploads → “+ Add size” ×4 → fill 5 size/sku/price/stock rows → optional “+ Add colour” per colour → Publish. Then a separate visit to the collection to attach it (form has no collection field). That is on the order of **20–40 interactions per piece**, not counting photography.

### 2.2 Images

Upload: `POST /api/admin/upload`. Images are pushed to Cloudinary with `transformation: [{ width: 1200, crop: "limit" }, { quality: "auto" }]` (`prudential-atelier/src/app/api/admin/upload/route.ts:85–88`). Cap `MAX_IMAGE_BYTES = 5 * 1024 * 1024` (`:7`). No max count in the product schema.

The form uploads files **one after another** (`prudential-atelier/src/components/admin/ProductFormPage.tsx:226–244`). First image is primary (`isFirst = imgs.length === 0` at `:239`). Primary can be changed with “Set primary” (`:254–256`, `:485`). `ProductImage.isPrimary` and `sortOrder` exist (`prudential-atelier/prisma/schema.prisma:372–377`). There is **no reorder UI** (no drag / move-up on images in `ProductFormPage`). Order is upload order.

Storefront later rewrites Cloudinary URLs via `optimizeImageUrl` (`prudential-atelier/src/lib/utils.ts:109–118`: `c_fill,g_top,w_${width},q_auto,f_auto`). Originals are not what the shopper gets; a 1200px-limited, quality-auto derivative is stored, then filled/cropped at request width.

Collection cover is a single upload or pasted URL (`prudential-atelier/src/components/admin/CollectionFormModal.tsx:440–448`). Collection **products** can be reordered up/down (`prudential-atelier/src/components/admin/CollectionDetailAdmin.tsx:96–106`).

### 2.3 Variants (size and colour)

`ProductVariant` is size + price + stock. There is no colour column (`prudential-atelier/prisma/schema.prisma:384–402`). `ProductColor` is product-level (`:404–414`). Cart stores `variantId` plus optional `colorId` (`:433–436`). Stock is on the size row, shared across colours.

UI: `VariantManager` “+ Add size” appends one empty row (`prudential-atelier/src/components/admin/VariantManager.tsx:21–33`, `:54–60`). “Apply ₦… to all variants” copies base price (`:40–42`). No matrix, no generate-from-size-list.

Colours: “+ Add colour” name + hex + optional image URL (`prudential-atelier/src/components/admin/ProductFormPage.tsx:560–578`).

**10-piece collection × 5 sizes = 50 size rows**, each entered by hand. That is 50 add/fill cycles if she starts from the one default row (9 products × 5 + 4 extra on the first = 49 adds, plus fills). Colour does **not** multiply SKUs. If she needs independent stock per colour, the data model requires separate products (or she accepts one stock pool per size).

### 2.4 Duplicate a product

**MISSING.** No clone/duplicate route or admin control under `prudential-atelier/src` (the only “duplicate” hits are reviews, job roles, and Woo import help copy). Loading a 10-piece drop means 10 full forms.

### 2.5 Bulk import

**PARTIAL — WooCommerce migration only.** Admin copy: “Import Products from WooCommerce” (`prudential-atelier/src/components/admin/ImportPageClient.tsx:140–141`). Execute creates unpublished RTW products (`prudential-atelier/src/app/api/admin/import/execute/route.ts:66`) with **`stock: 0` hardcoded** (`:80–85`). First image is primary (`:75`). It does not help a new-drop load: it cannot take a lookbook spreadsheet, and it would still leave every variant at zero stock.

---

## Section 3 — Scheduling the launch

**Verdict: MISSING** for scheduled publish and coming-soon. Manual toggle is **BUILT**.

### 3.1 Scheduled publish

No `publishAt` / `goesLive` on `Product` or `Collection` (`prudential-atelier/prisma/schema.prisma:284–357`). Blog `scheduledAt` exists (`:1857`) with API write (`prudential-atelier/src/app/api/blog/route.ts:118`) and **no cron** that promotes `SCHEDULED` → `PUBLISHED`.

Manual path: keep collection unpublished (must uncheck the default), keep products unpublished, then at launch hour an **admin** toggles collection (`CollectionsClient.tsx:278–282`) and bulk-publishes products (`prudential-atelier/src/components/admin/ProductsTable.tsx:297–306`). PATCH calls `revalidateCollection` / `revalidateProduct` (`prudential-atelier/src/lib/revalidate.ts:27–39`). ISR fallback on those pages is 300s (`collections/page.tsx:7`, `collections/[slug]/page.tsx:12`, `shop/page.tsx:5`, `shop/[slug]/page.tsx:31`). Someone with admin access must click at the launch hour.

### 3.2 Coming soon

**MISSING.** No visible-but-not-purchasable collection or product state. Homepage empty bestsellers copy is the only “coming soon” string (`prudential-atelier/src/components/public/BestSellers.tsx:114`). `isNewArrival` is a badge, not a hold. Shop `/shop/[slug]` either 404s or is buyable (subject to stock).

### 3.3 Pre-order / waitlist

`StockAlert` is restock-on-zero-variant (`prudential-atelier/prisma/schema.prisma:444–452`). PDP shows `StockAlertForm` when `variant.stock === 0` (`prudential-atelier/src/components/product/ProductDetailClient.tsx:239–240`). Public `POST /api/stock-alert` takes email + variantId (`prudential-atelier/src/app/api/stock-alert/route.ts:5–18`). Account `POST /api/account/stock-alert` requires a session (`prudential-atelier/src/app/api/account/stock-alert/route.ts:12–14`). `processRestockAlerts` emails then deletes alerts when admin restocks (`prudential-atelier/src/lib/stock-alerts.ts:6–7`; called from `prudential-atelier/src/app/api/admin/products/[id]/route.ts:258`).

That is a sold-out restock list. It is not a drop waitlist (no collection target, no “notify when this launches”).

---

## Section 4 — Announcing it

**Verdict: PARTIAL** for admin compose to registered customers. **MISSING** for the newsletter list, RTW-buyer segment, collection lookbook template, and unsubscribe.

### 4.1 NewsletterSubscriber

Model is email + `createdAt` only (`prudential-atelier/prisma/schema.prisma:454–458`). Signup: `POST /api/newsletter` upserts (`prudential-atelier/src/app/api/newsletter/route.ts:19–22`). Home and footer forms post there (`prudential-atelier/src/components/home/NewsletterSection.tsx:25–28`; `prudential-atelier/src/components/public/FooterNewsletter.tsx:34–37`). Success copy: “You're on the list. Thank you.” (`NewsletterSection.tsx:40`; `FooterNewsletter.tsx:66`).

`resolveRecipientEmails` never queries `newsletterSubscriber` (`prudential-atelier/src/lib/send-email-recipients.ts:9–15`, `:50–106`). **Nothing in this codebase sends to that list.**

### 4.2 Admin compose

**BUILT** as a developer-free screen: `/admin/content/send-email` for `ADMIN` / `SUPER_ADMIN` (`prudential-atelier/src/app/(admin)/admin/content/send-email/page.tsx:7–19`). `POST /api/admin/send-email` (`prudential-atelier/src/app/api/admin/send-email/route.ts:28–30`). UI: recipient radios, TipTap body, optional transactional template paste (`prudential-atelier/src/components/admin/content/AdminSendEmailClient.tsx:19–26`, `:101–116`, `:127–137`; editor `prudential-atelier/src/components/admin/content/EmailRichTextEditor.tsx:19–20` — StarterKit text, no image/lookbook block).

### 4.3 Targeting

Recipient types (`send-email-recipients.ts:9–15`, `:50–106`; UI labels `AdminSendEmailClient.tsx:19–26`):

| Type | What it selects |
|---|---|
| `all` | `User` with `role: CUSTOMER` |
| `gold_platinum` | CUSTOMER whose `ClientProfile.loyaltyTier` is GOLD or PLATINUM |
| `active_orders` | **Bespoke** orders not in `DELIVERY` |
| `upcoming_consultations` | consultation bookings |
| `specific` / `custom` | one user or one pasted email |

**No newsletter segment. No “past RTW purchasers” segment** (`Order` is never queried here). Guest RTW payers who ran `autoOnboardClient` become CUSTOMER users (`prudential-atelier/src/lib/order-payment.ts:217–223`) and then fall into `all`. People who only joined the footer list do not.

### 4.4 Outbox, batch budget, 500 recipients

`sendEmail` queues `EmailMessage` (`prudential-atelier/src/lib/email.tsx:46–59`; `prudential-atelier/src/lib/email-outbox.ts:47–80`). Immediate deliver is fire-and-forget unless capture/test skip (`:84–86`).

Broadcasts: `EmailSendJob`, `BATCH_SIZE = 50` (`prudential-atelier/src/lib/send-email-jobs.ts:6`, `:53–76`). POST processes one batch then returns `jobId` (`send-email/route.ts:74–87`). Status GET **also** processes the next batch (`prudential-atelier/src/app/api/admin/send-email/[jobId]/status/route.ts:10`). The UI polls that endpoint every 1.5s while `jobId` is set (`AdminSendEmailClient.tsx:85–98`). No cron processes `EmailSendJob`. Closing the tab can leave the job `SENDING` with remaining recipients never queued.

Each job row calls `sendEmail` → outbox. Drain job `email-outbox` is `* * * * *`, `migrated: true`, `budgetMs: 50_000` (`prudential-atelier/src/lib/cron/catalog.ts:99–104`). Drain `take: batchLimit` (`prudential-atelier/src/lib/email-outbox.ts:264–279`). `CRON_BATCH_LIMIT = 200` (`prudential-atelier/src/lib/cron/types.ts:47`). `RUN_BUDGET_MS` is 8s on Vercel, 5 minutes otherwise (`:44`); this job overrides to 50s.

**500-recipient estimate (tab stays open):** 10 job batches of 50. Polling can enqueue all in tens of seconds. Immediate deliver races the drain. Leftovers: up to 200/minute under a 50s budget → **on the order of 3 minutes** if every send falls through to cron, faster if Resend accepts the immediate delivers. If she closes the tab after the first POST, **only ~50 are queued**.

### 4.5 Templates

Catalog keys are transactional (welcome, RTW order, loyalty, low stock, …) (`prudential-atelier/src/lib/admin-email-catalog.ts:3–32`). Custom send wraps TipTap HTML in `BrandedHtmlEmail` (`prudential-atelier/src/lib/admin-email-render.tsx:39–41`). There is **no collection lookbook template** (no product grid, no multiple images, no drop CTA block beyond a pasted `<a>`).

### 4.6 Unsubscribe

**MISSING.** `NewsletterSubscriber` has no `unsubscribedAt`. No DELETE/unsub route. Footer/home copy has no legal unsubscribe line. Grep of `prudential-atelier/src/lib` for `List-Unsubscribe` / `unsubscribe` is empty. Sending a campaign from this admin to `all` CUSTOMER users has no one-click unsub. That is a compliance problem (NDPA / marketing consent), not a nice-to-have.

---

## Section 5 — Watching the launch

**Verdict: PARTIAL.** Orders exist as a refreshable list plus a 60s notification bell. No live table, no per-collection sales view, no low-stock ping. Pull-down is fast.

### 5.1 First hour

Admin orders is a server-rendered page, 20 per page, `findMany` ordered by `createdAt` (`prudential-atelier/src/app/(admin)/admin/orders/page.tsx:12`, `:36–47`). After cancel/delete the client calls `router.refresh()` (`prudential-atelier/src/components/admin/AdminOrdersListClient.tsx:99`). No poll, no websocket on the table.

`notifyNewOrder` fires on `POST /api/orders/create` (`prudential-atelier/src/app/api/orders/create/route.ts:381`; helper `prudential-atelier/src/lib/notifications.ts:36–44`). Admin bell polls unread count every 60s (`prudential-atelier/src/components/admin/NotificationBell.tsx:64–91`). She can hear the bell; she still refreshes the list to see lines.

### 5.2 Per-product / per-collection sales

`/admin/reports` KPIs: RTW vs bespoke revenue, pipeline, top **clients**, staff, RTW **inventory stock** (`prudential-atelier/src/components/admin/ReportsDashboardClient.tsx:17–37`, `:255–267`). No collection breakdown.

`GET /api/admin/analytics` groups `orderItem` by `productId` for a period (`prudential-atelier/src/app/api/admin/analytics/route.ts:36–39`, `:77–82`). **No admin page fetches that URL** (no `/api/admin/analytics` consumers under `prudential-atelier/`). Orphan API.

### 5.3 `update-bestsellers`

Cron `0 2 * * *`, `migrated: false` (`prudential-atelier/src/lib/cron/catalog.ts:81–84`) — in-process Slice E scheduler does **not** run it; it still depends on HTTP cron. Handler: lifetime `orderItem` qty vs `bestseller_threshold` (default 10), then `updateMany` **`isFeatured`** (`prudential-atelier/src/app/api/cron/update-bestsellers/route.ts:12–31`). `Product.isBestSeller` in schema (`schema.prisma:314`) has **no `src` readers**. Homepage BestSellers and shop badge read `isFeatured` (`BestSellers.tsx:30–31`; `prudential-atelier/src/components/shop/ShopBrowse.tsx:54`).

Speed: **once a night**, not first-hour. A drop’s winners will not badge until the next 02:00 run, and only if lifetime qty ≥ threshold. The job also **clears `isFeatured` on every product** then sets the winners (`:26–31`) — any manual featured flags are wiped.

### 5.4 Low stock mid-launch

RTW audit gap 8 confirmed: `notifyLowStock` is defined (`prudential-atelier/src/lib/notifications.ts:135–142`) and **has no callers**. Catalog has a `LOW_STOCK` email key (`admin-email-catalog.ts:27`). Nothing sends it.

What she sees: PDP size button `line-through`, title “Sold Out”, `StockAlertForm` (`ProductDetailClient.tsx:223–240`). Admin products table colours total stock (`ProductsTable.tsx:400–405`). No bell when a size hits zero during the drop.

Restock later: `processRestockAlerts` can email people who signed the PDP form (`stock-alerts.ts:6–7`).

### 5.5 Pull-down

**BUILT.** Product row toggle and bulk Unpublish (`ProductsTable.tsx:297–306`, `:416–418`) → `revalidateProduct`. Collection row toggle and bulk (`CollectionsClient.tsx:121–138`, `:278–282`) → `revalidateCollection`. Fast enough for “this look is wrong, take it down.” ISR 300s is the fallback if revalidate is skipped.

---

## Section 6 — Yassfrik feature map

Do not build. Gap vs what is here.

| Feature | Here | Missing | Gap |
|---|---|---|---|
| Auto-market new products/collections to existing clients | Admin Send Email to registered CUSTOMERS (`send-email-recipients.ts:50–54`). Gold/Platinum via `ClientProfile` (`:55–64`). | Newsletter list unused. No RTW-buyer segment. No send-on-publish. No lookbook template. No unsubscribe. Closing the send tab can stall the job. | **Large.** She can type a letter to accounts. She cannot run “email everyone who bought RTW / everyone on the list with this collection.” |
| Instagram feed on the storefront | Footer icon → `instagramHandleToUrl` (`prudential-atelier/src/components/public/Footer.tsx:140`, `:198–200`). | No embed, no `InstagramFeed` component, no homepage/shop slot. | **Small–medium.** Link exists; a feed is new UI + an embed or Graph token. Natural home: homepage below bestsellers or collection page. |
| WhatsApp contact | Footer `wa.me` from `social_whatsapp` (`Footer.tsx:71–73`, `:143`, `:217`). `/contact` CTA (`prudential-atelier/src/app/(storefront)/contact/page.tsx:82`, `:177–187`). | No floating / persistent FAB on shop/PDP/collection. | **Small.** Number is already in settings; a storefront float is UI only. |
| Loyalty | `LoyaltyRule` (`schema.prisma:1930–1935`) used for SIGNUP / SIGNUP_REFERRAL (`prudential-atelier/src/lib/loyalty.ts:112–116`; register + `client-onboarding.ts:65`). RTW purchase awards `Math.floor(totalNGN / 100)` on `fulfillPaidOrder` (`prudential-atelier/src/lib/points.ts:146–152`; `order-payment.ts:228–231`). Tier upgrade email (`points.ts:5`, `:38`; `LoyaltyTierUpgradeEmail.tsx`). `/account/loyalty` (`account/loyalty/page.tsx:15–40`). Referral first-purchase credit 5000 (`points.ts:8`). | “Early collection access” is a **label** in `TIER_BENEFITS` (`loyalty.ts:101–106`), not a publish gate. Purchase points are hardcoded, not a `LoyaltyRule`. | **Mostly built for RTW earn.** Unfinished: gated early access, rule-driven purchase points, any drop-specific perk. |
| Birthday / special-date wishes | `EventDate` on `ClientProfile` (`schema.prisma:1391–1401`). `GET/POST /api/account/events` (`prudential-atelier/src/app/api/account/events/route.ts:8–32`). Cron `event-reminders` `0 9 * * *`, **`migrated: false`** (`cron/catalog.ts:39–42`); HTTP route sends at 60/30/14 days (`event-reminders/route.ts:10`, `:27–39`). | Dashboard “Add event” links to `/account/settings` (`AccountDashboard.tsx:389–399`). Settings only has `eventReminders` preference (`SettingsClient.tsx:183`; `account/settings/page.tsx:33`). No EventDate form on settings. Checkout captures no birthday. Whether HTTP cron still hits this job on the VPS is **UNCLEAR** (`migrated: false`). | **Atelier-shaped, not RTW-shaped.** API exists; customer cannot save a date from the UI the dashboard points at; no drop-birthday cron on the new scheduler. |
| Client CRM for RTW | `Order.userId` optional, **no `clientProfileId`** (`schema.prisma:460–464`). Guest pay: `autoOnboardClient(..., source: "RTW_ORDER")` creates/links User + `ClientProfile` and sets `order.userId` (`order-payment.ts:217–223`; `client-onboarding.ts:18–24`, `:32–36`, `:101–105`). Account layout always `getOrCreateClientProfile`. | RTW order is not an atelier client row FK. Send-email “active_orders” is bespoke-only. Admin clients search is the CRM surface; it is not a drop CRM. | **PARTIAL.** Paid guests become users with a profile. The house still has two records (Order vs ClientProfile) glued by `userId`. |

---

## Section 7 — Gap register

Severity vs **“Mrs. Prudent can launch a 10-piece collection next month without a developer.”** Selling that collection still needs stock > 0, PSP keys, and maintenance off (RTW audit). Those are listed last so they are not confused with merchandising gaps.

| # | Gap | Severity | Blocks a collection launch? | Files | Est. |
|---|---|---|---|---|---|
| 1 | Newsletter list cannot be mailed; no RTW-buyer segment; no send-on-publish | **HIGH** | Blocks a *proper drop announce*. Manual “all customers” letter still possible. | `send-email-recipients.ts:50–106`; `schema.prisma:454–458`; `api/newsletter/route.ts:19–22` | M |
| 2 | No unsubscribe / List-Unsubscribe on marketing send | **HIGH** (legal) | Does not block loading. Blocks *lawful* broadcast. | `NewsletterSubscriber`; `send-email-jobs.ts`; `email-outbox.ts` | S–M |
| 3 | Collection `isPublished` defaults **true** (schema + form + API) | **HIGH** (ops trap) | Does not block. Easy to leak a half-built lookbook. | `schema.prisma:345`; `CollectionFormModal.tsx:56,:130,:458`; `api/admin/collections/route.ts:62` | S |
| 4 | Unpublished collection does not hide published products | **HIGH** (ops trap) | Does not block if she keeps products unpublished too. Publishing products early leaks them to `/shop`. | `products-list-query.ts:47–48`; `shop/[slug]/page.tsx:91`; `collection-products.ts:102–107` | S (docs/training) or M (hide-with-collection) |
| 5 | No duplicate-product path | **HIGH** (time) | Does not block. Makes 10 similar pieces 10 full forms. | (absent from admin products) | M |
| 6 | No size×colour matrix; colour is not a SKU | **MEDIUM** | Does not block a 5-size one-colour drop. Blocks independent colour stock. | `schema.prisma:384–414`; `VariantManager.tsx:21–60` | M–L |
| 7 | Bulk import is Woo-only and `stock: 0` | **MEDIUM** | Does not help this drop. | `ImportPageClient.tsx:140–141`; `import/execute/route.ts:66,:84` | M if building a drop CSV; else ignore |
| 8 | No scheduled publish; admin must click at launch hour | **MEDIUM** | Does not block if someone is at admin. Blocks unattended 00:01 drops. | Product/Collection schema (no `publishAt`) | M |
| 9 | No customer preview of unpublished collection | **MEDIUM** | Does not block. She QAs on admin chrome, not the PDP/collection page. | `CollectionDetailAdmin.tsx:139–146`; `collections/[slug]/page.tsx:51–54` | S–M |
| 10 | No coming-soon / drop waitlist | **MEDIUM** | Does not block a hard open. Blocks anticipation. | `StockAlert` is restock-only | M |
| 11 | EmailSendJob only advances while the send-email tab polls | **MEDIUM** | A 500-send can stall at 50 if she navigates away. | `send-email/[jobId]/status/route.ts:10`; `send-email-jobs.ts:6`; no job cron | S |
| 12 | No collection lookbook email template | **LOW–MEDIUM** | She can paste HTML/links. Ugly, but sendable. | `EmailRichTextEditor.tsx`; `admin-email-catalog.ts` | S–M |
| 13 | `notifyLowStock` never called | **MEDIUM** | Does not block launch. She will not be pinged when a size dies. | `notifications.ts:135–142` | S |
| 14 | No per-collection sales UI (analytics API orphan) | **MEDIUM** | Does not block launch. First-hour read is “refresh orders.” | `ReportsDashboardClient.tsx`; `api/admin/analytics/route.ts` | M |
| 15 | `update-bestsellers` nightly, `migrated: false`, overwrites `isFeatured` | **LOW** | Does not block. Badges lag; manual featured flags get wiped at 02:00 if HTTP cron still runs. | `update-bestsellers/route.ts:12–31`; `cron/catalog.ts:81–84` | S |
| 16 | Image reorder missing; sequential 5MB uploads | **LOW** | Does not block. Slow and fiddly. | `ProductFormPage.tsx:226–256`; `upload/route.ts:7,:85–88` | S |
| 17 | Public collection counts include unpublished manuals | **LOW** | Cosmetic on a published collection with drafts. | `collection-products.ts:59–68` | S |
| 18 | Instagram embed, WhatsApp FAB | **LOW** | Do not block a drop. | `Footer.tsx:140,:217`; `contact/page.tsx:177–187` | S |
| 19 | EventDate UI dead-end; cron not on new scheduler | **LOW** for a drop | Not required to open a collection. | `AccountDashboard.tsx:389`; `SettingsClient.tsx:183`; `cron/catalog.ts:39–42` | S–M |
| 20 | Production stock 0, no PSP keys, maintenance ON | **BLOCKER for sales** | Blocks *selling* the drop, not *loading* it. Same as RTW audit. | `import/execute/route.ts:84`; payments config (RTW audit) | ops, not code |

---

## Section 8 — The realistic path

Shortest sequence **today**, for a 10-piece / 5-size drop, **without a developer**, assuming she has photos and prices.

1. **Admin → Collections → New.** Uncheck **Published** (default is on). Cover, excerpt, optional `autoTag`. Save. Assign products later or from the same modal picker (`CollectionFormModal.tsx:191–192`).
2. **Admin → Products → New**, ten times. One long form each. Keep **Save draft**. Name, category, type, price. Upload images sequentially (Cloudinary 1200/limit). Set primary. “+ Add size” until five rows; type size, SKU, price, **stock** (import will not help; new rows start at 0). Optional colours (shared stock per size). No clone: the second dress is as much typing as the first.
3. **Open the collection** → attach the ten drafts (cap 100). Reorder looks with up/down. Admin detail shows `draftManual`. “View on site” 404s until publish — QA is this admin page, not the customer URL.
4. **Do not publish products early.** If she does, they show on `/shop` and PDP while the collection page is still 404.
5. **Launch hour (admin required):** bulk Publish the ten products (`ProductsTable.tsx:297–298`), then tick the collection published (`CollectionsClient.tsx:278–282`). Or the reverse only if products were already public (they will have been shoppable). Revalidate runs on those PATCHes; worst case ISR 5 minutes.
6. **Announce:** Admin → Content → Send Email → “All clients (registered customers)”. Write subject + body; paste a `/collections/[slug]` link. Stay on the page until the job reads `done`. This does **not** reach footer-newsletter-only addresses. It has **no unsubscribe**. Gold/Platinum is the only extra slice; “active orders” is atelier, not RTW.
7. **Watch:** keep `/admin/orders` and refresh. Bell may ping `NEW_ORDER` within a minute. There is no collection sales board. When a size hits 0, the PDP shows Sold Out + restock form; she is not notified.
8. **Pull-down:** unpublish the collection and/or the piece from the same toggles.

**Loading time (honest):** photography aside, **on the order of half a day to a full day** for ten pieces if she is new to the form; maybe **2–4 hours** if she is fast. The tedious part is **50 variant rows by hand** plus sequential image uploads, not 50 size×colour SKUs. A clone button would cut that more than a Woo importer. A matrix only matters if colour must have its own stock.

**What she still cannot do without a developer (or without ops):** mail the actual newsletter list; mail past RTW buyers as a segment; schedule midnight publish; show a coming-soon page; preview as a customer; stay legally clean on marketing email. **What she cannot do even after a perfect merchandising pass:** take money, until PSP keys are in, variants have stock, and production maintenance is off.

---

*End of audit. Evidence is `path:line` above. No application code was changed.*
