"use client";

import { planGuestServerMerge } from "@/lib/cart-merge";
import { stockGuardMessage } from "@/lib/quick-add";
import { useCartStore, type CartItem } from "@/store/cartStore";
import { effectiveUnitNGN, variantAmountInCurrency } from "@/lib/pricing";

type ServerCartRow = {
  id: string;
  quantity: number;
  productId: string;
  variantId: string | null;
  colorId: string | null;
  sizeMode?: "STANDARD" | "CUSTOM";
  measurements?: CartItem["measurements"];
  typedUnit?: string | null;
  surchargeNGN?: number;
  product: {
    id: string;
    name: string;
    slug: string;
    category: string;
    isOnSale: boolean;
    priceNGN?: number;
    priceUSD: number | null;
    priceGBP: number | null;
    customLeadTimeDays?: number | null;
    customReturnable?: boolean | null;
    images: { url: string }[];
    variants?: {
      priceNGN: number;
      salePriceNGN: number | null;
      priceUSD: number | null;
      priceGBP: number | null;
    }[];
  };
  variant: {
    id: string;
    size: string;
    priceNGN: number;
    salePriceNGN: number | null;
    priceUSD: number | null;
    priceGBP: number | null;
    stock: number;
  } | null;
  color: { name: string; hex: string } | null;
};

function serverRowToCartItem(
  row: ServerCartRow,
  rates: { NGN: number; USD: number; GBP: number },
): CartItem {
  const sizeMode = row.sizeMode === "CUSTOM" ? "CUSTOM" : "STANDARD";
  const priceSource = row.variant ?? row.product.variants?.[0];
  const unitBase = priceSource
    ? effectiveUnitNGN(priceSource, row.product.isOnSale)
    : (row.product.priceNGN ?? 0);
  const unit = unitBase + (row.surchargeNGN ?? 0);
  const img = row.product.images[0]?.url ?? "";
  const priced = { isOnSale: row.product.isOnSale, priceUSD: row.product.priceUSD, priceGBP: row.product.priceGBP };
  return {
    id: row.id,
    productId: row.productId,
    productName: row.product.name,
    productSlug: row.product.slug,
    variantId: row.variantId ?? `custom:${row.productId}`,
    size: sizeMode === "CUSTOM" ? "Custom" : (row.variant?.size ?? ""),
    colorId: row.colorId ?? undefined,
    color: row.color?.name,
    colorHex: row.color?.hex,
    imageUrl: img,
    priceNGN: unit,
    priceUSD: priceSource ? variantAmountInCurrency(priceSource, priced, "USD", rates) + (row.surchargeNGN ?? 0) * rates.USD : unit * rates.USD,
    priceGBP: priceSource ? variantAmountInCurrency(priceSource, priced, "GBP", rates) + (row.surchargeNGN ?? 0) * rates.GBP : unit * rates.GBP,
    quantity: row.quantity,
    stock: sizeMode === "CUSTOM" ? 999 : (row.variant?.stock ?? 0),
    category: row.product.category,
    sizeMode,
    measurements: row.measurements,
    typedUnit: row.typedUnit ?? undefined,
    surchargeNGN: row.surchargeNGN,
    customLeadTimeDays: row.product.customLeadTimeDays ?? undefined,
    customReturnable: row.product.customReturnable ?? undefined,
  };
}

async function loadRates(): Promise<{ NGN: number; USD: number; GBP: number }> {
  try {
    const ratesRes = await fetch("/api/currency/rates");
    const rates = (await ratesRes.json()) as { NGN: number; USD: number; GBP: number };
    return {
      NGN: 1,
      USD: rates.USD > 0 ? rates.USD : 0.00065,
      GBP: rates.GBP > 0 ? rates.GBP : 0.00052,
    };
  } catch {
    return { NGN: 1, USD: 0.00065, GBP: 0.00052 };
  }
}

export async function replaceCartFromServer(): Promise<boolean> {
  const rates = await loadRates();
  const res = await fetch("/api/cart");
  if (!res.ok) return false;
  const json = (await res.json()) as { items?: ServerCartRow[] };
  const merged = (json.items ?? []).map((r) => serverRowToCartItem(r, rates));
  const totalItems = merged.reduce((s, i) => s + i.quantity, 0);
  const totalNGN = merged.reduce((s, i) => s + i.priceNGN * i.quantity, 0);
  useCartStore.setState({ items: merged, totalItems, totalNGN });
  return true;
}

export async function postCartLine(line: {
  productId: string;
  variantId?: string | null;
  colorId?: string | null;
  quantity: number;
  sizeMode?: "STANDARD" | "CUSTOM";
  measurements?: { key: string; value: number; unit: "cm" | "in" }[];
  typedUnit?: "cm" | "in";
}): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/cart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(line),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    return { ok: false, error: stockGuardMessage(data.error) };
  }
  const replaced = await replaceCartFromServer();
  return replaced ? { ok: true } : { ok: false, error: "Could not refresh bag" };
}

export async function patchCartLine(itemId: string, quantity: number): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/cart/${encodeURIComponent(itemId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quantity }),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) return { ok: false, error: data.error ?? "Could not update quantity" };
  const replaced = await replaceCartFromServer();
  return replaced ? { ok: true } : { ok: false, error: "Could not refresh bag" };
}

export async function deleteCartLine(itemId: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/cart/${encodeURIComponent(itemId)}`, { method: "DELETE" });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) return { ok: false, error: data.error ?? "Could not remove item" };
  const replaced = await replaceCartFromServer();
  return replaced ? { ok: true } : { ok: false, error: "Could not refresh bag" };
}

/** Merge guest (localStorage) lines into the server cart using max-by-variant, then persist the server snapshot. */
export async function mergeGuestLinesIntoServer(local: CartItem[]): Promise<boolean> {
  const pulled = await replaceCartFromServer();
  if (!pulled) return false;
  const server = useCartStore.getState().items;
  const plan = planGuestServerMerge(local, server);
  for (const line of plan.create) {
    const result = await postCartLine({
      productId: line.productId,
      variantId: line.sizeMode === "CUSTOM" ? null : line.variantId,
      colorId: line.colorId ?? null,
      quantity: line.quantity,
      sizeMode: line.sizeMode,
      measurements: (line as CartItem).measurements?.map((m) => ({
        key: m.key,
        value: m.typedValue,
        unit: m.typedUnit,
      })),
    });
    if (!result.ok) return false;
  }
  for (const row of plan.setQty) {
    const result = await patchCartLine(row.id, row.quantity);
    if (!result.ok) return false;
  }
  if (plan.create.length || plan.setQty.length) {
    return replaceCartFromServer();
  }
  return true;
}

export { serverRowToCartItem };
export type { ServerCartRow };
