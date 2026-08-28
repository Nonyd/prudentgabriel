/**
 * Single place that decides what a size costs.
 * Display, bag, order lines, catalog min, and PSP amounts all call this.
 */
import type { ExchangeRatesNGN, ShopCurrency } from "@/lib/currency";
import { convertFromNGN } from "@/lib/currency";

export type PricedVariant = {
  priceNGN: number;
  salePriceNGN?: number | null;
  priceUSD?: number | null;
  priceGBP?: number | null;
  stock?: number;
};

export type PricedProduct = {
  isOnSale: boolean;
  priceUSD?: number | null;
  priceGBP?: number | null;
};

/** Sale ₦ counts only while the product is on sale. Flag off → list price. */
export function effectiveUnitNGN(variant: PricedVariant, isOnSale: boolean): number {
  if (isOnSale && variant.salePriceNGN != null && Number.isFinite(variant.salePriceNGN)) {
    return variant.salePriceNGN;
  }
  return variant.priceNGN;
}

export function saleFigureIsDormant(isOnSale: boolean, variants: PricedVariant[]): boolean {
  if (isOnSale) return false;
  return variants.some((v) => v.salePriceNGN != null && Number.isFinite(v.salePriceNGN));
}

export function minEffectiveNGN(variants: PricedVariant[], isOnSale: boolean): number {
  if (!variants.length) return 0;
  return Math.min(...variants.map((v) => effectiveUnitNGN(v, isOnSale)));
}

/**
 * Cheapest effective unit — written to Product.priceNGN and Product.basePriceNGN on a full save.
 * Shop filter/sort read Product.priceNGN. Wishlist, campaign "From", and admin lists use this helper
 * (or the denormalised column after save). basePriceNGN is no longer an independent catalog price;
 * the form field only seeds new size rows and “copy onto every size”.
 */
export function derivedCatalogMinNGN(variants: PricedVariant[], isOnSale: boolean): number {
  return minEffectiveNGN(variants, isOnSale);
}

export function pickVariantForPrice<T extends { id: string }>(
  variants: T[],
  variantId: string | null,
): T | null {
  if (!variantId) return null;
  return variants.find((v) => v.id === variantId) ?? null;
}

/** Unselected: lowest in-stock (or all sizes if none in stock). Selected: that SKU. */
export function displayPriceNGN<T extends PricedVariant & { id: string; stock: number }>(
  variants: T[],
  variantId: string | null,
  isOnSale: boolean,
): number {
  const selected = pickVariantForPrice(variants, variantId);
  if (selected) return effectiveUnitNGN(selected, isOnSale);
  const pool = variants.filter((v) => v.stock > 0);
  const source = pool.length ? pool : variants;
  return minEffectiveNGN(source, isOnSale);
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

export function variantAmountInCurrency(
  variant: PricedVariant,
  product: PricedProduct,
  currency: ShopCurrency,
  rates: ExchangeRatesNGN,
): number {
  const ngn = effectiveUnitNGN(variant, product.isOnSale);
  return overrideOrConvert(ngn, currency, resolveCurrencyOverride(currency, variant, product), rates);
}

export function minAmountInCurrency(
  variants: PricedVariant[],
  product: PricedProduct,
  currency: ShopCurrency,
  rates: ExchangeRatesNGN,
): number {
  if (!variants.length) return 0;
  return Math.min(...variants.map((v) => variantAmountInCurrency(v, product, currency, rates)));
}

export function displayAmountInCurrency<T extends PricedVariant & { id: string; stock: number }>(
  variants: T[],
  variantId: string | null,
  product: PricedProduct,
  currency: ShopCurrency,
  rates: ExchangeRatesNGN,
): number {
  const selected = pickVariantForPrice(variants, variantId);
  if (selected) return variantAmountInCurrency(selected, product, currency, rates);
  const pool = variants.filter((v) => v.stock > 0);
  const source = pool.length ? pool : variants;
  return minAmountInCurrency(source, product, currency, rates);
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
