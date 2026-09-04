/** Stock codes: PA-[STEM]-[SIZE], stem from the garment name. */

const STEM_LEN = 5;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Alphanumeric stem, articles and “(copy)” stripped so duplicates do not inherit ELISEC. */
export function skuStemFromName(name: string): string {
  const stripped = name
    .replace(/\(\s*copy\s*\)/gi, " ")
    .replace(/-copy(?:-\d+)?/gi, " ")
    .replace(/^\s*the\s+/i, "")
    .replace(/[^a-z0-9]+/gi, "");
  return stripped.slice(0, STEM_LEN).toUpperCase() || "ITEM";
}

export function skuSizePart(sizeLabel: string): string {
  return sizeLabel.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase() || "SIZE";
}

/** Default stock code from the product name and size: PA-DELPH-10 */
export function buildDefaultProductSku(name: string, sizeLabel: string): string {
  return `PA-${skuStemFromName(name)}-${skuSizePart(sizeLabel)}`;
}

export function isGeneratedProductSku(sku: string, name: string, sizeLabel: string): boolean {
  const base = buildDefaultProductSku(name, sizeLabel);
  const u = sku.trim().toUpperCase();
  const b = base.toUpperCase();
  if (u === b) return true;
  return new RegExp(`^${escapeRegex(b)}-\\d+$`).test(u);
}

/** Mutates `taken` (uppercased). First collision is `-2`, then `-3`. */
export function uniqueSkuFromTaken(preferred: string, taken: Set<string>): string {
  const base = preferred.trim() || "PA-ITEM-SIZE";
  const norm = (s: string) => s.toUpperCase();
  if (!taken.has(norm(base))) {
    taken.add(norm(base));
    return base;
  }
  let n = 2;
  while (taken.has(norm(`${base}-${n}`))) n += 1;
  const out = `${base}-${n}`;
  taken.add(norm(out));
  return out;
}

type SkuReader = {
  productVariant: {
    findMany: (args: {
      where?: { id?: { notIn: string[] } };
      select: { sku: true };
    }) => Promise<{ sku: string | null }[]>;
  };
};

export async function loadTakenSkus(tx: SkuReader, excludeIds: string[] = []): Promise<Set<string>> {
  const rows = await tx.productVariant.findMany({
    where: excludeIds.length ? { id: { notIn: excludeIds } } : undefined,
    select: { sku: true },
  });
  return new Set(rows.map((r) => r.sku?.toUpperCase()).filter((s): s is string => Boolean(s)));
}

export type PreferredSkuInput = {
  name: string;
  size: string;
  submittedSku?: string;
  skuManual?: boolean;
  existing?: { sku: string | null; skuManual: boolean; size: string } | null;
  oldName: string;
  nameChanged: boolean;
  regenerate?: boolean;
};

export function resolvePreferredSku(input: PreferredSkuInput): { sku: string; skuManual: boolean } {
  const generated = buildDefaultProductSku(input.name, input.size);
  if (input.regenerate) return { sku: generated, skuManual: false };

  if (input.skuManual) {
    const submitted = input.submittedSku?.trim();
    if (submitted) return { sku: submitted, skuManual: true };
    return { sku: generated, skuManual: false };
  }

  if (!input.existing) {
    return { sku: generated, skuManual: false };
  }

  const existingSku = input.existing.sku?.trim() ?? "";
  if (input.existing.skuManual) {
    return { sku: existingSku || generated, skuManual: Boolean(existingSku) };
  }

  if (
    input.nameChanged &&
    isGeneratedProductSku(existingSku, input.oldName, input.existing.size)
  ) {
    return { sku: generated, skuManual: false };
  }

  return { sku: existingSku || generated, skuManual: false };
}

export function variantTableColumns(opts: { onSale: boolean; advanced: boolean }) {
  return {
    size: true,
    price: true,
    stock: true,
    sale: opts.onSale,
    sku: opts.advanced,
    usd: opts.advanced,
    gbp: opts.advanced,
    lowAt: opts.advanced,
    parcel: opts.advanced,
  };
}
