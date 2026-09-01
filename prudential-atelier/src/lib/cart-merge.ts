export type MergeLine = {
  id: string;
  productId: string;
  variantId: string | null;
  colorId?: string | null;
  quantity: number;
  sizeMode?: "STANDARD" | "CUSTOM";
  measurements?: {
    key: string;
    label: string;
    valueCm: number;
    typedValue: number;
    typedUnit: "cm" | "in";
  }[];
};

export function cartLineKey(variantId: string, colorId?: string | null): string {
  return `${variantId}:${colorId ?? ""}`;
}

function mergeKey(line: Pick<MergeLine, "productId" | "variantId" | "colorId" | "sizeMode">): string {
  if (line.sizeMode === "CUSTOM") return `CUSTOM:${line.productId}:${line.colorId ?? ""}`;
  return `STANDARD:${cartLineKey(line.variantId ?? "", line.colorId)}`;
}

/**
 * Login merge: match by variant+colour, never by cart-row id (guest ids are
 * `${variantId}-none`, server ids are cuids). Quantity is max(guest, server),
 * not a sum — guest 2 + server 1 → 2. A second login with the persisted
 * server cart is a no-op.
 */
export function planGuestServerMerge(
  local: MergeLine[],
  server: MergeLine[],
): { create: MergeLine[]; setQty: { id: string; quantity: number }[] } {
  const serverByKey = new Map(server.map((s) => [mergeKey(s), s]));
  const create: MergeLine[] = [];
  const setQty: { id: string; quantity: number }[] = [];
  const seen = new Set<string>();

  for (const line of local) {
    const key = mergeKey(line);
    if (seen.has(key)) continue;
    seen.add(key);
    const existing = serverByKey.get(key);
    if (!existing) {
      create.push(line);
      continue;
    }
    if (line.quantity > existing.quantity) {
      setQty.push({ id: existing.id, quantity: line.quantity });
    }
  }

  return { create, setQty };
}
