/**
 * Slice AV: abandoned checkout list, rising pieces, curated /rtw order.
 *
 *   pnpm test:slice-av
 */
import "./preload-test-env";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { OrderStatus, PaymentGateway, PaymentStatus, ProductType, Role } from "@prisma/client";
import { ProductCategory } from "../src/lib/shop-category-slug";
import {
  ABANDONED_ATTEMPTS_ATTENTION,
  applyAdminOrdersListWhere,
  abandonedCheckoutAttemptWhere,
  isAbandonedCheckoutAttempt,
} from "../src/lib/admin-orders-filter";
import {
  expireStaleCheckoutReservations,
  PSP_RESERVATION_TTL_MS,
} from "../src/lib/checkout-reservations";
import { queryProductList } from "../src/lib/products-list-query";
import { prisma } from "../src/lib/prisma";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (rel: string) => readFileSync(join(root, rel), "utf8");
const stamp = `av-${Date.now()}`;

function runPure() {
  assert(src("src/lib/admin-orders-filter.ts").includes("ABANDONED_ATTEMPTS_ATTENTION"), "abandoned filter exists");
  assert(src("src/app/(admin)/admin/orders/page.tsx").includes("Abandoned attempts"), "orders page exposes abandoned chip");
  assert(src("src/lib/checkout-reservations.ts").includes("OrderStatus.ABANDONED"), "sweep marks abandoned");
  assert(src("src/lib/finance/aa0.ts").includes("Abandoned attempts keep that number"), "finance note explains order-number gaps");
  assert(src("src/components/admin/finance/HouseNumbersPanel.tsx").includes("Rising"), "rising panel is on reports");
  assert(src("src/lib/products-list-query.ts").includes('case "curated"'), "curated sort exists");
  assert(src("src/app/(storefront)/rtw/page.tsx").includes('"curated"'), "rtw defaults to curated");
  assert(src("src/components/shop/ShopBrowse.tsx").includes('"featured"'), "shop keeps its own default");
  assert(src("src/app/api/admin/products/reorder/route.ts").includes("shop.products"), "reorder needs catalogue permission");
  assert(src("scripts/test-authz.ts").includes("Glory shop.products grant"), "Glory catalogue grant is covered");

  const live = {
    status: OrderStatus.PENDING,
    paymentStatus: PaymentStatus.PENDING,
    paymentGateway: PaymentGateway.PAYSTACK,
  };
  const bank = {
    status: OrderStatus.PENDING,
    paymentStatus: PaymentStatus.PENDING,
    paymentGateway: PaymentGateway.BANK_TRANSFER,
  };
  const gone = { status: OrderStatus.ABANDONED, paymentStatus: PaymentStatus.FAILED, paymentGateway: PaymentGateway.PAYSTACK };
  assert(isAbandonedCheckoutAttempt(live), "live unpaid card attempt is abandoned clutter");
  assert(!isAbandonedCheckoutAttempt(bank), "bank proof waiting stays on the main list");
  assert(isAbandonedCheckoutAttempt(gone), "expired abandoned is abandoned");

  const defaultWhere = applyAdminOrdersListWhere({}, null);
  assert(JSON.stringify(defaultWhere).includes("NOT") || JSON.stringify(defaultWhere).includes("ABANDONED"), "default list excludes attempts");
  const abandonedWhere = applyAdminOrdersListWhere({}, ABANDONED_ATTEMPTS_ATTENTION);
  assert(JSON.stringify(abandonedWhere).includes("ABANDONED") || JSON.stringify(abandonedCheckoutAttemptWhere()).includes("ABANDONED"), "abandoned filter includes attempts");

  const checkout = src("src/lib/checkout-session.tsx");
  const abandonedCart = src("src/lib/cron/jobs/abandoned-cart.ts");
  const reservations = src("src/lib/checkout-reservations.ts");
  assert(checkout.includes("abandoned-checkout:"), "recovery email is keyed on CheckoutSession");
  assert(!reservations.includes("sendAbandoned"), "PENDING order sweep does not send a recovery email");
  assert(abandonedCart.includes("laterOrder"), "cart recovery skips when an order already exists");
}

