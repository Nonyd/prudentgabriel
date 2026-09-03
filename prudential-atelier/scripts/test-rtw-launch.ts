/**
 * RTW launch blockers: logged-in cart → checkout, stock floor, atelier bookings gate.
 *
 *   pnpm test:rtw-launch
 *
 * Optional: RTW_LAUNCH_PUBLIC_ORIGIN=https://staging.prudentgabriel.com
 * asserts GET /consultation is 200 while bookings stay closed.
 */
import "./preload-test-env";
import {
  Currency,
  OrderStatus,
  PaymentGateway,
  PaymentStatus,
  ProductCategory,
  ProductType,
  Role,
  SettingGroup,
  SettingType,
} from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { addCartLine, listCartLines } from "../src/lib/cart-service";
import { fulfillPaidOrder } from "../src/lib/order-payment";
import { filterStorefrontLinks, isOrderTrackLink, rtwOrderSuccessPath } from "../src/lib/atelier-storefront";
import { ATELIER_BOOKINGS_CLOSED_MESSAGE, ATELIER_BOOKINGS_SETTING_KEY } from "../src/lib/atelier-bookings";
import { clearSettingCacheKey } from "../src/lib/settings";
import { planGuestServerMerge } from "../src/lib/cart-merge";
import { resolveAdminAlertEmail } from "../src/lib/admin-alert-email";
import { applyOrderAttention, REFUND_REQUIRED_ATTENTION } from "../src/lib/admin-orders-filter";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

async function testAtelierPaths() {
  assert(
    filterStorefrontLinks([{ href: "/atelier", label: "The Atelier" }]).length === 1,
    "atelier footer link must stay visible",
  );
  assert(
    filterStorefrontLinks([{ href: "/consultation", label: "Book Consultation" }]).length === 1,
    "consultation footer link must stay visible",
  );
  assert(
    isOrderTrackLink({ label: "Track Your Order", url: "/account/orders" }),
    "footer Track must be recognized even when pointed at /account/orders",
  );
  assert(!isOrderTrackLink({ label: "Size Guide", url: "/size-guide" }), "size guide is not a track link");
  assert(filterStorefrontLinks([{ href: "/track", label: "Track" }]).length === 0, "Track stays hidden");
  assert(rtwOrderSuccessPath("PA-26-1", "a@b.c").includes("order=PA-26-1"), "success path includes order");
  assert(rtwOrderSuccessPath("PA-26-1", "a@b.c").includes("email=a%40b.c"), "success path includes email");

  const refundWhere = applyOrderAttention({}, REFUND_REQUIRED_ATTENTION);
  assert(refundWhere.status === OrderStatus.CANCELLED, "refund queue filters CANCELLED");
  assert(refundWhere.paymentStatus === PaymentStatus.PAID, "refund queue filters PAID");
}

function testCartMergeAndAlertEmail() {
  const guest2 = [{ id: "var1-none", productId: "p", variantId: "var1", colorId: null, quantity: 2 }];
  const server1 = [{ id: "cuid-server", productId: "p", variantId: "var1", colorId: null, quantity: 1 }];
  const summed = planGuestServerMerge(guest2, server1);
  assert(summed.create.length === 0, "same variant must not POST a second row");
  assert(summed.setQty.length === 1 && summed.setQty[0]!.quantity === 2, "guest 2 + server 1 → max 2, not 3");

  const guest1 = [{ id: "var1-none", productId: "p", variantId: "var1", colorId: null, quantity: 1 }];
  const server3 = [{ id: "cuid-server", productId: "p", variantId: "var1", colorId: null, quantity: 3 }];
  const keep = planGuestServerMerge(guest1, server3);
  assert(keep.create.length === 0 && keep.setQty.length === 0, "smaller guest qty must not shrink the server cart");

  const secondLogin = planGuestServerMerge(server3, server3);
  assert(secondLogin.create.length === 0 && secondLogin.setQty.length === 0, "second login must not re-merge");

  const onlyGuest = planGuestServerMerge(guest2, []);
  assert(onlyGuest.create.length === 1, "guest-only line is created on the server");
}

async function testAdminAlertSkipsBounceMailbox() {
  const prev = process.env.ADMIN_EMAIL;
  process.env.ADMIN_EMAIL = "admin@prudentgabriel.com";
  delete process.env.ORDERS_ADMIN_EMAIL;
  delete process.env.GENERAL_ADMIN_EMAIL;
  delete process.env.SUPER_ADMIN_EMAIL;
  delete process.env.ORDERS_EMAIL;
  try {
    const to = await resolveAdminAlertEmail(async (key) =>
      key === "admin_notification_email" ? "admin@prudentgabriel.com" : key === "contact_email" ? "hello@prudentgabriel.com" : null,
    );
    assert(to === null, `expected no deliverable mailbox, got ${to}`);
  } finally {
    if (prev === undefined) delete process.env.ADMIN_EMAIL;
    else process.env.ADMIN_EMAIL = prev;
  }
}

