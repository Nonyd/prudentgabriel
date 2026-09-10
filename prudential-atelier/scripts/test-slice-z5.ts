/**
 * Slice Z5: size feels safe — choose-size copy, bag size change, guest qty with no availability cap.
 *
 *   pnpm test:slice-z5
 */
import "./preload-test-env";
import { ProductCategory, ProductType, Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { addCartLine, changeCartLineSize } from "../src/lib/cart-service";
import {
  CHOOSE_SIZE_MESSAGE,
  SIZE_TARGET_PX,
  applyGuestSizeChange,
  capGuestQuantity,
  canChooseBagSize,
  guestLineId,
  guestQtyCanIncrease,
} from "../src/lib/bag-size";
import { chartRowsForOfferedSizes, womenCmsToChartRows } from "../src/lib/sizing";
import { DEFAULT_WOMEN_SIZE_CHART } from "../src/lib/page-content-defaults";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const stamp = `z5-${Date.now()}`;

function runPure() {
  assert(CHOOSE_SIZE_MESSAGE === "Please choose your size", "PDP add teaches this exact line");
  assert(SIZE_TARGET_PX === 44, "size and colour hits are 44px");

  assert(capGuestQuantity(5) === 5, "guest qty is kept");
  assert(capGuestQuantity(1) === 1, "qty of 1 is kept");
  assert(capGuestQuantity(0) === 1, "qty cannot fall below 1");
  assert(guestQtyCanIncrease(), "plus is never stock-capped");
  assert(canChooseBagSize(), "every listed size is choosable");

  const line = {
    id: guestLineId("var-10", null),
    variantId: "var-10",
    size: "10",
    quantity: 3,
    colorId: undefined as string | undefined,
    sizeMode: "STANDARD" as const,
  };

  const sized = applyGuestSizeChange(line, {
    id: "var-12",
    size: "12",
    priceNGN: 80_000,
    salePriceNGN: null,
    priceUSD: null,
    priceGBP: null,
  });
  assert(sized.id === guestLineId("var-12", null), "guest line id follows the new size");
  assert(sized.size === "12" && sized.quantity === 3, "changing size keeps the asked qty");

  const house = [{ label: "10" }, { label: "12" }, { label: "16" }, { label: "18" }];
  const clipped = chartRowsForOfferedSizes(house, ["10", "12"]);
  assert(
    clipped.map((r) => r.label).join(",") === "10,12",
    "the PDP chart must not show a house size this piece does not sell",
  );
  assert(
    chartRowsForOfferedSizes(house, ["6-12", "14-22"]).length === 0,
    "a range chip is not a licence to list UK 16 on the chart",
  );
  assert(chartRowsForOfferedSizes(house, ["XS"]).length === 0, "no matching row stays empty, never the full house");
  const fromCms = womenCmsToChartRows(DEFAULT_WOMEN_SIZE_CHART);
  assert(
    chartRowsForOfferedSizes(fromCms, ["10", "12"])
      .map((r) => r.label)
      .join(",") === "10,12",
    "when the database chart is empty, the CMS house still clips to chips she can tap",
  );
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
    data: { productId: product.id, size: "10", priceNGN: 80_000 },
  });
  const size12 = await prisma.productVariant.create({
    data: { productId: product.id, size: "12", priceNGN: 80_000 },
  });
  const size14 = await prisma.productVariant.create({
    data: { productId: product.id, size: "14", priceNGN: 80_000 },
  });
  const otherVar = await prisma.productVariant.create({
    data: { productId: other.id, size: "10", priceNGN: 90_000 },
  });

  try {
    const added = await addCartLine(user.id, {
      productId: product.id,
      variantId: size10.id,
      quantity: 3,
    });
    assert(added.ok, "add size 10");
    if (!added.ok) return;
    assert(added.cartItem.quantity === 3, "first add takes the asked qty");

    const changed = await changeCartLineSize(user.id, added.cartItem.id, size12.id);
    assert(changed.ok, "change to another listed size");
    if (!changed.ok) return;
    assert(changed.cartItem.variantId === size12.id, "line is now size 12");
    assert(changed.cartItem.quantity === 3, "qty is kept when the size changes");

    const fourteen = await changeCartLineSize(user.id, changed.cartItem.id, size14.id);
    assert(fourteen.ok, "every listed size can be chosen");
    if (!fourteen.ok) return;

    const alien = await changeCartLineSize(user.id, fourteen.cartItem.id, otherVar.id);
    assert(!alien.ok, "another product's size is refused");

    const back = await changeCartLineSize(user.id, fourteen.cartItem.id, size10.id);
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
    assert(merged.cartItem.quantity === 4, "merge adds the quantities");
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
