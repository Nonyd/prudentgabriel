"use client";

import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { deleteCartLine, patchCartLine, postCartLine } from "@/lib/cart-client";
import { stockGuardMessage } from "@/lib/quick-add";
import { useCartStore, type CartItem } from "@/store/cartStore";

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
  const openCart = useCartStore((s) => s.openCart);
  const authenticated = status === "authenticated";

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
      updateQty(id, qty);
      return true;
    }
    if (qty < 1) {
      return removeFromBag(id);
    }
    const result = await patchCartLine(id, qty);
    if (!result.ok) {
      toast.error(result.error ?? "Could not update quantity");
      return false;
    }
    return true;
  };

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

  return { addToBag, changeQty, removeFromBag, authenticated };
}
