"use client";

import { useCallback } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { deleteCartLine, patchCartLine, postCartLine } from "@/lib/cart-client";
import {
  applyGuestSizeChange,
  applyLiveStockToGuestLine,
  capGuestQuantity,
  type BagSizeOption,
} from "@/lib/bag-size";
import { stockGuardMessage } from "@/lib/quick-add";
import { effectiveUnitNGN, variantAmountInCurrency } from "@/lib/pricing";
import { useCartStore, type CartItem } from "@/store/cartStore";
import { useCurrencyStore } from "@/store/currencyStore";

export type AddToBagResult = { ok: true } | { ok: false; error: string };

export type AddToBagOptions = {
  toastOnError?: boolean;
  openOnSuccess?: boolean;
};

export function useBagActions() {
  const { status } = useSession();
  const addItem = useCartStore((s) => s.addItem);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQty = useCartStore((s) => s.updateQty);
  const replaceItems = useCartStore((s) => s.replaceItems);
  const openCart = useCartStore((s) => s.openCart);
  const authenticated = status === "authenticated";
  const rates = useCurrencyStore((s) => s.rates);

  const addToBag = async (
    item: Omit<CartItem, "id"> & { id?: string },
    opts?: AddToBagOptions,
  ): Promise<AddToBagResult> => {
    const toastOnError = opts?.toastOnError !== false;
    const openOnSuccess = opts?.openOnSuccess !== false;
    if (!authenticated) {
      if (item.sizeMode === "CUSTOM") {
        const gate = await fetch("/api/shop/custom-gate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: item.productId }),
        });
        const body = (await gate.json().catch(() => ({}))) as { error?: string };
        if (!gate.ok) {
          const message = stockGuardMessage(body.error);
          if (toastOnError) toast.error(message);
          return { ok: false, error: message };
        }
      }
      addItem(
        {
          ...item,
          id:
            item.id ??
            (item.sizeMode === "CUSTOM"
              ? `custom:${item.productId}-${item.colorId ?? "none"}`
              : `${item.variantId}-${item.colorId ?? "none"}`),
        },
        { open: openOnSuccess },
      );
      return { ok: true };
    }
    const result = await postCartLine({
      productId: item.productId,
      variantId: item.sizeMode === "CUSTOM" ? null : item.variantId,
      colorId: item.colorId ?? null,
      quantity: item.quantity,
      sizeMode: item.sizeMode,
      measurements: item.measurements?.map((m) => ({
        key: m.key,
        value: m.typedValue,
        unit: m.typedUnit,
      })),
      typedUnit: item.typedUnit === "in" || item.typedUnit === "cm" ? item.typedUnit : undefined,
    });
    if (!result.ok) {
      const message = stockGuardMessage(result.error);
      if (toastOnError) toast.error(message);
      return { ok: false, error: message };
    }
    if (openOnSuccess) openCart();
    return { ok: true };
  };

  const changeQty = async (id: string, qty: number) => {
    if (!authenticated) {
      const line = useCartStore.getState().items.find((i) => i.id === id);
      if (line && line.sizeMode !== "CUSTOM" && line.stock > 0 && qty > line.stock) {
        updateQty(id, line.stock);
        return true;
      }
      updateQty(id, qty);
      return true;
    }
    if (qty < 1) {
      return removeFromBag(id);
    }
    const result = await patchCartLine(id, { quantity: qty });
    if (!result.ok) {
      toast.error(result.error ?? "Could not update quantity");
    }
    return result.ok;
  };

  const changeSize = async (id: string, option: BagSizeOption, isOnSale = false): Promise<boolean> => {
    if (option.stock < 1) {
      toast.error("That size just sold out.");
      return false;
    }
    if (!authenticated) {
      const items = useCartStore.getState().items;
      const line = items.find((i) => i.id === id);
      if (!line || line.sizeMode === "CUSTOM") return false;
      const priced = applyGuestSizeChange(line, option);
      const product = { isOnSale, priceUSD: option.priceUSD, priceGBP: option.priceGBP };
      const withPrices: CartItem = {
        ...priced,
        priceNGN: effectiveUnitNGN(option, isOnSale),
        priceUSD: variantAmountInCurrency(option, product, "USD", rates),
        priceGBP: variantAmountInCurrency(option, product, "GBP", rates),
      };
      const rest = items.filter((i) => i.id !== id);
      const clash = rest.find((i) => i.id === withPrices.id);
      if (clash) {
        const merged = capGuestQuantity(clash.quantity + withPrices.quantity, option.stock, line.sizeMode);
        replaceItems(
          rest
            .filter((i) => i.id !== clash.id)
            .concat({ ...clash, ...withPrices, quantity: merged, stock: option.stock }),
        );
      } else {
        replaceItems(rest.concat(withPrices));
      }
      return true;
    }
    const result = await patchCartLine(id, { variantId: option.id });
    if (!result.ok) {
      toast.error(stockGuardMessage(result.error));
      return false;
    }
    return true;
  };

  const refreshGuestStock = useCallback(async () => {
    if (status !== "unauthenticated") return;
    const items = useCartStore.getState().items;
    const ids = Array.from(new Set(items.filter((i) => i.sizeMode !== "CUSTOM").map((i) => i.productId)));
    if (!ids.length) return;
    const res = await fetch(`/api/shop/sizes?productIds=${encodeURIComponent(ids.join(","))}`);
    if (!res.ok) return;
    const json = (await res.json()) as {
      products?: Record<string, { variants: BagSizeOption[] }>;
    };
    const next = items.map((line) => {
      const live = json.products?.[line.productId]?.variants ?? [];
      return applyLiveStockToGuestLine(line, live);
    });
    replaceItems(next);
  }, [status, replaceItems]);

  const removeFromBag = async (id: string) => {
    if (!authenticated) {
      removeItem(id);
      return true;
    }
    const result = await deleteCartLine(id);
    if (!result.ok) {
      toast.error(result.error ?? "Could not remove item");
      return false;
    }
    return true;
  };

  return { addToBag, changeQty, changeSize, refreshGuestStock, removeFromBag, authenticated };
}
