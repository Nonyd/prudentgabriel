# Inventory Management Audit

**Repo:** `github.com/Nonyd/prudentgabriel` → `prudential-atelier/`
**Branch:** `staging`
**Date:** 3 Sep 2026
**Mode:** READ-ONLY. No code was changed except this file.
**Question this answers:** when Mrs. Prudent counts five size 12s on the rail and the system says three, can anyone find out why?

Verdict vocabulary: `BUILT` | `PARTIAL` | `MISSING` | `UNCLEAR`.

**Known state (accepted, not re-counted):** production has 47 published products and 484 variants, all at stock 0. Staging has restocked variants for testing. Slice G added a conditional decrement that cannot go below zero, with `PAID + CANCELLED` plus an admin alert on failure. Slice H added bulk stock at `/admin/collections/[id]/stock`. Slice R added custom made-to-order lines that skip stock entirely.

This audit did not query production or staging databases.

---

## 1. What stock is, and everywhere it moves

**Verdict: PARTIAL** — a per-variant integer exists and is written on a closed set of paths. One path records a related order (by decrementing inside payment fulfilment). No path records a stock movement row.

### 1.1 Where stock lives

Canonical quantity is `ProductVariant.stock`, an `Int` defaulting to 0.

```417:440:prudential-atelier/prisma/schema.prisma
model ProductVariant {
  id           String      @id @default(cuid())
  sku          String?
  size         String
  priceNGN     Float
  ...
  stock        Int         @default(0)
  lowStockAt   Int         @default(3)
  ...
  stockAlerts  StockAlert[]
  orderItems   OrderItem[]
}
```

A second, denormalised flag exists on the product: `Product.inStock Boolean @default(true)` (`prudential-atelier/prisma/schema.prisma:320`). A third threshold exists on the product: `Product.lowStockAt Int @default(3)` (`prudential-atelier/prisma/schema.prisma:330`). Variant and product both have `lowStockAt`.

No other table holds a quantity of RTW garments. `PickupLocation` has name, address, hours, instructions — no stock column (`prudential-atelier/prisma/schema.prisma:856-871`). `Material` is a bespoke-order note, not a warehouse (`prudential-atelier/prisma/schema.prisma:2033-2046`). There is no `StockMovement`, `StockLedger`, `PurchaseOrder`, or `Return` model (schema grep for those names returns none).

`CartItem.quantity` (`prudential-atelier/prisma/schema.prisma:475`) and `OrderItem.quantity` (`prudential-atelier/prisma/schema.prisma:647`) are demand records. They do not hold available stock.

### 1.2 Every code path that changes `ProductVariant.stock`

| # | Path | Direction | Guard | Transactional | History row | File |
|---|---|---|---|---|---|---|
| A | Payment fulfilment, standard lines | decrease | `stock: { gte: item.quantity }` then `decrement` | yes, with payment flip | none | `prudential-atelier/src/lib/order-payment.ts:197-206` |
| B | Payment fulfilment, custom lines | none | `shouldDecrementStock` is false | n/a | n/a | `prudential-atelier/src/lib/order-payment.ts:199`; `prudential-atelier/src/lib/custom-size.ts:161-162` |
| C | Oversell refuse (`PAID + CANCELLED`) | none — decrement threw, txn rolled back | same as A | refuse is a second txn | none for stock | `prudential-atelier/src/lib/order-payment.ts:229-245` |
| D | Admin product create | set (initial) | `z.coerce.number().int().min(0)` | yes | none | `prudential-atelier/src/app/api/admin/products/route.ts:173-182`; `prudential-atelier/src/validations/product.ts:26` |
| E | Admin product edit (existing variant) | set (absolute) | same zod min 0 | yes | none | `prudential-atelier/src/app/api/admin/products/[id]/route.ts:197-206` |
| F | Admin product edit (new variant) | set (initial) | same | yes | none | `prudential-atelier/src/app/api/admin/products/[id]/route.ts:216-225` |
| G | Bulk collection stock PATCH | set (absolute) | zod min 0, max 500 rows | **no** — sequential updates | none | `prudential-atelier/src/app/api/admin/collections/[id]/stock/route.ts:97-106` |
| H | WooCommerce import execute | set to **0** | hardcoded | per-product `create` | `ActivityLog` for the import batch, not per variant | `prudential-atelier/src/app/api/admin/import/execute/route.ts:79-84`, `:139-146` |
| I | Duplicate product | copy source stock onto a new product | none | yes | `ActivityLog` on the product duplicate, not per variant | `prudential-atelier/src/lib/duplicate-product.ts:63-74`; `prudential-atelier/src/app/api/admin/products/[id]/duplicate/route.ts:16-25` |
| J | Seed fixtures | set from seed data | none | per-product create | none | `prudential-atelier/prisma/seed-fixtures.ts:335-340` |
| K | Demo seed | set `randInt(2, 15)` | none | `createMany` | none | `prudential-atelier/scripts/seed-demo.ts:529-536` |
| L | Admin cancel | none | n/a | status txn only | none | `prudential-atelier/src/app/api/admin/orders/[id]/route.ts:171-192` |
| M | Admin record-refund | none | n/a | payment-status txn | none | `prudential-atelier/src/app/api/admin/orders/[id]/route.ts:93-107` |
| N | Customer delete of unpaid order | none | n/a | delete or cancel | none | `prudential-atelier/src/app/api/account/orders/[id]/route.ts:63-78`; `prudential-atelier/src/lib/order-delete.ts:24-29` |
| O | Cart add / qty update | none | qty capped to current stock | n/a | n/a | `prudential-atelier/src/lib/cart-service.ts:98-124`, `:236-237` |
| P | Order create | none | read-check `v.stock < line.quantity` then 400 | check is **outside** the create transaction | `OrderItem` rows are created; stock is not written | `prudential-atelier/src/app/api/orders/create/route.ts:288-299`, `:566-579` |

