/**
 * Slice K: shipping methods, quote-pending consent, ship gate, pickup tracking, locked FX.
 *
 *   pnpm test:slice-k
 */
import "./preload-test-env";
import {
  Currency,
  PaymentStatus,
  ProductCategory,
  ProductType,
  ShippingMarkupKind,
  ShippingMethodKind,
  ShippingQuoteStatus,
} from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { listCheckoutShippingOptions } from "../src/lib/shipping/options";
import { resolveCheckoutShipping } from "../src/lib/shipping/resolve-selection";
import { setShippingCarriersForTest } from "../src/lib/shipping/carriers";
import { clearShippingQuoteCacheForTest } from "../src/lib/shipping/rate";
import type { ShippingCarrier } from "../src/lib/shipping/carriers/types";
import { assertCanMarkShipped, shippingRequiresTracking } from "../src/lib/order-status";
import { getLockedFx, setLockedFxForTest } from "../src/lib/fx";
import { DEFAULT_QUOTE_CONSENT } from "../src/lib/shipping/copy";
import { billableKgForCarrier, volumetricKg } from "../src/lib/shipping/weight";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const stamp = `slice-k-${Date.now()}`;
const productIds: string[] = [];
const orderIds: string[] = [];

async function ensureMethods() {
  await prisma.packagingProfile.upsert({
    where: { id: "pkg-garment-box" },
    update: { weightKg: 0.8, lengthCm: 60, widthCm: 40, heightCm: 20, isDefault: true },
    create: {
      id: "pkg-garment-box",
      name: "Garment box",
      weightKg: 0.8,
      lengthCm: 60,
      widthCm: 40,
      heightCm: 20,
      isDefault: true,
    },
  });
  await prisma.shippingMethod.upsert({
    where: { id: "ship-pickup" },
    update: { isActive: true },
    create: {
      id: "ship-pickup",
      kind: ShippingMethodKind.PICKUP,
      name: "Collect from the atelier",
      isActive: true,
      sortOrder: 0,
    },
  });
  await prisma.shippingMethod.upsert({
    where: { id: "ship-lagos" },
    update: { isActive: true },
    create: {
      id: "ship-lagos",
      kind: ShippingMethodKind.LOCAL_FLAT,
      name: "Lagos delivery",
      isActive: true,
      sortOrder: 1,
    },
  });
  await prisma.shippingMethod.upsert({
    where: { id: "ship-gig" },
    update: { isActive: true },
    create: {
      id: "ship-gig",
      kind: ShippingMethodKind.CARRIER_GIG,
      name: "GIG Logistics",
      isActive: true,
      sortOrder: 2,
      markupKind: ShippingMarkupKind.PERCENT,
      markupValue: 10,
    },
  });
  await prisma.shippingMethod.upsert({
    where: { id: "ship-dhl" },
    update: { isActive: true },
    create: {
      id: "ship-dhl",
      kind: ShippingMethodKind.CARRIER_DHL,
      name: "DHL Express",
      isActive: true,
      sortOrder: 3,
      markupKind: ShippingMarkupKind.PERCENT,
      markupValue: 15,
    },
  });
  await prisma.pickupLocation.upsert({
    where: { id: "pickup-surulere" },
    update: { isActive: true },
    create: {
      id: "pickup-surulere",
      shippingMethodId: "ship-pickup",
      name: "Surulere atelier",
      address: "14 Bode Thomas Street, Surulere, Lagos",
      hours: "Mon–Sat 10:00–18:00",
      isActive: true,
      sortOrder: 0,
    },
  });
  await prisma.lagosLocation.upsert({
    where: { id: "lagos-from-express" },
    update: { isActive: true },
    create: {
      id: "lagos-from-express",
      shippingMethodId: "ship-lagos",
      name: "Lagos — Express",
      price: 3500,
      freeAboveNGN: 250_000,
      etaText: "2–4 business days",
      isActive: true,
      sortOrder: 0,
    },
  });
}

