"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { WishlistButton } from "@/components/common/WishlistButton";
import { QuickViewModal } from "@/components/common/QuickViewModal";
import { convertFromNGN, formatPrice } from "@/lib/currency";
import { useCurrencyStore } from "@/store/currencyStore";
import type { ProductListItem } from "@/types/product";

const PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='1067'%3E%3Crect width='100%25' height='100%25' fill='%23F2F2F0'/%3E%3C/svg%3E";

export interface ProductCardProps {
  product: ProductListItem;
  priority?: boolean;
  compact?: boolean;
}

function effectiveVariantPrice(v: ProductListItem["variants"][0]) {
  return v.salePriceNGN != null ? v.salePriceNGN : v.priceNGN;
}

export function ProductCard({ product, priority, compact }: ProductCardProps) {
  const router = useRouter();
  const currency = useCurrencyStore((s) => s.currency);
  const rates = useCurrencyStore((s) => s.rates);
  const [qv, setQv] = useState<string | null>(null);

  const prices = product.variants.map((v) => ({
    orig: v.priceNGN,
    sale: v.salePriceNGN,
    eff: effectiveVariantPrice(v),
  }));
  const lowestOrig = Math.min(...prices.map((p) => p.orig));
  const salePrices = prices.map((p) => p.sale).filter((x): x is number => x != null);
  const lowestSale = salePrices.length ? Math.min(...salePrices) : null;
  const lowestEff = Math.min(...prices.map((p) => p.eff));
  const multi = product.variants.length > 1;

  const badges: { key: string; variant: "wine" | "gold" | "outline-wine"; label: string }[] = [];
  if (product.isOnSale) badges.push({ key: "sale", variant: "wine", label: "Sale" });
  if (product.isNewArrival) badges.push({ key: "new", variant: "gold", label: "New" });
  if (product.isBespokeAvail) badges.push({ key: "bes", variant: "outline-wine", label: "Bespoke" });
  const shown = badges.slice(0, 2);

  const primary = product.images[0];
  const secondary = product.images[1];

  const formatN = (ngn: number) => formatPrice(convertFromNGN(ngn, currency, rates), currency);

  return (
    <>
      <div
        role="link"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter") router.push(`/shop/${product.slug}`);
        }}
        onClick={() => router.push(`/shop/${product.slug}`)}
        className={cn("group relative cursor-pointer bg-[var(--white)]", compact && "text-left")}
      >
        <div className="relative aspect-[3/4] overflow-hidden bg-[var(--light-grey)]">
          <Image
            src={primary?.url ?? PLACEHOLDER}
            alt={primary?.alt || product.name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className={cn(
              "object-cover object-top transition-opacity duration-500",
              secondary && "group-hover:opacity-0",
            )}
            priority={priority}
          />
          {secondary && (
            <Image
              src={secondary.url}
              alt={secondary.alt || product.name}
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              className="absolute inset-0 object-cover object-top opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            />
          )}

          <div className="absolute left-2 top-2 flex flex-col gap-1">
            {shown.map((b) => (
              <Badge key={b.key} variant={b.variant} size="sm">
                {b.label}
              </Badge>
            ))}
          </div>

          <div className="absolute right-2 top-2" onClick={(e) => e.stopPropagation()}>
            <WishlistButton productId={product.id} className="h-auto w-auto min-h-0 min-w-0 bg-transparent hover:bg-transparent" />
          </div>

          {!compact && (
            <div className="absolute bottom-0 left-0 right-0 flex h-10 translate-y-full items-center justify-center bg-white/90 transition-transform duration-300 group-hover:translate-y-0 dark:bg-black/90">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setQv(product.slug);
                }}
                className="font-body text-[10px] font-medium uppercase tracking-[0.12em] text-charcoal"
              >
                Quick View
              </button>
            </div>
          )}
        </div>

        <div className={cn("py-3", compact && "py-2")}>
          <h3
            className={cn(
              "font-body text-[13px] font-normal text-charcoal line-clamp-1",
              compact && "text-sm text-white",
            )}
          >
            {product.name}
          </h3>
          <div className={cn("mt-1", compact && "text-ivory")}>
            {product.isOnSale && lowestSale != null ? (
              <p className="font-body text-[12px] font-light">
                <span className="text-dark-grey line-through">From {formatN(lowestOrig)}</span>{" "}
                <span className="font-normal text-olive">{formatN(lowestSale)}</span>
              </p>
            ) : multi ? (
              <p className="font-body text-[12px] font-light text-charcoal">
                From <span className="font-normal">{formatN(lowestEff)}</span>
              </p>
            ) : (
              <p className="font-body text-[12px] font-light text-charcoal">{formatN(lowestEff)}</p>
            )}
          </div>

          {!compact && product.colors.length > 0 && (
            <div className="mt-1.5 flex items-center gap-1.5">
              {product.colors.slice(0, 4).map((c) => (
                <span
                  key={c.id}
                  className="h-2.5 w-2.5 rounded-full ring-1 ring-mid-grey"
                  style={{ backgroundColor: c.hex }}
                />
              ))}
              {product.colors.length > 4 && (
                <span className="text-xs text-dark-grey">+{product.colors.length - 4}</span>
              )}
            </div>
          )}
        </div>
      </div>

      <QuickViewModal productSlug={qv} onClose={() => setQv(null)} />
    </>
  );
}