No other `productVariant.update` / `updateMany` / `create` writers exist under `prudential-atelier/src` besides the table above (plus test scripts that are not runtime).

### 1.3 Path detail

**A — Fulfilment decrement (the only runtime decrease).** After flipping the order `PENDING` → `PAID` + `CONFIRMED`, each standard line runs:

```197:206:prudential-atelier/src/lib/order-payment.ts
      for (const item of order.items) {
        if (!item.variantId) continue;
        if (!shouldDecrementStock(item.sizeMode)) continue;
        const decremented = await tx.productVariant.updateMany({
          where: { id: item.variantId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (decremented.count === 0) {
          throw new InsufficientVariantStockError(item.variantId, item.quantity);
        }
      }
```

Guarded: cannot go below zero. Transactional with the payment flip (`prudential-atelier/src/lib/order-payment.ts:181-228`, `INTERACTIVE_TX` at `prudential-atelier/src/lib/prisma-tx.ts:2-5`). Recorded: no stock row. `OrderItem` already exists from create. `ActivityLog` is not written. `Product.inStock` is not updated. `notifyLowStock` is not called.

**C — Oversell refuse.** The decrement throw rolls back A. A second transaction sets `paymentStatus: PAID` (or `REFUNDED` if remaining ≤ 0.01) and `status: CANCELLED`, writes `adminNotes: "Fulfilment refused: stock was insufficient after payment. Refund the customer — do not ship."` (`prudential-atelier/src/lib/order-payment.ts:43-44`, `:73-83`). Stock is unchanged. No stock history row.

**E/F — Admin product save.** Absolute set of `stock: v.stock` inside `$transaction` (`prudential-atelier/src/app/api/admin/products/[id]/route.ts:141-286`). Also writes `Product.inStock: data.variants.some((v) => v.stock > 0)` (`:169`). If an existing variant went from `<= 0` to `> 0`, `processRestockAlerts` is fired (`:290-294`). No actor, reason, previous quantity, or delta is stored.

**G — Bulk stock.** Loop: read current, `update({ data: { stock: u.stock } })`, collect restock IDs when `current.stock === 0 && u.stock > 0` (`prudential-atelier/src/app/api/admin/collections/[id]/stock/route.ts:97-111`). Not wrapped in `$transaction`. Does not write `Product.inStock`. Does not verify the variant belongs to the collection. Response `updated` is `parsed.data.updates.length` even when a variant id was missing and skipped (`:102`, `:114`). No `ActivityLog`.

**H — Woo execute.** `stock: 0` is literal (`prudential-atelier/src/app/api/admin/import/execute/route.ts:84`). Preview parses a CSV `Stock` column (`prudential-atelier/src/app/api/admin/import/preview/route.ts:157-168`) into a preview DTO. The parser used by execute (`ParsedVariant` in `prudential-atelier/src/lib/woocommerce-parser.ts:7-12`, `:111-119`) has no stock field. CSV quantities never reach the database.

**L/M — Cancel and refund.** Status / `paymentStatus` change plus `returnRedeemedPoints`. No `productVariant` write.

### 1.4 Which paths write a history row of any kind

| Path | What is written | What is not written |
|---|---|---|
| A fulfilment | `Order` paid/confirmed, `Payment` row, `OrderItem` already present | who took stock, previous qty, delta, reason `SALE` |
| C oversell | `Order` paid+cancelled, `Payment` row, admin notification, two emails | a stock movement (stock did not change) |
| D/E/F product save | product + variant rows; restock emails if 0→positive | previous qty, actor, reason `COUNT_CORRECTION` |
| G bulk | variant.stock only; restock emails if 0→positive | previous qty, actor, reason |
| H import | `ActivityLog` `Imported N products from WooCommerce CSV` | per-variant stock (always 0) |
| I duplicate | `ActivityLog` `Duplicated product to {slug}` | that stock was copied |
| J/K seed | product rows | anything attributable |

