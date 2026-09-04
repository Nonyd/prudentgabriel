/**
 * Slice Z2: custom is never auto-selected; remake after sell-out is a default-off gate.
 *
 *   pnpm test:slice-z2
 */
import "./preload-test-env";
import { ProductCategory, ProductType, Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { addCartLine } from "../src/lib/cart-service";
import { resolveCustomCheckoutLine } from "../src/lib/custom-order-line";
import {
  CUSTOM_REMAKE_REFUSED,
  PDP_INITIAL_FIT_MODE,
  isCustomOfferedNow,
} from "../src/lib/custom-availability";
import { stockGuardMessage } from "../src/lib/quick-add";
import { processRestockAlerts } from "../src/lib/stock-alerts";
import type { LockedFx } from "../src/lib/fx";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const stamp = `z2-${Date.now()}`;
const fx: LockedFx = {
  rate: 0.00065,
  gbpRate: 0.00052,
  source: "test",
  fetchedAt: new Date(),
  stale: false,
};

function runPure() {
  assert(PDP_INITIAL_FIT_MODE === "standard", "PDP starts on standard, never custom");

  const inStock = [{ size: "12", stock: 2 }];
  const soldOut = [{ size: "12", stock: 0 }];

  assert(
    isCustomOfferedNow({ customOffered: true, customOfferedWhenSoldOut: false, variants: inStock }),
    "custom is available while sizes are in stock",
  );
  assert(
    !isCustomOfferedNow({ customOffered: true, customOfferedWhenSoldOut: false, variants: soldOut }),
    "sold out + remake off hides custom",
  );
  assert(
    isCustomOfferedNow({ customOffered: true, customOfferedWhenSoldOut: true, variants: soldOut }),
    "sold out + remake on still offers custom",
  );
  assert(
    !isCustomOfferedNow({ customOffered: false, customOfferedWhenSoldOut: true, variants: soldOut }),
    "custom not offered at all — remake switch cannot invent it",
  );
  assert(
    stockGuardMessage(CUSTOM_REMAKE_REFUSED) === CUSTOM_REMAKE_REFUSED,
    "guest bag must keep the remake refusal, not rewrite it as a size miss",
  );
}

async function runDb() {
  const user = await prisma.user.create({
    data: { email: `${stamp}@slicez2.test`, name: "Slice Z2", role: Role.CUSTOMER },
  });

  const product = await prisma.product.create({
    data: {
      name: `Z2 Dress ${stamp}`,
      slug: `z2-dress-${stamp}`,
      description: "test",
      category: ProductCategory.FORMAL,
      type: ProductType.RTW,
      priceNGN: 80_000,
      basePriceNGN: 80_000,
      isPublished: true,
      customOffered: true,
      customOfferedWhenSoldOut: false,
    },
  });
  const bust = await prisma.measurementField.findUnique({ where: { key: "bust" } });
  const waist = await prisma.measurementField.findUnique({ where: { key: "waist" } });
  assert(bust && waist, "measurement fields exist");
  await prisma.productMeasurement.createMany({
    data: [
      { productId: product.id, fieldId: bust.id, required: true, sortOrder: 0 },
      { productId: product.id, fieldId: waist.id, required: true, sortOrder: 1 },
    ],
  });
  const variant = await prisma.productVariant.create({
    data: { productId: product.id, size: "12", priceNGN: 80_000, stock: 0 },
  });

  const measurements = [
    { key: "bust", value: 92, unit: "cm" as const },
    { key: "waist", value: 71, unit: "cm" as const },
  ];

  const refusedCart = await addCartLine(user.id, {
    productId: product.id,
    quantity: 1,
    sizeMode: "CUSTOM",
    measurements,
    typedUnit: "cm",
  });
  assert(!refusedCart.ok, "cart POST must refuse custom when remake is off");
  if (!refusedCart.ok) {
    assert(refusedCart.error === CUSTOM_REMAKE_REFUSED, `cart error, got ${refusedCart.error}`);
  }

  const refusedCheckout = await resolveCustomCheckoutLine({
    productId: product.id,
    quantity: 1,
    measurements,
    fx,
  });
  assert(!refusedCheckout.ok, "checkout POST must refuse custom when remake is off");
  if (!refusedCheckout.ok) {
    assert(refusedCheckout.error === CUSTOM_REMAKE_REFUSED, `checkout error, got ${refusedCheckout.error}`);
  }

  await prisma.product.update({
    where: { id: product.id },
    data: { customOfferedWhenSoldOut: true },
  });

  const allowedCart = await addCartLine(user.id, {
    productId: product.id,
    quantity: 1,
    sizeMode: "CUSTOM",
    measurements,
    typedUnit: "cm",
  });
  assert(allowedCart.ok, "cart accepts custom when remake is on");
  if (allowedCart.ok) {
    assert(allowedCart.cartItem.sizeMode === "CUSTOM", "line is custom");
    assert(allowedCart.cartItem.variantId == null, "custom does not take a size");
  }

  await prisma.stockAlert.upsert({
    where: { email_variantId: { email: user.email!, variantId: variant.id } },
    create: { email: user.email!, variantId: variant.id },
    update: {},
  });
  const held = await prisma.stockAlert.count({ where: { variantId: variant.id } });
  assert(held === 1, "notify-me writes a StockAlert row");

  await prisma.productVariant.update({ where: { id: variant.id }, data: { stock: 1 } });
  const sent = await processRestockAlerts([variant.id]);
  assert(sent >= 1, `restock must email the subscriber, sent ${sent}`);
  const afterMail = await prisma.stockAlert.count({ where: { variantId: variant.id } });
  assert(afterMail === 0, "alert is consumed after the restock mail");

  await prisma.cartItem.deleteMany({ where: { userId: user.id } });
  await prisma.productMeasurement.deleteMany({ where: { productId: product.id } });
  await prisma.productVariant.deleteMany({ where: { productId: product.id } });
  await prisma.product.delete({ where: { id: product.id } });
  await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
}

async function main() {
  runPure();
  try {
    await runDb();
  } finally {
    await prisma.$disconnect();
  }
  console.log("test-slice-z2: ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
