"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import * as Accordion from "@radix-ui/react-accordion";
import { Button } from "@/components/ui/Button";
import { Divider } from "@/components/ui/Divider";
import { StarRating } from "@/components/ui/StarRating";
import { CountdownTimer } from "@/components/ui/CountdownTimer";
import { ProductGallery } from "@/components/product/ProductGallery";
import { PriceDisplay } from "@/components/product/PriceDisplay";
import { WishlistButton } from "@/components/common/WishlistButton";
import { StockAlertForm } from "@/components/common/StockAlertForm";
import { SizeGuideModal } from "@/components/shop/SizeGuideModal";
import { QuickAddSizeRow } from "@/components/common/quick-add/QuickAddSizeRow";
import { CustomMeasurementsForm, typedFromForm } from "@/components/product/CustomMeasurementsForm";
import { sanitizeCmsHtml } from "@/lib/sanitize-html";
import { useBagActions } from "@/hooks/useBagActions";
import { formatPrice } from "@/lib/currency";
import {
  hasPurchasableSize,
  pickVariantForAdd,
  stockGuardMessage,
} from "@/lib/quick-add";
import { CUSTOM_LEAD_COPY, CUSTOM_RETURNS_COPY, customSurchargeNGN, standardVariants, validateCustomMeasurements } from "@/lib/custom-size";
import { isCustomOfferedNow, PDP_INITIAL_FIT_MODE } from "@/lib/custom-availability";
import { productAisle } from "@/lib/rtw-aisle";
import type { MeasurementFieldDef } from "@/lib/custom-size";
import { displayAmountInCurrency, effectiveUnitNGN, variantAmountInCurrency } from "@/lib/pricing";
import { useCurrencyStore } from "@/store/currencyStore";
import type { ProductType } from "@prisma/client";
import type { ProductListItem, ProductListVariant } from "@/types/product";
import type { TypedUnit } from "@/lib/sizing";
interface DetailProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  details: string | null;
  category: string;
  type: ProductType;
  isOnSale: boolean;
  saleEndsAt: string | null;
  isBespokeAvail: boolean;
  lowStockAt: number;
  basePriceNGN: number;
  priceUSD: number | null;
  priceGBP: number | null;
  isNewArrival: boolean;
  isFeatured: boolean;
  tags: string[];
  images: { id: string; url: string; alt: string | null }[];
  variants: ProductListVariant[];
  colors: { id: string; name: string; hex: string }[];
}

interface ProductDetailClientProps {
  product: DetailProduct;
  averageRating: number;
  reviewCount: number;
  freeLagosAboveNGN?: number | null;
  bespokeFromNGN?: number | null;
  customOffered?: boolean;
  customOfferedWhenSoldOut?: boolean;
  customFields?: MeasurementFieldDef[];
  customLeadTimeDays?: number;
  customReturnable?: boolean;
  customSurchargeKind?: "NONE" | "PERCENT" | "FLAT";
  customSurchargeValue?: number;
  previousCm?: Record<string, number>;
}

