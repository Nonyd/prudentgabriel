"use client";

import { useId, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { WishlistButton } from "@/components/common/WishlistButton";
import {
  QuickAddDesktopChrome,
  QuickAddDesktopPriceSwap,
  QuickAddDesktopSizes,
  QuickAddDesktopTrigger,
} from "@/components/common/quick-add/QuickAddDesktop";
import {
  QuickAddMobileClose,
  QuickAddMobileTrigger,
} from "@/components/common/quick-add/QuickAddMobile";
import { formatPrice } from "@/lib/currency";
import { useCurrencyStore } from "@/store/currencyStore";
import { useProductQuickAdd } from "@/hooks/useQuickAdd";
import { useIsMdUp } from "@/hooks/useMediaQuery";
import { ProductCardImageSwipe } from "@/components/common/ProductCardImageSwipe";
import { optimizeProductCardImageUrl } from "@/lib/product-image-url";
import { canGalleryHoverSwap, swipeableGallery } from "@/lib/product-gallery";
import { ImagePlaceholder } from "@/components/ui/ImagePlaceholder";
import type { ProductListItem } from "@/types/product";
import { minAmountInCurrency } from "@/lib/pricing";

export interface ProductCardProps {
  product: ProductListItem;
  priority?: boolean;
  compact?: boolean;
  dimmed?: boolean;
  merchBadge?: string;
}

export function ProductCard({ product, priority, compact, dimmed, merchBadge }: ProductCardProps) {
  const router = useRouter();
  const nameId = useId();
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

  const saleOn = product.isOnSale && product.variants.some((v) => v.salePriceNGN != null);
  const lowestEffShopper = minAmountInCurrency(product.variants, product, currency, rates);
  const multi = product.variants.length > 1;

  const gallery = product.images.filter((im) => im.url?.trim());
  const primaryFromColor = selectedColor?.imageUrl?.trim();
  const primary = primaryFromColor
    ? { url: primaryFromColor, alt: product.name }
    : gallery[galleryIndex] ?? gallery[0];
  const canSwap = canGalleryHoverSwap(gallery.length) && !primaryFromColor && galleryIndex === 0;
  const secondary = canSwap && gallery[1]?.url ? gallery[1] : undefined;
  const swipeImages = primaryFromColor
    ? [{ url: primaryFromColor, alt: product.name }]
    : swipeableGallery(gallery);
  const mobileSwipe = !isMd && swipeImages.length >= 2;

  const lowestListShopper = minAmountInCurrency(
    product.variants,
    { ...product, isOnSale: false },
    currency,
    rates,
  );

  const formatShopper = (n: number) => formatPrice(n, currency);

  const showSaleBadge = product.isOnSale;
  const showNewBadge = product.isNewArrival && !showSaleBadge;

  const hasImage = Boolean(primary?.url?.trim()) && !imgError;
  const imgPrimary = primary?.url?.trim() ? optimizeProductCardImageUrl(primary.url) : "";
  const imgSecondary = secondary ? optimizeProductCardImageUrl(secondary.url) : null;
  const garmentAlt = primary?.alt?.trim() || product.name;

  const goToProduct = () => router.push(`/shop/${product.slug}`);

  const priceBlock = (
    <>
      {saleOn ? (
        <p className="flex flex-wrap items-baseline gap-2">
          <del className="font-body text-[12px] font-light text-text-light">{formatShopper(lowestListShopper)}</del>
          <span className="font-body text-[13px] font-medium text-choc">{formatShopper(lowestEffShopper)}</span>
        </p>
      ) : (
        <p className="font-body text-[13px] text-text-mid">
          {multi ? <span className="text-text-light">From </span> : null}
          <span className={cn("font-medium", compact ? "text-ivory" : "text-choc")}>
            {formatShopper(lowestEffShopper)}
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
              alt={garmentAlt}
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
      className="product-gallery-card group"
      data-gallery-card=""
      data-gallery-open={qa.isOpen ? "true" : undefined}
    >
      <div className="product-gallery-shot">
        {mobileSwipe ? (
          <ProductCardImageSwipe
            href={`/shop/${product.slug}`}
            productName={product.name}
            images={swipeImages}
            priority={priority}
            enableQuickAddHit={!qa.soldOut && !qa.isOpen}
            onQuickAdd={qa.open}
          />
        ) : (
          <Link
            href={`/shop/${product.slug}`}
            aria-labelledby={nameId}
            className="absolute inset-0 z-[1] block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-cream"
          >
            {hasImage ? (
              <Image
                src={imgPrimary}
                alt={garmentAlt}
                fill
                sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className={cn(
                  "object-cover object-top",
                  secondary ? "product-gallery-crossfade [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-focus-within:opacity-0" : null,
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
                alt=""
                fill
                sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="product-gallery-crossfade absolute inset-0 object-cover object-top opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:group-focus-within:opacity-100"
                onError={() => setSecondaryError(true)}
              />
            ) : null}
          </Link>
        )}

        <div className="product-gallery-scrim" aria-hidden />

        <div className="pointer-events-none absolute left-3 top-3 z-[2] flex flex-col items-start gap-1">
          {merchBadge ? (
            <span className="product-gallery-merch-badge px-2 py-0.5 font-sans text-[9px] font-semibold uppercase tracking-[0.14em]">
              {merchBadge}
            </span>
          ) : null}
          <div className="product-gallery-hover-only flex flex-col gap-1">
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
          className={cn("product-gallery-hover-only absolute right-2 top-2 z-10", qa.isOpen && "max-md:hidden")}
          onClick={(e) => e.stopPropagation()}
        >
          <WishlistButton
            productId={product.id}
            className="h-8 min-h-[32px] w-8 min-w-[32px] bg-transparent hover:bg-transparent md:bg-choc/40 [&_svg]:text-choc md:[&_svg]:text-cream"
          />
        </div>

        <QuickAddDesktopChrome imageCount={gallery.length} onPrev={() => cycle(-1)} onNext={() => cycle(1)} />

        <QuickAddMobileTrigger
          productName={product.name}
          productId={product.id}
          soldOut={qa.soldOut}
          isOpen={qa.isOpen}
          onOpen={qa.open}
          passThroughSwipe={mobileSwipe}
        />
        {qa.isOpen ? (
          <QuickAddMobileClose productName={product.name} onClose={qa.close} />
        ) : null}
      </div>

      <div className="product-gallery-meta" onClick={goToProduct}>
        {!qa.soldOut && !qa.isOpen ? (
          <div className="mb-3 hidden justify-center md:flex">
            <QuickAddDesktopTrigger product={product} isOpen={qa.isOpen} onOpen={qa.open} />
          </div>
        ) : null}
        <h3
          id={nameId}
          className="product-gallery-name line-clamp-2 font-serif text-[15px] leading-snug text-choc md:text-base"
        >
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
            <QuickAddDesktopSizes
              product={product}
              isOpen={qa.isOpen}
              phase={qa.phase}
              variantId={qa.variantId}
              onSelectSize={qa.selectSize}
              autoFocus={isMd}
            />
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
