/**
 * Slice AF: what should I make more of.
 *
 *   pnpm test:slice-af
 */
import "./preload-test-env";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  OrderStatus,
  PaymentMethod,
  PaymentPurpose,
  PaymentStatus,
  ProductCategory,
  ProductType,
  Role,
  SizeMode,
} from "@prisma/client";
import {
  classifyPayments,
  type FinanceOrderSnap,
  type FinancePaymentSnap,
} from "../src/lib/finance/classify";
import { customRange } from "../src/lib/finance/period";
import {
  aggregatePeriod,
  buildWhatsSelling,
  cashRevenueNGN,
} from "../src/lib/finance/whats-selling";
import {
  COLLECTION_DOUBLE_COUNT_COPY,
  compareSelling,
  DEMAND_COPY,
  NO_COLLECTION_ASSIGNMENTS_COPY,
  NO_SALES_COPY,
} from "../src/lib/finance/whats-selling-view";
import { prisma } from "../src/lib/prisma";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (rel: string) => readFileSync(join(root, rel), "utf8");
const stamp = `af-${Date.now()}`;
const sept = new Date("2026-09-04T10:00:00+01:00");
const range = customRange("2026-09-01", "2026-09-30");

function orderSnap(over: Partial<FinanceOrderSnap> = {}): FinanceOrderSnap {
  return {
    orderNumber: "PG-AF",
    shippingAmount: 0,
    total: 80_000,
    currency: "NGN",
    fxRateLocked: null,
    fxGbpRateLocked: null,
    fxUsdAmountLocked: null,
    status: "CONFIRMED",
    paymentStatus: PaymentStatus.PAID,
    refundRecordedAt: null,
    ...over,
  };
}

function snap(over: Partial<FinancePaymentSnap> & Pick<FinancePaymentSnap, "id" | "amount" | "orderId">): FinancePaymentSnap {
  return {
    reference: over.id,
    currency: "NGN",
    method: PaymentMethod.PAYSTACK,
    status: PaymentStatus.CONFIRMED,
    purpose: PaymentPurpose.RTW_ORDER,
    confirmedAt: sept,
    createdAt: sept,
    confirmedByName: null,
    clientLabel: "Test",
    bespokeOrderId: null,
    invoiceId: null,
    consultationId: null,
    order: orderSnap(),
    invoice: null,
    consultationRef: null,
    bespokeRef: null,
    ...over,
  };
}

const product = {
  id: "p-avril",
  name: "Avril",
  slug: "avril",
  thumbnailUrl: null,
  isPublished: true,
};

