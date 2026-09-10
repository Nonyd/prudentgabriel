/**
 * Slice Z2: custom is never auto-selected; offered only when customOffered is on.
 *
 *   pnpm test:slice-z2
 */
import "./preload-test-env";
import { ProductCategory, ProductType, Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { addCartLine } from "../src/lib/cart-service";
import { resolveCustomCheckoutLine } from "../src/lib/custom-order-line";
import { PDP_INITIAL_FIT_MODE, isCustomOfferedNow } from "../src/lib/custom-availability";
import { bagErrorMessage } from "../src/lib/quick-add";
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

const CUSTOM_REFUSED = "This piece is not offered in custom measurements";

function runPure() {
  assert(PDP_INITIAL_FIT_MODE === "standard", "PDP starts on standard, never custom");
  assert(isCustomOfferedNow({ customOffered: true }), "custom is available when the switch is on");
  assert(!isCustomOfferedNow({ customOffered: false }), "custom is hidden when the switch is off");
  assert(bagErrorMessage(CUSTOM_REFUSED) === CUSTOM_REFUSED, "guest bag keeps the custom refusal copy");
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
      customOffered: false,
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
  await prisma.productVariant.create({
    data: { productId: product.id, size: "12", priceNGN: 80_000 },
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
  assert(!refusedCart.ok, "cart POST must refuse custom when custom is not offered");
  if (!refusedCart.ok) {
    assert(refusedCart.error === CUSTOM_REFUSED, `cart error, got ${refusedCart.error}`);
  }

  const refusedCheckout = await resolveCustomCheckoutLine({
    productId: product.id,
    quantity: 1,
    measurements,
    fx,
  });
  assert(!refusedCheckout.ok, "checkout POST must refuse custom when custom is not offered");
  if (!refusedCheckout.ok) {
    assert(refusedCheckout.error === CUSTOM_REFUSED, `checkout error, got ${refusedCheckout.error}`);
  }

  await prisma.product.update({
    where: { id: product.id },
    data: { customOffered: true },
  });

  const allowedCart = await addCartLine(user.id, {
    productId: product.id,
    quantity: 1,
    sizeMode: "CUSTOM",
    measurements,
    typedUnit: "cm",
  });
  assert(allowedCart.ok, "cart accepts custom when the switch is on");
  if (allowedCart.ok) {
    assert(allowedCart.cartItem.sizeMode === "CUSTOM", "line is custom");
    assert(allowedCart.cartItem.variantId == null, "custom does not take a size");
  }

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
