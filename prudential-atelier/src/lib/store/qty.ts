export const SUGGESTED_UNITS = ["yard", "metre", "piece", "roll", "cone", "spool", "pack"] as const;

export function toQty(value: { toString(): string } | number | string | null | undefined): number {
  if (value == null) return 0;
  return Number(typeof value === "number" ? value : value.toString());
}

export function formatQty(n: number, unit?: string | null): string {
  const rounded = Math.round(n * 10000) / 10000;
  const s = Number.isInteger(rounded) ? String(rounded) : String(rounded);
  return unit ? `${s} ${unit}` : s;
}

export function parseQty(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const m = raw.trim().replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}
