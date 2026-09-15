/**
 * Single place that decides what a size costs.
 * Display, bag, order lines, catalog min, and PSP amounts all call this.
 * Option adjustments enter here — never around it.
 */
import type { ExchangeRatesNGN, ShopCurrency } from "@/lib/currency";
import { convertFromNGN } from "@/lib/currency";
import { cheapestOptionAdjustmentNGN, selectedOptionAdjustmentNGN } from "@/lib/product-options";

export type PricedVariant = {
  priceNGN: number;
  salePriceNGN?: number | null;
  priceUSD?: number | null;
  priceGBP?: number | null;
};

export type PricedProduct = {
  isOnSale: boolean;
  priceUSD?: number | null;
  priceGBP?: number | null;
};

export type PricedOptionAdj = { priceAdjustmentNGN?: number | null };

/** Sale ₦ counts only while the product is on sale. Flag off → list price. Option adj is signed. */
export function effectiveUnitNGN(
  variant: PricedVariant,
  isOnSale: boolean,
  optionAdjustmentNGN = 0,
): number {
  const base =
    isOnSale && variant.salePriceNGN != null && Number.isFinite(variant.salePriceNGN)
      ? variant.salePriceNGN
      : variant.priceNGN;
  const adj = Number.isFinite(optionAdjustmentNGN) ? optionAdjustmentNGN : 0;
  return base + adj;
}

export function saleFigureIsDormant(isOnSale: boolean, variants: PricedVariant[]): boolean {
  if (isOnSale) return false;
  return variants.some((v) => v.salePriceNGN != null && Number.isFinite(v.salePriceNGN));
}

export function minEffectiveNGN(
  variants: PricedVariant[],
  isOnSale: boolean,
  options?: PricedOptionAdj[] | null,
): number {
  if (!variants.length) return 0;
  const adj = cheapestOptionAdjustmentNGN(options);
  return Math.min(...variants.map((v) => effectiveUnitNGN(v, isOnSale, adj)));
}

/**
 * Cheapest effective unit — written to Product.priceNGN and Product.basePriceNGN on a full save.
 * Shop filter/sort read Product.priceNGN. Wishlist, campaign "From", and admin lists use this helper
 * (or the denormalised column after save). basePriceNGN is no longer an independent catalog price;
 * the form field only seeds new size rows and “copy onto every size”.
 */
export function derivedCatalogMinNGN(
  variants: PricedVariant[],
  isOnSale: boolean,
  options?: PricedOptionAdj[] | null,
): number {
  return minEffectiveNGN(variants, isOnSale, options);
}

export function pickVariantForPrice<T extends { id: string }>(
  variants: T[],
  variantId: string | null,
): T | null {
  if (!variantId) return null;
  return variants.find((v) => v.id === variantId) ?? null;
}

/** Unselected size: lowest among all sizes. Unselected option: cheapest option. */
export function displayPriceNGN<T extends PricedVariant & { id: string }>(
  variants: T[],
  variantId: string | null,
  isOnSale: boolean,
  options?: Array<PricedOptionAdj & { id: string }> | null,
  optionId?: string | null,
): number {
  const adj = selectedOptionAdjustmentNGN(options, optionId);
  const selected = pickVariantForPrice(variants, variantId);
  if (selected) return effectiveUnitNGN(selected, isOnSale, adj);
  return minEffectiveNGN(variants, isOnSale, options);
}

export function resolveCurrencyOverride(
  currency: ShopCurrency,
  variant: PricedVariant,
  product: PricedProduct,
): number | null {
  if (currency === "NGN") return null;
  const fromVariant = currency === "USD" ? variant.priceUSD : variant.priceGBP;
  if (fromVariant != null && fromVariant > 0) return fromVariant;
  const fromProduct = currency === "USD" ? product.priceUSD : product.priceGBP;
  if (fromProduct != null && fromProduct > 0) return fromProduct;
  return null;
}

