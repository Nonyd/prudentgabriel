/**
 * Slice O: per-band shipping mode, mode-specific consent copy, Lagos isolation.
 *
 *   pnpm test:slice-o
 */
import "./preload-test-env";
import { ShippingMarkupKind, ShippingMethodKind, ShippingQuoteStatus } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { listCheckoutShippingOptions } from "../src/lib/shipping/options";
import { resolveCheckoutShipping } from "../src/lib/shipping/resolve-selection";
import { setShippingCarriersForTest } from "../src/lib/shipping/carriers";
import { clearShippingQuoteCacheForTest } from "../src/lib/shipping/rate";
import { getShippingAdminStatus, setShippingBandModesForTest } from "../src/lib/shipping/mode";
import { DEFAULT_MANUAL_QUOTE_CONSENT, DEFAULT_UNAVAILABLE_QUOTE_CONSENT } from "../src/lib/shipping/copy";
import {
  applyOrderAttention,
  QUOTE_PENDING_ALL_ATTENTION,
  QUOTE_PENDING_ATTENTION,
} from "../src/lib/admin-orders-filter";
import { orderWhatsAppUrl, toWhatsAppDigits } from "../src/lib/shipping/whatsapp";
import type { ShippingCarrier } from "../src/lib/shipping/carriers/types";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const lines = [
  {
    quantity: 1,
    variant: { weightKg: 0.8, lengthCm: 40, widthCm: 30, heightCm: 12 },
    product: { weightKg: 0.8, lengthCm: 40, widthCm: 30, heightCm: 12 },
  },
];

const hangingDhl: ShippingCarrier = {
  name: "dhl",
  isConfigured: () => true,
  rate: () => new Promise(() => {}),
};

const unconfiguredDhl: ShippingCarrier = {
  name: "dhl",
  isConfigured: () => false,
  rate: async () => ({ ok: false, kind: "unconfigured", message: "DHL Express account is not configured" }),
};

const liveGig: ShippingCarrier = {
  name: "gig",
  isConfigured: () => true,
  rate: async () => ({ ok: true, amountNGN: 8_500, currency: "NGN", service: "standard", etaText: "3–5 days" }),
};

async function ensureMethods() {
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
      etaText: "2–4 business days",
      isActive: true,
      sortOrder: 0,
    },
  });
}

