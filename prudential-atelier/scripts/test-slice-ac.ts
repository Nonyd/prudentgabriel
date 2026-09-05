/**
 * Slice AC: cascade product delete — quiet vs loud, snapshot, rollback.
 *
 *   pnpm test:slice-ac
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import "./preload-test-env";
import {
  OrderStatus,
  PaymentMethod,
  PaymentPurpose,
  PaymentStatus,
  ProductCategory,
  ProductType,
  Role,
  StockMovementReason,
} from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import {
  assertCascadeAllowed,
  cascadeDeletionsInPeriod,
  executeProductCascade,
  previewProductCascade,
  PRODUCT_CASCADE_DEPENDENCIES,
  ProductCascadeError,
} from "../src/lib/product-cascade-delete";
import { cascadeDialogCopy } from "../src/lib/product-cascade-copy";
import { customRange } from "../src/lib/finance/period";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const stamp = `ac-${Date.now()}`;
const ids = {
  productIds: [] as string[],
  userIds: [] as string[],
  orderIds: [] as string[],
  sessionIds: [] as string[],
};

async function cleanup() {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.ledger_bypass = 'on'`);
    if (ids.orderIds.length) {
      await tx.payment.deleteMany({ where: { orderId: { in: ids.orderIds } } });
      await tx.pointsTransaction.deleteMany({ where: { orderId: { in: ids.orderIds } } });
      await tx.order.deleteMany({ where: { id: { in: ids.orderIds } } });
    }
    if (ids.sessionIds.length) {
      await tx.checkoutSession.deleteMany({ where: { id: { in: ids.sessionIds } } });
    }
    if (ids.productIds.length) {
      await tx.cartItem.deleteMany({ where: { productId: { in: ids.productIds } } });
      await tx.wishlistItem.deleteMany({ where: { productId: { in: ids.productIds } } });
      await tx.review.deleteMany({ where: { productId: { in: ids.productIds } } });
      await tx.product.deleteMany({ where: { id: { in: ids.productIds } } });
    }
    if (ids.userIds.length) {
      await tx.user.deleteMany({ where: { id: { in: ids.userIds } } });
    }
    await tx.activityLog.deleteMany({ where: { recordId: { in: ids.productIds } } });
  });
}

function actor(role: "SUPER_ADMIN" | "ADMIN") {
  return {
    userId: `ac-actor-${stamp}`,
    email: `${role.toLowerCase()}+${stamp}@example.test`,
    role,
    ip: "127.0.0.1",
  };
}

async function makeProduct(slug: string, extras?: { sku?: string }) {
  const product = await prisma.product.create({
    data: {
      name: `AC ${slug}`,
      slug: `${stamp}-${slug}`,
      description: "cascade test",
      category: ProductCategory.FORMAL,
      type: ProductType.RTW,
      priceNGN: 90_000,
      basePriceNGN: 90_000,
      isPublished: true,
      images: { create: [{ url: `/media/public/test/${stamp}-${slug}.jpg`, isPrimary: true, sortOrder: 0 }] },
      variants: {
        create: [{ size: "12", priceNGN: 90_000, stock: 2, sku: extras?.sku ?? `${stamp}-${slug}-12` }],
      },
    },
    include: { variants: true },
  });
  ids.productIds.push(product.id);
  return product;
}

async function makeCustomer(tag: string) {
  const user = await prisma.user.create({
    data: { email: `${tag}+${stamp}@example.test`, name: tag, role: Role.CUSTOMER },
  });
  ids.userIds.push(user.id);
  return user;
}

function runCopy() {
  assert(PRODUCT_CASCADE_DEPENDENCIES.includes("Payment"), "dependency list names Payment");
  assert(PRODUCT_CASCADE_DEPENDENCIES.includes("CheckoutSession"), "dependency list names CheckoutSession");
  const quiet = cascadeDialogCopy({
    loud: false,
    productCount: 17,
    productsWithOrders: 0,
    products: [],
    orders: [],
    payments: [],
    customerEmails: [],
    receivedNGN: 0,
    mediaUrls: [],
  });
  assert(quiet.heading === "17 pieces will be deleted.", "quiet heading counts pieces");
  assert(quiet.lines.some((l) => l.includes("None have been ordered")), "quiet path says none were ordered");

  const loud = cascadeDialogCopy({
    loud: true,
    productCount: 17,
    productsWithOrders: 2,
    products: [],
    orders: [{ id: "o1", orderNumber: "PG-1", date: new Date().toISOString(), totalNGN: 0, receivedNGN: 0, customerEmail: "a@b.c" }],
    payments: [],
    customerEmails: ["a@b.c"],
    receivedNGN: 0,
    mediaUrls: [],
  });
  assert(loud.lines.some((l) => l.includes("2 have been ordered")), "loud path says how many were ordered");
  assert(loud.lines.some((l) => l.includes("₦0 received")), "loud path shows the money");
  assert(loud.lines.some((l) => l.includes("1 customer's order history")), "loud path counts customers");

  try {
    assertCascadeAllowed("ADMIN", true);
    throw new Error("ADMIN must not pass the loud gate");
  } catch (e) {
    assert(e instanceof ProductCascadeError && e.status === 403, "ADMIN gets 403 on the loud path");
  }
  assertCascadeAllowed("ADMIN", false);
  assertCascadeAllowed("SUPER_ADMIN", true);

  const cascadeSrc = readFileSync(join(process.cwd(), "src/app/api/admin/products/cascade/route.ts"), "utf8");
  assert(cascadeSrc.includes("requireSuperAdminApi"), "loud execute is Super Admin gated");
}

async function quietDeletesCleanly() {
  const user = await makeCustomer("quiet");
  const product = await makeProduct("quiet");
  const variant = product.variants[0]!;
  await prisma.stockMovement.create({
    data: { variantId: variant.id, delta: 2, reason: StockMovementReason.OPENING },
  });
  await prisma.cartItem.create({
    data: { userId: user.id, productId: product.id, variantId: variant.id, quantity: 1, lineKey: `STANDARD:${variant.id}:none` },
  });
  await prisma.wishlistItem.create({ data: { userId: user.id, productId: product.id } });
  await prisma.review.create({ data: { userId: user.id, productId: product.id, rating: 5, body: "nice" } });
  await prisma.stockAlert.create({ data: { email: user.email, variantId: variant.id } });

  const preview = await previewProductCascade([product.id]);
  assert(preview.loud === false, "no orders means the quiet path");
  assert(preview.receivedNGN === 0, "quiet preview has no money");

  const result = await executeProductCascade({
    productIds: [product.id],
    actor: actor("ADMIN"),
  });
  assert(result.loud === false, "quiet execute does not require DELETE");
  assert(!(await prisma.product.findUnique({ where: { id: product.id } })), "quiet product is gone");
  assert((await prisma.cartItem.count({ where: { productId: product.id } })) === 0, "cart lines are gone");
  assert((await prisma.wishlistItem.count({ where: { productId: product.id } })) === 0, "wishlist rows are gone");
  assert((await prisma.review.count({ where: { productId: product.id } })) === 0, "reviews are gone");
  assert((await prisma.stockMovement.count({ where: { variantId: variant.id } })) === 0, "stock movements are gone");
  assert((await prisma.stockAlert.count({ where: { variantId: variant.id } })) === 0, "stock alerts are gone");
}

async function loudNeedsTypedDeleteAndRemovesDependents() {
  const user = await makeCustomer("loud");
  const product = await makeProduct("loud");
  const variant = product.variants[0]!;
  const order = await prisma.order.create({
    data: {
      orderNumber: `AC-LOUD-${stamp}`,
      userId: user.id,
      subtotal: 90_000,
      total: 90_000,
      paymentStatus: PaymentStatus.PAID,
      status: OrderStatus.CONFIRMED,
      items: {
        create: { productId: product.id, variantId: variant.id, quantity: 1, size: "12", price: 90_000, lineTotal: 90_000 },
      },
    },
  });
  ids.orderIds.push(order.id);
  await prisma.payment.create({
    data: {
      reference: `AC-LOUD-${stamp}`,
      amount: 90_000,
      currency: "NGN",
      method: PaymentMethod.BANK_TRANSFER,
      status: PaymentStatus.CONFIRMED,
      purpose: PaymentPurpose.RTW_ORDER,
      orderId: order.id,
      clientId: user.id,
      confirmedAt: new Date("2026-09-05T10:00:00+01:00"),
    },
  });
  const session = await prisma.checkoutSession.create({
    data: {
      email: user.email,
      orderId: order.id,
      cartSnapshot: {
        lines: [{ productId: product.id, productName: product.name, productSlug: product.slug, variantId: variant.id, size: "12", imageUrl: "", priceNGN: 90_000, quantity: 1 }],
        subtotalNGN: 90_000,
      },
      furthestStep: 3,
    },
  });
  ids.sessionIds.push(session.id);

  const preview = await previewProductCascade([product.id]);
  assert(preview.loud === true, "orders make the loud path");
  assert(preview.orders.some((o) => o.orderNumber === `AC-LOUD-${stamp}`), "preview lists the order");
  assert(preview.receivedNGN === 90_000, `preview money is 90000, got ${preview.receivedNGN}`);

  try {
    await executeProductCascade({ productIds: [product.id], actor: actor("ADMIN") });
    throw new Error("ADMIN must not cascade orders");
  } catch (e) {
    assert(e instanceof ProductCascadeError && e.status === 403, "ADMIN gets 403 on the loud path");
  }
  assert(await prisma.product.findUnique({ where: { id: product.id } }), "ADMIN refusal left the product");

  try {
    await executeProductCascade({ productIds: [product.id], actor: actor("SUPER_ADMIN") });
    throw new Error("loud path must require DELETE");
  } catch (e) {
    assert(e instanceof ProductCascadeError && e.code === "CONFIRM", "loud path requires typed DELETE");
  }

  const result = await executeProductCascade({
    productIds: [product.id],
    actor: actor("SUPER_ADMIN"),
    confirmation: "DELETE",
  });
  assert(result.loud === true, "loud execute ran");
  assert(!(await prisma.product.findUnique({ where: { id: product.id } })), "ordered product is gone");
  assert(!(await prisma.order.findUnique({ where: { id: order.id } })), "the order is gone");
  assert((await prisma.payment.count({ where: { orderId: order.id } })) === 0, "payments are gone");
  assert((await prisma.orderItem.count({ where: { productId: product.id } })) === 0, "order items are gone");
  assert((await prisma.checkoutSession.count({ where: { id: session.id } })) === 0, "checkout sessions are gone");

  const log = await prisma.activityLog.findUnique({ where: { id: result.logId } });
  assert(log, "ActivityLog row exists");
  const snap = log!.snapshot as { orders?: { orderNumber: string; totalNGN: number }[]; payments?: { amountNGN: number }[]; receivedNGN?: number };
  assert(snap.orders?.some((o) => o.orderNumber === `AC-LOUD-${stamp}`), "snapshot contains the order number");
  assert(snap.payments?.some((p) => p.amountNGN === 90_000), "snapshot contains the payment amount");
  assert(snap.receivedNGN === 90_000, "snapshot stores received money");

  const sept = customRange("2026-09-01", "2026-09-30");
  const note = await cascadeDeletionsInPeriod(sept.from, sept.to);
  assert(note.paymentCount >= 1, "September ledger notes the deleted payment");
  assert(note.logIds.includes(result.logId), "ledger note links the log entry");
}

async function failureRollsBack() {
  const user = await makeCustomer("fail");
  const product = await makeProduct("fail");
  const order = await prisma.order.create({
    data: {
      orderNumber: `AC-FAIL-${stamp}`,
      userId: user.id,
      subtotal: 40_000,
      total: 40_000,
      paymentStatus: PaymentStatus.PAID,
      status: OrderStatus.CONFIRMED,
      items: {
        create: { productId: product.id, quantity: 1, size: "10", price: 40_000, lineTotal: 40_000 },
      },
    },
  });
  ids.orderIds.push(order.id);
  await prisma.payment.create({
    data: {
      reference: `AC-FAIL-${stamp}`,
      amount: 40_000,
      currency: "NGN",
      method: PaymentMethod.PAYSTACK,
      status: PaymentStatus.CONFIRMED,
      purpose: PaymentPurpose.RTW_ORDER,
      orderId: order.id,
      clientId: user.id,
    },
  });

  try {
    await executeProductCascade({
      productIds: [product.id],
      actor: actor("SUPER_ADMIN"),
      confirmation: "DELETE",
      injectFailure: "after-graph",
    });
    throw new Error("injected failure should throw");
  } catch (e) {
    assert(e instanceof Error && e.message === "injected cascade failure", "injected failure escaped");
  }
  assert(await prisma.product.findUnique({ where: { id: product.id } }), "failed txn left the product");
  assert(await prisma.order.findUnique({ where: { id: order.id } }), "failed txn left the order");
  assert((await prisma.payment.count({ where: { orderId: order.id } })) === 1, "failed txn left the payment");
}

async function main() {
  runCopy();
  try {
    await quietDeletesCleanly();
    await loudNeedsTypedDeleteAndRemovesDependents();
    await failureRollsBack();
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
  console.log("test-slice-ac: ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
