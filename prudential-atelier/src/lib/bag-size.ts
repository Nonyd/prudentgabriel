export const CHOOSE_SIZE_MESSAGE = "Please choose your size";
export const SIZE_TARGET_PX = 44;

export type BagSizeOption = {
  id: string;
  size: string;
  priceNGN: number;
  salePriceNGN: number | null;
  priceUSD: number | null;
  priceGBP: number | null;
};

export function capGuestQuantity(qty: number): number {
  return Math.max(1, Math.floor(Number.isFinite(qty) ? qty : 1));
}

export function guestQtyCanIncrease(): boolean {
  return true;
}

export function canChooseBagSize(): boolean {
  return true;
}

export function guestLineId(variantId: string, colorId?: string | null): string {
  return `${variantId}-${colorId?.trim() || "none"}`;
}

export function applyGuestSizeChange<
  T extends {
    id: string;
    variantId: string;
    size: string;
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
    quantity: capGuestQuantity(line.quantity),
  };
}
