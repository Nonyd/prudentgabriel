"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCartStore, type CartItem } from "@/store/cartStore";

export function RestoreBagClient({ token }: { token: string }) {
  const router = useRouter();
  const replaceItems = useCartStore((s) => s.replaceItems);
  const [message, setMessage] = useState("Restoring your bag…");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/checkout/restore/${encodeURIComponent(token)}`);
        const json = (await res.json()) as { error?: string; lines?: CartItem[] };
        if (!res.ok || !json.lines?.length) {
          if (!cancelled) setMessage(json.error ?? "This restore link is no longer valid.");
          return;
        }
        replaceItems(
          json.lines.map((l) => ({
            id: l.id || `${l.variantId}-${l.colorId ?? "none"}`,
            productId: l.productId,
            productName: l.productName,
            productSlug: l.productSlug,
            variantId: l.variantId,
            size: l.size,
            colorId: l.colorId ?? undefined,
            color: l.color,
            colorHex: l.colorHex,
            imageUrl: l.imageUrl,
            priceNGN: l.priceNGN,
            priceUSD: l.priceUSD ?? 0,
            priceGBP: l.priceGBP ?? 0,
            quantity: l.quantity,
            stock: l.stock ?? 999,
            category: l.category,
          })),
        );
        router.replace("/checkout");
      } catch {
        if (!cancelled) setMessage("Could not restore the bag. Open checkout and add the pieces again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, replaceItems, router]);

  return (
    <main className="mx-auto max-w-lg px-6 py-24 text-center">
      <p className="font-display text-2xl text-choc">Prudential Atelier</p>
      <p className="mt-6 font-body text-sm text-charcoal">{message}</p>
    </main>
  );
}
