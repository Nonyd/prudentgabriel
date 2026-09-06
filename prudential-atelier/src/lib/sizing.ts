/** Canonical centimetres. Display inches as cm / 2.54. Never store both. */
export const CM_PER_INCH = 2.54;

export type TypedUnit = "cm" | "in";

export function isTypedUnit(v: unknown): v is TypedUnit {
  return v === "cm" || v === "in";
}

export function cmToInches(cm: number): number {
  return Math.round((cm / CM_PER_INCH) * 10) / 10;
}

export function inchesToCm(inches: number): number {
  return Math.round(inches * CM_PER_INCH * 10) / 10;
}

export function toCanonicalCm(value: number, unit: TypedUnit): number {
  return unit === "in" ? inchesToCm(value) : Math.round(value * 10) / 10;
}

export function fromCanonicalCm(cm: number, unit: TypedUnit): number {
  return unit === "in" ? cmToInches(cm) : Math.round(cm * 10) / 10;
}

export function formatCmAndInches(cm: number): { cm: string; in: string } {
  return {
    cm: String(Math.round(cm * 10) / 10),
    in: String(cmToInches(cm)),
  };
}

/** WooCommerce imported a "Custom" size. That is not a standard size. */
export function isStandardSizeLabel(size: string): boolean {
  const n = size.trim().toLowerCase();
  return n.length > 0 && n !== "custom";
}

export function normalizeSizeToken(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^uk\s*/i, "")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, "");
}

const LETTER_SIZE_RANK: Record<string, number> = {
  xxs: 0,
  xs: 1,
  s: 2,
  m: 3,
  l: 4,
  xl: 5,
  xxl: 6,
  xxxl: 7,
};

/** Numeric UK sizes first (6 before 10), then letter sizes, then the rest. Custom last. */
export function sizeSortValue(size: string): number {
  const t = normalizeSizeToken(size);
  if (!t || t === "custom") return Number.POSITIVE_INFINITY;
  const n = Number.parseFloat(t);
  if (Number.isFinite(n)) return n;
  if (t in LETTER_SIZE_RANK) return 1000 + LETTER_SIZE_RANK[t];
  return 2000;
}

export function compareSizeLabels(a: string, b: string): number {
  const da = sizeSortValue(a);
  const db = sizeSortValue(b);
  if (da !== db) return da - db;
  return normalizeSizeToken(a).localeCompare(normalizeSizeToken(b));
}

export function sortBySize<T>(items: T[], sizeOf: (item: T) => string): T[] {
  return [...items].sort((x, y) => compareSizeLabels(sizeOf(x), sizeOf(y)));
}

export type SizeChartRowView = {
  label: string;
  bustCm: number | null;
  waistCm: number | null;
  hipCm: number | null;
  lengthCm: number | null;
};

function parseLeadingCm(raw: string): number | null {
  const m = raw.trim().match(/^(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/** CMS /size-guide women rows → centimetre fields the PDP modal already knows how to print. */
export function womenCmsToChartRows(
  rows: { size: string; bust: string; waist: string; hips: string; length: string }[],
): SizeChartRowView[] {
  return rows.map((row) => ({
    label: row.size,
    bustCm: parseLeadingCm(row.bust),
    waistCm: parseLeadingCm(row.waist),
    hipCm: parseLeadingCm(row.hips),
    lengthCm: parseLeadingCm(row.length),
  }));
}

/** True when this house-chart row is a size she can tap on this piece (including sold-out). */
export function chartRowIsOffered(label: string, offeredSizes: string[]): boolean {
  const lab = normalizeSizeToken(label);
  if (!lab) return false;
  return offeredSizes.some((size) => normalizeSizeToken(size) === lab);
}

export function chartRowsForOfferedSizes<T extends { label: string }>(
  rows: T[],
  offeredSizes: string[],
): T[] {
  return sortBySize(
    rows.filter((row) => chartRowIsOffered(row.label, offeredSizes)),
    (row) => row.label,
  );
}

export function displayChartRow(row: SizeChartRowView): {
  label: string;
  bust: string;
  waist: string;
  hip: string;
  length: string;
} {
  const cell = (cm: number | null) => {
    if (cm == null) return "—";
    const both = formatCmAndInches(cm);
    return `${both.cm} cm / ${both.in} in`;
  };
  return {
    label: row.label,
    bust: cell(row.bustCm),
    waist: cell(row.waistCm),
    hip: cell(row.hipCm),
    length: cell(row.lengthCm),
  };
}
