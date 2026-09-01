import type { ProductListItem, ProductListVariant } from "@/types/product";
import { displayPriceNGN, pickVariantForPrice } from "@/lib/pricing";

export type QuickAddPhase = "idle" | "sizes" | "selected" | "submitting" | "done" | "error";

export interface QuickAddState {
  product: ProductListItem | null;
  variantId: string | null;
  phase: QuickAddPhase;
  error: string | null;
}

export type QuickAddAction =
  | { type: "open"; product: ProductListItem }
  | { type: "close" }
  | { type: "select"; variantId: string }
  | { type: "submit" }
  | { type: "success" }
  | { type: "fail"; message: string };

export function initialQuickAddState(): QuickAddState {
  return { product: null, variantId: null, phase: "idle", error: null };
}

export function hasPurchasableSize(variants: Pick<ProductListVariant, "stock">[]): boolean {
  return variants.some((v) => v.stock > 0);
}

/** Never default. Add is only valid when the shopper picked a size. */
export function pickVariantForAdd(
  variants: ProductListVariant[],
  variantId: string | null,
): ProductListVariant | null {
  return pickVariantForPrice(variants, variantId);
}

export { displayPriceNGN };

export function quickAddCtaLabel(phase: QuickAddPhase, price: string): string {
  switch (phase) {
    case "idle":
      return price;
    case "sizes":
      return `Select Size · ${price}`;
    case "selected":
    case "error":
    case "submitting":
      return `Add to bag · ${price}`;
    case "done":
      return `Added to bag · ${price}`;
  }
}

export function stockGuardMessage(apiError?: string | null): string {
  const e = (apiError ?? "").toLowerCase();
  if (e.includes("stock") || e.includes("sold")) return "That size just sold out.";
  if (apiError?.trim()) return apiError.trim();
  return "Could not add to bag.";
}

export function canSubmit(state: QuickAddState): boolean {
  if (state.phase !== "selected" && state.phase !== "error") return false;
  return Boolean(state.variantId);
}

export function reduceQuickAdd(state: QuickAddState, action: QuickAddAction): QuickAddState {
  switch (action.type) {
    case "open": {
      if (!hasPurchasableSize(action.product.variants) && !action.product.customOffered) return state;
      return {
        product: action.product,
        variantId: null,
        phase: "sizes",
        error: null,
      };
    }
    case "close":
      return initialQuickAddState();
    case "select": {
      if (state.phase === "idle" || state.phase === "submitting" || state.phase === "done") {
        return state;
      }
      const variant = state.product
        ? pickVariantForAdd(state.product.variants, action.variantId)
        : null;
      if (!variant || variant.stock < 1) return state;
      return { ...state, variantId: variant.id, phase: "selected", error: null };
    }
    case "submit": {
      if (!canSubmit(state)) return state;
      const variant = state.product
        ? pickVariantForAdd(state.product.variants, state.variantId)
        : null;
      if (!variant) return state;
      return { ...state, phase: "submitting", error: null };
    }
    case "success":
      if (state.phase !== "submitting") return state;
      return { ...state, phase: "done", error: null };
    case "fail":
      if (state.phase !== "submitting" && state.phase !== "selected") return state;
      return {
        ...state,
        phase: "selected",
        error: action.message || "That size just sold out.",
      };
  }
}
