/**
 * Slice L: pricing integrity — one helper, sale flag, USD override, inline refuse, catalog min.
 *
 *   pnpm test:slice-l
 */
import "./preload-test-env";
import { PaymentStatus } from "@prisma/client";
import {
  canInlineEditPrice,
  derivedCatalogMinNGN,
  displayPriceNGN,
  effectiveUnitNGN,
  minEffectiveNGN,
  overrideOrConvert,
  variantAmountInCurrency,
} from "../src/lib/pricing";
import { rtwChargeAmountForeign, rtwChargeAmountNGN, rtwHasOutstandingBalance } from "../src/lib/payments/rtw-totals";
import { applyShippingQuoteToLocked, usdOverrideOrConvert, type LockedFx } from "../src/lib/fx";
import { assertCanMarkShipped } from "../src/lib/order-status";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const rates = { NGN: 1, USD: 0.00065, GBP: 0.00052 };
const fx: LockedFx = {
  rate: 0.00065,
  gbpRate: 0.00052,
  source: "test",
  fetchedAt: new Date(),
  stale: false,
};

function run() {
  const size = {
    id: "38",
    size: "38",
    priceNGN: 200_000,
    salePriceNGN: 150_000,
    priceUSD: null as number | null,
    priceGBP: null as number | null,
    stock: 2,
  };

  // L2: display and charge share effectiveUnitNGN. Flag off ignores sale ₦.
  assert(effectiveUnitNGN(size, false) === 200_000, "flag off charges list ₦");
  assert(effectiveUnitNGN(size, true) === 150_000, "flag on charges sale ₦");
  assert(displayPriceNGN([size], "38", false) === 200_000, "flag off displays list ₦");
  assert(displayPriceNGN([size], "38", true) === 150_000, "flag on displays sale ₦");
  assert(
    displayPriceNGN([size], "38", false) === effectiveUnitNGN(size, false),
    "displayed ₦ equals charged ₦ when sale flag is off",
  );
  assert(
    displayPriceNGN([size], "38", true) === effectiveUnitNGN(size, true),
    "displayed ₦ equals charged ₦ when sale flag is on",
  );

  // L1: USD override is the amount charged, not converted NGN.
  const overridden = { ...size, priceUSD: 450 };
  const product = { isOnSale: false, priceUSD: null as number | null, priceGBP: null as number | null };
  const converted = overrideOrConvert(200_000, "USD", null, rates);
  assert(converted === 130, "converted ₦200,000 at 0.00065 is $130");
  const chargedUsd = variantAmountInCurrency(overridden, product, "USD", rates);
  assert(chargedUsd === 450, "variant USD override is used for display");
  assert(usdOverrideOrConvert(200_000, 450, fx) === 450, "usdOverrideOrConvert stamps the override");
  assert(converted === 130 && chargedUsd === 450, "override is not the converted NGN figure");

  const lockedOrder = {
    paymentStatus: PaymentStatus.PENDING,
    total: 200_000,
    fxUsdAmountLocked: 450,
    fxGbpAmountLocked: null as number | null,
  };
  assert(
    rtwChargeAmountForeign(lockedOrder, "USD", fx) === 450,
    "Stripe/Flutterwave charge the locked override, not ₦200,000 × rate",
  );

  // Pay the garment in USD, then quote shipping: locked grows by converted ₦,
  // the top-up charges that converted figure (not locked × outstanding/total),
  // and the two USD charges sum to the new lock so the NGN balance can close.
  const garmentNGN = 200_000;
  const shipNGN = 50_000;
  const uglyShipNGN = 33_333;
  let usdLocked = 450;
  const firstCharge = rtwChargeAmountForeign(
    { paymentStatus: PaymentStatus.PENDING, total: garmentNGN, fxUsdAmountLocked: usdLocked },
    "USD",
    fx,
  );
  assert(firstCharge === 450, "first USD charge is the override");
  usdLocked = applyShippingQuoteToLocked(usdLocked, shipNGN, "USD", fx)!;
  assert(usdLocked === 482.5, "quote adds ₦50,000 × 0.00065 = $32.50 onto $450");
  const afterQuote = {
    paymentStatus: PaymentStatus.PAID,
    total: garmentNGN + shipNGN,
    amountPaid: garmentNGN,
    balance: shipNGN,
    fxUsdAmountLocked: usdLocked,
  };
  const topUp = rtwChargeAmountForeign(afterQuote, "USD", fx);
  assert(topUp === 32.5, "shipping top-up is the converted quote, not a mix of override and rate");
  assert(firstCharge + topUp === usdLocked, "the two USD charges sum to the locked payable");
  const scaledWrong = Math.round((usdLocked * (shipNGN / afterQuote.total)) * 100) / 100;
  assert(Math.abs(scaledWrong - 96.5) < 0.001, "precondition: proportion would have billed $96.50");
  assert(Math.abs(topUp - 32.5) < 0.001, "top-up stays at converted shipping");
  const ngnFirst = rtwChargeAmountNGN({
    paymentStatus: PaymentStatus.PENDING,
    total: garmentNGN,
    amountPaid: 0,
    balance: garmentNGN,
  });
  const ngnTopUp = rtwChargeAmountNGN(afterQuote);
  assert(ngnFirst + ngnTopUp === afterQuote.total, "NGN ledger of both charges equals order.total");
  const closed = {
    status: "PROCESSING" as const,
    total: afterQuote.total,
    amountPaid: afterQuote.total,
    balance: 0,
    shippingMethodKind: "CARRIER_DHL",
    trackingNumber: "1Z",
  };
  assert(!rtwHasOutstandingBalance(closed), "NGN remainder is zero");
  const shipGate = assertCanMarkShipped(closed);
  assert(shipGate.ok === true, "zero remainder can be marked shipped");

  const uglyLocked = applyShippingQuoteToLocked(450, uglyShipNGN, "USD", fx)!;
  const uglyTopUp = rtwChargeAmountForeign(
    {
      paymentStatus: PaymentStatus.PAID,
      total: garmentNGN + uglyShipNGN,
      amountPaid: garmentNGN,
      balance: uglyShipNGN,
      fxUsdAmountLocked: uglyLocked,
    },
    "USD",
    fx,
  );
  assert(450 + uglyTopUp === uglyLocked, "cent rounding on an uneven ₦ quote still closes exactly");

  // L3: inline edit on a multi-size product is refused.
  assert(canInlineEditPrice(1).ok === true, "single size may be edited inline");
  const multi = canInlineEditPrice(3);
  assert(multi.ok === false, "three sizes cannot be edited inline");
  if (!multi.ok) {
    assert(multi.error.includes("per-size"), "refusal names the product form");
  }

  // L4: catalog min (filter/sort field) matches the card's cheapest effective ₦.
  const sizes = [
    { priceNGN: 250_000, salePriceNGN: null, stock: 1 },
    { priceNGN: 180_000, salePriceNGN: null, stock: 1 },
    { priceNGN: 220_000, salePriceNGN: 100_000, stock: 1 },
  ];
  const cardMinOff = minEffectiveNGN(sizes, false);
  const catalogMinOff = derivedCatalogMinNGN(sizes, false);
  assert(cardMinOff === 180_000, "card uses cheapest list ₦ when sale is off");
  assert(catalogMinOff === cardMinOff, "filter/sort priceNGN agrees with the card when sale is off");

  const cardMinOn = minEffectiveNGN(sizes, true);
  const catalogMinOn = derivedCatalogMinNGN(sizes, true);
  assert(cardMinOn === 100_000, "card uses cheapest sale ₦ when sale is on");
  assert(catalogMinOn === cardMinOn, "filter/sort priceNGN agrees with the card when sale is on");

  console.log("slice-l: all checks passed");
}

run();
