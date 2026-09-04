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

function sizeTokenNumber(raw: string): number | null {
  const n = Number(normalizeSizeToken(raw));
  return Number.isFinite(n) ? n : null;
}

function parseSizeRange(raw: string): { min: number; max: number } | null {
  const m = normalizeSizeToken(raw).match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  return { min: Number(m[1]), max: Number(m[2]) };
}

/** True when this house-chart row is a size the piece actually sells (including sold-out). */
export function chartRowIsOffered(label: string, offeredSizes: string[]): boolean {
  const lab = normalizeSizeToken(label);
  if (!lab) return false;
  const n = sizeTokenNumber(label);
  for (const size of offeredSizes) {
    const tok = normalizeSizeToken(size);
    if (!tok) continue;
    if (tok === lab) return true;
    const range = parseSizeRange(size);
    if (range && n != null && n >= range.min && n <= range.max) return true;
  }
  return false;
}

export function chartRowsForOfferedSizes<T extends { label: string }>(
  rows: T[],
  offeredSizes: string[],
): T[] {
  return rows.filter((row) => chartRowIsOffered(row.label, offeredSizes));
}

export type SizeChartRowView = {
  label: string;
  bustCm: number | null;
  waistCm: number | null;
  hipCm: number | null;
  lengthCm: number | null;
};

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