function runSource() {
  const reports = src("src/components/admin/finance/HowWeAreDoingClient.tsx");
  const panel = src("src/components/admin/finance/WhatsSellingPanel.tsx");
  const bestsellers = src("src/components/public/BestSellers.tsx");
  const shop = src("src/app/(storefront)/shop/[slug]/page.tsx");
  const list = src("src/lib/products-list-query.ts");
  const route = src("src/app/api/admin/reports/route.ts");
  const pkg = src("package.json");

  const view = src("src/lib/finance/whats-selling-view.ts");
  assert(reports.includes("WhatsSellingPanel"), "what's selling sits on /admin/reports");
  assert(!reports.includes("Best-selling pieces"), "do not keep the old units-only list");
  assert(panel.includes("card-surface"), "selling charts are solid panels");
  assert(!panel.includes("glass-opaque"), "charts are not glass under data");
  const selling = src("src/lib/finance/whats-selling.ts");
  assert(!selling.includes("StockMovement"), "what's selling does not read StockMovement");
  assert(!selling.includes("stockMovement"), "what's selling does not query stockMovement");
  assert(selling.includes("orderItem.findMany"), "what's selling reads OrderItem");
  assert(selling.includes("loadFinanceSnaps"), "what's selling reads confirmed Payment");
  assert(panel.includes('useState<SellingSort>("units")'), "units is the default sort");
  assert(panel.includes("NO_SALES_COPY"), "empty state names the lack of sales");
  assert(view.includes(NO_SALES_COPY), "empty copy is the specified sentence");
  assert(view.includes(DEMAND_COPY), "the page says these figures are paid demand");
  assert(!view.includes("Sell-through"), "sell-through copy is gone");
  assert(view.includes(COLLECTION_DOUBLE_COUNT_COPY), "double-count across collections is stated");
  assert(view.includes(NO_COLLECTION_ASSIGNMENTS_COPY), "unassigned collections have an honest empty state");
  assert((panel.match(/<section className="card-surface/g) ?? []).length === 4, "four visuals on the page");
  assert(route.includes("requireAdminApi(\"reports\")"), "still behind reports");
  assert(route.includes("buildWhatsSelling"), "reports API reads the selling ledger");
  assert(bestsellers.includes("rankedProductIdsByUnitsSold"), "homepage Best sellers uses ledger ranking");
  assert(!bestsellers.includes("orderCount"), "homepage no longer ranks on Product.orderCount");
  assert(!shop.includes("orderCount"), "related pieces no longer rank on orderCount");
  assert(list.includes("unitsSoldByProductId"), "shop Best selling sort uses ledger units");
  assert(pkg.includes("test:slice-af"), "package.json exposes the slice AF script");
}

function runPure() {
  const pointsPay = snap({
    id: "pts",
    amount: 80_000,
    method: PaymentMethod.POINTS,
    purpose: PaymentPurpose.POINTS_REDEMPTION,
    orderId: "o-pts",
    order: orderSnap({ total: 80_000 }),
  });
  const pointsLines = classifyPayments([pointsPay]);
  assert(cashRevenueNGN(pointsLines[0]!) === 0, "points cash revenue is zero");
  const points = aggregatePeriod({
    from: range.from,
    to: range.to,
    snaps: [pointsPay],
    lines: pointsLines,
    items: [
      {
        orderId: "o-pts",
        productId: product.id,
        variantId: "v1",
        quantity: 1,
        size: "12",
        sizeMode: SizeMode.STANDARD,
        lineTotal: 80_000,
      },
    ],
    returns: [],
    variants: [{ id: "v1", productId: product.id, size: "12" }],
    products: [product],
    collections: [],
  });
  assert(points.pieces.length === 1, "points-paid order still appears");
  assert(points.pieces[0]!.unitsSold === 1, "points-paid order counts one unit");
  assert(points.pieces[0]!.revenueNGN === 0, "points-paid order counts zero revenue");

  const oversellPay = snap({
    id: "ov",
    amount: 55_000,
    orderId: "o-ov",
    order: orderSnap({
      status: "CANCELLED",
      paymentStatus: PaymentStatus.PAID,
      total: 55_000,
    }),
  });
  const oversell = aggregatePeriod({
    from: range.from,
    to: range.to,
    snaps: [oversellPay],
    lines: classifyPayments([oversellPay]),
    items: [
      {
        orderId: "o-ov",
        productId: product.id,
        variantId: "v1",
        quantity: 1,
        size: "12",
        sizeMode: SizeMode.STANDARD,
        lineTotal: 55_000,
      },
    ],
    returns: [],
    variants: [{ id: "v1", productId: product.id, size: "12" }],
    products: [product],
    collections: [],
  });
  assert(oversell.pieces.length === 0, "oversell PAID + CANCELLED counts nothing");

  const soldPay = snap({ id: "sold", amount: 80_000, orderId: "o-sold" });
  const returned = aggregatePeriod({
    from: range.from,
    to: range.to,
    snaps: [soldPay],
    lines: classifyPayments([soldPay]),
    items: [
      {
        orderId: "o-sold",
        productId: product.id,
        variantId: "v1",
        quantity: 1,
        size: "12",
        sizeMode: SizeMode.STANDARD,
        lineTotal: 80_000,
      },
    ],
    returns: [{ orderId: "o-sold", variantId: "v1", quantity: 1, at: sept }],
    variants: [{ id: "v1", productId: product.id, size: "12" }],
    products: [product],
    collections: [],
  });
  assert(returned.pieces.length === 0, "a refunded piece drops out");

  const threePay = snap({ id: "three", amount: 240_000, orderId: "o-three" });
  const threeInput = {
    from: range.from,
    to: range.to,
    snaps: [threePay],
    lines: classifyPayments([threePay]),
    items: [
      {
        orderId: "o-three",
        productId: product.id,
        variantId: "v1",
        quantity: 3,
        size: "12",
        sizeMode: SizeMode.STANDARD,
        lineTotal: 240_000,
      },
    ],
    returns: [] as { orderId: string; variantId: string; quantity: number; at: Date }[],
    variants: [{ id: "v1", productId: product.id, size: "12" }],
    products: [product],
    collections: [
      { id: "c1", name: "Look one", slug: "look-one", productIds: [product.id] },
      { id: "c2", name: "Look two", slug: "look-two", productIds: [product.id] },
    ],
  };
  const first = aggregatePeriod(threeInput);
  const second = aggregatePeriod(threeInput);
  assert(first.pieces[0]!.unitsSold === 3, "three units sold");
  assert(first.pieces[0]!.sizes[0]!.sold === 3, "size 12 took the three units");
  assert(JSON.stringify(first.pieces) === JSON.stringify(second.pieces), "re-running a past period returns identical figures");
  assert(first.collections.length === 2, "the same sale is counted in each collection");
  assert(
    first.collections[0]!.unitsSold + first.collections[1]!.unitsSold === 6,
    "collection totals do not sum to the shop total",
  );
  assert(first.collectionsAssigned, "assignments are detected");

  const noneAssigned = aggregatePeriod({ ...threeInput, collections: [] });
  assert(!noneAssigned.collectionsAssigned, "no assignments is an empty collection state");

  const mto = aggregatePeriod({
    from: range.from,
    to: range.to,
    snaps: [snap({ id: "mto", amount: 90_000, orderId: "o-mto" })],
    lines: classifyPayments([snap({ id: "mto", amount: 90_000, orderId: "o-mto" })]),
    items: [
      {
        orderId: "o-mto",
        productId: product.id,
        variantId: null,
        quantity: 1,
        size: "Custom",
        sizeMode: SizeMode.CUSTOM,
        lineTotal: 90_000,
      },
    ],
    returns: [],
    variants: [],
    products: [product],
    collections: [],
  });
  assert(mto.pieces[0]!.orderedToMeasure === 1, "made-to-order is ordered to measure");
  assert(mto.pieces[0]!.unitsSold === 0, "made-to-order has no standard-size units");

  const ranked = [
    { name: "Slow", unitsSold: 5, revenueNGN: 100 },
    { name: "Tight", unitsSold: 3, revenueNGN: 90 },
  ];
  ranked.sort((a, b) => compareSelling("units", a, b));
  assert(ranked[0]!.name === "Slow", "units ranks five orders above three");
  ranked.sort((a, b) => compareSelling("revenue", a, b));
  assert(ranked[0]!.name === "Slow", "revenue ranks 100 above 90");
}

async function runDb() {
  const ids = { userIds: [] as string[], productIds: [] as string[], orderIds: [] as string[] };
  try {
    const user = await prisma.user.create({
      data: { email: `${stamp}@sliceaf.test`, name: "Slice AF", role: Role.CUSTOMER },
    });
    ids.userIds.push(user.id);
    const gown = await prisma.product.create({
      data: {
        name: `AF Gown ${stamp}`,
        slug: `af-gown-${stamp}`,
        description: "test",
        category: ProductCategory.FORMAL,
        type: ProductType.RTW,
        priceNGN: 80_000,
        basePriceNGN: 80_000,
        isPublished: true,
        variants: { create: { size: "12", priceNGN: 80_000 } },
      },
      include: { variants: true },
    });
    ids.productIds.push(gown.id);
    const variant = gown.variants[0]!;
    const order = await prisma.order.create({
      data: {
        orderNumber: `AF-${stamp}`,
        userId: user.id,
        subtotal: 80_000,
        shippingAmount: 45_000,
        total: 125_000,
        paymentStatus: PaymentStatus.PAID,
        status: OrderStatus.CONFIRMED,
        paidAt: sept,
        items: {
          create: {
            productId: gown.id,
            variantId: variant.id,
            quantity: 1,
            size: "12",
            price: 80_000,
            lineTotal: 80_000,
          },
        },
      },
    });
    ids.orderIds.push(order.id);
    await prisma.payment.create({
      data: {
        reference: `AF-${stamp}`,
        amount: 125_000,
        currency: "NGN",
        method: PaymentMethod.PAYSTACK,
        status: PaymentStatus.CONFIRMED,
        purpose: PaymentPurpose.RTW_ORDER,
        orderId: order.id,
        clientId: user.id,
        confirmedAt: sept,
        createdAt: sept,
      },
    });
    const first = await buildWhatsSelling(range.from, range.to);
    const row = first.pieces.find((p) => p.productId === gown.id);
    assert(row, "db piece appears in the period");
    assert(row.unitsSold === 1, "db counts the unit");
    assert(row.revenueNGN === 80_000, `db shipping is not revenue, got ${row.revenueNGN}`);
    assert(row.sizes.some((s) => s.size === "12" && s.sold === 1), "db counts the size from OrderItem");

    await prisma.order.update({ where: { id: order.id }, data: { total: 9_999_999 } });
    const second = await buildWhatsSelling(range.from, range.to);
    const again = second.pieces.find((p) => p.productId === gown.id);
    assert(again?.unitsSold === row.unitsSold, "re-run units unchanged after Order.total mutates");
    assert(again?.revenueNGN === row.revenueNGN, "re-run revenue unchanged after Order.total mutates");
  } finally {
    await prisma.$transaction(
      async (tx) => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.ledger_bypass', 'on', true)`);
      if (ids.orderIds.length) {
        await tx.payment.deleteMany({ where: { orderId: { in: ids.orderIds } } });
        await tx.orderItem.deleteMany({ where: { orderId: { in: ids.orderIds } } });
        await tx.order.deleteMany({ where: { id: { in: ids.orderIds } } });
      }
      if (ids.productIds.length) {
        await tx.product.deleteMany({ where: { id: { in: ids.productIds } } });
      }
      if (ids.userIds.length) {
        await tx.user.deleteMany({ where: { id: { in: ids.userIds } } });
      }
      },
      { timeout: 20_000 },
    );
  }
}

async function main() {
  runSource();
  runPure();
  try {
    await runDb();
  } finally {
    await prisma.$disconnect();
  }
  console.log("test-slice-af: ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
