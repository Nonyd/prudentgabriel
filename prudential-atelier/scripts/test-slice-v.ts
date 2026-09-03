/**
 * Slice V: stock ledger, duplicate zeros, custom skip, oversell does not restock.
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
import { fulfillPaidOrder, FULFILMENT_STOCK_REFUSE_NOTE } from "../src/lib/order-payment";
import { duplicateProduct } from "../src/lib/duplicate-product";
import { shouldDecrementStock } from "../src/lib/custom-size";
import {
  applyCountCorrection,
  ensureAllOpeningMovements,
  reconcileVariantStock,
  restockOrderLines,
} from "../src/lib/stock-ledger";

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

async function sumDelta(variantId: string): Promise<number> {
  const agg = await prisma.stockMovement.aggregate({
    where: { variantId },
    _sum: { delta: true },
  });
  return agg._sum.delta ?? 0;
}

async function cachedStock(variantId: string): Promise<number> {
  const row = await prisma.productVariant.findUniqueOrThrow({
    where: { id: variantId },
    select: { stock: true },
  });
  return row.stock;
}

async function testSaleWritesMovement() {
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
      variants: { create: { size: "M", priceNGN: 80_000, stock: 3 } },
    },
    include: { variants: true },
  });
  ids.productIds.push(product.id);
  const variant = product.variants[0]!;
  const order = await prisma.order.create({
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
  ids.orderIds.push(order.id);

  await fulfillPaidOrder({
    orderId: order.id,
    paymentRef: `PA-ORDER-V-SALE-${stamp}`,
    notify: false,
  });

  const sales = await prisma.stockMovement.findMany({
    where: { variantId: variant.id, reason: "SALE" },
  });
  assert(sales.length === 1, "sale writes one SALE movement");
  assert(sales[0]!.delta === -1, "SALE delta is -1");
  assert(sales[0]!.orderId === order.id, "SALE carries orderId");
  assert((await cachedStock(variant.id)) === (await sumDelta(variant.id)), "cache equals movement sum after sale");
  assert((await cachedStock(variant.id)) === 2, "cached stock is 2 after selling 1 of 3");
}

async function testAdminEditWritesCorrection() {
  const actor = await prisma.user.create({
    data: { email: `${stamp}-actor@example.test`, name: "Counter", role: Role.ADMIN },
  });
  ids.userIds.push(actor.id);
  const product = await prisma.product.create({
    data: {
      name: `${stamp} count gown`,
      slug: `${stamp}-count`,
      description: "count",
      category: ProductCategory.FORMAL,
      type: ProductType.RTW,
      priceNGN: 50_000,
      basePriceNGN: 50_000,
      variants: { create: { size: "S", priceNGN: 50_000, stock: 4 } },
    },
    include: { variants: true },
  });
  ids.productIds.push(product.id);
  const variant = product.variants[0]!;

  await prisma.$transaction((tx) =>
    applyCountCorrection(tx, { variantId: variant.id, newStock: 6, actorId: actor.id }),
  );

  const rows = await prisma.stockMovement.findMany({
    where: { variantId: variant.id, reason: "COUNT_CORRECTION" },
  });
  assert(rows.length === 1, "admin edit writes COUNT_CORRECTION");
  assert(rows[0]!.actorId === actor.id, "correction records the actor");
  assert(rows[0]!.note?.includes("was 4, now 6"), `note records previous value, got ${rows[0]!.note}`);
  assert((await cachedStock(variant.id)) === 6, "cache is 6");
  assert((await cachedStock(variant.id)) === (await sumDelta(variant.id)), "cache equals movement sum after correction");
}

async function testDuplicateStartsAtZero() {
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
          { size: "S", priceNGN: 10_000, stock: 5 },
          { size: "M", priceNGN: 10_000, stock: 2 },
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
  assert(loaded?.variants.every((v) => v.stock === 0), "copy sizes start at 0");
  const movements = await prisma.stockMovement.count({
    where: { variantId: { in: loaded!.variants.map((v) => v.id) } },
  });
  assert(movements === 0, "duplicate writes no movements");
}

async function testCustomWritesNoMovement() {
  const user = await prisma.user.create({
    data: { email: `${stamp}-custom@example.test`, name: "Custom", role: Role.CUSTOMER },
  });
  ids.userIds.push(user.id);
  const product = await prisma.product.create({
    data: {
      name: `${stamp} custom gown`,
      slug: `${stamp}-custom`,
      description: "custom",
      category: ProductCategory.FORMAL,
      type: ProductType.RTW,
      priceNGN: 100_000,
      basePriceNGN: 100_000,
      customOffered: true,
      variants: { create: { size: "12", priceNGN: 100_000, stock: 2 } },
    },
    include: { variants: true },
  });
  ids.productIds.push(product.id);
  const variant = product.variants[0]!;
  assert(!shouldDecrementStock(SizeMode.CUSTOM), "custom does not decrement");

  const order = await prisma.order.create({
    data: {
      orderNumber: `V-CUSTOM-${stamp}`,
      userId: user.id,
      subtotal: 100_000,
      total: 100_000,
      paymentStatus: PaymentStatus.PENDING,
      items: {
        create: {
          productId: product.id,
          variantId: variant.id,
          quantity: 1,
          size: "Custom",
          price: 100_000,
          lineTotal: 100_000,
          sizeMode: SizeMode.CUSTOM,
        },
      },
    },
  });
  ids.orderIds.push(order.id);

  await fulfillPaidOrder({
    orderId: order.id,
    paymentRef: `PA-ORDER-V-CUSTOM-${stamp}`,
    notify: false,
  });

  const movements = await prisma.stockMovement.count({ where: { variantId: variant.id } });
  assert(movements === 0, "custom line writes no movement");
  assert((await cachedStock(variant.id)) === 2, "custom leaves cached stock untouched");
}

async function testBackfillReconciles() {
  const product = await prisma.product.create({
    data: {
      name: `${stamp} opening gown`,
      slug: `${stamp}-opening`,
      description: "opening",
      category: ProductCategory.FORMAL,
      type: ProductType.RTW,
      priceNGN: 20_000,
      basePriceNGN: 20_000,
      variants: { create: { size: "L", priceNGN: 20_000, stock: 7 } },
    },
    include: { variants: true },
  });
  ids.productIds.push(product.id);
  const variant = product.variants[0]!;
  assert((await prisma.stockMovement.count({ where: { variantId: variant.id } })) === 0, "bare variant has no history");

  const created = await ensureAllOpeningMovements(prisma);
  assert(created >= 1, "backfill writes at least this variant's OPENING");
  const opening = await prisma.stockMovement.findFirst({
    where: { variantId: variant.id, reason: "OPENING" },
  });
  assert(opening?.delta === 7, "OPENING equals current stock");
  const rec = await reconcileVariantStock(prisma);
  const row = rec.rows.find((r) => r.variantId === variant.id);
  assert(row && row.cached === row.summed, "this variant reconciles");
}

async function testOversellDoesNotRestock() {
  const user = await prisma.user.create({
    data: { email: `${stamp}-over@example.test`, name: "Oversell", role: Role.CUSTOMER },
  });
  ids.userIds.push(user.id);
  const actor = await prisma.user.create({
    data: { email: `${stamp}-over-admin@example.test`, name: "Admin", role: Role.ADMIN },
  });
  ids.userIds.push(actor.id);
  const product = await prisma.product.create({
    data: {
      name: `${stamp} oversell gown`,
      slug: `${stamp}-oversell`,
      description: "oversell",
      category: ProductCategory.FORMAL,
      type: ProductType.RTW,
      priceNGN: 80_000,
      basePriceNGN: 80_000,
      variants: { create: { size: "S", priceNGN: 80_000, stock: 1 } },
    },
    include: { variants: true },
  });
  ids.productIds.push(product.id);
  const variant = product.variants[0]!;

  const mk = async (suffix: string) => {
    const order = await prisma.order.create({
      data: {
        orderNumber: `V-OVER-${stamp}-${suffix}`,
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
            size: "S",
            price: 80_000,
            lineTotal: 80_000,
          },
        },
      },
    });
    ids.orderIds.push(order.id);
    return order;
  };

  const first = await mk("A");
  const second = await mk("B");
  await fulfillPaidOrder({
    orderId: first.id,
    paymentRef: `PA-ORDER-V-OVER-A-${stamp}`,
    notify: false,
  });
  await fulfillPaidOrder({
    orderId: second.id,
    paymentRef: `PA-ORDER-V-OVER-B-${stamp}`,
    notify: false,
  });

  const refused = await prisma.order.findUniqueOrThrow({ where: { id: second.id } });
  assert(refused.paymentStatus === PaymentStatus.PAID, "oversell is PAID");
  assert(refused.status === OrderStatus.CANCELLED, "oversell is CANCELLED");
  assert(refused.adminNotes?.includes(FULFILMENT_STOCK_REFUSE_NOTE), "refuse note is on the order");

  const stockBefore = await cachedStock(variant.id);
  const movementCountBefore = await prisma.stockMovement.count({ where: { variantId: variant.id } });

  const writes = await prisma.$transaction((tx) =>
    restockOrderLines(tx, {
      orderId: second.id,
      adminNotes: refused.adminNotes,
      paymentStatus: refused.paymentStatus,
      items: [{ variantId: variant.id, quantity: 1, sizeMode: SizeMode.STANDARD }],
      reason: "CANCEL_RETURN",
      actorId: actor.id,
      note: "should not restock oversell",
      shouldDecrementStock,
    }),
  );
  assert(writes.length === 0, "oversell restock is a no-op");
  assert((await cachedStock(variant.id)) === stockBefore, "oversell does not change cache");
  assert(
    (await prisma.stockMovement.count({ where: { variantId: variant.id } })) === movementCountBefore,
    "oversell writes no return movement",
  );
}

async function testCacheAlwaysEqualsSum() {
  const rec = await reconcileVariantStock(prisma);
  for (const productId of ids.productIds) {
    const variants = await prisma.productVariant.findMany({
      where: { productId },
      select: { id: true },
    });
    for (const v of variants) {
      const row = rec.rows.find((r) => r.variantId === v.id);
      assert(row, `reconcile missing variant ${v.id}`);
      assert(row.cached === row.summed, `cache ${row.cached} != sum ${row.summed} for ${v.id}`);
    }
  }
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
    await testSaleWritesMovement();
    await testAdminEditWritesCorrection();
    await testDuplicateStartsAtZero();
    await testCustomWritesNoMovement();
    await testBackfillReconciles();
    await testOversellDoesNotRestock();
    await testCacheAlwaysEqualsSum();
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
