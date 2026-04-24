"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Divider } from "@/components/ui/Divider";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/store/cartStore";
import { convertFromNGN, formatPrice } from "@/lib/currency";
import { useCurrencyStore } from "@/store/currencyStore";

export interface QuickViewModalProps {
  productSlug: string | null;
  onClose: () => void;
}

export function QuickViewModal({ productSlug, onClose }: QuickViewModalProps) {
  const open = Boolean(productSlug);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    product: {
      id: string;
      name: string;
      slug: string;
      category: string;
      isOnSale: boolean;
      images: { url: string; alt: string | null }[];
      variants: { id: string; size: string; priceNGN: number; salePriceNGN: number | null; stock: number }[];
      colors: { id: string; name: string; hex: string }[];
    };
  } | null>(null);

  const currency = useCurrencyStore((s) => s.currency);
  const rates = useCurrencyStore((s) => s.rates);
  const addItem = useCartStore((s) => s.addItem);

  const [colorId, setColorId] = useState<string | null>(null);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (!productSlug) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/products/${productSlug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled || !json?.product) return;
        setData(json);
        const p = json.product;
        setVariantId(p.variants[0]?.id ?? null);
        setColorId(p.colors?.[0]?.id ?? null);
        setQty(1);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productSlug]);

  const p = data?.product;
  const variant = p?.variants.find((v) => v.id === variantId) ?? p?.variants[0];
  const color = p?.colors.find((c) => c.id === colorId) ?? null;

  const effective =
    variant && (variant.salePriceNGN != null ? variant.salePriceNGN : variant.priceNGN);
  const orig = variant?.priceNGN ?? 0;
  const onSale = Boolean(variant?.salePriceNGN != null && p?.isOnSale);

  const fmt = (ngn: number) => formatPrice(convertFromNGN(ngn, currency, rates), currency);

  const addToBag = () => {
    if (!p || !variant) return;
    if (variant.stock < 1) {
      toast.error("This size is sold out.");
      return;
    }
    const id = `${variant.id}-${color?.id ?? "none"}`;
    const unit = variant.salePriceNGN ?? variant.priceNGN;
    addItem({
      id,
      productId: p.id,
      productName: p.name,
      productSlug: p.slug,
      variantId: variant.id,
      size: variant.size,
      colorId: color?.id,
      color: color?.name,
      colorHex: color?.hex,
      imageUrl: p.images[0]?.url ?? "",
      priceNGN: unit,
      priceUSD: convertFromNGN(unit, "USD", rates),
      priceGBP: convertFromNGN(unit, "GBP", rates),
      quantity: Math.min(qty, variant.stock),
      stock: variant.stock,
    });
    toast.success("Added to bag ✓");
    onClose();
  };

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay forceMount asChild>
              <motion.div
                className="fixed inset-0 z-[70] bg-charcoal/60 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </Dialog.Overlay>
            <Dialog.Content forceMount asChild>
              <motion.div
                data-lenis-prevent
                className="fixed inset-4 z-[71] mx-auto flex max-h-[85vh] max-w-3xl flex-col overflow-y-auto overscroll-contain rounded-sm bg-[var(--white)] shadow-xl md:inset-y-12 md:left-1/2 md:w-full md:-translate-x-1/2"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <Dialog.Title className="sr-only">Quick view</Dialog.Title>
                <button
                  type="button"
                  onClick={onClose}
                  className="absolute right-3 top-3 z-10 rounded-sm p-2 text-charcoal hover:bg-wine-muted"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>

                {loading || !p ? (
                  <div className="grid flex-1 grid-cols-1 gap-6 p-6 md:grid-cols-2">
                    <div className="aspect-[3/4] animate-pulse rounded-sm bg-ivory-dark" />
                    <div className="space-y-3 pt-8">
                      <div className="h-6 w-1/3 animate-pulse rounded bg-border" />
                      <div className="h-10 w-full animate-pulse rounded bg-border" />
                      <div className="h-24 w-full animate-pulse rounded bg-border" />
                    </div>
                  </div>
                ) : (
                  <div className="grid flex-1 grid-cols-1 gap-0 overflow-y-auto md:grid-cols-2">
                    <div className="relative aspect-[3/4] min-h-[280px] bg-ivory-dark md:min-h-0">
                      {p.images[0] && (
                        <Image
                          src={p.images[0].url}
                          alt={p.images[0].alt || p.name}
                          fill
                          className="object-cover object-top"
                          sizes="(max-width: 768px) 100vw, 50vw"
                        />
                      )}
                    </div>
                    <div className="flex flex-col gap-4 p-6 md:py-10">
                      <Badge variant="gold" className="w-fit">
                        {String(p.category).replace(/_/g, " ")}
                      </Badge>
                      <h2 className="font-display text-3xl text-charcoal">{p.name}</h2>
                      <div className="text-lg">
                        {onSale ? (
                          <p>
                            <del className="text-charcoal-light">{fmt(orig)}</del>{" "}
                            <span className="font-semibold text-wine">{fmt(effective ?? 0)}</span>
                          </p>
                        ) : (
                          <p className="font-semibold text-charcoal">{fmt(effective ?? 0)}</p>
                        )}
                      </div>
                      <Divider />
                      {p.colors.length > 0 && (
                        <div>
                          <p className="font-label text-xs uppercase tracking-wider text-charcoal-mid">
                            Colour: {color?.name ?? "—"}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {p.colors.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => setColorId(c.id)}
                                className={cn(
                                  "h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-cream transition-shadow",
                                  colorId === c.id ? "ring-wine" : "ring-transparent hover:ring-border",
                                )}
                                style={{ backgroundColor: c.hex }}
                                title={c.name}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      <div>
                        <p className="font-label text-xs uppercase tracking-wider text-charcoal-mid">Size</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {p.variants.map((v) => (
                            <button
                              key={v.id}
                              type="button"
                              disabled={v.stock === 0}
                              onClick={() => setVariantId(v.id)}
                              className={cn(
                                "rounded-sm border px-3 py-2 font-label text-[11px] uppercase tracking-wide",
                                v.stock === 0 && "cursor-not-allowed opacity-50 line-through",
                                variantId === v.id
                                  ? "border-wine bg-wine text-ivory"
                                  : "border-border bg-cream text-charcoal hover:border-wine",
                              )}
                            >
                              {v.size}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          className="flex h-9 w-9 items-center justify-center rounded-sm border border-border hover:border-wine"
                          onClick={() => setQty((q) => Math.max(1, q - 1))}
                        >
                          −
                        </button>
                        <span className="w-8 text-center font-medium">{qty}</span>
                        <button
                          type="button"
                          className="flex h-9 w-9 items-center justify-center rounded-sm border border-border hover:border-wine"
                          onClick={() =>
                            setQty((q) => (variant ? Math.min(variant.stock, q + 1) : q + 1))
                          }
                        >
                          +
                        </button>
                      </div>
                      <Button type="button" className="w-full" size="lg" onClick={addToBag}>
                        Add to Bag
                      </Button>
                      <Link
                        href={`/shop/${p.slug}`}
                        onClick={onClose}
                        className="text-center font-label text-xs uppercase tracking-wider text-wine underline-offset-4 hover:underline"
                      >
                        View Full Details →
                      </Link>
                    </div>
                  </div>
                )}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
