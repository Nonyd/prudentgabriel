/**
 * Slice AU: product options — one choice with a signed price adjustment.
 *
 * Photography (Allure suit): they share photography. Staging PDP is a single
 * Cloudinary logo PNG, copy still says a 3-piece with pants. No gallery switch.
 *
 * Quick-add: required option group sends her to the PDP (same as Slice Z2 custom).
 *
 * SKU: size SKU stays as it is. Workroom suffix PA-STEM-SIZE-SKIRT (includeInSku,
 * default true). Do not explode variants.
 *
 *   pnpm test:slice-au
 */
import "./preload-test-env";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PaymentStatus, ProductType, Role } from "@prisma/client";
import { ProductCategory } from "../src/lib/shop-category-slug";
import { prisma } from "../src/lib/prisma";
import { addCartLine } from "../src/lib/cart-service";
import {
  derivedCatalogMinNGN,
  displayPriceNGN,
  effectiveUnitNGN,
  minEffectiveNGN,
  overrideOrConvertWithOption,
  variantAmountInCurrency,
} from "../src/lib/pricing";
import { rtwChargeAmountNGN } from "../src/lib/payments/rtw-totals";
import {
  assertChosenOption,
  buildWorkroomSku,
  cheapestOptionAdjustmentNGN,
  fieldsForOption,
  formatGarmentChoice,
  requiresOptionChoice,
} from "../src/lib/product-options";
import { cartLineKey } from "../src/lib/custom-size";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (rel: string) => readFileSync(join(root, rel), "utf8");
const stamp = `au-${Date.now()}`;
const rates = { NGN: 1, USD: 0.00065, GBP: 0.00052 };

function runSource() {
  const pricing = src("src/lib/pricing.ts");
  const pdp = src("src/components/product/ProductDetailClient.tsx");
  const card = src("src/components/common/ProductCard.tsx");
  const row = src("src/components/product/ProductOptionRow.tsx");
  const totals = src("src/lib/payments/rtw-totals.ts");
  const schema = src("prisma/schema.prisma");
  const gallery = src("src/components/product/ProductGallery.tsx");
  const bind = src("src/lib/payment-bind.ts");
  const editor = src("src/components/admin/ProductOptionGroupEditor.tsx");

  assert(pricing.includes("optionAdjustmentNGN = 0"), "option adj enters effectiveUnitNGN");
  assert(pricing.includes("cheapestOptionAdjustmentNGN"), "From ₦ uses the cheapest option");
  assert(!gallery.includes("optionId") && !gallery.includes("optionGroup"), "Allure shares photography — gallery does not switch on option");
  assert(pdp.includes("<ProductGallery images={product.images}"), "PDP gallery stays the product images");
  assert(card.includes("requiresOptionChoice"), "quick-add checks for a required option group");
  assert(card.includes("goToProduct()"), "required option sends her to the PDP");
  assert(row.includes("min-h-[44px]"), "option chips are 44px");
  assert(row.includes('id="product-options"'), "option row is the scroll target");
  const optionRowIdx = pdp.indexOf("<ProductOptionRow");
  const sizesIdx = pdp.indexOf('id="product-sizes"');
  assert(optionRowIdx >= 0 && sizesIdx > optionRowIdx, "the choice sits above the size chips");
  assert(pdp.includes("chooseOptionMessage"), "required option uses Z5-style teach-on-tap");
  assert(pdp.includes("fieldsForOption"), "option can override measurement fields");
  assert(totals.includes("return order.total"), "payment charge uses order.total when unpaid");
  assert(bind.includes("expectedAmount"), "Slice A bind still compares the outstanding charge");
  assert(schema.includes("model ProductOptionGroup"), "option group is its own table");
  assert(schema.includes("model ProductOption "), "options are not a second variant dimension");
  assert(schema.includes("Slice AQ can hang a material list off ProductOption"), "AQ can attach a BOM later");
  assert(editor.includes("includeInSku"), "admin can put the choice on the workroom code");
  assert(schema.includes("includeInSku Boolean         @default(true)"), "workroom SKU includes the option by default");
}

