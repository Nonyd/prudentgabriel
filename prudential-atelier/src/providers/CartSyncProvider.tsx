"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useCartStore, type CartItem } from "@/store/cartStore";
import { getExchangeRates, convertFromNGN } from "@/lib/currency";

type ServerCartRow = {
  id: string;
  quantity: number;
  productId: string;
  variantId: string;
  colorId: string | null;
  product: {
    id: string;
    name: string;
    slug: string;
    category: string;
    images: { url: string }[];
  };
  variant: { id: string; size: string; priceNGN: number; salePriceNGN: number | null; stock: number };
  color: { name: string; hex: string } | null;
};

function serverRowToCartItem(row: ServerCartRow, rates: { NGN: number; USD: number; GBP: number }): CartItem {
  const unit = row.variant.salePriceNGN ?? row.variant.priceNGN;
  const img = row.product.images[0]?.url ?? "";
  return {
    id: row.id,
    productId: row.productId,
    productName: row.product.name,
    productSlug: row.product.slug,
    variantId: row.variantId,
    size: row.variant.size,
    colorId: row.colorId ?? undefined,
    color: row.color?.name,
    colorHex: row.color?.hex,
    imageUrl: img,
    priceNGN: unit,
    priceUSD: convertFromNGN(unit, "USD", rates),
    priceGBP: convertFromNGN(unit, "GBP", rates),
    quantity: row.quantity,
    stock: row.variant.stock,
    category: row.product.category,
  };
}

export function CartSyncProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();

  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;

    (async () => {
      const rates = await getExchangeRates();
      const local = useCartStore.getState().items;
      if (local.length) {
        for (const line of local) {
          await fetch("/api/cart", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              productId: line.productId,
              variantId: line.variantId,
              colorId: line.colorId ?? null,
              quantity: line.quantity,
            }),
          });
        }
      }
      if (cancelled) return;
      const res = await fetch("/api/cart");
      if (!res.ok || cancelled) return;
      const json = (await res.json()) as { items?: ServerCartRow[] };
      const serverItems = json.items ?? [];
      const merged = serverItems.map((r) => serverRowToCartItem(r, rates));
      const totalItems = merged.reduce((s, i) => s + i.quantity, 0);
      const totalNGN = merged.reduce((s, i) => s + i.priceNGN * i.quantity, 0);
      useCartStore.setState({ items: merged, totalItems, totalNGN });
    })();

    return () => {
      cancelled = true;
    };
  }, [status]);

  return <>{children}</>;
}
