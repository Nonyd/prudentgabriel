"use client";

import { Badge } from "@/components/ui/Badge";
import { formatPrice } from "@/lib/currency";
import { effectiveUnitNGN, minAmountInCurrency, variantAmountInCurrency } from "@/lib/pricing";
import { useCurrencyStore } from "@/store/currencyStore";
import type { ProductListItem, ProductListVariant } from "@/types/product";

interface PriceDisplayProps {
  product: ProductListItem;
  selectedVariant: ProductListVariant | null;
  className?: string;
}

export function PriceDisplay({ product, selectedVariant, className }: PriceDisplayProps) {
  const currency = useCurrencyStore((s) => s.currency);
  const rates = useCurrencyStore((s) => s.rates);
  const fmt = (n: number) => formatPrice(n, currency);

  if (!selectedVariant) {
    const lowest = minAmountInCurrency(product.variants, product, currency, rates);
    const alsoUsd = minAmountInCurrency(product.variants, product, "USD", rates);
    const alsoGbp = minAmountInCurrency(product.variants, product, "GBP", rates);
    return (
      <div className={className}>
        <p className="text-2xl font-semibold text-charcoal">From {fmt(lowest)}</p>
        {currency === "NGN" ? (
          <p className="mt-1 text-sm text-charcoal-light">
            Also: {formatPrice(alsoUsd, "USD")} · {formatPrice(alsoGbp, "GBP")}
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
  );
  const charged = variantAmountInCurrency(selectedVariant, product, currency, rates);
  const pct =
    sale && selectedVariant.priceNGN > 0 && selectedVariant.salePriceNGN != null
      ? Math.round(((selectedVariant.priceNGN - effectiveUnitNGN(selectedVariant, true)) / selectedVariant.priceNGN) * 100)
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
          Also: {formatPrice(variantAmountInCurrency(selectedVariant, product, "USD", rates), "USD")} ·{" "}
          {formatPrice(variantAmountInCurrency(selectedVariant, product, "GBP", rates), "GBP")}
        </p>
      ) : null}
    </div>
  );
}
