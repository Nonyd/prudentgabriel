export const CHOOSE_SIZE_MESSAGE = "Please choose your size";
export const SOLD_OUT_WORD = "Sold out";
export const SIZE_TARGET_PX = 44;

export type BagSizeOption = {
  id: string;
  size: string;
  stock: number;
  priceNGN: number;
  salePriceNGN: number | null;
  priceUSD: number | null;
  priceGBP: number | null;
};

export function capGuestQuantity(qty: number, stock: number, sizeMode?: string | null): number {
  const q = Math.max(1, Math.floor(Number.isFinite(qty) ? qty : 1));
  if (sizeMode === "CUSTOM") return q;
  const cap = Math.max(0, Math.floor(Number.isFinite(stock) ? stock : 0));
  if (cap < 1) return 1;
  return Math.min(q, cap);
}

export function guestQtyCanIncrease(quantity: number, stock: number, sizeMode?: string | null): boolean {
  if (sizeMode === "CUSTOM") return true;
  return stock > 0 && quantity < stock;
}

export function canChooseBagSize(option: Pick<BagSizeOption, "stock">): boolean {
  return option.stock > 0;
}

export function guestLineId(variantId: string, colorId?: string | null): string {
  return `${variantId}-${colorId?.trim() || "none"}`;
}

export function applyLiveStockToGuestLine<
  T extends { variantId: string; stock: number; quantity: number; sizeMode?: string },
>(line: T, live: Pick<BagSizeOption, "id" | "stock">[]): T {
  if (line.sizeMode === "CUSTOM") return line;
  const found = live.find((v) => v.id === line.variantId);
  if (!found) return line;
  return {
    ...line,
    stock: found.stock,
    quantity: capGuestQuantity(line.quantity, found.stock, line.sizeMode),
  };
}

export function applyGuestSizeChange<
  T extends {
    id: string;
    variantId: string;
    size: string;
    stock: number;
    quantity: number;
    colorId?: string;
    sizeMode?: string;
  },
>(line: T, next: BagSizeOption): T {
  return {
    ...line,
    id: guestLineId(next.id, line.colorId),
    variantId: next.id,
    size: next.size,
    stock: next.stock,
    quantity: capGuestQuantity(line.quantity, next.stock, line.sizeMode),
  };
}

export function soldOutSizeAriaLabel(size: string): string {
  return `${size}, ${SOLD_OUT_WORD.toLowerCase()}`;
}
