"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { WishlistButton } from "@/components/common/WishlistButton";
import { QuickViewModal } from "@/components/common/QuickViewModal";
import { convertFromNGN, formatPrice } from "@/lib/currency";
import { useCurrencyStore } from "@/store/currencyStore";
import { useCartStore } from "@/store/cartStore";
import { optimizeProductCardImageUrl } from "@/lib/product-image-url";
import { ImagePlaceholder } from "@/components/ui/ImagePlaceholder";
import type { ProductListItem } from "@/types/product";

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
  const addItem = useCartStore((s) => s.addItem);
  const [qv, setQv] = useState<string | null>(null);
  const [colorId, setColorId] = useState<string | null>(product.colors[0]?.id ?? null);
  const [sizeId, setSizeId] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [secondaryError, setSecondaryError] = useState(false);

  const selectedColor = useMemo(
    () => product.colors.find((c) => c.id === colorId) ?? product.colors[0] ?? null,
    [product.colors, colorId],
  );

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
  const oneSizeOnly =
    product.variants.length === 1 ||
    product.variants.every((v) => v.size.toLowerCase().replace(/\s/g, "") === "onesize");

  const primaryFromColor = selectedColor?.imageUrl?.trim();
  const primary = primaryFromColor
    ? { url: primaryFromColor, alt: product.name }
    : product.images[0];
  const secondary =
    !primaryFromColor && product.images[1]?.url ? product.images[1] : undefined;

  const formatN = (ngn: number) => formatPrice(convertFromNGN(ngn, currency, rates), currency);

  const showSaleBadge = product.isOnSale;
  const showNewBadge = product.isNewArrival && !showSaleBadge;

  const hasImage = Boolean(primary?.url?.trim()) && !imgError;
  const imgPrimary = primary?.url?.trim() ? optimizeProductCardImageUrl(primary.url) : "";
  const imgSecondary = secondary ? optimizeProductCardImageUrl(secondary.url) : null;

  const addToBag = (variant: ProductListItem["variants"][0]) => {
    if (variant.stock < 1) {
      toast.error("This size is sold out.");
      return;
    }
    const unit = variant.salePriceNGN ?? variant.priceNGN;
    const id = `${variant.id}-${selectedColor?.id ?? "none"}`;
    const imageUrl = (selectedColor?.imageUrl?.trim() || primary?.url || "") as string;
    addItem({
      id,
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      variantId: variant.id,
      size: variant.size,
      colorId: selectedColor?.id,
      color: selectedColor?.name,
      colorHex: selectedColor?.hex,
      imageUrl,
      priceNGN: unit,
      priceUSD: convertFromNGN(unit, "USD", rates),
      priceGBP: convertFromNGN(unit, "GBP", rates),
      quantity: 1,
      stock: variant.stock,
      category: product.category,
    });
    toast.success("Added to bag ✓");
  };

  return (
    <>
      <article
        role="link"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter") router.push(`/shop/${product.slug}`);
        }}
        className={cn(
          "group relative flex h-full cursor-pointer flex-col overflow-hidden border border-sand/70 bg-bg-card transition-shadow duration-300 hover:shadow-[0_10px_32px_rgba(42,36,31,0.08)]",
          compact && "border-0 bg-transparent shadow-none hover:shadow-none",
        )}
      >
        <div
          className="relative aspect-[3/4] shrink-0 overflow-hidden bg-ivory-dark"
          onClick={() => router.push(`/shop/${product.slug}`)}
        >
          {hasImage ? (
            <Image
              src={imgPrimary}
              alt={primary?.alt || product.name}
              fill
              sizes="(max-width: 768px) 50vw, 33vw"
              className={cn(
                "object-cover object-top",
                secondary
                  ? "transition-opacity duration-500 ease-out group-hover:opacity-0"
                  : "transition-transform duration-700 ease-out group-hover:scale-[1.04]",
              )}
              priority={priority}
              onError={() => setImgError(true)}
            />
          ) : (
            <ImagePlaceholder className="absolute inset-0 h-full w-full" />
          )}
          {secondary && !secondaryError && (
            <Image
              src={imgSecondary!}
              alt={secondary.alt || product.name}
              fill
              sizes="(max-width: 768px) 50vw, 33vw"
              className="absolute inset-0 object-cover object-top opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-100"
              onError={() => setSecondaryError(true)}
            />
          )}

          <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1">
            {showSaleBadge && (
              <span className="bg-olive px-2 py-0.5 font-body text-[9px] font-medium uppercase tracking-wide text-white">
                Sale
              </span>
            )}
            {showNewBadge && (
              <span className="bg-black px-2 py-0.5 font-body text-[9px] font-medium uppercase tracking-wide text-white">
                New
              </span>
            )}
          </div>

          <div className="absolute right-2 top-2" onClick={(e) => e.stopPropagation()}>
            <WishlistButton
              productId={product.id}
              className="h-8 min-h-[32px] w-8 min-w-[32px] bg-transparent hover:bg-transparent"
            />
          </div>

          {!compact && (
            <div
              className="absolute bottom-0 left-0 right-0 translate-y-full bg-bg-card px-4 pb-4 pt-4 transition-transform duration-[400ms] ease-[cubic-bezier(0.25,0.1,0.25,1)] group-hover:translate-y-0"
              onClick={(e) => e.stopPropagation()}
            >
              {oneSizeOnly ? (
                <button
                  type="button"
                  onClick={() => addToBag(product.variants[0])}
                  className="h-10 w-full bg-olive font-body text-[11px] font-medium uppercase tracking-[0.12em] text-white transition-opacity hover:opacity-90"
                >
                  Add to bag
                </button>
              ) : (
                <>
                  <div className="mb-2 flex flex-wrap gap-1">
                    {product.variants.map((v) => {
                      const active = sizeId === v.id;
                      const oos = v.stock < 1;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          disabled={oos}
                          onClick={() => setSizeId(v.id)}
                          className={cn(
                            "border px-2 py-1 font-body text-[10px] uppercase tracking-wide transition-colors",
                            active ? "border-olive bg-olive text-white" : "border-mid-grey text-charcoal",
                            oos && "opacity-40 line-through",
                          )}
                        >
                          {v.size}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    disabled={!sizeId || product.variants.find((v) => v.id === sizeId)?.stock === 0}
                    onClick={() => {
                      const v = product.variants.find((x) => x.id === sizeId);
                      if (v) addToBag(v);
                    }}
                    className="h-10 w-full bg-olive font-body text-[11px] font-medium uppercase tracking-[0.12em] text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Add to bag
                  </button>
                  <button
                    type="button"
                    onClick={() => setQv(product.slug)}
                    className="mt-2 w-full text-center font-body text-[10px] font-medium uppercase tracking-[0.14em] text-charcoal underline-offset-2 hover:text-olive hover:underline"
                  >
                    Quick view →
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <div
          onClick={() => router.push(`/shop/${product.slug}`)}
          className={cn(
            "flex flex-1 flex-col px-4 pb-5 pt-4 md:px-5 md:pb-6",
            compact && "px-0 py-2",
          )}
        >
          <h3
            className={cn(
              "line-clamp-2 font-serif text-[15px] leading-snug text-choc transition-colors duration-200 group-hover:text-nut md:text-base",
              compact && "line-clamp-1 font-body text-sm text-white group-hover:text-white",
            )}
          >
            {product.name}
          </h3>
          <div className={cn("mt-2.5", compact && "text-ivory")}>
            {product.isOnSale && lowestSale != null ? (
              <p className="flex flex-wrap items-baseline gap-2">
                <del className="font-body text-[12px] font-light text-text-light">{formatN(lowestOrig)}</del>
                <span className="font-body text-[13px] font-medium text-olive">{formatN(lowestSale)}</span>
              </p>
            ) : (
              <p className="font-body text-[13px] text-text-mid">
                {multi ? <span className="text-text-light">From </span> : null}
                <span className={cn("font-medium", compact ? "text-ivory" : "text-choc")}>
                  {formatN(lowestEff)}
                </span>
              </p>
            )}
          </div>

          {!compact && product.colors.length > 0 && (
            <div
              className="mt-auto flex flex-wrap items-center gap-2 pt-4"
              onClick={(e) => e.stopPropagation()}
            >
              {product.colors.slice(0, 4).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-label={c.name}
                  title={c.name}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setColorId(c.id);
                  }}
                  className={cn(
                    "h-3.5 w-3.5 rounded-full ring-1 ring-mid-grey transition-[box-shadow,transform] duration-150 hover:scale-110 hover:ring-charcoal md:h-4 md:w-4",
                    colorId === c.id && "ring-2 ring-choc ring-offset-2 ring-offset-bg-card",
                  )}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
              {product.colors.length > 4 && (
                <span className="font-body text-[11px] text-text-light">+{product.colors.length - 4}</span>
              )}
            </div>
          )}
        </div>
      </article>

      <QuickViewModal productSlug={qv} onClose={() => setQv(null)} />
    </>
  );
}
