"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { CHOOSE_SIZE_MESSAGE } from "@/lib/bag-size";
import { formatPrice } from "@/lib/currency";
import {
  hasPurchasableSize,
  pickVariantForAdd,
  quickAddCtaLabel,
  stockGuardMessage,
} from "@/lib/quick-add";
import { standardVariants } from "@/lib/custom-size";
import { displayAmountInCurrency, effectiveUnitNGN, variantAmountInCurrency } from "@/lib/pricing";
import { useBagActions } from "@/hooks/useBagActions";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { useCartStore } from "@/store/cartStore";
import { useCurrencyStore } from "@/store/currencyStore";
import { useQuickAddStore } from "@/store/quickAddStore";
import type { ProductListItem } from "@/types/product";
import type { QuickAddPhase } from "@/lib/quick-add";

const DONE_MS = 900;

export function useProductQuickAdd(
  product: ProductListItem,
  selectedColor?: ProductListItem["colors"][0] | null,
) {
  const storeProductId = useQuickAddStore((s) => s.product?.id ?? null);
  const variantId = useQuickAddStore((s) => s.variantId);
  const phase = useQuickAddStore((s) => s.phase);
  const error = useQuickAddStore((s) => s.error);
  const openStore = useQuickAddStore((s) => s.open);
  const closeStore = useQuickAddStore((s) => s.close);
  const selectSize = useQuickAddStore((s) => s.selectSize);
  const beginSubmit = useQuickAddStore((s) => s.submit);
  const markSuccess = useQuickAddStore((s) => s.success);
  const markFail = useQuickAddStore((s) => s.fail);

  const isOpen = storeProductId === product.id && phase !== "idle";
  const sizesSoldOut = !hasPurchasableSize(standardVariants(product.variants));
  const soldOut = sizesSoldOut;
  const activePhase: QuickAddPhase = isOpen ? phase : "idle";
  const activeVariantId = isOpen ? variantId : null;
  const activeError = isOpen ? error : null;

  const currency = useCurrencyStore((s) => s.currency);
  const rates = useCurrencyStore((s) => s.rates);
  const { addToBag } = useBagActions();
  const openCart = useCartStore((s) => s.openCart);
  const reduceMotion = usePrefersReducedMotion();
  const doneTimer = useRef<number | null>(null);
  const inFlight = useRef(false);

  const priceLabel = formatPrice(
    displayAmountInCurrency(product.variants, activeVariantId, product, currency, rates),
    currency,
  );
  const ctaLabel = quickAddCtaLabel(activePhase, priceLabel);

  const announcement = useMemo(() => {
    if (!isOpen) return "";
    if (activePhase === "sizes") return `Select a size for ${product.name}. ${priceLabel}`;
    if (activePhase === "selected") return `Size selected. ${ctaLabel}`;
    if (activePhase === "submitting") return "Adding to bag";
    if (activePhase === "done") return `${product.name} added to bag`;
    if (activeError) return activeError;
    return "";
  }, [isOpen, activePhase, product.name, priceLabel, ctaLabel, activeError]);

  useEffect(() => {
    return () => {
      if (doneTimer.current) window.clearTimeout(doneTimer.current);
    };
  }, []);

  useEffect(() => {
    if (phase === "idle") inFlight.current = false;
  }, [phase]);

  const open = useCallback(() => {
    if (soldOut) return;
    openStore(product);
  }, [openStore, product, soldOut]);

    const close = useCallback(() => {
    inFlight.current = false;
    if (doneTimer.current) {
      window.clearTimeout(doneTimer.current);
      doneTimer.current = null;
    }
    closeStore();
  }, [closeStore]);

  const add = useCallback(async () => {
    if (soldOut || inFlight.current) return;
    const variant = pickVariantForAdd(product.variants, activeVariantId);
    if (!variant) {
      markFail(CHOOSE_SIZE_MESSAGE);
      return;
    }
    if (variant.stock < 1) {
      markFail("That size just sold out.");
      return;
    }
    inFlight.current = true;
    beginSubmit();
    const unit = effectiveUnitNGN(variant, product.isOnSale);
    const color = selectedColor ?? product.colors[0];
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
        imageUrl: (color?.imageUrl?.trim() || product.images[0]?.url || "") as string,
        priceNGN: unit,
        priceUSD: variantAmountInCurrency(variant, product, "USD", rates),
        priceGBP: variantAmountInCurrency(variant, product, "GBP", rates),
        quantity: 1,
        stock: variant.stock,
        category: product.category,
      },
      { toastOnError: false, openOnSuccess: false },
    );
    if (!result.ok) {
      inFlight.current = false;
      markFail(stockGuardMessage(result.error));
      return;
    }
    markSuccess();
    const wait = reduceMotion ? 0 : DONE_MS;
    const addedId = product.id;
    doneTimer.current = window.setTimeout(() => {
      const current = useQuickAddStore.getState();
      if (current.product?.id === addedId && current.phase === "done") {
        openCart();
        closeStore();
      }
      doneTimer.current = null;
    }, wait);
  }, [
    soldOut,
    product,
    selectedColor,
    activeVariantId,
    beginSubmit,
    markFail,
    markSuccess,
    addToBag,
    rates,
    reduceMotion,
    openCart,
    closeStore,
  ]);

  return {
    isOpen,
    soldOut,
    phase: activePhase,
    variantId: activeVariantId,
    error: activeError,
    priceLabel,
    ctaLabel,
    announcement,
    open,
    close,
    selectSize,
    add,
  };
}
