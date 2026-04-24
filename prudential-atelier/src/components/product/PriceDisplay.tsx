"use client";

import { Badge } from "@/components/ui/Badge";
import { convertFromNGN, formatPrice } from "@/lib/currency";
import { useCurrencyStore } from "@/store/currencyStore";
import type { ProductListVariant } from "@/types/product";

type Variant = ProductListVariant;

interface ProductLike {
  isOnSale: boolean;
  variants: Variant[];
}

interface PriceDisplayProps {
  product: ProductLike;
  selectedVariant: Variant | null;
  className?: string;
}

export function PriceDisplay({ product, selectedVariant, className }: PriceDisplayProps) {
  const currency = useCurrencyStore((s) => s.currency);
  const rates = useCurrencyStore((s) => s.rates);
  const fmt = (ngn: number) => formatPrice(convertFromNGN(ngn, currency, rates), currency);

  const lowest = Math.min(
    ...product.variants.map((v) => (v.salePriceNGN != null ? v.salePriceNGN : v.priceNGN)),
  );

  if (!selectedVariant) {
    return (
      <div className={className}>
        <p className="text-2xl font-semibold text-charcoal">From {fmt(lowest)}</p>
        <p className="mt-1 text-sm text-charcoal-light">
          Also: {formatPrice(convertFromNGN(lowest, "USD", rates), "USD")} ·{" "}
          {formatPrice(convertFromNGN(lowest, "GBP", rates), "GBP")}
        </p>
      </div>
    );
  }

  const sale = selectedVariant.salePriceNGN != null && product.isOnSale;
  const price = selectedVariant.priceNGN;
  const saleP = selectedVariant.salePriceNGN ?? price;
  const pct =
    sale && selectedVariant.salePriceNGN != null
      ? Math.round(((price - selectedVariant.salePriceNGN) / price) * 100)
      : 0;

  return (
    <div className={className}>
      {sale ? (
        <div className="flex flex-wrap items-center gap-3">
          <del className="text-lg text-charcoal-light">{fmt(price)}</del>
          <span className="text-2xl font-semibold text-wine">{fmt(saleP)}</span>
          <Badge variant="wine">Save {pct}%</Badge>
        </div>
      ) : (
        <span className="text-2xl font-semibold text-charcoal">{fmt(price)}</span>
      )}
      <p className="mt-1 text-sm text-charcoal-light">
        Also: {formatPrice(convertFromNGN(sale ? saleP : price, "USD", rates), "USD")} ·{" "}
        {formatPrice(convertFromNGN(sale ? saleP : price, "GBP", rates), "GBP")}
      </p>
    </div>
  );
}