`ActivityLog` (`prudential-atelier/prisma/schema.prisma:1539-1556`) is a generic audit table. Product create and product PATCH do not call `logActivity`. Stock is an integer that goes up and down.

---

## 2. Is there a stock ledger?

**Verdict: MISSING.**

No table records stock movements with reason, quantity, actor, timestamp, and related order. Schema search for `StockMovement`, `StockLedger`, `inventoryLog`, `stockHistory`, `StockEvent` returns no matches.

`OrderItem` is not a stock ledger:

- It is created at order create, before payment, while stock is still untouched (`prudential-atelier/src/app/api/orders/create/route.ts:288-299`, `:566-579`).
- Custom lines have `OrderItem` rows and never decrement (`prudential-atelier/src/lib/order-payment.ts:199`).
- Oversell `PAID + CANCELLED` leaves `OrderItem` rows and does not decrement (`prudential-atelier/src/lib/order-payment.ts:229-245`).
- Admin cancel / refund of a paid order leaves `OrderItem` rows and does not increment (`prudential-atelier/src/app/api/admin/orders/[id]/route.ts:93-107`, `:187-192`).
- Hand corrections (E, F, G) create no `OrderItem`.

### 2.1 What is unanswerable today

| Question | Why it is unanswerable |
|---|---|
| Which order took the last size 12? | Decrement has no movement row. Paid `OrderItem`s for that variant can be listed, but unpaid, cancelled-without-decrement, custom, and hand-edits contaminate any reconstruction. |
| Was a count ever corrected by hand? | Paths E/F/G overwrite the integer. No previous value, actor, or reason. |
| When did a piece go to zero? | `ProductVariant` has no `updatedAt`. Prisma `@updatedAt` is on `Product` (`prudential-atelier/prisma/schema.prisma:385`), not on `ProductVariant` (`:417-440`). |
| Who typed the number that is on the screen? | Product PATCH and bulk PATCH do not call `logActivity`. |
| Opening balance for this size? | There is no opening movement. Import writes 0. Admin later types a number. |

### 2.2 Could `ProductVariant.stock` be derived?

Yes, in the same shape Sprint A used for money.

Sprint A: `Payment` rows are the source of truth; `BespokeOrder.amountPaid` / `balance` are a denormalised cache written only by `recomputeOrderTotals` (`prudential-atelier/src/lib/payments/ledger.ts:271-282`). RTW mirrors that with `recomputeRtwOrderTotals` as the only writer of `Order.amountPaid` / `Order.balance` (`prudential-atelier/src/lib/payments/rtw-totals.ts:9-11`, `:54`).

A stock ledger would be the source of truth (opening + signed movements: receipt, sale, cancel-return, count correction, write-off). `ProductVariant.stock` would remain a cached column with a recompute — the same pattern. Today the integer **is** the source of truth, so it cannot be recomputed from anything else.

---

## 3. Known gaps — confirm and detail

### 3.1 `notifyLowStock` is never called — **MISSING** (runtime)

The helper exists:

```138:146:prudential-atelier/src/lib/notifications.ts
export function notifyLowStock(product: Pick<Product, "name">, variant: Pick<ProductVariant, "id" | "size" | "stock">): void {
  void createNotification({
    type: "LOW_STOCK",
    title: "Low stock",
    message: `${product.name} — size ${variant.size} (${variant.stock} left)`,
    link: `/admin/products`,
    entityId: variant.id,
  }).catch(() => {});
}
```

Grep across `prudential-atelier/**/*.ts` and `*.tsx` finds this definition and no callers.

What would call it: `fulfillPaidOrder` after a successful decrement, and/or admin set-paths E/F/G after a write that lands `stock <= lowStockAt`. Nothing does.

Thresholds that exist and are not wired to this helper:

| Field | Location | Read by notifyLowStock? |
|---|---|---|
| `ProductVariant.lowStockAt` default 3 | `schema.prisma:426`; written by VariantManager and product APIs | no — helper is never called |
| `Product.lowStockAt` default 3 | `schema.prisma:330`; copied on duplicate (`duplicate-product.ts:53`); **not** in `productAdminSchema` and **not** written by product PATCH | no |
| SiteSetting `notify_low_stock` | seeded `true`, label "Email when variant stock ≤ lowStockAt" (`prisma/seed.ts:513`) | no runtime `getSetting("notify_low_stock")` |
| SiteSetting `low_stock_threshold` default `"2"` | `GeneralSettingsClient.tsx:16` | no runtime reader except the settings form itself |

Where a notification would go, if called: `createNotification` inserts `AdminNotification` type `LOW_STOCK` (`prudential-atelier/src/lib/notifications.ts:18-33`; enum at `schema.prisma:1270`). The bell can render that type (`NotificationBell.tsx:39-41`). The admin email catalog has a `low_stock` template (`admin-email-catalog.ts:423-435`). Grep finds no `sendEmail` / outbox call with that template. `notify.ts` maps `low_stock` to `RTW_MANAGER`, `ADMIN`, `SUPER_ADMIN` (`notify.ts:9`) and then voids `targetRoles` (`:32-33`).

