/**
 * Slice R: custom measurements, stock skip, sold-out still orderable, range checks.
 *
 *   pnpm test:slice-r
 */
import "./preload-test-env";
import {
  CustomSurchargeKind,
  OrderFulfilmentKind,
  PaymentStatus,
  ProductCategory,
  ProductType,
  Role,
  SizeMode,
} from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { fulfillPaidOrder } from "../src/lib/order-payment";
import {
  customSurchargeNGN,
  formatSnapshotLines,
  fulfilmentKindForLines,
  parseSnapshot,
  shouldDecrementStock,
  validateCustomMeasurements,
  type MeasurementFieldDef,
} from "../src/lib/custom-size";
import { inchesToCm, isStandardSizeLabel, toCanonicalCm } from "../src/lib/sizing";
import { canTransitionOrder } from "../src/lib/order-status";
import { render } from "@react-email/render";
import OrderConfirmationEmail from "../src/emails/OrderConfirmationEmail";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const FIELDS: MeasurementFieldDef[] = [
  {
    key: "bust",
    label: "Bust",
    required: true,
    sortOrder: 0,
    minCm: 60,
    maxCm: 150,
  },
  {
    key: "waist",
    label: "Waist",
    required: true,
    sortOrder: 1,
    minCm: 50,
    maxCm: 140,
  },
  {
    key: "notes",
    label: "Notes",
    required: false,
    sortOrder: 2,
  },
];

function runPure() {
  assert(isStandardSizeLabel("12"), "UK 12 is a standard size");
  assert(!isStandardSizeLabel("Custom"), "Custom is not a standard size");
  assert(!isStandardSizeLabel("custom"), "custom is not a standard size");

  assert(Math.abs(toCanonicalCm(36, "in") - inchesToCm(36)) < 0.01, "inches convert to cm");
  assert(toCanonicalCm(92, "cm") === 92, "cm stays cm");

  const missing = validateCustomMeasurements(FIELDS, [{ key: "bust", value: 90, unit: "cm" }]);
  assert(!missing.ok, "required waist is missing");
  if (!missing.ok) assert(missing.errors.some((e) => e.key === "waist" && e.code === "REQUIRED"), "waist required");

  const tooSmall = validateCustomMeasurements(FIELDS, [
    { key: "bust", value: 30, unit: "cm" },
    { key: "waist", value: 70, unit: "cm" },
  ]);
  assert(!tooSmall.ok, "30cm bust is rejected");
  if (!tooSmall.ok) assert(tooSmall.errors.some((e) => e.code === "RANGE"), "range error");

  const inchesOk = validateCustomMeasurements(FIELDS, [
    { key: "bust", value: 36, unit: "in" },
    { key: "waist", value: 28, unit: "in" },
  ]);
  assert(inchesOk.ok, "inch figures within range pass");
  if (inchesOk.ok) {
    assert(inchesOk.snapshot[0].valueCm === toCanonicalCm(36, "in"), "snapshot stores cm");
    assert(inchesOk.snapshot[0].typedUnit === "in", "typed unit is kept");
    const lines = formatSnapshotLines(inchesOk.snapshot);
    assert(lines.some((l) => l.includes("Bust") && l.includes("in")), "email lines carry typed bust");
  }

  assert(customSurchargeNGN({ unitNGN: 100_000, kind: CustomSurchargeKind.PERCENT, value: 10 }) === 10_000, "10% surcharge");
  assert(customSurchargeNGN({ unitNGN: 100_000, kind: CustomSurchargeKind.FLAT, value: 5000 }) === 5000, "flat surcharge");
  assert(customSurchargeNGN({ unitNGN: 100_000, kind: CustomSurchargeKind.NONE, value: 99 }) === 0, "none is zero");

  assert(shouldDecrementStock(SizeMode.STANDARD), "standard decrements");
  assert(!shouldDecrementStock(SizeMode.CUSTOM), "custom does not decrement");
  assert(fulfilmentKindForLines(["CUSTOM"]) === OrderFulfilmentKind.MADE_TO_ORDER, "custom is MTO");
  assert(fulfilmentKindForLines(["STANDARD", "CUSTOM"]) === OrderFulfilmentKind.MIXED, "mixed cart");

  assert(
    canTransitionOrder("CONFIRMED", "CUTTING", { fulfilmentKind: "MADE_TO_ORDER" }),
    "MTO confirmed goes to cutting",
  );
  assert(
    !canTransitionOrder("CONFIRMED", "PROCESSING", { fulfilmentKind: "MADE_TO_ORDER" }),
    "MTO skips pick-and-pack processing",
  );
  assert(canTransitionOrder("CONFIRMED", "PROCESSING", {}), "stock orders still process");
}

const stamp = `slice-r-${Date.now()}`;

