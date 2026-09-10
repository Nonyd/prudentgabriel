/**
 * Slice V (AG): duplicate copies sizes; fulfil never writes garment stock.
 *
 *   pnpm test:slice-v
 */
import "./preload-test-env";
import {
  Currency,
  OrderStatus,
  PaymentStatus,
  ProductCategory,
  ProductType,
  Role,
  SizeMode,
} from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { fulfillPaidOrder } from "../src/lib/order-payment";
import { duplicateProduct } from "../src/lib/duplicate-product";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const stamp = `slice-v-${Date.now()}`;
const ids = {
  productIds: [] as string[],
  userIds: [] as string[],
  orderIds: [] as string[],
};

async function cleanup() {
  await prisma.$transaction(async (tx) => {
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
  });
}

async function testDuplicateCopiesSizes() {
  const product = await prisma.product.create({
    data: {
      name: `${stamp} src gown`,
      slug: `${stamp}-src`,
      description: "src",
      category: ProductCategory.FORMAL,
      type: ProductType.RTW,
      priceNGN: 10_000,
      basePriceNGN: 10_000,
      variants: {
        create: [
          { size: "S", priceNGN: 10_000 },
          { size: "M", priceNGN: 10_000 },
        ],
      },
    },
  });
  ids.productIds.push(product.id);
  const copy = await duplicateProduct(product.id);
  assert(copy, "duplicate returns a product");
  ids.productIds.push(copy!.id);
  const loaded = await prisma.product.findUnique({
    where: { id: copy!.id },
    include: { variants: true },
  });
  assert(loaded?.variants.length === 2, "copy keeps both sizes");
  assert(loaded?.variants.every((v) => v.size === "S" || v.size === "M"), "copy sizes match the source");
}

async function testFulfilDoesNotBlock() {
  const user = await prisma.user.create({
    data: { email: `${stamp}-sale@example.test`, name: "Sale", role: Role.CUSTOMER },
  });
  ids.userIds.push(user.id);
  const product = await prisma.product.create({
    data: {
      name: `${stamp} sale gown`,
      slug: `${stamp}-sale`,
      description: "sale",
      category: ProductCategory.FORMAL,
      type: ProductType.RTW,
      priceNGN: 80_000,
      basePriceNGN: 80_000,
      customOffered: true,
      variants: { create: { size: "M", priceNGN: 80_000 } },
    },
    include: { variants: true },
  });
  ids.productIds.push(product.id);
  const variant = product.variants[0]!;

  const standard = await prisma.order.create({
    data: {
      orderNumber: `V-SALE-${stamp}`,
      userId: user.id,
      subtotal: 80_000,
      total: 80_000,
      currency: Currency.NGN,
      paymentStatus: PaymentStatus.PENDING,
      status: OrderStatus.PENDING,
      items: {
        create: {
          productId: product.id,
          variantId: variant.id,
          quantity: 1,
          size: "M",
          price: 80_000,
          lineTotal: 80_000,
        },
      },
    },
  });
  ids.orderIds.push(standard.id);
  await fulfillPaidOrder({
    orderId: standard.id,
    paymentRef: `PA-ORDER-V-SALE-${stamp}`,
    notify: false,
  });
  const paid = await prisma.order.findUniqueOrThrow({ where: { id: standard.id } });
  assert(paid.paymentStatus === PaymentStatus.PAID, "standard fulfil marks PAID");
  assert(paid.status !== OrderStatus.CANCELLED, "made-to-order fulfil never cancels for stock");

  const custom = await prisma.order.create({
    data: {
      orderNumber: `V-CUSTOM-${stamp}`,
      userId: user.id,
      subtotal: 80_000,
      total: 80_000,
      paymentStatus: PaymentStatus.PENDING,
      items: {
        create: {
          productId: product.id,
          variantId: variant.id,
          quantity: 1,
          size: "Custom",
          price: 80_000,
          lineTotal: 80_000,
          sizeMode: SizeMode.CUSTOM,
        },
      },
    },
  });
  ids.orderIds.push(custom.id);
  await fulfillPaidOrder({
    orderId: custom.id,
    paymentRef: `PA-ORDER-V-CUSTOM-${stamp}`,
    notify: false,
  });
  const customPaid = await prisma.order.findUniqueOrThrow({ where: { id: custom.id } });
  assert(customPaid.paymentStatus === PaymentStatus.PAID, "custom fulfil marks PAID");
}

async function sweepPriorSliceV() {
  const products = await prisma.product.findMany({
    where: { slug: { startsWith: "slice-v-" } },
    select: { id: true },
  });
  const users = await prisma.user.findMany({
    where: { email: { contains: "slice-v-" } },
    select: { id: true },
  });
  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { orderNumber: { startsWith: "V-SALE-slice-v-" } },
        { orderNumber: { startsWith: "V-CUSTOM-slice-v-" } },
        { orderNumber: { startsWith: "V-OVER-slice-v-" } },
      ],
    },
    select: { id: true },
  });
  ids.productIds = products.map((p) => p.id);
  ids.userIds = users.map((u) => u.id);
  ids.orderIds = orders.map((o) => o.id);
  await cleanup();
  ids.productIds = [];
  ids.userIds = [];
  ids.orderIds = [];
}

async function main() {
  try {
    await sweepPriorSliceV();
    await testDuplicateCopiesSizes();
    await testFulfilDoesNotBlock();
    console.log("test:slice-v passed");
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
