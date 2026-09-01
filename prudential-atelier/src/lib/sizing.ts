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