Per-variant low-stock level: **BUILT** as a column (`ProductVariant.lowStockAt`) and as an admin input (`VariantManager.tsx:213-214`). Per-product: **PARTIAL** — `Product.lowStockAt` exists; the storefront reads it (`ProductDetailClient.tsx:153-154` via `shop/[slug]/page.tsx:176`); admin save does not write it.

### 3.2 Refunds and cancellations do not restock — **MISSING** (restock)

**Admin record-refund** (`prudential-atelier/src/app/api/admin/orders/[id]/route.ts:78-107`): requires `paymentStatus === "PAID"`. Writes `paymentStatus: "REFUNDED"`, `status` `REFUNDED` (full) or `PROCESSING` (partial), appends a line to `adminNotes`, returns redeemed points on full refund. No `productVariant` update.

**Admin status PATCH to `CANCELLED` or `REFUNDED`** (`:187-192`): `returnRedeemedPoints` only. `canTransitionOrder` allows `CANCELLED` / `REFUNDED` from any status (`prudential-atelier/src/lib/order-status.ts:48`).

**Customer DELETE** of an unpaid/failed order (`account/orders/[id]/route.ts:56-78`): deletes the order or, if a payment ledger row blocks delete, sets `CANCELLED`. Unpaid orders never decremented, so there is nothing to restock. Paid orders cannot be removed on this path (`:56-60`).

**Order hard-delete** (`order-delete.ts:24-29`): deletes points rows, nulls review FKs, deletes orders. No stock increment. Blocked when `Payment` rows exist.

**Slice G `PAID + CANCELLED` oversell** (`order-payment.ts:58-112`, `:229-269`): decrement failed, transaction A rolled back, stock unchanged. Restock is not applicable. The garment was never taken. What is lost is the *sale*, not the unit. Admin is told to refund and not ship (`:250-256`). Customer email: payment received, piece sold out before reserve, refund of the full amount will be issued, no substitute (`email.tsx:273-286`).

A garment on a **paid then admin-cancelled** order stays decremented. That unit is inventory lost to a bookkeeping gap.

There is no Return / RMA model (schema grep for `model Return` / `model Rma` returns none). Policy copy is unrelated to stock writes.

### 3.3 No reservation at checkout — **BUILT** as a race, **MISSING** as a reservation

Cart add checks `variant.stock < 1` and caps quantity to current stock (`cart-service.ts:98-124`). It does not decrement. Two sessions can hold the last dress.

Order create re-reads stock and returns 400 `Insufficient stock for {name}` if `v.stock < line.quantity` (`orders/create/route.ts:288-299`). The check is not inside the `$transaction` that inserts `Order` / `OrderItem` (`:519+`). Two creates can both pass.

Payment initiate routes under `src/app/api/payment/` contain no `stock` reference.

The first successful `fulfillPaidOrder` takes the unit (path A). The second hits path C.

**What the second customer experiences, end to end:**

1. Add to bag succeeds while stock ≥ 1 (`cart-service.ts:98-100`). PDP may show the size as available from the last server render (`ProductDetailClient.tsx:211-213` is a client check against that render).
2. Checkout creates a `PENDING` order if the create-time read still sees stock (`orders/create/route.ts:294-298`).
3. Payment is collected by the PSP. Fulfilment runs after pay (`order-payment.ts:181-228`).
4. `updateMany` with `stock: { gte: quantity }` matches 0 rows. `InsufficientVariantStockError` is thrown (`:204-205`).
5. Order becomes `paymentStatus: PAID` (money in) and `status: CANCELLED` (`:76-79`). `adminNotes` is the refuse sentence (`:43-44`).
6. Admin `AdminNotification` type `PAYMENT_FAILED`, title "RTW oversell — refund required", link `/admin/orders?attention=refund-required` (`:250-256`).
7. Customer email subject `We could not fulfil order #{number} — refund underway` (`email.tsx:275-280`).
8. Admin email `Refund required — RTW oversell #{number}` with links to the order and the refund queue (`email.tsx:291-299`).
9. The second customer does not receive the garment. Refund is a manual PSP action plus "record refund" in admin (`AdminOrderToolbar.tsx:219` copy: record in Atelier and issue in the gateway). Recording the refund still does not touch stock (`admin/orders/[id]/route.ts:93-107`).

Guest cart (`cartStore.ts:19-20`) stores `stock` as a snapshot at add time. That snapshot is not a reservation.

---

## 4. Where stock does not apply

### 4.1 Custom / made-to-order lines (Slice R) — **BUILT** (skip)

Schema: `Product.customOffered` "Does not consume size stock" (`schema.prisma:340-341`).

Decrement gate:

```161:162:prudential-atelier/src/lib/custom-size.ts
export function shouldDecrementStock(sizeMode: SizeMode | string | null | undefined): boolean {
  return !isCustomLine(sizeMode);
}
```

`fulfillPaidOrder` continues past custom lines (`order-payment.ts:199`). Checkout sends `variantId: null` for custom (`CheckoutClient.tsx:512`). Cart custom add sets `variantId: null` (`cart-service.ts:200`). Test asserts stock unchanged after custom pay (`scripts/test-slice-r.ts:195`, `:96-97`).

When all standard sizes are at 0 and `customOffered` is true, PDP keeps custom available (`ProductDetailClient.tsx:102`, `:125-126`, `:409-411`). `useProductQuickAdd` uses the same rule (`useQuickAdd.ts:39-40`).

### 4.2 Atelier orders / `Material` — **BUILT** as a cost note, **MISSING** as inventory

`Material` belongs to `BespokeOrder` (`schema.prisma:2033-2046`): `name`, `quantity String?`, `unitCost`, `totalCost`, `supplier`, `notes`. Quantity is a string, not a decrementable integer.

Create path: admin PATCH `body.material` → `prisma.material.create` (`src/app/api/bespoke/[orderId]/route.ts:110-129`). UI: `BespokeOrderDetailClient.tsx` materials section (`:762+`, `addMaterial` at `:343`).

No `productVariant` write exists in the bespoke order route. Fabric and notions are not consumed from RTW stock. There is no materials SKU catalogue.

### 4.3 Pickup orders (Slice K) — **BUILT** as the same integer, **MISSING** as location stock

Pickup is a shipping method. `Order.pickupLocationId` is set at create (`orders/create/route.ts:535`). `PickupLocation` has no stock field (`schema.prisma:856-871`).

Fulfilment is the same `fulfillPaidOrder` decrement. Collection status (`READY_FOR_COLLECTION` / `COLLECTED`) does not touch stock (`admin/orders/[id]/route.ts:136-153`, `:171-185`).

Stock is not location-aware. A piece held at Surulere pickup and a piece on the showroom rail are the same `ProductVariant.stock`.

---

## 5. Getting stock in

**Verdict: PARTIAL** — an admin can type a number per variant and in bulk. There is no incoming-stock document.

### 5.1 Per variant

`/admin/products/[id]/edit` → `ProductFormPage` → `VariantManager` stock input (`VariantManager.tsx:201-207`). Save PATCHes the whole product (`admin/products/[id]/route.ts:197-206`). New products POST the same field (`admin/products/route.ts:182`). New-row default stock is 0 (`VariantManager.tsx:31`, `ProductFormPage.tsx:149`).

### 5.2 Bulk (Slice H)

`/admin/collections/[id]/stock` (`collections/[id]/stock/page.tsx:8-9`). Link from collection admin: "Bulk stock" (`CollectionDetailAdmin.tsx:149-153`). One number input per size, one "Save stock" (`CollectionStockClient.tsx:88-116`). Copy on the page: "Set size stock for every piece in this collection, including the imported zeros." (`:69`).

### 5.3 Interactions for a ten-piece collection in seven sizes

70 variant quantities.

**Bulk path:** open the collection (`CollectionDetailAdmin`) → click Bulk stock → type 70 numbers → click Save stock. **72 interactions** (2 navigations + 70 fields + 1 save). One PATCH with up to 70 updates (`stock/route.ts:8-17`, max 500).

**Per-product path:** for each of 10 products: open `/admin/products/[id]/edit` → find the variants table → type 7 stock fields → save the product (full product payload, not stock-only). **90 field/save interactions** plus 10 page loads, not counting list search. Products list shows a summed `totalStock` but is not editable there (`admin/products/page.tsx:67`; `ProductsTable.tsx:414-420`).

### 5.4 WooCommerce importer

Preview: parses CSV `Stock` / `stock` (`import/preview/route.ts:157-168`). Execute: `stock: 0` (`import/execute/route.ts:84`). `ParsedVariant` has size, color, price, sku — no quantity (`woocommerce-parser.ts:7-12`). **No path imports real quantities.** Re-import cannot restock.

### 5.5 Incoming stock, purchase order, production run

**MISSING.** No `PurchaseOrder` model. No goods-receipt. No production-run that yields RTW units. A number changes (paths D–G, J, K). Duplicate (I) copies whatever the source currently holds onto a new unpublished product (`duplicate-product.ts:73`, `:55` `isPublished: false`).

---

## 6. Seeing stock

**Verdict: PARTIAL** — Mrs. Prudent can see summed units and a short low/out list. She cannot see stock value, a movement history, or a trustworthy sold/slow report.

### 6.1 What she can see