/** Variant override, else product override, else convert from NGN. */
export function overrideOrConvert(
  amountNGN: number,
  currency: ShopCurrency,
  override: number | null | undefined,
  rates: ExchangeRatesNGN,
): number {
  if (currency === "NGN") return amountNGN;
  if (override != null && override > 0) return override;
  return convertFromNGN(amountNGN, currency, rates);
}

/**
 * Size-level USD/GBP override stays. The option's naira adjustment is converted and added,
 * so a cheaper skirt is cheaper in every currency.
 */
export function overrideOrConvertWithOption(
  amountNGN: number,
  currency: ShopCurrency,
  override: number | null | undefined,
  rates: ExchangeRatesNGN,
  optionAdjustmentNGN = 0,
): number {
  if (currency === "NGN") return amountNGN;
  const adj = Number.isFinite(optionAdjustmentNGN) ? optionAdjustmentNGN : 0;
  if (override != null && override > 0) {
    return override + (adj !== 0 ? convertFromNGN(adj, currency, rates) : 0);
  }
  return convertFromNGN(amountNGN, currency, rates);
}

export function variantAmountInCurrency(
  variant: PricedVariant,
  product: PricedProduct,
  currency: ShopCurrency,
  rates: ExchangeRatesNGN,
  optionAdjustmentNGN = 0,
): number {
  const ngn = effectiveUnitNGN(variant, product.isOnSale, optionAdjustmentNGN);
  return overrideOrConvertWithOption(
    ngn,
    currency,
    resolveCurrencyOverride(currency, variant, product),
    rates,
    optionAdjustmentNGN,
  );
}

export function minAmountInCurrency(
  variants: PricedVariant[],
  product: PricedProduct,
  currency: ShopCurrency,
  rates: ExchangeRatesNGN,
  options?: PricedOptionAdj[] | null,
): number {
  if (!variants.length) return 0;
  const adj = cheapestOptionAdjustmentNGN(options);
  return Math.min(...variants.map((v) => variantAmountInCurrency(v, product, currency, rates, adj)));
}

export function displayAmountInCurrency<T extends PricedVariant & { id: string }>(
  variants: T[],
  variantId: string | null,
  product: PricedProduct,
  currency: ShopCurrency,
  rates: ExchangeRatesNGN,
  options?: Array<PricedOptionAdj & { id: string }> | null,
  optionId?: string | null,
): number {
  const adj = selectedOptionAdjustmentNGN(options, optionId);
  const selected = pickVariantForPrice(variants, variantId);
  if (selected) return variantAmountInCurrency(selected, product, currency, rates, adj);
  return minAmountInCurrency(variants, product, currency, rates, options);
}

export function cartLineAmountInCurrency(
  line: { priceNGN: number; priceUSD: number; priceGBP: number; quantity: number },
  currency: ShopCurrency,
  rates: ExchangeRatesNGN,
): number {
  const unit =
    currency === "USD"
      ? line.priceUSD
      : currency === "GBP"
        ? line.priceGBP
        : line.priceNGN;
  const fallback = overrideOrConvert(line.priceNGN, currency, null, rates);
  const resolved = unit > 0 ? unit : fallback;
  return resolved * line.quantity;
}

export function extrasAmountInCurrency(
  amountNGN: number,
  currency: ShopCurrency,
  rates: ExchangeRatesNGN,
): number {
  return overrideOrConvert(amountNGN, currency, null, rates);
}

export const INLINE_MULTI_VARIANT_PRICE_ERROR =
  "This product has per-size prices. Edit them in the product form.";

export function canInlineEditPrice(variantCount: number): { ok: true } | { ok: false; error: string } {
  if (variantCount > 1) return { ok: false, error: INLINE_MULTI_VARIANT_PRICE_ERROR };
  return { ok: true };
}

export const DEFAULT_BESPOKE_FROM_MARKUP = 1.3;

export function bespokeFromNGN(minEffective: number, markupRaw: string | null | undefined): number {
  const m = markupRaw != null ? Number.parseFloat(markupRaw) : DEFAULT_BESPOKE_FROM_MARKUP;
  const markup = Number.isFinite(m) && m >= 1 && m <= 5 ? m : DEFAULT_BESPOKE_FROM_MARKUP;
  return minEffective * markup;
}
