/**
 * Slice Z5: size feels safe — choose-size copy, honest sold-out, bag size change, guest qty cap.
 *
 *   pnpm test:slice-z5
 */
import "./preload-test-env";
import { ProductCategory, ProductType, Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { addCartLine, changeCartLineSize } from "../src/lib/cart-service";
import {
  CHOOSE_SIZE_MESSAGE,
  SOLD_OUT_WORD,
  SIZE_TARGET_PX,
  applyGuestSizeChange,
  applyLiveStockToGuestLine,
  capGuestQuantity,
  canChooseBagSize,
  guestLineId,
  guestQtyCanIncrease,
  soldOutSizeAriaLabel,
} from "../src/lib/bag-size";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const stamp = `z5-${Date.now()}`;

function runPure() {
  assert(CHOOSE_SIZE_MESSAGE === "Please choose your size", "PDP add teaches this exact line");
  assert(SOLD_OUT_WORD === "Sold out", "the chip must say the words, not only go grey");
  assert(SIZE_TARGET_PX === 44, "size and colour hits are 44px");
  assert(soldOutSizeAriaLabel("14") === "14, sold out", "sold-out size is named for a screen reader");

  assert(capGuestQuantity(5, 2) === 2, "guest qty cannot exceed live stock");
  assert(capGuestQuantity(1, 2) === 1, "guest qty below stock is kept");
  assert(capGuestQuantity(3, 0) === 1, "sold-out line stays at 1 so she can pick another size");
  assert(capGuestQuantity(4, 8, "CUSTOM") === 4, "made-to-measure is not stock-capped");
  assert(!guestQtyCanIncrease(2, 2), "plus is dead at the stock cap");
  assert(!guestQtyCanIncrease(1, 0), "plus is dead on a sold-out size");
  assert(guestQtyCanIncrease(1, 3), "plus works while stock remains");
  assert(!canChooseBagSize({ stock: 0 }), "sold-out size is not choosable");
  assert(canChooseBagSize({ stock: 1 }), "in-stock size is choosable");

  const line = {
    id: guestLineId("var-10", null),
    variantId: "var-10",
    size: "10",
    stock: 4,
    quantity: 3,
    colorId: undefined as string | undefined,
    sizeMode: "STANDARD" as const,
  };
  const live = applyLiveStockToGuestLine(line, [
    { id: "var-10", stock: 1 },
    { id: "var-12", stock: 5 },
  ]);
  assert(live.quantity === 1 && live.stock === 1, "refreshing a guest bag clamps qty to live stock");

  const sold = applyLiveStockToGuestLine(line, [{ id: "var-10", stock: 0 }]);
  assert(sold.stock === 0 && sold.quantity === 1, "a sold-out guest line is kept so she can change size");

  const sized = applyGuestSizeChange(line, {
    id: "var-12",
    size: "12",
    stock: 2,
    priceNGN: 80_000,
    salePriceNGN: null,
    priceUSD: null,
    priceGBP: null,
  });
  assert(sized.id === guestLineId("var-12", null), "guest line id follows the new size");
  assert(sized.size === "12" && sized.quantity === 2, "changing size also caps qty to that size's stock");
}

async function runDb() {
  const user = await prisma.user.create({
    data: { email: `${stamp}@slicez5.test`, name: "Slice Z5", role: Role.CUSTOMER },
  });
  const product = await prisma.product.create({
    data: {
      name: `Z5 Dress ${stamp}`,
      slug: `z5-dress-${stamp}`,
      description: "test",
      category: ProductCategory.FORMAL,
      type: ProductType.RTW,
      priceNGN: 80_000,
      basePriceNGN: 80_000,
      isPublished: true,
    },
  });
  const other = await prisma.product.create({
    data: {
      name: `Z5 Other ${stamp}`,
      slug: `z5-other-${stamp}`,
      description: "test",
      category: ProductCategory.FORMAL,
      type: ProductType.RTW,
      priceNGN: 90_000,
      basePriceNGN: 90_000,
      isPublished: true,
    },
  });

  const size10 = await prisma.productVariant.create({
    data: { productId: product.id, size: "10", priceNGN: 80_000, stock: 3 },
  });
  const size12 = await prisma.productVariant.create({
    data: { productId: product.id, size: "12", priceNGN: 80_000, stock: 1 },
  });
  const size14 = await prisma.productVariant.create({
    data: { productId: product.id, size: "14", priceNGN: 80_000, stock: 0 },
  });
  const otherVar = await prisma.productVariant.create({
    data: { productId: other.id, size: "10", priceNGN: 90_000, stock: 4 },
  });

  try {
    const added = await addCartLine(user.id, {
      productId: product.id,
      variantId: size10.id,
      quantity: 3,
    });
    assert(added.ok, "add size 10");
    if (!added.ok) return;
    assert(added.cartItem.quantity === 3, "first add takes the asked qty within stock");

    const capped = await changeCartLineSize(user.id, added.cartItem.id, size12.id);
    assert(capped.ok, "change to a smaller-stock size");
    if (!capped.ok) return;
    assert(capped.cartItem.variantId === size12.id, "line is now size 12");
    assert(capped.cartItem.quantity === 1, "qty is capped to the new size's stock");

    const sold = await changeCartLineSize(user.id, capped.cartItem.id, size14.id);
    assert(!sold.ok, "sold-out size is refused");
    if (!sold.ok) {
      assert(sold.error === "That size just sold out.", `sold-out copy, got ${sold.error}`);
    }

    const alien = await changeCartLineSize(user.id, capped.cartItem.id, otherVar.id);
    assert(!alien.ok, "another product's size is refused");

    const back = await changeCartLineSize(user.id, capped.cartItem.id, size10.id);
    assert(back.ok, "change back to size 10");
    if (!back.ok) return;

    const second = await addCartLine(user.id, {
      productId: product.id,
      variantId: size12.id,
      quantity: 1,
    });
    assert(second.ok, "second line in size 12");
    if (!second.ok) return;

    const merged = await changeCartLineSize(user.id, back.cartItem.id, size12.id);
    assert(merged.ok, "changing onto an existing size merges");
    if (!merged.ok) return;
    assert(merged.cartItem.id === second.cartItem.id, "the surviving line is the one already in that size");
    assert(merged.cartItem.quantity === 1, "merge cannot exceed the size's stock");
    const leftover = await prisma.cartItem.count({ where: { userId: user.id } });
    assert(leftover === 1, "the old line is deleted after merge");
  } finally {
    await prisma.cartItem.deleteMany({ where: { userId: user.id } });
    await prisma.productVariant.deleteMany({ where: { productId: { in: [product.id, other.id] } } });
    await prisma.product.deleteMany({ where: { id: { in: [product.id, other.id] } } });
    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
  }
}

async function main() {
  runPure();
  try {
    await runDb();
  } finally {
    await prisma.$disconnect();
  }
  console.log("test-slice-z5: ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
