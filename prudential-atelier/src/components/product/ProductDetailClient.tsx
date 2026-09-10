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
import { SizeGuideModal } from "@/components/shop/SizeGuideModal";
import { QuickAddSizeRow } from "@/components/common/quick-add/QuickAddSizeRow";
import { CustomMeasurementsForm, typedFromForm } from "@/components/product/CustomMeasurementsForm";
import { sanitizeCmsHtml } from "@/lib/sanitize-html";
import { useBagActions } from "@/hooks/useBagActions";
import { formatPrice } from "@/lib/currency";
import { pickVariantForAdd, bagErrorMessage } from "@/lib/quick-add";
import { customSurchargeNGN, standardVariants, validateCustomMeasurements } from "@/lib/custom-size";
import { isCustomOfferedNow, PDP_INITIAL_FIT_MODE } from "@/lib/custom-availability";
import {
  FABRIC_POLICY_COPY,
  MADE_TO_MEASURE_REASON,
  STANDARD_SIZE_COPY,
  madeThenShippedCopy,
} from "@/lib/production-time";
import { productAisle } from "@/lib/rtw-aisle";
import { CHOOSE_SIZE_MESSAGE } from "@/lib/bag-size";
import type { MeasurementFieldDef } from "@/lib/custom-size";
import { displayAmountInCurrency, effectiveUnitNGN, variantAmountInCurrency } from "@/lib/pricing";
import { useCurrencyStore } from "@/store/currencyStore";
import { cn } from "@/lib/utils";
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
  customFields?: MeasurementFieldDef[];
  customLeadTimeDays?: number;
  productionCopy?: string;
  customReturnable?: boolean;
  customSurchargeKind?: "NONE" | "PERCENT" | "FLAT";
  customSurchargeValue?: number;
  previousCm?: Record<string, number>;
}