async function testLoggedInCartSurvivesToCheckout() {
  const stamp = `rtw-g1-${Date.now()}`;
  const user = await prisma.user.create({
    data: { email: `${stamp}@example.test`, name: "Cart Test", role: Role.CUSTOMER },
  });
  const product = await prisma.product.create({
    data: {
      name: "Cart Launch Test",
      slug: stamp,
      description: "test",
      category: ProductCategory.FORMAL,
      type: ProductType.RTW,
      priceNGN: 50_000,
      basePriceNGN: 50_000,
      variants: { create: { size: "M", priceNGN: 50_000, stock: 4 } },
    },
    include: { variants: true },
  });
  const variant = product.variants[0]!;

  try {
    const added = await addCartLine(user.id, {
      productId: product.id,
      variantId: variant.id,
      quantity: 1,
    });
    assert(added.ok, "addCartLine must succeed");

    const lines = await listCartLines(user.id);
    assert(lines.length === 1, `expected 1 cart line, got ${lines.length}`);
    assert(lines[0]!.variantId === variant.id, "checkout source of truth must be the cartItem row");
    assert(lines[0]!.quantity === 1, "quantity must persist");
  } finally {
    await prisma.cartItem.deleteMany({ where: { userId: user.id } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
}

async function testStockCannotGoNegative() {
  const stamp = `rtw-g3-${Date.now()}`;
  const user = await prisma.user.create({
    data: { email: `${stamp}@example.test`, name: "Stock Test", role: Role.CUSTOMER },
  });
  const product = await prisma.product.create({
    data: {
      name: "Stock Launch Test",
      slug: stamp,
      description: "test",
      category: ProductCategory.FORMAL,
      type: ProductType.RTW,
      priceNGN: 80_000,
      basePriceNGN: 80_000,
      variants: { create: { size: "S", priceNGN: 80_000, stock: 1 } },
    },
    include: { variants: true },
  });
  const variant = product.variants[0]!;

  const mkOrder = (suffix: string) =>
    prisma.order.create({
      data: {
        orderNumber: `${stamp}-${suffix}`,
        userId: user.id,
        guestEmail: `${stamp}@example.test`,
        guestName: "Stock Test",
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

  const [orderA, orderB] = await Promise.all([mkOrder("A"), mkOrder("B")]);

  try {
    await Promise.all([
      fulfillPaidOrder({
        orderId: orderA.id,
        paymentRef: `${stamp}-pay-a`,
        gateway: PaymentGateway.PAYSTACK,
        clientId: user.id,
        notify: false,
      }),
      fulfillPaidOrder({
        orderId: orderB.id,
        paymentRef: `${stamp}-pay-b`,
        gateway: PaymentGateway.PAYSTACK,
        clientId: user.id,
        notify: false,
      }),
    ]);

    const stock = await prisma.productVariant.findUnique({
      where: { id: variant.id },
      select: { stock: true },
    });
    assert(stock != null, "variant must still exist");
    assert(stock.stock >= 0, `stock went negative: ${stock.stock}`);
    assert(stock.stock === 0, `expected remaining stock 0, got ${stock.stock}`);

    const [a, b] = await Promise.all([
      prisma.order.findUnique({ where: { id: orderA.id } }),
      prisma.order.findUnique({ where: { id: orderB.id } }),
    ]);
    const statuses = [a?.status, b?.status];
    assert(
      statuses.includes(OrderStatus.CONFIRMED) && statuses.includes(OrderStatus.CANCELLED),
      `expected one CONFIRMED and one CANCELLED, got ${statuses.join(",")}`,
    );
  } finally {
    // Payment rows are append-only; stamped PA-TEST orders stay as ledger evidence.
  }
}

async function testAtelierBookingsGate() {
  const existing = await prisma.siteSetting.findUnique({
    where: { key: ATELIER_BOOKINGS_SETTING_KEY },
    select: { value: true },
  });
  const previous = existing?.value ?? null;

  await prisma.siteSetting.upsert({
    where: { key: ATELIER_BOOKINGS_SETTING_KEY },
    create: {
      key: ATELIER_BOOKINGS_SETTING_KEY,
      value: "false",
      group: SettingGroup.STORE,
      label: "Atelier bookings enabled",
      type: SettingType.BOOLEAN,
      isPublic: false,
      sortOrder: 9,
    },
    update: { value: "false" },
  });
  clearSettingCacheKey(ATELIER_BOOKINGS_SETTING_KEY);

  try {
    const { POST } = await import("../src/app/api/consultations/create/route");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest("http://localhost/api/consultations/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    assert(res.status === 403, `POST /api/consultations/create must 403 when bookings closed, got ${res.status}`);
    const body = (await res.json()) as { error?: string };
    assert(body.error === ATELIER_BOOKINGS_CLOSED_MESSAGE, "403 body must explain that bookings are closed");

    const origin = process.env.RTW_LAUNCH_PUBLIC_ORIGIN?.replace(/\/$/, "");
    if (origin) {
      const page = await fetch(`${origin}/consultation`, {
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
      });
      assert(page.status === 200, `${origin}/consultation must return 200, got ${page.status}`);
    }
  } finally {
    if (previous === null) {
      await prisma.siteSetting.deleteMany({ where: { key: ATELIER_BOOKINGS_SETTING_KEY } });
    } else {
      await prisma.siteSetting.update({
        where: { key: ATELIER_BOOKINGS_SETTING_KEY },
        data: { value: previous },
      });
    }
    clearSettingCacheKey(ATELIER_BOOKINGS_SETTING_KEY);
  }
}

async function main() {
  await testAtelierPaths();
  await testAtelierBookingsGate();
  testCartMergeAndAlertEmail();
  await testAdminAlertSkipsBounceMailbox();
  await testLoggedInCartSurvivesToCheckout();
  await testStockCannotGoNegative();
  console.log("test-rtw-launch: all assertions passed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
