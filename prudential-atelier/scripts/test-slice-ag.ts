/**
 * Slice AG: garment stock is gone. Every listed size is made to order.
 *
 *   pnpm test:slice-ag
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isCustomOfferedNow } from "../src/lib/custom-availability";
import { capGuestQuantity, guestQtyCanIncrease } from "../src/lib/bag-size";
import { bagErrorMessage, hasPurchasableSize } from "../src/lib/quick-add";
import { displayPriceNGN } from "../src/lib/pricing";
import {
  DEFAULT_PRODUCTION_COPY,
  DEFAULT_PRODUCTION_LEAD_DAYS,
  FABRIC_POLICY_COPY,
  MADE_TO_MEASURE_REASON,
  STANDARD_SIZE_COPY,
  madeThenShippedCopy,
  normalizeProductionCopy,
  productionLeadDaysFromCopy,
} from "../src/lib/production-time";
import {
  FABRIC_PROMISE_HOURS,
  FABRIC_UNAVAILABLE_ATTENTION,
  fabricQueueOverdue,
  fabricQueueWhere,
  hoursOnFabricQueue,
  isFabricUnavailableChoice,
} from "../src/lib/fabric-unavailable";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (rel: string) => readFileSync(join(root, rel), "utf8");

const DELETED = [
  "src/lib/stock-ledger.ts",
  "src/lib/stock-alerts.ts",
  "src/emails/BackInStockEmail.tsx",
  "src/components/common/StockAlertForm.tsx",
  "src/app/(admin)/admin/products/[id]/stock/page.tsx",
  "src/app/api/admin/products/[id]/stock-movements/route.ts",
  "src/app/(admin)/admin/collections/[id]/stock/page.tsx",
  "src/app/api/admin/collections/[id]/stock/route.ts",
  "src/components/admin/CollectionStockClient.tsx",
  "src/components/admin/OutOfStockPanel.tsx",
  "scripts/reconcile-stock-ledger.ts",
  "src/app/api/account/stock-alert/route.ts",
  "src/app/api/stock-alert/route.ts",
];

function runDeleted() {
  for (const rel of DELETED) {
    assert(!existsSync(join(root, rel)), `${rel} must be gone`);
  }
}

function runProduction() {
  assert(DEFAULT_PRODUCTION_COPY === "7-12 days", "house default is 7-12 days");
  assert(DEFAULT_PRODUCTION_LEAD_DAYS === 12, "lead days take the high end of the range");
  assert(normalizeProductionCopy("7–12 days") === "7-12 days", "en-dash becomes hyphen");
  assert(productionLeadDaysFromCopy("7-12 days") === 12, "lead is the larger number");
  assert(madeThenShippedCopy() === "Made in 7-12 days, then shipped.", "bag/checkout note");
  assert(STANDARD_SIZE_COPY.includes("Returnable"), "standard size is returnable");
  assert(MADE_TO_MEASURE_REASON.includes("cannot be returned"), "custom reason is on the PDP");
  assert(FABRIC_POLICY_COPY.includes("48 hours"), "fabric promise is 48 hours");
}

function runFabric() {
  assert(FABRIC_UNAVAILABLE_ATTENTION === "fabric-unavailable", "orders queue key");
  assert(FABRIC_PROMISE_HOURS === 48, "48h clock");
  assert(isFabricUnavailableChoice("ALTERNATIVE_OFFERED"), "alternative is a choice");
  assert(isFabricUnavailableChoice("REFUNDED"), "refunded is a choice");
  assert(!isFabricUnavailableChoice("PENDING"), "unknown choice is rejected");
  assert(fabricQueueWhere().refundRecordedAt === null, "queue drops refunded rows");
  const started = new Date("2026-09-10T10:00:00Z");
  assert(hoursOnFabricQueue(started, new Date("2026-09-10T20:00:00Z")) === 10, "hours on queue");
  assert(!fabricQueueOverdue(started, new Date("2026-09-12T09:00:00Z")), "under 48h is on time");
  assert(fabricQueueOverdue(started, new Date("2026-09-12T11:00:00Z")), "over 48h is overdue");
}

function runBag() {
  assert(isCustomOfferedNow({ customOffered: true }), "custom follows the switch only");
  assert(!isCustomOfferedNow({ customOffered: false }), "off means off");
  assert(capGuestQuantity(4) === 4, "guest qty is not stock-capped");
  assert(capGuestQuantity(0) === 1, "qty floor is 1");
  assert(guestQtyCanIncrease(), "plus is always live");
  assert(hasPurchasableSize([{ id: "a" }]), "a listed size is purchasable");
  assert(!hasPurchasableSize([]), "no sizes is not purchasable");
  assert(bagErrorMessage(undefined) === "Could not add to bag.", "empty bag error");
  assert(
    displayPriceNGN(
      [
        { id: "a", priceNGN: 190000 },
        { id: "b", priceNGN: 180000 },
      ],
      null,
      false,
    ) === 180000,
    "display price uses every listed size",
  );
}

function runSources() {
  const types = src("src/types/product.ts");
  assert(!types.includes("stock"), "ProductListVariant has no stock");
  assert(!types.includes("lowStockAt"), "ProductListVariant has no lowStockAt");

  const query = src("src/lib/products-list-query.ts");
  assert(!query.includes("inStock"), "shop list has no inStock filter");

  const pricing = src("src/lib/pricing.ts");
  assert(!pricing.includes("stock > 0") && !pricing.includes("stock>0"), "display price does not filter stock");

  const validations = src("src/validations/product.ts");
  assert(!validations.includes("lowStockAt"), "product validation dropped lowStockAt");
  assert(!validations.includes("customOfferedWhenSoldOut"), "product validation dropped remake-after-sold-out");

  const pkg = src("package.json");
  assert(!pkg.includes("reconcile:stock"), "reconcile:stock script is gone");
  assert(pkg.includes("test:slice-ag"), "test:slice-ag is wired");

  const access = src("src/lib/admin-notification-access.ts");
  assert(access.includes("FABRIC_UNAVAILABLE"), "fabric unavailable is a notification");
  assert(!access.includes("LOW_STOCK"), "LOW_STOCK notification is gone");
  assert(!access.includes("RTW_OVERSELL"), "RTW_OVERSELL notification is gone");

  const nav = src("src/lib/admin-route-access.ts");
  assert(nav.includes("fabric-unavailable"), "orders nav has the fabric queue");

  const seed = src("prisma/seed.ts");
  assert(seed.includes("rtw_production_copy"), "seed writes production copy");
  assert(!seed.includes("notify_low_stock"), "seed dropped notify_low_stock");

  const orderPatch = src("src/app/api/admin/orders/[id]/route.ts");
  assert(orderPatch.includes("fabricUnavailableAt:"), "PATCH stamps fabricUnavailableAt");
  assert(orderPatch.includes("fabricUnavailableChoice:"), "PATCH records the fabric choice");

  const emailLib = src("src/lib/email.tsx");
  const productionProps = emailLib.match(/productionCopy=\{params\.productionCopy\}/g) ?? [];
  assert(productionProps.length === 1, "confirmation email passes productionCopy once");

  const form = src("src/components/admin/ProductFormPage.tsx");
  assert(!form.includes("?? 21"), "product form lead default is not 21 days");

  assert(
    src("src/components/layout/CartDrawer.tsx").includes("useMadeThenShippedCopy"),
    "bag reads production time from the CMS setting",
  );
  assert(
    src("src/components/checkout/OrderSummary.tsx").includes("useMadeThenShippedCopy"),
    "checkout reads production time from the CMS setting",
  );
  assert(
    src("src/components/product/ProductDetailClient.tsx").includes("madeThenShippedCopy"),
    "PDP shows production time",
  );
}

function main() {
  runDeleted();
  runProduction();
  runFabric();
  runBag();
  runSources();
  console.log("test-slice-ag: ok");
}

main();
