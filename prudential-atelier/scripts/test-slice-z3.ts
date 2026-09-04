/**
 * Slice Z3: she can always find her order after a refresh, without a login wall.
 *
 *   pnpm test:slice-z3
 */
import "./preload-test-env";
import {
  PaymentStatus,
  ProductCategory,
  ProductType,
} from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { autoOnboardClient } from "../src/lib/client-onboarding";
import { toPublicRtwOrderDto } from "../src/lib/public-pii-dtos";
import {
  canViewRtwTracker,
  defaultAccountOrdersTab,
  rtwPaidInChargedCurrency,
  rtwTrackerStatusLabel,
} from "../src/lib/rtw-tracker";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const stamp = `z3-${Date.now()}`;

function runPure() {
  assert(defaultAccountOrdersTab(0) === "rtw", "no commission → Ready-to-Wear");
  assert(defaultAccountOrdersTab(1) === "bespoke", "a commission still opens atelier");

  const usd = rtwPaidInChargedCurrency({
    total: 100_000,
    currency: "USD",
    fxUsdAmountLocked: 65,
  });
  assert(usd.currency === "USD" && usd.amount === 65, "USD order shows what she paid in dollars");

  const gbp = rtwPaidInChargedCurrency({
    total: 100_000,
    currency: "GBP",
    fxGbpAmountLocked: 52,
  });
  assert(gbp.currency === "GBP" && gbp.amount === 52, "GBP order shows what she paid in pounds");

  const dto = toPublicRtwOrderDto({
    orderNumber: "PA-26-00001",
    status: "CONFIRMED",
    paymentStatus: PaymentStatus.PAID,
    total: 250_000,
    currency: "USD",
    fxUsdAmountLocked: 162.5,
    items: [{ product: { name: "Avril" }, size: "12", quantity: 1 }],
  });
  const json = JSON.stringify(dto);
  for (const leak of [
    "guestEmail",
    "guestPhone",
    "guestName",
    "addressSnapshot",
    "paymentRef",
    "collectionCode",
    "shippingZone",
    "subtotal",
  ]) {
    assert(!(leak in dto), `tracker DTO must not have ${leak}`);
    assert(!json.includes(leak), `tracker JSON must not mention ${leak}`);
  }
  assert(dto.orderNumber === "PA-26-00001", "order number");
  assert(dto.items[0]?.size === "12", "size");
  assert(dto.paid.currency === "USD", "paid currency is what she paid");
  assert(rtwTrackerStatusLabel("CONFIRMED", "PAID") === "Paid — we are preparing it", "plain status");

  assert(
    canViewRtwTracker(
      { userId: "u1", guestEmail: "ada@example.com", userEmail: "ada@example.com" },
      { email: "ada@example.com" },
    ),
    "guest link with email still opens after onboard attaches a user",
  );
  assert(
    canViewRtwTracker(
      { userId: "u1", guestEmail: null, userEmail: "ada@example.com" },
      { email: "ada@example.com" },
    ),
    "already-cleared guestEmail still unlocks via the account email",
  );
  assert(
    !canViewRtwTracker(
      { userId: "u1", guestEmail: "ada@example.com", userEmail: "ada@example.com" },
      { email: "other@example.com" },
    ),
    "wrong email is refused",
  );
}

async function runDb() {
  const guestEmail = `${stamp}@slicez3.test`;
  const product = await prisma.product.create({
    data: {
      name: `Z3 Dress ${stamp}`,
      slug: `z3-dress-${stamp}`,
      description: "test",
      category: ProductCategory.FORMAL,
      type: ProductType.RTW,
      priceNGN: 80_000,
      basePriceNGN: 80_000,
      isPublished: true,
    },
  });
  const order = await prisma.order.create({
    data: {
      orderNumber: `Z3-${stamp}`,
      guestEmail,
      guestName: "Ada",
      guestPhone: "08000000000",
      subtotal: 80_000,
      total: 80_000,
      currency: "USD",
      fxUsdAmountLocked: 52,
      paymentStatus: PaymentStatus.PENDING,
      items: {
        create: {
          productId: product.id,
          quantity: 1,
          size: "12",
          price: 80_000,
          lineTotal: 80_000,
        },
      },
    },
  });

  const onboard = await autoOnboardClient({
    name: "Ada",
    email: guestEmail,
    source: "RTW_ORDER",
    sourceId: order.id,
  });
  assert(onboard.isNew, "guest checkout creates an account");

  const after = await prisma.order.findUnique({
    where: { id: order.id },
    select: { guestEmail: true, userId: true, user: { select: { email: true } } },
  });
  assert(after?.userId === onboard.userId, "order is attached to the new account");
  assert(after?.guestEmail === guestEmail, "guestEmail must survive onboard so the success link still works");
  assert(
    canViewRtwTracker(
      {
        userId: after.userId,
        guestEmail: after.guestEmail,
        userEmail: after.user?.email ?? null,
      },
      { email: guestEmail },
    ),
    "success ?email= still unlocks after refresh",
  );

  const userId = onboard.userId;
  await prisma.order.delete({ where: { id: order.id } }).catch(() => undefined);
  await prisma.product.delete({ where: { id: product.id } }).catch(() => undefined);
  await prisma.pointsTransaction.deleteMany({ where: { userId } }).catch(() => undefined);
  await prisma.customerNotification.deleteMany({ where: { userId } }).catch(() => undefined);
  await prisma.clientProfile.deleteMany({ where: { userId } }).catch(() => undefined);
  await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
}

async function main() {
  runPure();
  try {
    await runDb();
  } finally {
    await prisma.$disconnect();
  }
  console.log("test-slice-z3: ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