async function runDb() {
  const user = await prisma.user.create({
    data: { email: `${stamp}@sliceav.test`, name: "Slice AV", role: Role.CUSTOMER },
  });

  const productA = await prisma.product.create({
    data: {
      name: `AV Rising A ${stamp}`,
      slug: `av-a-${stamp}`,
      description: "A",
      category: ProductCategory.FORMAL,
      type: ProductType.RTW,
      priceNGN: 100_000,
      basePriceNGN: 100_000,
      isPublished: true,
      isFeatured: false,
      displayOrder: 10,
      variants: { create: [{ size: "12", priceNGN: 100_000 }] },
    },
  });
  const productB = await prisma.product.create({
    data: {
      name: `AV Rising B ${stamp}`,
      slug: `av-b-${stamp}`,
      description: "B",
      category: ProductCategory.FORMAL,
      type: ProductType.RTW,
      priceNGN: 120_000,
      basePriceNGN: 120_000,
      isPublished: true,
      isFeatured: true,
      displayOrder: 20,
      variants: { create: [{ size: "12", priceNGN: 120_000 }] },
    },
  });
  const productC = await prisma.product.create({
    data: {
      name: `AV Rising C ${stamp}`,
      slug: `av-c-${stamp}`,
      description: "C",
      category: ProductCategory.FORMAL,
      type: ProductType.RTW,
      priceNGN: 90_000,
      basePriceNGN: 90_000,
      isPublished: true,
      isFeatured: false,
      displayOrder: 5,
      variants: { create: [{ size: "12", priceNGN: 90_000 }] },
    },
  });

  const variantA = await prisma.productVariant.findFirstOrThrow({ where: { productId: productA.id } });

  const liveAttempt = await prisma.order.create({
    data: {
      orderNumber: `AV-LIVE-${stamp}`,
      userId: user.id,
      subtotal: 100_000,
      total: 100_000,
      paymentStatus: PaymentStatus.PENDING,
      paymentGateway: PaymentGateway.PAYSTACK,
      status: OrderStatus.PENDING,
      items: {
        create: {
          productId: productA.id,
          variantId: variantA.id,
          quantity: 1,
          size: "12",
          price: 100_000,
          lineTotal: 100_000,
        },
      },
    },
  });

  const paid = await prisma.order.create({
    data: {
      orderNumber: `AV-PAID-${stamp}`,
      userId: user.id,
      subtotal: 100_000,
      total: 100_000,
      paymentStatus: PaymentStatus.PAID,
      paymentGateway: PaymentGateway.PAYSTACK,
      status: OrderStatus.CONFIRMED,
      paidAt: new Date(),
      items: {
        create: {
          productId: productA.id,
          variantId: variantA.id,
          quantity: 1,
          size: "12",
          price: 100_000,
          lineTotal: 100_000,
        },
      },
    },
  });

  const defaultList = await prisma.order.findMany({
    where: applyAdminOrdersListWhere({}, null),
    select: { id: true },
  });
  assert(
    defaultList.some((o) => o.id === paid.id),
    "default list includes paid orders",
  );
  assert(
    !defaultList.some((o) => o.id === liveAttempt.id),
    "default list excludes live unpaid checkout attempts",
  );

  const abandonedList = await prisma.order.findMany({
    where: applyAdminOrdersListWhere({}, ABANDONED_ATTEMPTS_ATTENTION),
    select: { id: true },
  });
  assert(
    abandonedList.some((o) => o.id === liveAttempt.id),
    "abandoned filter surfaces the unpaid attempt",
  );
  assert(
    !abandonedList.some((o) => o.id === paid.id),
    "abandoned filter does not include paid orders",
  );

  const stale = await prisma.order.create({
    data: {
      orderNumber: `AV-STALE-${stamp}`,
      userId: user.id,
      subtotal: 100_000,
      total: 100_000,
      paymentStatus: PaymentStatus.PENDING,
      paymentGateway: PaymentGateway.PAYSTACK,
      status: OrderStatus.PENDING,
      createdAt: new Date(Date.now() - PSP_RESERVATION_TTL_MS - 60_000),
      items: {
        create: {
          productId: productA.id,
          variantId: variantA.id,
          quantity: 1,
          size: "12",
          price: 100_000,
          lineTotal: 100_000,
        },
      },
    },
  });
  await expireStaleCheckoutReservations(prisma, new Date(), 50);
  const after = await prisma.order.findUnique({
    where: { id: stale.id },
    select: { status: true, paymentStatus: true },
  });
  assert(after?.status === OrderStatus.ABANDONED, "expired reservation marks the order abandoned");
  assert(after?.paymentStatus === PaymentStatus.FAILED, "expired reservation fails the payment status");

  await prisma.product.update({ where: { id: productA.id }, data: { displayOrder: 0 } });
  await prisma.product.update({ where: { id: productC.id }, data: { displayOrder: 1 } });
  await prisma.product.update({ where: { id: productB.id }, data: { displayOrder: 2 } });

  const listed = await queryProductList(
    new URLSearchParams({
      type: "RTW",
      sort: "curated",
      limit: "48",
      search: stamp,
    }),
    { isAdmin: false },
  );
  const ids = listed.products.map((p) => p.id);
  const iB = ids.indexOf(productB.id);
  const iA = ids.indexOf(productA.id);
  const iC = ids.indexOf(productC.id);
  assert(iB >= 0 && iA >= 0 && iC >= 0, "curated list returns the three aisle pieces");
  assert(iB < iA && iB < iC, "Featured piece still appears above curated order");
  assert(iA < iC, "displayOrder drives order beneath Featured");

  await prisma.order.deleteMany({ where: { id: { in: [liveAttempt.id, paid.id, stale.id] } } });
  await prisma.product.deleteMany({ where: { id: { in: [productA.id, productB.id, productC.id] } } });
  await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
}

async function main() {
  runPure();
  await runDb();
  console.log("OK slice-av");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
