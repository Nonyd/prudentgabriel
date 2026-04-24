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
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='1067'%3E%3Crect width='100%25' height='100%25' fill='%23E8DDD0'/%3E%3C/svg%3E";

export interface ProductCardProps {
  product: ProductListItem;
  priority?: boolean;
  /** Minimal layout for search modal featured grid */
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
        className={cn(
          "group relative cursor-pointer transition-all duration-250",
          !compact && "hover:-translate-y-1 hover:shadow-lg",
        )}
      >
        <div className="relative aspect-[3/4] overflow-hidden rounded-sm bg-ivory-dark">
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
            <WishlistButton productId={product.id} className="bg-cream/80 backdrop-blur-sm" />
          </div>

          {!compact && (
            <div className="absolute bottom-0 left-0 right-0 translate-y-full bg-gradient-to-t from-charcoal/80 to-transparent transition-transform duration-300 group-hover:translate-y-0">
              <div className="flex justify-center pb-4 pt-10">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setQv(product.slug);
                  }}
                  className="rounded-sm border border-ivory/60 px-4 py-2 font-label text-[11px] uppercase tracking-wider text-ivory transition-colors hover:border-ivory"
                >
                  Quick View
                </button>
              </div>
            </div>
          )}
        </div>

        <div className={cn("py-3", compact && "py-2")}>
          <h3
            className={cn(
              "font-display text-charcoal line-clamp-1",
              compact ? "text-sm text-ivory" : "text-base",
            )}
          >
            {product.name}
          </h3>
          <div className={cn("mt-1", compact && "text-ivory")}>
            {product.isOnSale && lowestSale != null ? (
              <p className="text-sm">
                <span className="text-charcoal-light line-through">From {formatN(lowestOrig)}</span>{" "}
                <span className="font-medium text-wine">{formatN(lowestSale)}</span>
              </p>
            ) : multi ? (
              <p className="text-sm text-charcoal">
                From <span className="font-medium">{formatN(lowestEff)}</span>
              </p>
            ) : (
              <p className="text-sm font-medium text-charcoal">{formatN(lowestEff)}</p>
            )}
          </div>

          {!compact && product.colors.length > 0 && (
            <div className="mt-2 flex items-center gap-1">
              {product.colors.slice(0, 4).map((c) => (
                <span
                  key={c.id}
                  title={c.name}
                  className="h-3 w-3 rounded-full ring-1 ring-border"
                  style={{ backgroundColor: c.hex }}
                />
              ))}
              {product.colors.length > 4 && (
                <span className="text-xs text-charcoal-light">+{product.colors.length - 4}</span>
              )}
            </div>
          )}
        </div>
      </div>

      <QuickViewModal productSlug={qv} onClose={() => setQv(null)} />
    </>
  );
}
