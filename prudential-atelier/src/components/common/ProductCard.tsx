"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { WishlistButton } from "@/components/common/WishlistButton";
import {
  QuickAddDesktopChrome,
  QuickAddDesktopPriceSwap,
  QuickAddDesktopTrigger,
} from "@/components/common/quick-add/QuickAddDesktop";
import {
  QuickAddMobileClose,
  QuickAddMobileTrigger,
} from "@/components/common/quick-add/QuickAddMobile";
import { convertFromNGN, formatPrice } from "@/lib/currency";
import { useCurrencyStore } from "@/store/currencyStore";
import { useProductQuickAdd } from "@/hooks/useQuickAdd";
import { useIsMdUp } from "@/hooks/useMediaQuery";
import { optimizeProductCardImageUrl } from "@/lib/product-image-url";
import { ImagePlaceholder } from "@/components/ui/ImagePlaceholder";
import type { ProductListItem } from "@/types/product";

export interface ProductCardProps {
  product: ProductListItem;
  priority?: boolean;
  compact?: boolean;
  dimmed?: boolean;
}

function effectiveVariantPrice(v: ProductListItem["variants"][0]) {
  return v.salePriceNGN != null ? v.salePriceNGN : v.priceNGN;
}

export function ProductCard({ product, priority, compact, dimmed }: ProductCardProps) {
  const router = useRouter();
  const currency = useCurrencyStore((s) => s.currency);
  const rates = useCurrencyStore((s) => s.rates);
  const [colorId, setColorId] = useState<string | null>(product.colors[0]?.id ?? null);
  const [imgError, setImgError] = useState(false);
  const [secondaryError, setSecondaryError] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const selectedColor = useMemo(
    () => product.colors.find((c) => c.id === colorId) ?? product.colors[0] ?? null,
    [product.colors, colorId],
  );

  const qa = useProductQuickAdd(product, selectedColor);
  const isMd = useIsMdUp();

  const prices = product.variants.map((v) => ({
    orig: v.priceNGN,
    sale: v.salePriceNGN,
    eff: effectiveVariantPrice(v),
  }));
  const lowestOrig = prices.length ? Math.min(...prices.map((p) => p.orig)) : 0;
  const salePrices = prices.map((p) => p.sale).filter((x): x is number => x != null);
  const lowestSale = salePrices.length ? Math.min(...salePrices) : null;
  const lowestEff = prices.length ? Math.min(...prices.map((p) => p.eff)) : 0;
  const multi = product.variants.length > 1;

  const gallery = product.images.filter((im) => im.url?.trim());
  const primaryFromColor = selectedColor?.imageUrl?.trim();
  const primary = primaryFromColor
    ? { url: primaryFromColor, alt: product.name }
    : gallery[galleryIndex] ?? gallery[0];
  const secondary =
    !primaryFromColor && galleryIndex === 0 && gallery[1]?.url ? gallery[1] : undefined;

  const formatN = (ngn: number) => formatPrice(convertFromNGN(ngn, currency, rates), currency);

  const showSaleBadge = product.isOnSale;
  const showNewBadge = product.isNewArrival && !showSaleBadge;

  const hasImage = Boolean(primary?.url?.trim()) && !imgError;
  const imgPrimary = primary?.url?.trim() ? optimizeProductCardImageUrl(primary.url) : "";
  const imgSecondary = secondary ? optimizeProductCardImageUrl(secondary.url) : null;

  const goToProduct = () => router.push(`/shop/${product.slug}`);

  const priceBlock = (
    <>
      {product.isOnSale && lowestSale != null ? (
        <p className="flex flex-wrap items-baseline gap-2">
          <del className="font-body text-[12px] font-light text-text-light">{formatN(lowestOrig)}</del>
          <span className="font-body text-[13px] font-medium text-choc">{formatN(lowestSale)}</span>
        </p>
      ) : (
        <p className="font-body text-[13px] text-text-mid">
          {multi ? <span className="text-text-light">From </span> : null}
          <span className={cn("font-medium", compact ? "text-ivory" : "text-choc")}>
            {formatN(lowestEff)}
          </span>
        </p>
      )}
    </>
  );

  if (compact) {
    return (
      <article
        role="link"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter") goToProduct();
        }}
        onClick={goToProduct}
        className="group relative flex h-full cursor-pointer flex-col overflow-hidden"
      >
        <div className="relative aspect-[3/4] shrink-0 overflow-hidden bg-ivory-dark">
          {hasImage ? (
            <Image
              src={imgPrimary}
              alt={primary?.alt || product.name}
              fill
              sizes="(max-width: 768px) 50vw, 33vw"
              className="object-cover object-top"
              priority={priority}
              onError={() => setImgError(true)}
            />
          ) : (
            <ImagePlaceholder className="absolute inset-0 h-full w-full" />
          )}
        </div>
        <div className="px-0 py-2">
          <h3 className="line-clamp-1 font-body text-sm text-white">{product.name}</h3>
          <div className="mt-1 text-ivory">{priceBlock}</div>
        </div>
      </article>
    );
  }

  const cycle = (dir: -1 | 1) => {
    if (gallery.length < 2) return;
    setGalleryIndex((i) => (i + dir + gallery.length) % gallery.length);
  };

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden border border-sand/70 bg-bg-card transition-shadow duration-300",
        "hover:shadow-[0_10px_32px_rgba(42,36,31,0.08)]",
      )}
    >
      <div
        className="relative aspect-[3/4] shrink-0 cursor-pointer overflow-hidden bg-ivory-dark"
        onClick={goToProduct}
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
                ? "transition-opacity duration-500 ease-out [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-0"
                : "transition-transform duration-700 ease-out [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-[1.04]",
            )}
            priority={priority}
            onError={() => setImgError(true)}
          />
        ) : (
          <ImagePlaceholder className="absolute inset-0 h-full w-full" />
        )}
        {secondary && !secondaryError ? (
          <Image
            src={imgSecondary!}
            alt={secondary.alt || product.name}
            fill
            sizes="(max-width: 768px) 50vw, 33vw"
            className="absolute inset-0 object-cover object-top opacity-0 transition-opacity duration-500 ease-out [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100"
            onError={() => setSecondaryError(true)}
          />
        ) : null}

        <div className="pointer-events-none absolute left-3 top-3 z-[1] flex flex-col gap-1">
          {showSaleBadge ? (
            <span className="bg-choc px-2 py-0.5 font-body text-[9px] font-medium uppercase tracking-wide text-cream">
              Sale
            </span>
          ) : null}
          {showNewBadge ? (
            <span className="bg-choc px-2 py-0.5 font-body text-[9px] font-medium uppercase tracking-wide text-cream">
              New
            </span>
          ) : null}
        </div>

        {dimmed || qa.isOpen ? (
          <div
            className={cn(
              "pointer-events-none absolute inset-0 z-[1] transition-opacity duration-200 md:hidden",
              dimmed && !qa.isOpen && "bg-choc/50",
              qa.isOpen && "bg-choc/25",
            )}
            aria-hidden
          />
        ) : null}

        <div
          className={cn("absolute right-2 top-2 z-10", qa.isOpen && "max-md:hidden")}
          onClick={(e) => e.stopPropagation()}
        >
          <WishlistButton
            productId={product.id}
            className="h-8 min-h-[32px] w-8 min-w-[32px] bg-transparent hover:bg-transparent"
          />
        </div>

        {!qa.soldOut ? (
          <QuickAddDesktopChrome
            product={product}
            isOpen={qa.isOpen}
            phase={qa.phase}
            variantId={qa.variantId}
            onSelectSize={qa.selectSize}
            imageCount={gallery.length}
            onPrev={() => cycle(-1)}
            onNext={() => cycle(1)}
            autoFocus={isMd}
          />
        ) : gallery.length > 1 ? (
          <QuickAddDesktopChrome
            product={product}
            isOpen={false}
            phase="idle"
            variantId={null}
            onSelectSize={() => {}}
            imageCount={gallery.length}
            onPrev={() => cycle(-1)}
            onNext={() => cycle(1)}
          />
        ) : null}

        <QuickAddMobileTrigger
          productName={product.name}
          productId={product.id}
          soldOut={qa.soldOut}
          isOpen={qa.isOpen}
          onOpen={qa.open}
        />
        {qa.isOpen ? (
          <QuickAddMobileClose productName={product.name} onClose={qa.close} />
        ) : null}
      </div>

      <div
        className="relative flex flex-1 cursor-pointer flex-col px-4 pb-5 pt-4 md:px-5 md:pb-6"
        onClick={goToProduct}
      >
        {qa.soldOut ? null : (
          <QuickAddDesktopTrigger product={product} isOpen={qa.isOpen} onOpen={qa.open} />
        )}

        <h3 className="line-clamp-2 font-serif text-[15px] leading-snug text-choc transition-colors duration-200 group-hover:text-nut md:text-base">
          {product.name}
        </h3>

        {qa.soldOut ? (
          <>
            <div className="mt-2.5">{priceBlock}</div>
            <p className="mt-1 hidden font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-text-light md:block">
              Sold out
            </p>
          </>
        ) : (
          <>
            <div className="mt-2.5 md:hidden">{priceBlock}</div>
            <QuickAddDesktopPriceSwap
              isOpen={qa.isOpen}
              phase={qa.phase}
              ctaLabel={qa.ctaLabel}
              error={qa.error}
              onAdd={() => void qa.add()}
            >
              {priceBlock}
            </QuickAddDesktopPriceSwap>
          </>
        )}

        {product.colors.length > 0 ? (
          <div
            data-quick-add="colors"
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
            {product.colors.length > 4 ? (
              <span className="font-body text-[11px] text-text-light">+{product.colors.length - 4}</span>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