| Surface | What it shows | File |
|---|---|---|
| Products list | Sum of variant stock per product; colour: 0 red, `< 10` amber, else green. Filter `stock=out` (any variant at 0) / `stock=in` (no variant at 0) | `admin/products/page.tsx:43-44`, `:67`; `ProductsTable.tsx:414-420`, `:292` |
| Product edit | Per-size stock and `lowStockAt` | `VariantManager.tsx:201-214` |
| Collection bulk stock | Per-size stock for every product in the collection | `CollectionStockClient.tsx:88-99` |
| Reports → RTW inventory | Up to 50 variants, `orderBy: { stock: "asc" }`. Status `out` if `stock <= 0`, `low` if `stock <= 3`, else `ok`. Threshold 3 is hardcoded, not `lowStockAt` | `admin/reports/route.ts:180-185`, `:249-255`; `ReportsDashboardClient.tsx:255-285` |
| Admin home `/admin` | Revenue, commissions, attendance. No stock widget | `admin/page.tsx:322-363` |
| `AnalyticsDashboard` "Out of stock" list | Component exists (`AnalyticsDashboard.tsx:345-365`) | **No page imports it.** Dead surface. |

Stock value on hand (units × cost or units × price): **MISSING**. Grep for `stock *` price / `inventory value` under `src` returns none.

Low-stock admin attention: the reports table uses a hard `3`. `notifyLowStock` never fires. Bell can display `LOW_STOCK` if a row existed (`NotificationBell.tsx:39-41`); no writer creates that row.

### 6.2 What sold, what is slow, what has never sold

Analytics API `topProducts` is paid `OrderItem` revenue in a period (`admin/analytics/route.ts:36-42`, `:77-82`). That is a revenue ranking, not a stock-turn report. It includes custom lines and oversell cancelled orders that stayed `PAID`.

`Product.orderCount` (`schema.prisma:328`) is ordered by homepage BestSellers and related products (`BestSellers.tsx:23`, `shop/[slug]/page.tsx:120`). Grep of `src` finds **no increment** of `orderCount` on sale. Duplicate sets `orderCount: 0` (`duplicate-product.ts:59`). Demo seed writes fictional counts (`seed-demo.ts:483`). On a live database the column stays 0 unless something outside `src` wrote it.

Never-sold / slow-mover: **MISSING** as a report.

### 6.3 `update-bestsellers` and `update-performance`

**`update-bestsellers`** — catalog `0 2 * * *`, `migrated: false` (`cron/catalog.ts:88-91`). In-process scheduler has no handler (`cron/jobs.ts:15-27`). Host crontab still fires it (`deploy/cron.d/prudentgabriel:27`). Handler: lifetime `orderItem.groupBy` quantity vs `SiteSetting` key `bestseller_threshold` default 10, then `product.updateMany` **`isFeatured: true`** for those ids and `isFeatured: false` for everyone else (`update-bestsellers/route.ts:12-31`). It does not write `isBestSeller`. `Product.isBestSeller` has no `src` readers except duplicate forcing false. General settings form writes a different key, `best_seller_threshold` (`GeneralSettingsClient.tsx:17`). Homepage BestSellers reads `isFeatured` then fills by `orderCount` (`BestSellers.tsx:20-36`). Current as of last successful HTTP cron at 02:00 UTC, and wrong relative to "units sold from stock" because `OrderItem` is not a stock ledger and `orderCount` is not maintained.

**`update-performance`** — `0 2 * * *`, migrated, handler present (`cron/catalog.ts:64-67`; `cron/jobs.ts:8`, `:18`). Writes `StaffProfile` / `PerformanceRecord` from assignments and attendance (`cron/jobs/update-performance.ts:82-108`). It does not read or write garment stock.

### 6.4 During a launch, what she sees as sizes sell out

- Products list `totalStock` falls after each successful pay (path A), on the next page load. No live push.
- Collection bulk page shows whatever was fetched at load; it does not poll.
- Reports inventory, if opened, lists the lowest 50 variant rows.
- Storefront size buttons grey and strike through at `stock < 1` (`QuickAddSizeRow.tsx:40`, `:92`). She sees the same greying a customer sees, after revalidation (`bulk PATCH` calls `revalidateProduct` at `stock/route.ts:112`; product PATCH at `[id]/route.ts:288`; fulfilment does **not** call `revalidateProduct`).
- `Product.inStock` stays whatever the last product save wrote (`[id]/route.ts:169`) until the next product save. Fulfilment and bulk stock do not update it. Shop "in stock" filter uses `variant.stock > 0` (`products-list-query.ts:115-118`), so the stale boolean does not hide sold-out sizes from that filter. Abandoned-checkout "all lines OOS" uses `v.stock < 1 || !v.product.inStock` (`checkout-session.tsx:93-96`): a product left `inStock: false` with remaining units is treated as OOS for recovery mail.

---

## 7. Customer-facing

### 7.1 `StockAlert` — **BUILT** (opt-in + email on 0→positive admin restock)

Model: unique `(email, variantId)` (`schema.prisma:489-497`).

Customer can ask:

