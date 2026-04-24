"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import * as Accordion from "@radix-ui/react-accordion";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Divider } from "@/components/ui/Divider";
import { StarRating } from "@/components/ui/StarRating";
import { CountdownTimer } from "@/components/ui/CountdownTimer";
import { ProductGallery } from "@/components/product/ProductGallery";
import { PriceDisplay } from "@/components/product/PriceDisplay";
import { WishlistButton } from "@/components/common/WishlistButton";
import { StockAlertForm } from "@/components/common/StockAlertForm";
import { SizeGuideModal } from "@/components/shop/SizeGuideModal";
import { useCartStore } from "@/store/cartStore";
import { convertFromNGN } from "@/lib/currency";
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
}

export function ProductDetailClient({
  product,
  averageRating,
  reviewCount,
}: ProductDetailClientProps) {
  const [variantId, setVariantId] = useState<string | null>(product.variants[0]?.id ?? null);
  const [colorId, setColorId] = useState<string | null>(product.colors[0]?.id ?? null);
  const [qty, setQty] = useState(1);
  const addItem = useCartStore((s) => s.addItem);
  const rates = useCurrencyStore((s) => s.rates);

  const variant = useMemo(
    () => product.variants.find((v) => v.id === variantId) ?? product.variants[0] ?? null,
    [product.variants, variantId],
  );
  const color = product.colors.find((c) => c.id === colorId) ?? null;

  const productLike: ProductListItem = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    category: product.category as ProductListItem["category"],
    type: product.type,
    basePriceNGN: product.basePriceNGN,
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

  const addToBag = () => {
    if (!variant) {
      toast.error("Please select a size");
      return;
    }
    if (variant.stock < 1) {
      toast.error("This size is sold out.");
      return;
    }
    const unit = variant.salePriceNGN ?? variant.priceNGN;
    const id = `${variant.id}-${color?.id ?? "none"}`;
    addItem({
      id,
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
      priceUSD: convertFromNGN(unit, "USD", rates),
      priceGBP: convertFromNGN(unit, "GBP", rates),
      quantity: Math.min(qty, variant.stock),
      stock: variant.stock,
      category: product.category,
    });
    toast.success("Added to your bag ✓");
  };

  return (
    <div className="mx-auto max-w-site px-4 pb-20">
      <nav className="py-4 text-xs text-charcoal-light">
        <Link href="/shop" className="hover:text-wine">
          Shop
        </Link>
        <span className="mx-2">/</span>
        <span>{String(product.category).replace(/_/g, " ")}</span>
        <span className="mx-2">/</span>
        <span className="text-charcoal">{product.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[55%_45%] lg:gap-12">
        <ProductGallery images={product.images} />

        <div className="lg:sticky lg:top-32 lg:self-start">
          <Badge variant="gold" className="mb-3">
            {String(product.category).replace(/_/g, " ")}
          </Badge>
          <h1 className="font-display text-4xl text-charcoal md:text-5xl">{product.name}</h1>

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
                    className="h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-cream transition-shadow"
                    style={{
                      backgroundColor: c.hex,
                      boxShadow: colorId === c.id ? "0 0 0 2px var(--wine)" : undefined,
                    }}
                    title={c.name}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="mb-2 flex items-center justify-between">
            <p className="font-label text-xs uppercase text-charcoal-mid">Size</p>
            <SizeGuideModal>
              <button type="button" className="font-label text-[10px] uppercase text-wine underline">
                Size Guide
              </button>
            </SizeGuideModal>
          </div>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((v) => (
              <button
                key={v.id}
                type="button"
                disabled={v.stock === 0}
                onClick={() => {
                  setVariantId(v.id);
                  setQty(1);
                }}
                className={`rounded-sm border px-3 py-2 font-label text-[11px] uppercase ${
                  variantId === v.id
                    ? "border-wine bg-wine text-ivory"
                    : v.stock === 0
                      ? "cursor-not-allowed border-border text-charcoal-light/50 line-through"
                      : "border-border text-charcoal hover:border-wine"
                }`}
                title={v.stock === 0 ? "Sold Out" : undefined}
              >
                {v.size}
              </button>
            ))}
          </div>
          {lowStock > 0 && (
            <p className="mt-2 font-label text-[10px] uppercase text-gold">Only {lowStock} left!</p>
          )}
          {variant && variant.stock === 0 && (
            <StockAlertForm productId={product.id} variantId={variant.id} />
          )}

          <div className="mt-6">
            <p className="font-label text-xs uppercase text-charcoal-mid">Qty</p>
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-sm border border-border hover:border-wine"
                disabled={qty <= 1}
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >
                −
              </button>
              <span className="w-8 text-center">{qty}</span>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-sm border border-border hover:border-wine"
                disabled={!variant || qty >= variant.stock}
                onClick={() => setQty((q) => (variant ? Math.min(variant.stock, q + 1) : q))}
              >
                +
              </button>
            </div>
          </div>

          <Button type="button" className="mt-8 w-full" size="lg" onClick={addToBag}>
            Add to Bag
          </Button>

          <div className="mt-4 flex w-full items-center justify-center gap-2 rounded-sm border border-wine py-3">
            <WishlistButton productId={product.id} />
            <span className="font-label text-[11px] uppercase tracking-wider text-wine">Add to Wishlist</span>
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
                    className="space-y-2 text-sm leading-relaxed text-charcoal-mid [&_p]:mb-2"
                    dangerouslySetInnerHTML={{ __html: product.details }}
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
                  <button type="button" className="font-label text-wine underline">
                    View Full Size Guide
                  </button>
                </SizeGuideModal>
                <p>If between sizes, size up. Cut is fitted.</p>
              </Accordion.Content>
            </Accordion.Item>
            <Accordion.Item value="del" className="border-b border-border">
              <Accordion.Header>
                <Accordion.Trigger className="flex w-full py-3 font-label text-xs uppercase tracking-wider">
                  Delivery &amp; Returns
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content className="space-y-2 pb-4 text-sm text-charcoal-mid">
                <p>Free Lagos delivery on orders over ₦150,000. Ships worldwide.</p>
                <p>Returns accepted within 14 days in original condition.</p>
              </Accordion.Content>
            </Accordion.Item>
            {product.isBespokeAvail && (
              <Accordion.Item value="b" className="border-b border-border">
                <Accordion.Header>
                  <Accordion.Trigger className="flex w-full py-3 font-label text-xs uppercase tracking-wider">
                    Bespoke Version
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content className="space-y-3 pb-4 text-sm text-charcoal-mid">
                  <p>Have this piece made to your exact measurements.</p>
                  <p>Lead time: 3–6 weeks. Starts from ₦{Math.round(product.basePriceNGN * 1.3).toLocaleString()}</p>
                  <Link href="/bespoke" className="font-label text-wine underline">
                    Book Bespoke Consultation
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
