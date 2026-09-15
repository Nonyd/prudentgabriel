"use client";

import { Badge } from "@/components/ui/Badge";
import { formatAlsoAmount, formatPrice } from "@/lib/currency";
import { effectiveUnitNGN, minAmountInCurrency, variantAmountInCurrency } from "@/lib/pricing";
import { selectedOptionAdjustmentNGN } from "@/lib/product-options";
import { useCurrencyStore } from "@/store/currencyStore";
import type { ProductListItem, ProductListOption, ProductListVariant } from "@/types/product";

interface PriceDisplayProps {
  product: ProductListItem;
  selectedVariant: ProductListVariant | null;
  options?: ProductListOption[] | null;
  optionId?: string | null;
  className?: string;
}

export function PriceDisplay({ product, selectedVariant, options, optionId, className }: PriceDisplayProps) {
  const currency = useCurrencyStore((s) => s.currency);
  const rates = useCurrencyStore((s) => s.rates);
  const fmt = (n: number) => formatPrice(n, currency);
  const optionList = options ?? product.optionGroup?.options ?? null;
  const adj = selectedOptionAdjustmentNGN(optionList, optionId);

  if (!selectedVariant) {
    const lowest = minAmountInCurrency(product.variants, product, currency, rates, optionList);
    const alsoUsd = minAmountInCurrency(product.variants, product, "USD", rates, optionList);
    const alsoGbp = minAmountInCurrency(product.variants, product, "GBP", rates, optionList);
    return (
      <div className={className}>
        <p className="text-2xl font-semibold text-charcoal">From {fmt(lowest)}</p>
        {currency === "NGN" ? (
          <p className="mt-1 text-sm text-charcoal-light">
            Also {formatAlsoAmount(alsoUsd, "USD")} or {formatAlsoAmount(alsoGbp, "GBP")}
          </p>
        ) : null}
      </div>
    );
  }

  const sale = product.isOnSale && selectedVariant.salePriceNGN != null;
  const list = variantAmountInCurrency(
    { ...selectedVariant, salePriceNGN: null },
    { ...product, isOnSale: false },
    currency,
    rates,
    adj,
  );
  const charged = variantAmountInCurrency(selectedVariant, product, currency, rates, adj);
  const pct =
    sale && selectedVariant.priceNGN > 0 && selectedVariant.salePriceNGN != null
      ? Math.round(
          ((selectedVariant.priceNGN - effectiveUnitNGN(selectedVariant, true)) / selectedVariant.priceNGN) * 100,
        )
      : 0;

  return (
    <div className={className}>
      {sale ? (
        <div className="flex flex-wrap items-center gap-3">
          <del className="text-lg text-charcoal-light">{fmt(list)}</del>
          <span className="text-2xl font-semibold text-choc">{fmt(charged)}</span>
          {pct > 0 ? <Badge variant="gold">Save {pct}%</Badge> : null}
        </div>
      ) : (
        <span className="text-2xl font-semibold text-charcoal">{fmt(charged)}</span>
      )}
      {currency === "NGN" ? (
        <p className="mt-1 text-sm text-charcoal-light">
          Also {formatAlsoAmount(variantAmountInCurrency(selectedVariant, product, "USD", rates, adj), "USD")} or{" "}
          {formatAlsoAmount(variantAmountInCurrency(selectedVariant, product, "GBP", rates, adj), "GBP")}
        </p>
      ) : null}
    </div>
  );
}