export function ProductDetailClient({
  product,
  averageRating,
  reviewCount,
  freeLagosAboveNGN = null,
  bespokeFromNGN = null,
  customOffered = false,
  customOfferedWhenSoldOut = false,
  customFields = [],
  customLeadTimeDays = 21,
  customReturnable = false,
  customSurchargeKind = "NONE",
  customSurchargeValue = 0,
  previousCm = {},
}: ProductDetailClientProps) {
  const [variantId, setVariantId] = useState<string | null>(null);
  const [colorId, setColorId] = useState<string | null>(product.colors[0]?.id ?? null);
  const [qty, setQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [bagError, setBagError] = useState<string | null>(null);
  const [fitMode, setFitMode] = useState<"standard" | "custom">(PDP_INITIAL_FIT_MODE);
  const [measureUnit, setMeasureUnit] = useState<TypedUnit>("cm");
  const [measureValues, setMeasureValues] = useState<Record<string, string>>({});
  const { addToBag } = useBagActions();
  const rates = useCurrencyStore((s) => s.rates);
  const currency = useCurrencyStore((s) => s.currency);

  const variant = useMemo(
    () => pickVariantForAdd(product.variants, variantId),
    [product.variants, variantId],
  );
  const standardSizes = useMemo(() => standardVariants(product.variants), [product.variants]);
  const sizesSoldOut = !hasPurchasableSize(standardSizes);
  const aisle = productAisle(product);
  const customAvailable = isCustomOfferedNow({
    customOffered,
    customOfferedWhenSoldOut,
    variants: product.variants,
  });
  const soldOut = sizesSoldOut && !customAvailable;
  const customSurcharge = customSurchargeNGN({
    unitNGN: product.basePriceNGN,
    kind: customSurchargeKind,
    value: customSurchargeValue,
  });
  const customPriceNGN = product.basePriceNGN + customSurcharge;
  const priceLabel = formatPrice(
    fitMode === "custom"
      ? customPriceNGN * (currency === "NGN" ? 1 : currency === "USD" ? rates.USD : rates.GBP)
      : displayAmountInCurrency(product.variants, variantId, product, currency, rates),
    currency,
  );
  const ctaLabel = soldOut
    ? `Sold out · ${priceLabel}`
    : fitMode === "custom"
      ? `Add to bag · ${priceLabel}`
      : !variant
        ? `Select Size · ${priceLabel}`
        : `Add to bag · ${priceLabel}`;
  const color = product.colors.find((c) => c.id === colorId) ?? null;

  const productLike: ProductListItem = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    category: product.category as ProductListItem["category"],
    type: product.type,
    basePriceNGN: product.basePriceNGN,
    priceUSD: product.priceUSD,
    priceGBP: product.priceGBP,
    isOnSale: product.isOnSale,
    isNewArrival: product.isNewArrival,
    isBespokeAvail: product.isBespokeAvail,
    isFeatured: product.isFeatured,
    tags: product.tags,
    images: product.images.map((im, i) => ({
      url: im.url,
      alt: im.alt,
      isPrimary: i === 0,
    })),
    variants: product.variants,
    colors: product.colors,
    _count: { reviews: reviewCount },
  };

  const lowStock =
    variant && variant.stock > 0 && variant.stock <= (variant.lowStockAt ?? 3) ? variant.stock : 0;

  const addToBagClick = async () => {
    if (soldOut || submitting) return;
    if (fitMode === "custom") {
      if (!customAvailable || !customFields.length) {
        setBagError("Custom measurements are not available for this piece.");
        return;
      }
      const typed = typedFromForm(customFields, measureValues, measureUnit);
      const checked = validateCustomMeasurements(customFields, typed);
      if (!checked.ok) {
        setBagError(checked.errors[0]?.message ?? "Check your measurements");
        return;
      }
      setBagError(null);
      setSubmitting(true);
      try {
        const result = await addToBag(
          {
            id: `custom:${product.id}-${color?.id ?? "none"}`,
            productId: product.id,
            productName: product.name,
            productSlug: product.slug,
            variantId: `custom:${product.id}`,
            size: "Custom",
            colorId: color?.id,
            color: color?.name,
            colorHex: color?.hex,
            imageUrl: product.images[0]?.url ?? "",
            priceNGN: customPriceNGN,
            priceUSD: customPriceNGN * rates.USD,
            priceGBP: customPriceNGN * rates.GBP,
            quantity: 1,
            stock: 999,
            category: product.category,
            sizeMode: "CUSTOM",
            measurements: checked.snapshot,
            typedUnit: measureUnit,
            surchargeNGN: customSurcharge,
            customLeadTimeDays,
            customReturnable,
          },
          { toastOnError: false },
        );
        if (!result.ok) setBagError(result.error);
      } catch {
        setBagError("Could not add to bag.");
      } finally {
        setSubmitting(false);
      }
      return;
    }
    if (!variant) {
      setBagError("Select a size.");
      return;
    }
    if (variant.stock < 1) {
      setBagError("That size just sold out.");
      return;
    }
    setBagError(null);
    setSubmitting(true);
    try {
      const unit = effectiveUnitNGN(variant, product.isOnSale);
      const result = await addToBag(
        {
          id: `${variant.id}-${color?.id ?? "none"}`,
          productId: product.id,
          productName: product.name,
          productSlug: product.slug,
          variantId: variant.id,
          size: variant.size,
          colorId: color?.id,
          color: color?.name,
          colorHex: color?.hex,
          imageUrl: product.images[0]?.url ?? "",
          priceNGN: unit,
          priceUSD: variantAmountInCurrency(variant, product, "USD", rates),
          priceGBP: variantAmountInCurrency(variant, product, "GBP", rates),
          quantity: Math.min(qty, variant.stock),
          stock: variant.stock,
          category: product.category,
        },
        { toastOnError: false },
      );
      if (!result.ok) {
        setBagError(stockGuardMessage(result.error));
      }
    } catch {
      setBagError(stockGuardMessage(null));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-site overflow-x-clip px-4 pb-20 lg:px-10">
      <nav className="py-4 font-body text-[11px] font-medium uppercase tracking-[0.08em] text-dark-grey">
        <Link href={aisle.href} className="hover:text-choc">
          {aisle.label}
        </Link>
        <span className="mx-2">/</span>
        <span>{String(product.category).replace(/_/g, " ")}</span>
        <span className="mx-2">/</span>
        <span className="text-charcoal">{product.name}</span>
      </nav>

      <div className="grid min-w-0 gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-12">
        <div className="min-w-0">
          <ProductGallery images={product.images} />
        </div>

        <div className="min-w-0 lg:sticky lg:top-32 lg:self-start">
          <p className="mb-1 font-body text-[10px] font-medium uppercase tracking-[0.2em] text-lightbr">
            Prudent Gabriel
          </p>
          <p className="mb-4 font-body text-[10px] font-medium uppercase tracking-[0.14em] text-text-light">
            {String(product.category).replace(/_/g, " ")}
          </p>
          <h1 className="font-display text-[36px] font-normal leading-[1.1] text-choc md:text-[42px]">
            {product.name}
          </h1>

          <button
            type="button"
            className="mt-4 flex items-center gap-2 text-left"
            onClick={() => document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth" })}
          >
            <StarRating rating={averageRating} size="sm" />
            <span className="text-sm text-charcoal-mid">
              {averageRating.toFixed(1)} ({reviewCount} reviews)
            </span>
          </button>

          <Divider className="my-6" />

          <PriceDisplay product={productLike} selectedVariant={variant} />

          {product.saleEndsAt && product.isOnSale && (
            <CountdownTimer endsAt={product.saleEndsAt} className="mt-2" />
          )}

          <Divider className="my-6" />

          {product.colors.length > 0 && (
            <div className="mb-6">
              <p className="font-label text-xs uppercase text-charcoal-mid">
                Colour: {color?.name ?? "—"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {product.colors.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setColorId(c.id)}
                    aria-label={c.name}
                    aria-pressed={colorId === c.id}
                    className="h-5 w-5 rounded-full ring-1 ring-offset-2 ring-offset-white transition-shadow"
                    style={{
                      backgroundColor: c.hex,
                      boxShadow: colorId === c.id ? "0 0 0 1px var(--charcoal)" : undefined,
                    }}
                    title={c.name}
                  />
                ))}
              </div>
            </div>
          )}

          {customAvailable ? (
            <div className="mb-6 min-w-0">
              <p className="mb-3 font-body text-base font-medium text-charcoal">How should this piece be made?</p>
              <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setFitMode("standard");
                    setBagError(null);
                  }}
                  className={`min-h-[6.25rem] min-w-0 border-2 px-4 py-4 text-left ${
                    fitMode === "standard" ? "border-choc bg-choc text-cream" : "border-choc/30 bg-white text-charcoal"
                  }`}
                >
                  <span className="block font-body text-lg font-semibold">Standard size</span>
                  <span className={`mt-1 block font-body text-sm leading-6 ${fitMode === "standard" ? "text-cream/85" : "text-charcoal-mid"}`}>
                    {sizesSoldOut ? "UK sizes from stock — currently sold out." : "Pick a UK size from stock."}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFitMode("custom");
                    setVariantId(null);
                    setBagError(null);
                    requestAnimationFrame(() => {
                      document.getElementById("custom-measurements")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                    });
                  }}
                  className={`min-h-[6.25rem] min-w-0 border-2 px-4 py-4 text-left ${
                    fitMode === "custom" ? "border-choc bg-choc text-cream" : "border-choc bg-[#f7f2ec] text-charcoal"
                  }`}
                >
                  <span className="block font-body text-lg font-semibold">Made to your measurements</span>
                  <span className={`mt-1 block font-body text-sm leading-6 ${fitMode === "custom" ? "text-cream/85" : "text-charcoal"}`}>
                    {sizesSoldOut
                      ? "Sizes are gone. Tap here if you want this cut for you — it is not chosen until you do."
                      : "We cut this piece to the figures you enter below."}
                  </span>
                </button>
              </div>
            </div>
          ) : null}

          {fitMode === "standard" && standardSizes.length > 0 ? (
            <>
              <div className="mb-3 mt-1 flex min-w-0 items-baseline justify-between gap-3">
                <p className="shrink-0 font-body text-sm font-medium uppercase tracking-[0.08em] text-charcoal">Size</p>
                <SizeGuideModal>
                  <button
                    type="button"
                    className="shrink-0 whitespace-nowrap font-body text-sm text-choc underline underline-offset-4"
                  >
                    Size Guide
                  </button>
                </SizeGuideModal>
              </div>
              <QuickAddSizeRow
                variants={standardSizes}
                selectedId={variantId}
                onSelect={(id) => {
                  setVariantId(id);
                  setQty(1);
                  setBagError(null);
                }}
                compact
              />
            </>
          ) : null}
          {fitMode === "custom" && customAvailable ? (
            <CustomMeasurementsForm
              fields={customFields}
              previousCm={previousCm}
              leadTimeDays={customLeadTimeDays}
              returnable={customReturnable}
              surchargeLabel={
                customSurcharge > 0
                  ? `Custom surcharge: ₦${Math.round(customSurcharge).toLocaleString("en-NG")}`
                  : null
              }
              unit={measureUnit}
              onUnitChange={setMeasureUnit}
              values={measureValues}
              onChange={(key, value) => setMeasureValues((p) => ({ ...p, [key]: value }))}
            />
          ) : null}
          {sizesSoldOut && customAvailable && fitMode === "standard" ? (
            <button
              type="button"
              onClick={() => {
                setFitMode("custom");
                setVariantId(null);
                setBagError(null);
              }}
              className="mt-4 w-full border-2 border-choc bg-[#f7f2ec] px-4 py-4 text-left"
            >
              <span className="block font-body text-lg font-semibold text-choc">Sold out in standard sizes</span>
              <span className="mt-1 block font-body text-base leading-6 text-charcoal">
                We can still make this in your measurements. Tap to choose that — it is not selected for you.
              </span>
            </button>
          ) : null}
          {soldOut ? (
            <div className="mt-4 border border-border bg-cream px-4 py-4">
              <p className="font-body text-lg font-semibold text-choc">Sold out</p>
              <p className="mt-1 font-body text-sm leading-6 text-charcoal-mid">
                This piece is not being remade. Leave your email and we will tell you if it returns.
              </p>
              <StockAlertForm productId={product.id} />
            </div>
          ) : null}
          {lowStock > 0 && (
            <p className="mt-2 font-body text-[10px] font-medium uppercase tracking-wide text-choc">Only {lowStock} left!</p>
          )}
          {variant && variant.stock === 0 && !soldOut ? (
            <StockAlertForm productId={product.id} variantId={variant.id} />
          ) : null}

          {variant && variant.stock > 1 ? (
          <div className="mt-6">
            <p className="font-body text-[10px] font-medium uppercase tracking-[0.14em] text-text-light">Quantity</p>
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                aria-label="Decrease quantity"
                className="flex h-9 w-9 items-center justify-center rounded-sm border border-border hover:border-choc"
                disabled={qty <= 1}
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >
                −
              </button>
              <span className="w-8 text-center">{qty}</span>
              <button
                type="button"
                aria-label="Increase quantity"
                className="flex h-9 w-9 items-center justify-center rounded-sm border border-border hover:border-choc"
                disabled={!variant || qty >= variant.stock}
                onClick={() => setQty((q) => (variant ? Math.min(variant.stock, q + 1) : q))}
              >
                +
              </button>
            </div>
          </div>
          ) : null}

          <Button
            type="button"
            className="mt-8 h-[52px] w-full bg-choc font-body text-[11px] font-semibold uppercase tracking-[0.18em] text-cream hover:bg-nut disabled:opacity-40"
            size="lg"
            disabled={
              soldOut ||
              submitting ||
              (fitMode === "standard" && !variant) ||
              (fitMode === "custom" && (!customAvailable || !customFields.length))
            }
            aria-busy={submitting}
            onClick={() => void addToBagClick()}
          >
            {submitting ? (
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-cream/30 border-t-cream"
                aria-hidden
              />
            ) : null}
            {ctaLabel}
          </Button>
          <p className="sr-only" aria-live="polite">
            {bagError ?? (submitting ? "Adding to bag" : "")}
          </p>
          {bagError ? (
            <p className="mt-3 font-body text-[12px] leading-5 text-choc" role="alert">
              {bagError}
            </p>
          ) : null}

          <div className="mt-4 flex w-full items-center justify-center gap-2 border border-charcoal py-3">
            <WishlistButton productId={product.id} />
            <span className="font-body text-[11px] font-medium uppercase tracking-wider text-charcoal">Add to Wishlist</span>
          </div>

          <div className="mt-6 flex min-w-0 w-full flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center font-sans text-[10px] uppercase tracking-[0.12em] text-charcoal-light">
            <span>Secure checkout</span>
            <span aria-hidden className="text-sand">
              ·
            </span>
            <span>Ships worldwide</span>
            <span aria-hidden className="text-sand">
              ·
            </span>
            <SizeGuideModal>
              <button type="button" className="uppercase tracking-[0.12em] text-charcoal-light underline-offset-4 hover:text-choc hover:underline">
                Size guide
              </button>
            </SizeGuideModal>
          </div>

          <Accordion.Root type="multiple" className="mt-10 space-y-2 border-t border-border pt-6">
            {product.details && (
              <Accordion.Item value="d" className="border-b border-border">
                <Accordion.Header>
                  <Accordion.Trigger className="flex w-full py-3 font-label text-xs uppercase tracking-wider">
                    Product Details
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content className="pb-4">
                  <div
                    className="copy-body space-y-2 text-sm leading-relaxed text-charcoal-mid [&_p]:mb-2"
                    dangerouslySetInnerHTML={{ __html: sanitizeCmsHtml(product.details) }}
                  />
                </Accordion.Content>
              </Accordion.Item>
            )}
            <Accordion.Item value="s" className="border-b border-border">
              <Accordion.Header>
                <Accordion.Trigger className="flex w-full py-3 font-label text-xs uppercase tracking-wider">
                  Size &amp; Fit
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content className="space-y-3 pb-4 text-sm text-charcoal-mid">
                <SizeGuideModal>
                  <button type="button" className="font-body text-[11px] font-medium uppercase tracking-wide text-choc underline">
                    View Full Size Guide
                  </button>
                </SizeGuideModal>
                <p className="copy-body">If between sizes, size up. Cut is fitted.</p>
              </Accordion.Content>
            </Accordion.Item>
            <Accordion.Item value="del" className="border-b border-border">
              <Accordion.Header>
                <Accordion.Trigger className="flex w-full py-3 font-label text-xs uppercase tracking-wider">
                  Delivery &amp; Returns
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content className="space-y-2 pb-4 text-sm text-charcoal-mid">
                {freeLagosAboveNGN != null ? (
                  <p>
                    Free Lagos delivery on orders over ₦{Math.round(freeLagosAboveNGN).toLocaleString("en-NG")}.
                    Ships worldwide.
                  </p>
                ) : (
                  <p>Ships worldwide.</p>
                )}
                {customAvailable ? <p>{CUSTOM_LEAD_COPY(customLeadTimeDays)}</p> : null}
                <p>Returns accepted within 14 days in original condition for standard sizes.</p>
                {customAvailable && !customReturnable ? <p>{CUSTOM_RETURNS_COPY}</p> : null}
              </Accordion.Content>
            </Accordion.Item>
            {product.isBespokeAvail && product.type !== "RTW" && (
              <Accordion.Item value="b" className="border-b border-border">
                <Accordion.Header>
                  <Accordion.Trigger className="flex w-full py-3 font-label text-xs uppercase tracking-wider">
                    Atelier Version
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content className="space-y-3 pb-4 text-sm text-charcoal-mid">
                  <p>Have this piece made to your exact measurements.</p>
                  <p>
                    Lead time: 3–6 weeks. Starts from ₦
                    {Math.round(bespokeFromNGN ?? product.basePriceNGN).toLocaleString()}
                  </p>
                  <Link href="/atelier" className="font-body text-[11px] font-medium uppercase tracking-wide text-choc underline">
                    Book Atelier Consultation
                  </Link>
                </Accordion.Content>
              </Accordion.Item>
            )}
          </Accordion.Root>
        </div>
      </div>
    </div>
  );
}