async function makeProduct() {
  const product = await prisma.product.create({
    data: {
      name: `Slice K ${stamp}`,
      slug: `slice-k-${stamp}`,
      description: "Test",
      category: ProductCategory.EVENING_WEAR,
      type: ProductType.RTW,
      priceNGN: 100_000,
      basePriceNGN: 100_000,
      isPublished: true,
      defaultWeightKg: 0.8,
      defaultLengthCm: 40,
      defaultWidthCm: 30,
      defaultHeightCm: 12,
      variants: {
        create: {
          sku: `PA-K-${stamp}`,
          size: "M",
          priceNGN: 100_000,
          stock: 4,
        },
      },
    },
    include: { variants: true },
  });
  productIds.push(product.id);
  return product;
}

async function cleanup() {
  if (orderIds.length) {
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  }
  if (productIds.length) {
    await prisma.productVariant.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  }
  setShippingCarriersForTest(null);
  setLockedFxForTest(null);
  clearShippingQuoteCacheForTest();
}

async function main() {
  const gownBox = { weightKg: 0.8, lengthCm: 60, widthCm: 40, heightCm: 20 };
  assert(Math.abs(volumetricKg(gownBox) - 9.6) < 0.01, `60×40×20 volumetric expected 9.6kg, got ${volumetricKg(gownBox)}`);
  assert(billableKgForCarrier(gownBox, "gig") === 0.8, "GIG bills actual weight, not volumetric");
  assert(
    Math.abs(billableKgForCarrier(gownBox, "dhl") - 9.6) < 0.01,
    "DHL bills max(actual, volumetric/5000)",
  );

  await ensureMethods();
  const product = await makeProduct();
  const variant = product.variants[0]!;
  const lines = [
    {
      quantity: 1,
      variant: { weightKg: 0.8, lengthCm: 40, widthCm: 30, heightCm: 12 },
      product: { weightKg: 0.8, lengthCm: 40, widthCm: 30, heightCm: 12 },
    },
  ];

  const lagos = await listCheckoutShippingOptions({
    destination: { country: "NG", state: "Lagos", city: "Yaba" },
    subtotalNGN: 100_000,
    lines,
    isFreeShippingCoupon: false,
  });
  assert(lagos.band === "LAGOS", "Lagos band");
  assert(
    lagos.options.every((o) => o.kind === "PICKUP" || o.kind === "LOCAL_FLAT"),
    `Lagos must only offer pickup and local rates, got ${lagos.options.map((o) => o.kind).join(",")}`,
  );
  assert(
    lagos.options.some((o) => o.kind === "PICKUP") && lagos.options.some((o) => o.kind === "LOCAL_FLAT"),
    "Lagos offers both pickup and a local rate",
  );

  const captured: { gig?: number; dhl?: number } = {};
  setShippingCarriersForTest([
    {
      name: "gig",
      isConfigured: () => true,
      rate: async (req) => {
        captured.gig = req.billableKg;
        return { ok: true, amountNGN: 8_500, currency: "NGN", service: "standard", etaText: "3–5 days" };
      },
    },
    {
      name: "dhl",
      isConfigured: () => true,
      rate: async (req) => {
        captured.dhl = req.billableKg;
        return { ok: true, amountNGN: 45_000, currency: "NGN", service: "express", etaText: "5–8 days" };
      },
    },
  ]);
  clearShippingQuoteCacheForTest();
  const nigeriaRated = await listCheckoutShippingOptions({
    destination: { country: "NG", state: "Abuja", city: "Wuse" },
    subtotalNGN: 100_000,
    lines,
    isFreeShippingCoupon: false,
  });
  const intlRated = await listCheckoutShippingOptions({
    destination: { country: "US", state: "NY", city: "New York" },
    subtotalNGN: 100_000,
    lines,
    isFreeShippingCoupon: false,
  });
  assert(nigeriaRated.options.some((o) => o.kind === "CARRIER_GIG"), "Abuja offers GIG when configured");
  assert(intlRated.options.some((o) => o.kind === "CARRIER_DHL"), "US offers DHL when configured");
  assert(captured.gig != null && captured.gig < 3, `GIG must not use DHL volumetric, got ${captured.gig}`);
  assert(captured.dhl != null && captured.dhl > 8, `DHL must use volumetric gown box, got ${captured.dhl}`);

  const hanging: ShippingCarrier = {
    name: "gig",
    isConfigured: () => true,
    rate: () => new Promise(() => {}),
  };
  setShippingCarriersForTest([hanging]);
  clearShippingQuoteCacheForTest();
  const started = Date.now();
  const nigeria = await listCheckoutShippingOptions({
    destination: { country: "NG", state: "Abuja", city: "Wuse" },
    subtotalNGN: 100_000,
    lines,
    isFreeShippingCoupon: false,
  });
  const elapsed = Date.now() - started;
  assert(elapsed < 9_000, `carrier timeout should fall through in ~6s, took ${elapsed}ms`);
  assert(nigeria.band === "NIGERIA", "Abuja is Nigeria band");
  assert(
    nigeria.options.some((o) => o.kind === "QUOTE_PENDING" && o.requiresConsent),
    "timeout yields quote-pending with consent",
  );

  const quoteOpt = nigeria.options.find((o) => o.kind === "QUOTE_PENDING")!;
  const resolved = await resolveCheckoutShipping({
    optionId: quoteOpt.optionId,
    destination: { country: "NG", state: "FCT", city: "Abuja" },
    subtotalNGN: 100_000,
    lines,
    isFreeShippingCoupon: false,
  });
  assert(resolved.ok, "resolve quote-pending");
  if (!resolved.ok) throw new Error("unreachable");
  assert(resolved.shipping.quoteStatus === ShippingQuoteStatus.QUOTE_PENDING, "quote status pending");
  assert(resolved.shipping.shippingAmount === 0, "quote pending ships at ₦0");
  assert(resolved.shipping.requiresConsent, "consent required");

  const consentText = DEFAULT_QUOTE_CONSENT;
  const order = await prisma.order.create({
    data: {
      orderNumber: `PA-K-${stamp}`,
      guestEmail: `${stamp}@example.test`,
      guestName: "Test Client",
      subtotal: 100_000,
      shippingAmount: 0,
      total: 100_000,
      currency: Currency.NGN,
      paymentStatus: PaymentStatus.PENDING,
      shippingQuoteStatus: resolved.shipping.quoteStatus,
      shippingConsentAt: new Date(),
      shippingConsentText: consentText,
      shippingMethodKind: ShippingMethodKind.CARRIER_GIG,
      fxRateLocked: 0.00065,
      fxRateSource: "test",
      fxRateFetchedAt: new Date(),
      items: {
        create: {
          productId: product.id,
          variantId: variant.id,
          quantity: 1,
          size: "M",
          price: 100_000,
          lineTotal: 100_000,
        },
      },
    },
  });
  orderIds.push(order.id);
  assert(order.shippingQuoteStatus === ShippingQuoteStatus.QUOTE_PENDING, "order stored QUOTE_PENDING");
  assert(order.shippingConsentText === consentText, "consent wording stored, not a boolean");
  assert(order.shippingConsentAt != null, "consent timestamp stored");

  const blocked = assertCanMarkShipped({
    status: "PROCESSING",
    total: 145_000,
    amountPaid: 100_000,
    balance: 45_000,
    shippingMethodKind: "CARRIER_GIG",
    trackingNumber: "1Z",
  });
  assert(!blocked.ok, "outstanding balance cannot ship");

  assert(!shippingRequiresTracking("PICKUP"), "pickup needs no tracking number");
  assert(shippingRequiresTracking("CARRIER_DHL"), "DHL still needs tracking");
  const pickupShip = assertCanMarkShipped({
    status: "PROCESSING",
    total: 100_000,
    amountPaid: 100_000,
    balance: 0,
    shippingMethodKind: "PICKUP",
    trackingNumber: null,
  });
  assert(!pickupShip.ok, "pickup is not marked shipped");

  setLockedFxForTest({
    rate: 0.001,
    source: "test-lock",
    fetchedAt: new Date(),
    stale: false,
    gbpRate: 0.0008,
  });
  const locked = await getLockedFx();
  await prisma.order.update({
    where: { id: order.id },
    data: { fxRateLocked: locked.rate, fxRateSource: locked.source },
  });
  setLockedFxForTest({
    rate: 0.002,
    source: "test-moved",
    fetchedAt: new Date(),
    stale: false,
    gbpRate: 0.0008,
  });
  const moved = await getLockedFx();
  const stored = await prisma.order.findUnique({ where: { id: order.id } });
  assert(moved.rate === 0.002, "feed moved");
  assert(stored?.fxRateLocked === 0.001, "order keeps the rate locked at creation");

  console.log("slice-k: all assertions passed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => cleanup().then(() => prisma.$disconnect()));