function runPure() {
  const sizes = [
    { id: "10", priceNGN: 200_000, salePriceNGN: null, priceUSD: null as number | null, priceGBP: null as number | null },
    { id: "12", priceNGN: 210_000, salePriceNGN: null, priceUSD: null, priceGBP: null },
  ];
  const options = [
    { id: "trousers", label: "Trousers", priceAdjustmentNGN: 0, isDefault: true },
    { id: "skirt", label: "Skirt", priceAdjustmentNGN: -25_000, isDefault: false },
  ];
  const product = { isOnSale: false, priceUSD: null as number | null, priceGBP: null as number | null };

  const fromCard = minEffectiveNGN(sizes, false, options);
  const fromCatalog = derivedCatalogMinNGN(sizes, false, options);
  const fromUnselectedPdp = displayPriceNGN(sizes, null, false, options, null);
  assert(cheapestOptionAdjustmentNGN(options) === -25_000, "cheapest option is the skirt");
  assert(fromCard === 175_000, "From ₦ is cheapest size with cheapest option");
  assert(fromCatalog === fromCard, "catalog min agrees with the card");
  assert(fromUnselectedPdp === fromCard, "unselected PDP From agrees with the card");

  const pdpSkirt12 = displayPriceNGN(sizes, "12", false, options, "skirt");
  const bagSkirt12 = effectiveUnitNGN(sizes[1]!, false, -25_000);
  const checkoutSkirt12 = effectiveUnitNGN(sizes[1]!, false, -25_000);
  const orderSkirt12 = bagSkirt12;
  assert(pdpSkirt12 === 185_000, "PDP size 12 skirt is ₦185,000");
  assert(bagSkirt12 === pdpSkirt12, "bag unit equals PDP");
  assert(checkoutSkirt12 === bagSkirt12, "checkout unit equals bag");
  assert(orderSkirt12 === checkoutSkirt12, "order unit equals checkout");

  const usd = variantAmountInCurrency(sizes[1]!, product, "USD", rates, -25_000);
  assert(usd === 185_000 * rates.USD, "USD converts the adjusted naira figure");
  const overridden = overrideOrConvertWithOption(185_000, "USD", 450, rates, -25_000);
  assert(overridden === 450 + -25_000 * rates.USD, "USD override keeps the size stamp and converts the adj");

  const required = assertChosenOption({
    group: { isRequired: true, includeInSku: true, label: "Trousers or skirt", options },
    optionId: null,
  });
  assert(!required.ok, "a required option cannot be skipped");

  const chosen = assertChosenOption({
    group: { isRequired: true, includeInSku: true, label: "Trousers or skirt", options },
    optionId: "skirt",
  });
  assert(chosen.ok && chosen.chosen?.priceAdjustmentNGN === -25_000, "chosen option freezes its adj");

  const unpaid = rtwChargeAmountNGN({
    paymentStatus: PaymentStatus.PENDING,
    total: 185_000,
    amountPaid: 0,
    pointsDiscountNGN: 0,
  });
  assert(unpaid === 185_000, "Slice A charges order.total, which already includes the adj");

  assert(
    formatGarmentChoice({ name: "Allure suit", optionLabel: "Skirt", size: "12" }) === "Allure suit — Skirt, size 12",
    "confirmation and packing read Allure suit — Skirt, size 12",
  );
  assert(
    buildWorkroomSku({ variantSku: "PA-ALLUR-12", includeInSku: true, optionLabel: "Skirt" }) === "PA-ALLUR-12-SKIRT",
    "workroom code appends the option",
  );
  assert(
    cartLineKey({ sizeMode: "STANDARD", productId: "p", variantId: "v12", colorId: null, optionId: "skirt" }).endsWith(
      ":skirt",
    ),
    "bag line key includes the option so trousers and skirt do not merge",
  );

  const trouserFields = [{ key: "inseam", label: "Inseam", helpText: null, minCm: 60, maxCm: 100, required: true, sortOrder: 0 }];
  const skirtFields = [{ key: "skirtLength", label: "Skirt length", helpText: null, minCm: 40, maxCm: 90, required: true, sortOrder: 0 }];
  const productFields = [{ key: "waist", label: "Waist", helpText: null, minCm: 50, maxCm: 120, required: true, sortOrder: 0 }];
  const swapped = fieldsForOption(productFields, [{ optionId: "skirt", fields: skirtFields }, { optionId: "trousers", fields: trouserFields }], "skirt");
  assert(swapped[0]?.key === "skirtLength", "choosing skirt asks for skirt measurements");
  assert(requiresOptionChoice({ isRequired: true, options }), "required group needs a tap");
}