- PDP when selected variant `stock === 0`: `StockAlertForm` POSTs `/api/stock-alert` (`ProductDetailClient.tsx:416-417`; `StockAlertForm.tsx:23-26`; `api/stock-alert/route.ts:28-34`).
- Wishlist "notify me": `/api/account/stock-alert` (`WishlistClient.tsx:49-54`; `api/account/stock-alert/route.ts:40-46`).

Notify them: `processRestockAlerts` loads alerts, skips if `variant.stock <= 0`, sends `restockEmailHtml`, deletes the alert (`stock-alerts.ts:8-41`; `email-templates/reports.ts:51-54`). Called from product PATCH (`[id]/route.ts:290-294`) and bulk PATCH (`collections/[id]/stock/route.ts:111`) only when previous stock was 0 and new stock is > 0. Not called from seed. Not called when stock goes from 1 to 5. Not called from fulfilment (stock is falling).

Account preference `wishlistRestock` ("Email me when wishlisted items restock") is stored (`SettingsClient.tsx:182`; `account-helpers.ts:92`). Grep finds no reader in `processRestockAlerts` or any cron. Wishlist restock mail happens only if the customer also created a `StockAlert`.

### 7.2 Low stock copy — **BUILT** on PDP for the selected size

```153:154:prudential-atelier/src/components/product/ProductDetailClient.tsx
  const lowStock =
    variant && variant.stock > 0 && variant.stock <= product.lowStockAt ? variant.stock : 0;
```

Rendered: `Only {lowStock} left!` (`ProductDetailClient.tsx:413-414`). Threshold is `Product.lowStockAt` (schema default 3), not `ProductVariant.lowStockAt`. Admin "Low at" edits the variant field (`VariantManager.tsx:213-214`), which this copy does not read.

Listing cards do not show "Only N left". Quantity stepper on PDP shows only when `variant.stock > 1` (`ProductDetailClient.tsx:420-445`).

### 7.3 Slice M greying and Slice R custom-when-sold-out — **BUILT**

Sold-out sizes stay in the row, disabled, struck through (`QuickAddSizeRow.tsx:40-55`, `:92`). PDP uses that row (`ProductDetailClient.tsx:379-388`).

`soldOut` for the whole product is `sizesSoldOut && !customOffered` (`ProductDetailClient.tsx:101-102`). When sizes are gone and custom is offered, fit mode switches to custom (`:125-126`) and copy reads "Standard sizes are sold out. This piece can still be made to your measurements." (`:409-411`). Cards use the same `soldOut` definition (`useQuickAdd.ts:39-40`); a fully sold-out non-custom card shows "Sold out" (`ProductCard.tsx:280-285`).

---

## 8. Gap register

Sorted by severity against **"Mrs. Prudent can trust the stock number and explain it."**

| # | Gap | Severity | What breaks | Files | Est. |
|---|---|---|---|---|---|
| 1 | No stock movement ledger (reason, qty, actor, time, order) | CRITICAL | Five on the rail vs three on screen cannot be explained. The integer is the history. | `schema.prisma:417-440`; `order-payment.ts:200-202`; `admin/products/[id]/route.ts:206`; `collections/[id]/stock/route.ts:103-105` | L |
| 2 | Cancel / refund / return do not restock | HIGH | A paid cancelled garment stays sold. Physical unit exists; book does not. | `admin/orders/[id]/route.ts:93-107`, `:187-192`; `order-status.ts:48` | M |
| 3 | No reservation between bag and pay | HIGH | Two customers hold the last dress. Loser pays, gets `PAID + CANCELLED`, waits on a manual refund. | `cart-service.ts:98-124`; `orders/create/route.ts:288-299`; `order-payment.ts:197-245`; `email.tsx:273-286` | L |
| 4 | Hand corrections overwrite the integer with no actor or previous value | HIGH | A mistyped count is indistinguishable from a sale. Bulk PATCH is not transactional. | `admin/products/[id]/route.ts:197-206`; `collections/[id]/stock/route.ts:97-106` | M |
| 5 | Woo execute hardcodes `stock: 0`; CSV stock is preview-only | HIGH (ops) | Import cannot load a collection's quantities. Known production zeros stay zeros until someone types. | `import/execute/route.ts:84`; `woocommerce-parser.ts:7-12`; `import/preview/route.ts:157-168` | M |
| 6 | No incoming stock / PO / production run | HIGH | The only inbound event is a human typing a number. | schema: no PO/RMA models; §5.5 | L |
| 7 | `notifyLowStock` never called; `notify_low_stock` and `low_stock_threshold` unread | MEDIUM | Sizes hit 3, then 0, with no admin bell or email. | `notifications.ts:138-146`; `seed.ts:513`; `GeneralSettingsClient.tsx:16` | S |
| 8 | `Product.inStock` not updated on sale or bulk restock | MEDIUM | Abandoned-checkout OOS uses the stale flag (`checkout-session.tsx:96`). | `order-payment.ts:200-202`; `collections/[id]/stock/route.ts:103-105`; `[id]/route.ts:169` | S |
| 9 | Two `lowStockAt` columns; PDP reads the one admin save does not write | MEDIUM | Variant "Low at" does not change "Only N left!". | `schema.prisma:330`, `:426`; `ProductDetailClient.tsx:153-154`; `validations/product.ts:50-97` | S |
| 10 | Fulfilment does not revalidate the product | MEDIUM | Launch PDP can show a size as available until the next deploy/revalidate. | `order-payment.ts:181-228` vs `stock/route.ts:112` | S |
| 11 | `orderCount` never incremented; `update-bestsellers` overwrites `isFeatured`; settings key mismatch | MEDIUM | "What sold" / bestsellers are not a stock-turn view and can wipe manual featured flags at 02:00 UTC. | `BestSellers.tsx:20-36`; `update-bestsellers/route.ts:12-31`; `GeneralSettingsClient.tsx:17` | M |
| 12 | No stock-on-hand value; reports inventory is 50 rows, threshold hardcoded 3 | MEDIUM | Cannot see naira tied up in garments. Launch sell-through is not a dedicated screen. | `admin/reports/route.ts:180-185`, `:249-255` | M |
| 13 | `wishlistRestock` preference unused | LOW | Toggle does not create alerts or send mail. | `SettingsClient.tsx:182`; `stock-alerts.ts:8-41` | S |
| 14 | Duplicate copies stock onto a new product | LOW | A copy invents units that were not received. | `duplicate-product.ts:73` | S |
| 15 | `AnalyticsDashboard` OOS widget is unmounted | LOW | Code exists; `/admin` does not show it. | `AnalyticsDashboard.tsx:345-365`; `admin/page.tsx` | S |
| 16 | Stock is not location-aware | LOW given one atelier pickup | Pickup vs rail vs "at the embroiderer" are the same integer. | `schema.prisma:856-871`; `order-payment.ts:197-206` | L if multi-location |