async function main() {
  assert(toWhatsAppDigits("08012345678") === "2348012345678", "NG local number to 234");
  const wa = orderWhatsAppUrl("+234 801 234 5678", "PA-1001");
  assert(wa != null && wa.startsWith("https://wa.me/2348012345678"), "WhatsApp link uses digits");
  assert(wa.includes("PA-1001"), "WhatsApp link prefilled with order number");

  const ready = applyOrderAttention({}, QUOTE_PENDING_ATTENTION);
  assert(ready.shippingQuoteStatus === "QUOTE_PENDING", "ready filter is quote-pending");
  assert(ready.status === "PROCESSING", "ready filter is packed / processing");
  const all = applyOrderAttention({}, QUOTE_PENDING_ALL_ATTENTION);
  assert(all.shippingQuoteStatus === "QUOTE_PENDING", "all filter is quote-pending");
  assert(all.status === undefined, "all filter does not force processing");

  await ensureMethods();

  setShippingBandModesForTest({ nigeria: "MANUAL", international: "MANUAL" });
  setShippingCarriersForTest([hangingDhl, liveGig]);
  clearShippingQuoteCacheForTest();

  const started = Date.now();
  const london = await listCheckoutShippingOptions({
    destination: { country: "GB", state: "England", city: "London" },
    subtotalNGN: 100_000,
    lines,
    isFreeShippingCoupon: false,
  });
  assert(Date.now() - started < 2_000, "MANUAL must not wait on the DHL API");
  assert(london.band === "INTERNATIONAL", "London is international");
  const londonQuote = london.options.find((o) => o.kind === "QUOTE_PENDING");
  assert(londonQuote != null, "MANUAL international yields QUOTE_PENDING");
  assert(londonQuote.quoteReason === "manual", "quote reason is deliberate manual");
  assert(london.quoteConsent === DEFAULT_MANUAL_QUOTE_CONSENT, "checkout shows the manual-mode copy");
  assert(londonQuote.description === DEFAULT_MANUAL_QUOTE_CONSENT, "option description is the manual copy");

  const resolved = await resolveCheckoutShipping({
    optionId: londonQuote.optionId,
    destination: { country: "GB", state: "England", city: "London" },
    subtotalNGN: 100_000,
    lines,
    isFreeShippingCoupon: false,
  });
  assert(resolved.ok, "resolve London manual");
  if (!resolved.ok) throw new Error("unreachable");
  assert(resolved.shipping.quoteStatus === ShippingQuoteStatus.QUOTE_PENDING, "resolved QUOTE_PENDING");
  assert(resolved.shipping.consentText === DEFAULT_MANUAL_QUOTE_CONSENT, "consent stored wording is manual");
  assert((resolved.shipping.quoteLocked as { mode?: string }).mode === "MANUAL", "locked quote records MANUAL");

  const lagosManual = await listCheckoutShippingOptions({
    destination: { country: "NG", state: "Lagos", city: "Lekki" },
    subtotalNGN: 100_000,
    lines,
    isFreeShippingCoupon: false,
  });
  assert(lagosManual.band === "LAGOS", "Lekki is Lagos");
  assert(
    lagosManual.options.every((o) => o.kind === "PICKUP" || o.kind === "LOCAL_FLAT"),
    "Lagos stays automatic under MANUAL bands",
  );
  assert(
    !lagosManual.options.some((o) => o.kind === "QUOTE_PENDING"),
    "Lagos never takes the quote-pending path",
  );

  const abuja = await listCheckoutShippingOptions({
    destination: { country: "NG", state: "Abuja", city: "Wuse" },
    subtotalNGN: 100_000,
    lines,
    isFreeShippingCoupon: false,
  });
  assert(abuja.options.some((o) => o.kind === "QUOTE_PENDING" && o.quoteReason === "manual"), "Nigeria MANUAL skips GIG even when it would rate");

  setShippingBandModesForTest({ nigeria: "MANUAL", international: "LIVE" });
  setShippingCarriersForTest([unconfiguredDhl, liveGig]);
  clearShippingQuoteCacheForTest();

  const admin = await getShippingAdminStatus();
  assert(admin.lagos.mode === "AUTOMATIC", "Lagos is automatic");
  assert(!admin.lagos.misconfigured, "Lagos cannot be misconfigured");
  assert(admin.international.mode === "LIVE", "international set to LIVE");
  assert(admin.international.configured === false, "no DHL credentials");
  assert(admin.international.misconfigured, "LIVE without credentials is shown as misconfigured");
  assert(admin.nigeria.mode === "MANUAL", "Nigeria stays MANUAL");
  assert(!admin.nigeria.misconfigured, "MANUAL is never a misconfiguration");

  const londonLive = await listCheckoutShippingOptions({
    destination: { country: "GB", state: "England", city: "London" },
    subtotalNGN: 100_000,
    lines,
    isFreeShippingCoupon: false,
  });
  const liveQuote = londonLive.options.find((o) => o.kind === "QUOTE_PENDING");
  assert(liveQuote != null, "LIVE with no credentials still falls back to QUOTE_PENDING");
  assert(liveQuote.quoteReason === "unavailable", "fallback is the apologetic path, not manual");
  assert(londonLive.quoteConsent === DEFAULT_UNAVAILABLE_QUOTE_CONSENT, "LIVE fallback uses the unavailable copy");

  const lagosLive = await listCheckoutShippingOptions({
    destination: { country: "NG", state: "Lagos", city: "Lekki" },
    subtotalNGN: 100_000,
    lines,
    isFreeShippingCoupon: false,
  });
  assert(
    lagosLive.options.every((o) => o.kind === "PICKUP" || o.kind === "LOCAL_FLAT"),
    "Lagos stays automatic when international is LIVE and unconfigured",
  );

  console.log("slice-o: all assertions passed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => {
    setShippingCarriersForTest(null);
    setShippingBandModesForTest(null);
    clearShippingQuoteCacheForTest();
    return prisma.$disconnect();
  });