async function runDb() {
  const user = await prisma.user.create({
    data: {
      email: `${stamp}@example.com`,
      name: "Slice R",
      role: Role.CUSTOMER,
    },
  });

  const product = await prisma.product.create({
    data: {
      name: `Slice R Gown ${stamp}`,
      slug: `slice-r-gown-${stamp}`,
      description: "test",
      category: ProductCategory.FORMAL,
      type: ProductType.RTW,
      priceNGN: 100_000,
      basePriceNGN: 100_000,
      isPublished: true,
      customOffered: true,
      customReturnable: false,
      customLeadTimeDays: 21,
    },
  });

  const bust = await prisma.measurementField.findUnique({ where: { key: "bust" } });
  const waist = await prisma.measurementField.findUnique({ where: { key: "waist" } });
  assert(bust && waist, "seeded measurement fields exist");
  await prisma.productMeasurement.createMany({
    data: [
      { productId: product.id, fieldId: bust!.id, required: true, sortOrder: 0 },
      { productId: product.id, fieldId: waist!.id, required: true, sortOrder: 1 },
    ],
  });

  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      size: "12",
      priceNGN: 100_000,
      stock: 2,
    },
  });

  const snapshot = [
    { key: "bust", label: "Bust", valueCm: 92, typedValue: 36.2, typedUnit: "in" },
    { key: "waist", label: "Waist", valueCm: 71, typedValue: 28, typedUnit: "in" },
  ];

  const customOrder = await prisma.order.create({
    data: {
      orderNumber: `R-CUSTOM-${stamp}`,
      userId: user.id,
      subtotal: 100_000,
      total: 100_000,
      paymentStatus: PaymentStatus.PENDING,
      fulfilmentKind: OrderFulfilmentKind.MADE_TO_ORDER,
      customReturnable: false,
      customLeadTimeDays: 21,
      items: {
        create: {
          productId: product.id,
          quantity: 1,
          size: "Custom",
          price: 100_000,
          lineTotal: 100_000,
          sizeMode: SizeMode.CUSTOM,
          measurements: snapshot,
          typedUnit: "in",
        },
      },
    },
  });

  const before = (await prisma.productVariant.findUnique({ where: { id: variant.id } }))!.stock;
  await fulfillPaidOrder({
    orderId: customOrder.id,
    paymentRef: `PA-ORDER-R-${stamp}`,
    notify: false,
  });
  const after = (await prisma.productVariant.findUnique({ where: { id: variant.id } }))!.stock;
  assert(after === before, `custom must not decrement stock, before ${before} after ${after}`);

  const soldOut = await prisma.productVariant.update({
    where: { id: variant.id },
    data: { stock: 0 },
  });
  assert(soldOut.stock === 0, "standard size is sold out");
  const stillOffered = await prisma.product.findUnique({
    where: { id: product.id },
    select: { customOffered: true },
  });
  assert(stillOffered?.customOffered, "custom remains offered when sizes are gone");

  const guestOrder = await prisma.order.create({
    data: {
      orderNumber: `R-GUEST-${stamp}`,
      guestEmail: `guest-${stamp}@example.com`,
      guestName: "Guest",
      subtotal: 100_000,
      total: 100_000,
      paymentStatus: PaymentStatus.PENDING,
      fulfilmentKind: OrderFulfilmentKind.MADE_TO_ORDER,
      guestCustom: true,
      items: {
        create: {
          productId: product.id,
          quantity: 1,
          size: "Custom",
          price: 100_000,
          lineTotal: 100_000,
          sizeMode: SizeMode.CUSTOM,
          measurements: snapshot,
        },
      },
    },
  });
  await fulfillPaidOrder({
    orderId: guestOrder.id,
    paymentRef: `PA-ORDER-RG-${stamp}`,
    notify: false,
  });
  const stockAfterGuest = (await prisma.productVariant.findUnique({ where: { id: variant.id } }))!.stock;
  assert(stockAfterGuest === 0, "guest custom still does not touch stock");

  const paid = await prisma.order.findUnique({
    where: { id: customOrder.id },
    include: { items: true },
  });
  assert(paid?.paymentStatus === PaymentStatus.PAID, "custom order paid");
  const measured = paid!.items[0].measurements;
  assert(JSON.stringify(measured).includes("Bust"), "order line stores measurements");

  const html = await render(
    OrderConfirmationEmail({
      firstName: "Ada",
      orderNumber: customOrder.orderNumber,
      items: [
        {
          name: product.name,
          size: "Custom",
          qty: 1,
          priceNGN: 100_000,
          custom: true,
          measurements: formatSnapshotLines(parseSnapshot(measured)),
        },
      ],
      subtotalNGN: 100_000,
      shippingNGN: 0,
      discountNGN: 0,
      pointsDiscNGN: 0,
      totalNGN: 100_000,
      customLeadDays: 21,
      customReturnNote: "This piece is cut to the measurements you entered. It cannot be returned or exchanged.",
    }),
  );
  assert(html.includes("Bust"), "confirmation email carries bust");
  assert(html.includes("Waist"), "confirmation email carries waist");
  assert(html.includes("Made to your measurements"), "confirmation email labels custom");
}

async function cleanup() {
  // Paid orders stay. Payment ledger is append-only, so these stamped
  // R-CUSTOM-slice-r-* / R-GUEST-slice-r-* rows are ledger evidence.
}

async function main() {
  runPure();
  try {
    await runDb();
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
  console.log("slice-r ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