---

## 9. Open questions

Cap 10. Each is answerable in one sentence.

1. On production right now, is every published variant still at stock 0, or have any been typed since the known-state snapshot?
2. Does staging host cron still HTTP-fire `update-bestsellers` at 02:00 UTC, or only production's `/etc/cron.d/prudentgabriel`?
3. When Mrs. Prudent "records a refund" in admin, is the physical garment returned to the rail, and if so who is expected to type the stock back?
4. Is `Product.lowStockAt` leftover, or is `ProductVariant.lowStockAt` leftover — which number is the house rule?
5. Should a `PAID + CANCELLED` oversell ever restock (it currently never decremented), or is the only remaining work the refund?
6. For custom/MTO, is fabric ever meant to come off an RTW SKU, or is `Material.quantity` as a string the finished design?
7. Is there a second pickup location that will need its own count, or is Surulere the only rail that matters?
8. Who is allowed to correct a count — `shop.products` only (`stock/route.ts:21`, `:78`) — and should that permission be narrower than product edit?
9. For a ten-piece drop, is the intended inbound process "type 70 numbers on Bulk stock", or is a CSV quantity column expected to start working?
10. If a stock ledger is added, is `ProductVariant.stock` to become a cache with recompute (Sprint A), or remain the write target with movements as an after-the-fact log?

---

## Appendix — closed-set verdicts

| Topic | Verdict |
|---|---|
| Canonical stock column `ProductVariant.stock` | BUILT |
| Stock movement ledger | MISSING |
| Decrement on paid standard RTW | BUILT (Slice G guard) |
| Decrement on custom/MTO | BUILT (skip) |
| Restock on cancel/refund/return | MISSING |
| Reservation at checkout | MISSING |
| Oversell path `PAID + CANCELLED` + emails | BUILT |
| `notifyLowStock` at runtime | MISSING |
| Per-variant `lowStockAt` column + admin input | BUILT |
| That threshold driving admin notify or PDP copy | MISSING / PARTIAL (PDP uses product-level default) |
| Admin per-variant stock edit | BUILT |
| Bulk collection stock | BUILT (Slice H) |
| Import of real quantities | MISSING |
| Incoming PO / production run | MISSING |
| Location-aware stock | MISSING |
| Bespoke `Material` consuming RTW stock | MISSING (does not; it is a note) |
| Customer stock alert + restock email | BUILT (on admin 0→positive only) |
| Wishlist restock preference | PARTIAL (stored, not sent) |
| PDP "Only N left" | BUILT |
| Sold-out sizes greyed not hidden | BUILT |
| Custom available when sizes sold out | BUILT |
| Stock-on-hand value | MISSING |
| Sold / slow / never-sold stock report | MISSING |
| `orderCount` as live sales counter | MISSING |
| `update-performance` as inventory feed | MISSING (it is HR) |
| Trust-and-explain the number | MISSING |
