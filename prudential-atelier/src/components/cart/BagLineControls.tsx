"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { canChooseBagSize, SOLD_OUT_WORD, type BagSizeOption } from "@/lib/bag-size";
import { useBagActions } from "@/hooks/useBagActions";
import type { CartItem } from "@/store/cartStore";

type SizesPayload = {
  products?: Record<string, { isOnSale: boolean; variants: BagSizeOption[] }>;
};

export function useBagProductSizes(productIds: string[]) {
  const key = Array.from(new Set(productIds.filter(Boolean))).sort().join(",");
  const [data, setData] = useState<NonNullable<SizesPayload["products"]>>({});

  useEffect(() => {
    if (!key) {
      setData({});
      return;
    }
    let cancelled = false;
    void fetch(`/api/shop/sizes?productIds=${encodeURIComponent(key)}`)
      .then((r) => r.json())
      .then((j: SizesPayload) => {
        if (!cancelled) setData(j.products ?? {});
      })
      .catch(() => {
        if (!cancelled) setData({});
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return data;
}

export function BagSizeSelect({
  item,
  product,
}: {
  item: CartItem;
  product?: { isOnSale: boolean; variants: BagSizeOption[] };
}) {
  const { changeSize } = useBagActions();
  const fetched = useBagProductSizes(product != null || item.sizeMode === "CUSTOM" ? [] : [item.productId]);
  const resolved = product ?? fetched[item.productId];
  const options = resolved?.variants ?? [];

  if (item.sizeMode === "CUSTOM") {
    return <p className="font-body text-[11px] font-medium uppercase tracking-wider text-dark-grey">Made to measure</p>;
  }

  if (!options.length) {
    return (
      <p className="font-body text-[11px] font-medium uppercase tracking-wider text-dark-grey">{item.size}</p>
    );
  }

  return (
    <label className="mt-1 block">
      <span className="sr-only">Size for {item.productName}</span>
      <select
        className="min-h-[44px] w-full max-w-[11rem] border border-border bg-white px-2 font-body text-[12px] uppercase tracking-wider text-charcoal"
        value={item.variantId}
        onChange={(e) => {
          const next = options.find((o) => o.id === e.target.value);
          if (!next) return;
          void changeSize(item.id, next, resolved?.isOnSale ?? false);
        }}
      >
        {options.map((o) => (
          <option key={o.id} value={o.id} disabled={!canChooseBagSize(o) && o.id !== item.variantId}>
            {o.size}
            {canChooseBagSize(o) ? "" : ` — ${SOLD_OUT_WORD}`}
          </option>
        ))}
      </select>
      {item.stock < 1 ? (
        <span className="mt-1 block font-body text-[11px] text-choc">{SOLD_OUT_WORD} in this size. Choose another.</span>
      ) : null}
    </label>
  );
}

export function BagQtyButtons({
  item,
  onDecrease,
  onIncrease,
}: {
  item: CartItem;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  const atCap = item.sizeMode !== "CUSTOM" && (item.stock < 1 || item.quantity >= item.stock);
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={item.quantity <= 1}
        className={cn(
          "flex h-11 w-11 items-center justify-center border border-border text-sm disabled:opacity-40",
        )}
        aria-label={`Decrease quantity of ${item.productName}`}
        onClick={onDecrease}
      >
        −
      </button>
      <span className="w-6 text-center text-sm">{item.quantity}</span>
      <button
        type="button"
        disabled={atCap}
        className="flex h-11 w-11 items-center justify-center border border-border text-sm disabled:opacity-40"
        aria-label={`Increase quantity of ${item.productName}`}
        onClick={onIncrease}
      >
        +
      </button>
    </div>
  );
}