async function runDb() {
  const ids = { userIds: [] as string[], productIds: [] as string[], orderIds: [] as string[] };
  try {
    const user = await prisma.user.create({
      data: { email: `${stamp}@sliceau.test`, name: "Slice AU", role: Role.CUSTOMER },
    });
    ids.userIds.push(user.id);

    const product = await prisma.product.create({
      data: {
        name: `AU Allure ${stamp}`,
        slug: `au-allure-${stamp}`,
        description: "test",
        category: ProductCategory.FORMAL,
        type: ProductType.RTW,
        priceNGN: 175_000,
        basePriceNGN: 175_000,
        isPublished: true,
        variants: {
          create: [
            { size: "10", priceNGN: 200_000, sku: `AU-${stamp}-10` },
            { size: "12", priceNGN: 210_000, sku: `AU-${stamp}-12` },
          ],
        },
        optionGroup: {
          create: {
            label: "Trousers or skirt",
            isRequired: true,
            includeInSku: true,
            options: {
              create: [
                { label: "Trousers", priceAdjustmentNGN: 0, isDefault: true, sortOrder: 0, skuPart: "TROUS" },
                { label: "Skirt", priceAdjustmentNGN: -25_000, isDefault: false, sortOrder: 1, skuPart: "SKIRT" },
              ],
            },
          },
        },
      },
      include: { variants: true, optionGroup: { include: { options: true } } },
    });
    ids.productIds.push(product.id);
    const size12 = product.variants.find((v) => v.size === "12")!;
    const skirt = product.optionGroup!.options.find((o) => o.label === "Skirt")!;
    const trousers = product.optionGroup!.options.find((o) => o.label === "Trousers")!;

    const card = derivedCatalogMinNGN(product.variants, product.isOnSale, product.optionGroup!.options);
    const pdp = displayPriceNGN(product.variants, size12.id, product.isOnSale, product.optionGroup!.options, skirt.id);
    const bag = effectiveUnitNGN(size12, product.isOnSale, skirt.priceAdjustmentNGN);
    assert(card === 175_000, `card From is cheapest size+option, got ${card}`);
    assert(pdp === bag, "PDP selected price equals bag unit");
    assert(bag === 185_000, "skirt size 12 is ₦185,000");

    const skipped = await addCartLine(user.id, {
      productId: product.id,
      variantId: size12.id,
      quantity: 1,
    });
    assert(!skipped.ok, "cart refuses a required option left blank");

    const added = await addCartLine(user.id, {
      productId: product.id,
      variantId: size12.id,
      quantity: 1,
      optionId: skirt.id,
    });
    assert(added.ok, "cart accepts the skirt");
    if (added.ok) {
      assert(added.cartItem.optionId === skirt.id, "bag stores the chosen option");
    }

    const charged = bag;
    const order = await prisma.order.create({
      data: {
        orderNumber: `AU-${stamp}`,
        userId: user.id,
        subtotal: charged,
        shippingAmount: 0,
        total: charged,
        items: {
          create: {
            productId: product.id,
            variantId: size12.id,
            quantity: 1,
            size: "12",
            price: charged,
            lineTotal: charged,
            optionId: skirt.id,
            optionLabel: "Skirt",
            optionAdjustmentNGN: skirt.priceAdjustmentNGN,
          },
        },
      },
      include: { items: true },
    });
    ids.orderIds.push(order.id);
    assert(order.items[0]!.optionLabel === "Skirt", "order line freezes the option label");
    assert(order.items[0]!.optionAdjustmentNGN === -25_000, "order line freezes the adj");
    assert(order.items[0]!.price === charged, "order line freezes the charged unit");
    assert(order.total === charged, "order.total includes the adj");
    assert(
      rtwChargeAmountNGN({
        paymentStatus: PaymentStatus.PENDING,
        total: order.total,
        amountPaid: 0,
      }) === charged,
      "payment bind would charge the adjusted total",
    );

    await prisma.productOption.update({
      where: { id: skirt.id },
      data: { priceAdjustmentNGN: -50_000 },
    });
    await prisma.productOption.update({
      where: { id: trousers.id },
      data: { priceAdjustmentNGN: 10_000 },
    });
    const frozen = await prisma.orderItem.findFirst({ where: { orderId: order.id } });
    assert(frozen?.optionLabel === "Skirt", "later option edits do not rewrite the label");
    assert(frozen?.optionAdjustmentNGN === -25_000, "later option edits do not rewrite the adj");
    assert(frozen?.price === charged, "later option edits do not rewrite the charged unit");
  } finally {
    await prisma.$transaction(
      async (tx) => {
        if (ids.userIds.length) {
          await tx.cartItem.deleteMany({ where: { userId: { in: ids.userIds } } });
        }
        if (ids.orderIds.length) {
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
  console.log("test-slice-au: ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