function sentenceCase(value: string): string {
  const t = value.replace(/_/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function ProductDetailClient({
  product,
  averageRating,
  reviewCount,
  freeLagosAboveNGN = null,
  bespokeFromNGN = null,
  customOffered = false,
  customFields = [],
  customLeadTimeDays = 12,
  productionCopy,
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
  const aisle = productAisle(product);
  const customAvailable = isCustomOfferedNow({ customOffered });
  const madeCopy = madeThenShippedCopy(productionCopy);
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
  const ctaLabel =
    fitMode === "custom"
      ? `Add to bag · ${priceLabel}`
      : !variant
        ? `Choose your size`
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

  const addToBagClick = async () => {
    if (submitting) return;
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
      setBagError(CHOOSE_SIZE_MESSAGE);
      document.getElementById("product-sizes")?.scrollIntoView({ behavior: "smooth", block: "center" });
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
          quantity: qty,
          category: product.category,
        },
        { toastOnError: false },
      );
      if (!result.ok) {
        setBagError(bagErrorMessage(result.error));
      }
    } catch {
      setBagError(bagErrorMessage(null));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-site overflow-x-clip px-4 pb-20 lg:px-10">
      <nav className="mb-6 inline-flex max-w-full flex-wrap items-center gap-x-1.5 glass-1 glass-pill px-4 py-2 font-body text-[12px] font-normal text-charcoal">
        <Link href={aisle.href} className="hover:text-choc">
          {sentenceCase(aisle.label)}
        </Link>
        <span className="text-charcoal-mid">/</span>
        <span>{sentenceCase(String(product.category))}</span>
        <span className="text-charcoal-mid">/</span>
        <span>{product.name}</span>
      </nav>

      <div className="grid min-w-0 gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-12">
        <div className="min-w-0">
          <ProductGallery images={product.images} />
        </div>

        <div className="min-w-0 lg:sticky lg:top-32 lg:self-start">
          <div className="glass-2 glass-panel px-6 py-7 lg:px-8">
          <p className="mb-4 font-body text-[13px] font-normal text-text-mid">
            {sentenceCase(String(product.category))}
          </p>
          <h1 className="font-display text-[36px] font-normal leading-[1.1] text-choc md:text-[42px]">
            {product.name}
          </h1>

          {reviewCount > 0 ? (
            <button
              type="button"
              className="mt-4 flex items-center gap-2 text-left"
              onClick={() => document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth" })}
            >
              <StarRating rating={averageRating} size="sm" />
              <span className="font-body text-sm font-normal text-charcoal-mid">
                {averageRating.toFixed(1)} ({reviewCount} {reviewCount === 1 ? "review" : "reviews"})
              </span>
            </button>
          ) : null}

          <Divider className="my-6" />

          <PriceDisplay product={productLike} selectedVariant={variant} />

          {product.saleEndsAt && product.isOnSale && (
            <CountdownTimer endsAt={product.saleEndsAt} className="mt-2" />
          )}

          <Divider className="my-6" />

          {product.colors.length > 0 && (
            <div className="mb-6">
              <p className="font-body text-sm font-normal text-charcoal-mid">
                Colour: {color ? sentenceCase(color.name) : "—"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {product.colors.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setColorId(c.id)}
                    aria-label={c.name}
                    aria-pressed={colorId === c.id}
                    className="flex h-11 w-11 items-center justify-center rounded-full"
                    title={c.name}
                  >
                    <span
                      className="h-5 w-5 rounded-full ring-1 ring-offset-2 ring-offset-white"
                      style={{
                        backgroundColor: c.hex,
                        boxShadow: colorId === c.id ? "0 0 0 1px var(--charcoal)" : undefined,
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {customAvailable ? (
            <div className="mb-6 min-w-0">
              <p id="fit-mode-label" className="mb-3 font-body text-base font-medium text-charcoal">
                How should this piece be made?
              </p>
              <div
                role="radiogroup"
                aria-labelledby="fit-mode-label"
                className="flex overflow-hidden rounded-full border-2 border-choc"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={fitMode === "standard"}
                  onClick={() => {
                    setFitMode("standard");
                    setBagError(null);
                  }}
                  className={cn(
                    "rounded-none min-h-12 flex-1 px-3 py-3 text-center font-sans text-[13px] font-semibold leading-snug sm:px-4 sm:text-[14px]",
                    fitMode === "standard" ? "bg-choc text-cream" : "bg-white text-charcoal",
                  )}
                >
                  Standard size
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={fitMode === "custom"}
                  aria-label="Made to your measurements"
                  onClick={() => {
                    setFitMode("custom");
                    setVariantId(null);
                    setBagError(null);
                    requestAnimationFrame(() => {
                      document.getElementById("custom-measurements")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                    });
                  }}
                  className={cn(
                    "rounded-none min-h-12 flex-1 px-3 py-3 text-center font-sans text-[13px] font-semibold leading-snug sm:px-4 sm:text-[14px]",
                    fitMode === "custom" ? "bg-choc text-cream" : "bg-[#f7f2ec] text-charcoal",
                  )}
                >
                  Made to measure
                </button>
              </div>
              <p className="mt-2.5 font-body text-sm leading-6 text-charcoal-mid">
                {fitMode === "standard" ? STANDARD_SIZE_COPY : MADE_TO_MEASURE_REASON}
              </p>
            </div>
          ) : null}

          {fitMode === "standard" && standardSizes.length > 0 ? (
            <div id="product-sizes">
              <div className="mb-3 mt-1 flex min-w-0 items-baseline justify-between gap-3">
                <p className="shrink-0 font-body text-sm font-normal text-charcoal">Size</p>
                <SizeGuideModal offeredSizes={standardSizes.map((v) => v.size)}>
                  <button
                    type="button"
                    className="inline-flex min-h-[44px] shrink-0 items-center whitespace-nowrap font-body text-sm text-choc underline underline-offset-4"
                  >
                    Size guide
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
            </div>
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
          {fitMode === "standard" ? (
          <div className="mt-6">
            <p className="font-body text-[10px] font-medium uppercase tracking-[0.14em] text-text-light">Quantity</p>
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                aria-label="Decrease quantity"
                className="flex h-11 w-11 items-center justify-center rounded-sm border border-border hover:border-choc"
                disabled={qty <= 1}
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >
                −
              </button>
              <span className="w-8 text-center">{qty}</span>
              <button
                type="button"
                aria-label="Increase quantity"
                className="flex h-11 w-11 items-center justify-center rounded-sm border border-border hover:border-choc"
                onClick={() => setQty((q) => q + 1)}
              >
                +
              </button>
            </div>
          </div>
          ) : null}

          <p className="mt-8 font-body text-sm leading-6 text-charcoal-mid">{madeCopy}</p>
          <Button
            type="button"
            className="mt-3 h-[52px] w-full bg-choc font-body text-[15px] font-normal normal-case tracking-normal text-cream hover:bg-nut disabled:opacity-40"
            size="lg"
            disabled={submitting}
            aria-busy={submitting}
            onClick={() => void addToBagClick()}
          >
            {submitting ? (
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-cream/30 border-t-cream"
                aria-hidden
              />
            ) : null}
            {fitMode === "standard" && !variant ? (
              <span className="flex w-full items-center justify-center gap-3">
                <span>Choose your size</span>
                <span>{priceLabel}</span>
              </span>
            ) : (
              ctaLabel
            )}
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
            <span className="font-body text-sm font-normal text-charcoal">Add to wishlist</span>
          </div>

          <Accordion.Root type="multiple" className="mt-10 space-y-0 border-t border-charcoal/10 pt-4">
            {product.details && (
              <Accordion.Item value="d" className="border-b border-charcoal/10">
                <Accordion.Header>
                  <Accordion.Trigger className="flex w-full py-3 font-body text-sm font-normal text-charcoal">
                    Product details
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
            <Accordion.Item value="s" className="border-b border-charcoal/10">
              <Accordion.Header>
                <Accordion.Trigger className="flex w-full py-3 font-body text-sm font-normal text-charcoal">
                  Size &amp; fit
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content className="space-y-3 pb-4 text-sm text-charcoal-mid">
                <SizeGuideModal offeredSizes={standardSizes.map((v) => v.size)}>
                  <button type="button" className="font-body text-sm font-normal text-choc underline">
                    Size guide
                  </button>
                </SizeGuideModal>
                <p className="copy-body">If between sizes, size up. Cut is fitted.</p>
              </Accordion.Content>
            </Accordion.Item>
            <Accordion.Item value="del" className="border-b border-charcoal/10">
              <Accordion.Header>
                <Accordion.Trigger className="flex w-full py-3 font-body text-sm font-normal text-charcoal">
                  Delivery &amp; returns
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content className="space-y-2 pb-4 text-sm text-charcoal-mid">
                <p>{madeCopy}</p>
                {freeLagosAboveNGN != null ? (
                  <p>
                    Free Lagos delivery on orders over ₦{Math.round(freeLagosAboveNGN).toLocaleString("en-NG")}.
                    Ships worldwide.
                  </p>
                ) : (
                  <p>Ships worldwide.</p>
                )}
                <p>{STANDARD_SIZE_COPY}</p>
                {customAvailable ? <p>{MADE_TO_MEASURE_REASON}</p> : null}
                <p>{FABRIC_POLICY_COPY}</p>
              </Accordion.Content>
            </Accordion.Item>
            {product.isBespokeAvail && product.type !== "RTW" && (
              <Accordion.Item value="b" className="border-b border-charcoal/10">
                <Accordion.Header>
                  <Accordion.Trigger className="flex w-full py-3 font-body text-sm font-normal text-charcoal">
                    Atelier version
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content className="space-y-3 pb-4 text-sm text-charcoal-mid">
                  <p>Have this piece made to your exact measurements.</p>
                  <p>
                    Lead time: 3–6 weeks. Starts from ₦
                    {Math.round(bespokeFromNGN ?? product.basePriceNGN).toLocaleString()}
                  </p>
                  <Link href="/atelier" className="font-body text-sm font-normal text-choc underline">
                    Book atelier consultation
                  </Link>
                </Accordion.Content>
              </Accordion.Item>
            )}
          </Accordion.Root>
          </div>
        </div>
      </div>
    </div>
  );
}
