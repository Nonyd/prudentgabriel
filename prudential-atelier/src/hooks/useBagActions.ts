"use client";

import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { deleteCartLine, patchCartLine, postCartLine } from "@/lib/cart-client";
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
      addItem(
        {
          ...item,
          id: item.id ?? `${item.variantId}-${item.colorId ?? "none"}`,
        },
        { open: openOnSuccess },
      );
      return { ok: true };
    }
    const result = await postCartLine({
      productId: item.productId,
      variantId: item.variantId,
      colorId: item.colorId ?? null,
      quantity: item.quantity,
    });
    if (!result.ok) {
      if (toastOnError) toast.error(result.error ?? "Could not add to bag");
      return { ok: false, error: result.error ?? "Could not add to bag" };
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
