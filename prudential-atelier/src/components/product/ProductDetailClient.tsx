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
import { sanitizeCmsHtml } from "@/lib/sanitize-html";
import { useBagActions } from "@/hooks/useBagActions";
import { formatPrice } from "@/lib/currency";
import {
  hasPurchasableSize,
  pickVariantForAdd,
  stockGuardMessage,
} from "@/lib/quick-add";
import { displayAmountInCurrency, effectiveUnitNGN, variantAmountInCurrency } from "@/lib/pricing";
import { useCurrencyStore } from "@/store/currencyStore";
import type { ProductType } from "@prisma/client";
import type { ProductListItem, ProductListVariant } from "@/types/product";
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
}

export function ProductDetailClient({
  product,
  averageRating,
  reviewCount,
  freeLagosAboveNGN = null,
  bespokeFromNGN = null,
}: ProductDetailClientProps) {
  const [variantId, setVariantId] = useState<string | null>(null);
  const [colorId, setColorId] = useState<string | null>(product.colors[0]?.id ?? null);
  const [qty, setQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [bagError, setBagError] = useState<string | null>(null);
  const { addToBag } = useBagActions();
  const rates = useCurrencyStore((s) => s.rates);
  const currency = useCurrencyStore((s) => s.currency);

  const variant = useMemo(
    () => pickVariantForAdd(product.variants, variantId),
    [product.variants, variantId],
  );
  const soldOut = !hasPurchasableSize(product.variants);
  const priceLabel = formatPrice(
    displayAmountInCurrency(product.variants, variantId, product, currency, rates),
    currency,
  );
  const ctaLabel = soldOut
    ? `Sold out · ${priceLabel}`
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
    variant && variant.stock > 0 && variant.stock <= product.lowStockAt ? variant.stock : 0;

  const addToBagClick = async () => {
    if (soldOut || submitting) return;
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
    <div className="mx-auto max-w-site px-4 pb-20">
      <nav className="py-4 font-body text-[11px] font-medium uppercase tracking-[0.08em] text-dark-grey">
        <Link href="/shop" className="hover:text-choc">
          Shop
        </Link>
        <span className="mx-2">/</span>
        <span>{String(product.category).replace(/_/g, " ")}</span>
        <span className="mx-2">/</span>
        <span className="text-charcoal">{product.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[60%_40%] lg:gap-12">
        <ProductGallery images={product.images} />

        <div className="lg:sticky lg:top-32 lg:self-start">
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

          {product.variants.length > 0 ? (
            <>
              <div className="mb-2 flex items-center justify-between">
                <p className="font-body text-[10px] font-medium uppercase tracking-[0.14em] text-text-light">Size</p>
                <SizeGuideModal>
                  <button
                    type="button"
                    className="font-body text-[10px] font-medium uppercase tracking-wide text-choc underline"
                  >
                    Size Guide
                  </button>
                </SizeGuideModal>
              </div>
              <QuickAddSizeRow
                variants={product.variants}
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
          {lowStock > 0 && (
            <p className="mt-2 font-body text-[10px] font-medium uppercase tracking-wide text-choc">Only {lowStock} left!</p>
          )}
          {variant && variant.stock === 0 && (
            <StockAlertForm productId={product.id} variantId={variant.id} />
          )}

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
            disabled={soldOut || !variant || submitting}
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

          <div className="mt-6 flex flex-wrap justify-center gap-4 text-center text-[11px] text-charcoal-light">
            <span>🔒 Secure Checkout</span>
            <span>✈️ Ships Worldwide</span>
            <span>📏 Free Size Guide</span>
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
                <p>Returns accepted within 14 days in original condition.</p>
              </Accordion.Content>
            </Accordion.Item>
            {product.isBespokeAvail && (
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
