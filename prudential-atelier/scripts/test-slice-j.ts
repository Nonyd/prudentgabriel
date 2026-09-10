/**
 * Slice J: Quick Add state machine — no silent size default, CTA labels.
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
  bagErrorMessage,
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
  variant({ id: "xs", size: "XS", priceNGN: 180000 }),
  variant({ id: "s", size: "S", priceNGN: 180000 }),
  variant({ id: "m", size: "M", priceNGN: 190000 }),
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
  assert(state.variantId === null, "open does not preselect the first listed size");
  assert(!canSubmit(state), "cannot add before a size is chosen");

  state = reduceQuickAdd(state, { type: "submit" });
  assert(state.phase === "sizes", "submit in sizes without a pick is a no-op");
  assert(state.variantId === null, "still no silent default on submit");

  state = reduceQuickAdd(state, { type: "fail", message: "Please choose your size" });
  assert(state.phase === "sizes", "add without a size still shows the chips");
  assert(state.error === "Please choose your size", "the tap teaches her to choose");

  state = reduceQuickAdd(state, { type: "select", variantId: "s" });
  assert(state.phase === "selected", "every listed size is selectable");
  assert(state.variantId === "s", "selected id is the one the shopper tapped");

  state = reduceQuickAdd(state, { type: "select", variantId: "m" });
  assert(state.phase === "selected", "pick -> selected");
  assert(state.variantId === "m", "selected id is the one the shopper tapped");
  assert(canSubmit(state), "selected can submit");

  const other = product([variant({ id: "l", size: "L" })], "p2");
  state = reduceQuickAdd(state, { type: "open", product: other });
  assert(state.product?.id === "p2", "only one product open at a time");
  assert(state.variantId === null, "opening another product clears the previous size");
  assert(state.phase === "sizes", "new open is sizes, not selected");

  state = reduceQuickAdd(state, { type: "select", variantId: "l" });
  state = reduceQuickAdd(state, { type: "submit" });
  assert(state.phase === "submitting", "submit -> submitting");
  state = reduceQuickAdd(state, { type: "fail", message: "Could not add to bag." });
  assert(state.phase === "selected", "error returns to selected");
  assert(state.error === "Could not add to bag.", "inline bag copy");
  assert(canSubmit(state), "can retry after error");

  state = reduceQuickAdd(state, { type: "submit" });
  state = reduceQuickAdd(state, { type: "success" });
  assert(state.phase === "done", "success -> done");
  state = reduceQuickAdd(state, { type: "close" });
  assert(state.phase === "idle", "close resets");
  assert(state.variantId === null, "close clears size");

  const empty = product([]);
  assert(!hasPurchasableSize(empty.variants), "no sizes is not purchasable");
  state = reduceQuickAdd(initialQuickAddState(), { type: "open", product: empty });
  assert(state.phase === "idle", "do not open a piece with no sizes");

  assert(hasPurchasableSize(dress.variants), "listed sizes are purchasable");
  assert(quickAddCtaLabel("sizes", "₦180,000") === "Select Size · ₦180,000", "sizes CTA names next action + price");
  assert(quickAddCtaLabel("selected", "₦190,000") === "Add to bag · ₦190,000", "selected CTA names next action + price");
  assert(quickAddCtaLabel("done", "₦190,000") === "Added to bag · ₦190,000", "done keeps price visible");
  assert(displayPriceNGN(sizes, null, false) === 180000, "unselected display uses lowest listed size, not first variant");
  assert(displayPriceNGN(sizes, "m", false) === 190000, "selected display uses that SKU");
  assert(bagErrorMessage("Please choose your size") === "Please choose your size", "API copy is kept");
  assert(bagErrorMessage(undefined) === "Could not add to bag.", "empty API body is not Could not update bag");

  console.log("slice-j: all checks passed");
}

run();
