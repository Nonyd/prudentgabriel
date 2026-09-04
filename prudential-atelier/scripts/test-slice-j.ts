/**
 * Slice J: Quick Add state machine — no silent size default, sold-out, CTA labels.
 *
 *   pnpm test:slice-j
 */
import {
  canSubmit,
  displayPriceNGN,
  hasPurchasableSize,
  initialQuickAddState,
  pickVariantForAdd,
  quickAddCtaLabel,
  reduceQuickAdd,
  stockGuardMessage,
  type QuickAddState,
} from "../src/lib/quick-add";
import type { ProductListItem, ProductListVariant } from "../src/types/product";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

function variant(partial: Partial<ProductListVariant> & { id: string; size: string }): ProductListVariant {
  return {
    priceNGN: 150000,
    salePriceNGN: null,
    priceUSD: null,
    priceGBP: null,
    stock: 3,
    ...partial,
  };
}

function product(variants: ProductListVariant[], id = "p1"): ProductListItem {
  return {
    id,
    name: "Halter Draped Sequin Dress",
    slug: "halter-draped-sequin-dress",
    description: "",
    category: "EVENING_WEAR",
    type: "RTW",
    basePriceNGN: 150000,
    priceUSD: null,
    priceGBP: null,
    isOnSale: false,
    isNewArrival: false,
    isBespokeAvail: false,
    isFeatured: false,
    tags: [],
    images: [],
    variants,
    colors: [],
    _count: { reviews: 0 },
  };
}

const sizes = [
  variant({ id: "xs", size: "XS", stock: 2, priceNGN: 180000 }),
  variant({ id: "s", size: "S", stock: 0, priceNGN: 180000 }),
  variant({ id: "m", size: "M", stock: 5, priceNGN: 190000 }),
];

function run() {
  const dress = product(sizes);

  assert(pickVariantForAdd(sizes, null) === null, "must not default when no size chosen");
  assert(pickVariantForAdd(sizes, "missing") === null, "unknown id is not a silent default");
  assert(pickVariantForAdd(sizes, "m")?.id === "m", "picked size is used");

  let state: QuickAddState = initialQuickAddState();
  assert(state.phase === "idle", "starts idle");
  assert(!canSubmit(state), "cannot submit idle");

  state = reduceQuickAdd(state, { type: "submit" });
  assert(state.phase === "idle", "submit without open is a no-op");
  assert(state.variantId === null, "submit must not invent a variant");

  state = reduceQuickAdd(state, { type: "open", product: dress });
  assert(state.phase === "sizes", "open goes to sizes");
  assert(state.variantId === null, "open does not preselect first / first in-stock variant");
  assert(!canSubmit(state), "cannot add before a size is chosen");

  state = reduceQuickAdd(state, { type: "submit" });
  assert(state.phase === "sizes", "submit in sizes without a pick is a no-op");
  assert(state.variantId === null, "still no silent default on submit");

  state = reduceQuickAdd(state, { type: "fail", message: "Please choose your size" });
  assert(state.phase === "sizes", "add without a size still shows the chips");
  assert(state.error === "Please choose your size", "the tap teaches her to choose");

  state = reduceQuickAdd(state, { type: "select", variantId: "s" });
  assert(state.variantId === null, "sold-out size is not selectable");
  assert(state.phase === "sizes", "still sizes after refused sold-out pick");

  state = reduceQuickAdd(state, { type: "select", variantId: "m" });
  assert(state.phase === "selected", "in-stock pick -> selected");
  assert(state.variantId === "m", "selected id is the one the shopper tapped");
  assert(canSubmit(state), "selected can submit");

  const other = product([variant({ id: "l", size: "L", stock: 1 })], "p2");
  state = reduceQuickAdd(state, { type: "open", product: other });
  assert(state.product?.id === "p2", "only one product open at a time");
  assert(state.variantId === null, "opening another product clears the previous size");
  assert(state.phase === "sizes", "new open is sizes, not selected");

  state = reduceQuickAdd(state, { type: "select", variantId: "l" });
  state = reduceQuickAdd(state, { type: "submit" });
  assert(state.phase === "submitting", "submit -> submitting");
  state = reduceQuickAdd(state, { type: "fail", message: "That size just sold out." });
  assert(state.phase === "selected", "error returns to selected");
  assert(state.error === "That size just sold out.", "inline stock copy");
  assert(canSubmit(state), "can retry after error");

  state = reduceQuickAdd(state, { type: "submit" });
  state = reduceQuickAdd(state, { type: "success" });
  assert(state.phase === "done", "success -> done");
  state = reduceQuickAdd(state, { type: "close" });
  assert(state.phase === "idle", "close resets");
  assert(state.variantId === null, "close clears size");

  const empty = product([variant({ id: "a", size: "A", stock: 0 }), variant({ id: "b", size: "B", stock: 0 })]);
  assert(!hasPurchasableSize(empty.variants), "all-zero is sold out");
  state = reduceQuickAdd(initialQuickAddState(), { type: "open", product: empty });
  assert(state.phase === "idle", "do not open an empty / sold-out panel");

  assert(hasPurchasableSize(dress.variants), "staging-style stock is purchasable");
  assert(quickAddCtaLabel("sizes", "₦180,000") === "Select Size · ₦180,000", "sizes CTA names next action + price");
  assert(quickAddCtaLabel("selected", "₦190,000") === "Add to bag · ₦190,000", "selected CTA names next action + price");
  assert(quickAddCtaLabel("done", "₦190,000") === "Added to bag · ₦190,000", "done keeps price visible");
  assert(displayPriceNGN(sizes, null, false) === 180000, "unselected display uses lowest in-stock, not first variant");
  assert(displayPriceNGN(sizes, "m", false) === 190000, "selected display uses that SKU");
  assert(stockGuardMessage("Out of stock") === "That size just sold out.", "stock API maps to inline copy");
  assert(stockGuardMessage("Quantity exceeds stock") === "That size just sold out.", "qty/stock maps to inline copy");
  assert(stockGuardMessage(undefined) === "Could not add to bag.", "empty API body is not Could not update bag");

  console.log("slice-j: all checks passed");
}

run();
