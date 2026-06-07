"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { cn, optimizeImageUrl } from "@/lib/utils";
import { PRODUCT_IMAGE_PLACEHOLDER } from "@/lib/product-image-url";
import { convertFromNGN, formatPrice } from "@/lib/currency";
import { useCurrencyStore } from "@/store/currencyStore";
import { useCartStore } from "@/store/cartStore";
import type { ProductListItem } from "@/types/product";

export interface RTWProductCardProps {
  product: ProductListItem;
  priority?: boolean;
}

function effectiveVariantPrice(v: ProductListItem["variants"][0]) {
  return v.salePriceNGN != null ? v.salePriceNGN : v.priceNGN;
}

export function RTWProductCard({ product, priority }: RTWProductCardProps) {
  const router = useRouter();
  const currency = useCurrencyStore((s) => s.currency);
  const rates = useCurrencyStore((s) => s.rates);
  const addItem = useCartStore((s) => s.addItem);
  const [colorId, setColorId] = useState<string | null>(product.colors[0]?.id ?? null);
  const [sizeId, setSizeId] = useState<string | null>(null);

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

  const imgPrimary = optimizeImageUrl(primary?.url || PRODUCT_IMAGE_PLACEHOLDER, 600);
  const imgSecondary = secondary?.url ? optimizeImageUrl(secondary.url, 600) : null;

  const addToBag = (variant: ProductListItem["variants"][0]) => {
    if (variant.stock < 1) {
      toast.error("This size is sold out.");
      return;
    }
    const unit = variant.salePriceNGN ?? variant.priceNGN;
    const id = `${variant.id}-${selectedColor?.id ?? "none"}`;
    const imageUrl =
      (selectedColor?.imageUrl?.trim() || primary?.url || PRODUCT_IMAGE_PLACEHOLDER) as string;
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

  const goToProduct = () => {
    router.push(`/shop/${product.slug}`);
  };

  return (
    <article
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") goToProduct();
      }}
      className="group relative flex h-full cursor-pointer flex-col overflow-hidden border border-sand/70 bg-bg-card transition-shadow duration-300 hover:shadow-[0_10px_32px_rgba(42,36,31,0.08)]"
    >
      <div
        className="relative aspect-[3/4] shrink-0 overflow-hidden bg-ivory-dark"
        onClick={goToProduct}
      >
        <Image
          src={imgPrimary}
          alt={primary?.alt || product.name}
          fill
          sizes="(max-width: 768px) 50vw, 25vw"
          quality={85}
          className={cn(
            "object-cover object-top",
            imgSecondary
              ? "transition-opacity duration-500 ease-out group-hover:opacity-0"
              : "transition-transform duration-700 ease-out group-hover:scale-[1.03]",
          )}
          priority={priority}
        />
        {imgSecondary && (
          <Image
            src={imgSecondary}
            alt={secondary?.alt || product.name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            quality={85}
            className="absolute inset-0 object-cover object-top opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-100"
          />
        )}

        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1">
          {showSaleBadge && (
            <span className="bg-olive px-2 py-0.5 font-body text-[9px] font-medium uppercase tracking-wide text-white">
              Sale
            </span>
          )}
          {showNewBadge && (
            <span className="bg-choc px-2 py-0.5 font-body text-[9px] font-medium uppercase tracking-wide text-cream">
              New
            </span>
          )}
        </div>

        <div
          className="absolute bottom-0 left-0 right-0 translate-y-full border-t border-sand/60 bg-bg-card px-4 py-3.5 transition-transform duration-[400ms] ease-[cubic-bezier(0.25,0.1,0.25,1)] group-hover:translate-y-0"
          onClick={(e) => e.stopPropagation()}
        >
          {oneSizeOnly ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                addToBag(product.variants[0]);
              }}
              className="h-10 w-full bg-choc font-body text-[10px] font-medium uppercase tracking-[0.12em] text-cream transition-opacity hover:opacity-90"
            >
              Add to bag
            </button>
          ) : (
            <>
              <div className="mb-2.5 flex flex-wrap gap-1.5">
                {product.variants.map((v) => {
                  const active = sizeId === v.id;
                  const oos = v.stock < 1;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      disabled={oos}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSizeId(v.id);
                      }}
                      className={cn(
                        "min-w-[2rem] border px-2.5 py-1 font-body text-[10px] uppercase tracking-wide transition-colors",
                        active ? "border-choc bg-choc text-cream" : "border-mid-grey text-charcoal",
                        oos && "cursor-not-allowed opacity-30 line-through",
                        !oos && !active && "hover:border-choc",
                      )}
                    >
                      {v.size}
                    </button>
                  );
                })}
              </div>
              {!sizeId ? (
                <p className="text-center font-body text-[10px] font-medium uppercase tracking-[0.12em] text-text-light">
                  Select a size
                </p>
              ) : (
                <button
                  type="button"
                  disabled={(product.variants.find((x) => x.id === sizeId)?.stock ?? 0) < 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    const v = product.variants.find((x) => x.id === sizeId);
                    if (v) addToBag(v);
                  }}
                  className="h-10 w-full bg-choc font-body text-[10px] font-medium uppercase tracking-[0.12em] text-cream transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Add to bag
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col px-4 pb-5 pt-4 md:px-5 md:pb-6" onClick={goToProduct}>
        <h3 className="line-clamp-2 font-serif text-[15px] leading-snug text-choc transition-colors duration-200 group-hover:text-nut md:text-base">
          {product.name}
        </h3>

        <div className="mt-2.5">
          {product.isOnSale && lowestSale != null ? (
            <p className="flex flex-wrap items-baseline gap-2">
              <del className="font-body text-[12px] font-light text-text-light">{formatN(lowestOrig)}</del>
              <span className="font-body text-[13px] font-medium text-olive">{formatN(lowestSale)}</span>
            </p>
          ) : (
            <p className="font-body text-[13px] text-text-mid">
              {multi ? <span className="text-text-light">From </span> : null}
              <span className="font-medium text-choc">{formatN(lowestEff)}</span>
            </p>
          )}
        </div>

        {product.colors.length > 0 && (
          <div
            className="mt-auto flex flex-wrap items-center gap-2 pt-4"
            onClick={(e) => e.stopPropagation()}
          >
            {product.colors.slice(0, 5).map((c) => (
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
            {product.colors.length > 5 && (
              <span className="font-body text-[11px] text-text-light">+{product.colors.length - 5}</span>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
