import type { CustomSurchargeKind, OrderFulfilmentKind, SizeMode } from "@prisma/client";
import { isStandardSizeLabel, isTypedUnit, toCanonicalCm, type TypedUnit } from "@/lib/sizing";

export const CUSTOM_CART_SIZE = "Custom";

export const CUSTOM_RETURNS_COPY =
  "This piece is cut to the measurements you entered. It cannot be returned or exchanged.";

export const CUSTOM_LEAD_COPY = (days: number) =>
  `Made to your measurements. Allow about ${days} day${days === 1 ? "" : "s"} before dispatch.`;

export type MeasurementFieldDef = {
  key: string;
  label: string;
  helpText?: string | null;
  minCm?: number | null;
  maxCm?: number | null;
  required: boolean;
  sortOrder: number;
};

export type TypedMeasurement = {
  key: string;
  value: number;
  unit: TypedUnit;
};

export type MeasurementSnapshotEntry = {
  key: string;
  label: string;
  valueCm: number;
  typedValue: number;
  typedUnit: TypedUnit;
};

export type MeasurementValidationError =
  | { code: "REQUIRED"; key: string; message: string }
  | { code: "RANGE"; key: string; message: string }
  | { code: "INVALID"; key: string; message: string };

export type MeasurementValidationResult =
  | { ok: true; snapshot: MeasurementSnapshotEntry[] }
  | { ok: false; errors: MeasurementValidationError[] };

export function validateCustomMeasurements(
  fields: MeasurementFieldDef[],
  typed: TypedMeasurement[],
): MeasurementValidationResult {
  const byKey = new Map(typed.map((t) => [t.key, t]));
  const errors: MeasurementValidationError[] = [];
  const snapshot: MeasurementSnapshotEntry[] = [];

  for (const field of [...fields].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const row = byKey.get(field.key);
    if (!row || !Number.isFinite(row.value)) {
      if (field.required) {
        errors.push({
          code: "REQUIRED",
          key: field.key,
          message: `${field.label} is required`,
        });
      }
      continue;
    }
    if (!isTypedUnit(row.unit)) {
      errors.push({ code: "INVALID", key: field.key, message: `${field.label}: choose cm or in` });
      continue;
    }
    const valueCm = toCanonicalCm(row.value, row.unit);
    if (valueCm <= 0) {
      errors.push({ code: "INVALID", key: field.key, message: `${field.label} must be greater than zero` });
      continue;
    }
    if (field.minCm != null && valueCm < field.minCm) {
      errors.push({
        code: "RANGE",
        key: field.key,
        message: `${field.label} looks too small — please check the tape`,
      });
      continue;
    }
    if (field.maxCm != null && valueCm > field.maxCm) {
      errors.push({
        code: "RANGE",
        key: field.key,
        message: `${field.label} looks too large — please check the tape`,
      });
      continue;
    }
    snapshot.push({
      key: field.key,
      label: field.label,
      valueCm,
      typedValue: row.value,
      typedUnit: row.unit,
    });
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, snapshot };
}

export function customSurchargeNGN(params: {
  unitNGN: number;
  kind: CustomSurchargeKind | string | null | undefined;
  value: number | null | undefined;
}): number {
  const kind = params.kind ?? "NONE";
  const value = params.value ?? 0;
  if (kind === "PERCENT") return Math.round(params.unitNGN * (value / 100) * 100) / 100;
  if (kind === "FLAT") return Math.max(0, value);
  return 0;
}

export function resolveCustomPolicy(params: {
  product: {
    customOffered: boolean;
    customSurchargeKind?: CustomSurchargeKind | null;
    customSurchargeValue?: number | null;
    customLeadTimeDays?: number | null;
    customReturnable?: boolean | null;
  };
  globals: {
    offeredDefault: boolean;
    surchargeKind: CustomSurchargeKind;
    surchargeValue: number;
    leadTimeDays: number;
    returnable: boolean;
  };
}): {
  offered: boolean;
  surchargeKind: CustomSurchargeKind;
  surchargeValue: number;
  leadTimeDays: number;
  returnable: boolean;
} {
  return {
    offered: params.product.customOffered,
    surchargeKind: params.product.customSurchargeKind ?? params.globals.surchargeKind,
    surchargeValue: params.product.customSurchargeValue ?? params.globals.surchargeValue,
    leadTimeDays: params.product.customLeadTimeDays ?? params.globals.leadTimeDays,
    returnable: params.product.customReturnable ?? params.globals.returnable,
  };
}

export function cartLineKey(params: {
  sizeMode: SizeMode | "STANDARD" | "CUSTOM";
  productId: string;
  variantId?: string | null;
  colorId?: string | null;
}): string {
  const color = params.colorId?.trim() || "";
  if (params.sizeMode === "CUSTOM") return `CUSTOM:${params.productId}:${color}`;
  return `STANDARD:${params.variantId ?? ""}:${color}`;
}

export function isCustomLine(sizeMode: SizeMode | string | null | undefined): boolean {
  return sizeMode === "CUSTOM";
}

export function shouldDecrementStock(sizeMode: SizeMode | string | null | undefined): boolean {
  return !isCustomLine(sizeMode);
}

export function fulfilmentKindForLines(
  modes: Array<SizeMode | string | null | undefined>,
): OrderFulfilmentKind {
  const custom = modes.some((m) => isCustomLine(m));
  const standard = modes.some((m) => !isCustomLine(m));
  if (custom && standard) return "MIXED";
  if (custom) return "MADE_TO_ORDER";
  return "STOCK";
}

export function maxCustomLeadDays(
  lines: Array<{ sizeMode?: string | null; customLeadTimeDays?: number | null }>,
): number | null {
  const days = lines
    .filter((l) => isCustomLine(l.sizeMode))
    .map((l) => l.customLeadTimeDays)
    .filter((d): d is number => typeof d === "number" && d > 0);
  if (!days.length) return null;
  return Math.max(...days);
}

export function customLinesReturnable(
  lines: Array<{ sizeMode?: string | null; customReturnable?: boolean | null }>,
): boolean {
  const custom = lines.filter((l) => isCustomLine(l.sizeMode));
  if (!custom.length) return true;
  return custom.every((l) => l.customReturnable === true);
}

export function standardVariants<T extends { size: string }>(variants: T[]): T[] {
  return variants.filter((v) => isStandardSizeLabel(v.size));
}

export const PROFILE_COLUMN_BY_KEY: Record<string, string> = {
  bust: "bust",
  waist: "waist",
  hip: "hips",
  shoulder: "shoulderWidth",
  sleeve_length: "sleeveLength",
  total_length: "dressLength",
  thigh: "thigh",
  inseam: "inseam",
  neck: "neck",
  armhole: "armhole",
};

export type ProfileMeasurement = {
  bust?: number | null;
  waist?: number | null;
  hips?: number | null;
  shoulderWidth?: number | null;
  sleeveLength?: number | null;
  dressLength?: number | null;
  thigh?: number | null;
  inseam?: number | null;
  neck?: number | null;
  armhole?: number | null;
  unit?: string | null;
  values?: unknown;
};

function valuesMap(values: unknown): Record<string, number> {
  if (!values || typeof values !== "object" || Array.isArray(values)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(values as Record<string, unknown>)) {
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n) && n > 0) out[k] = n;
  }
  return out;
}

/** Prefill centimetres from the atelier Measurement record. */
export function profileCmForKey(profile: ProfileMeasurement | null | undefined, key: string): number | null {
  if (!profile) return null;
  const extras = valuesMap(profile.values);
  if (extras[key] != null) return extras[key];
  const col = PROFILE_COLUMN_BY_KEY[key];
  if (!col) return null;
  const raw = (profile as Record<string, unknown>)[col];
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = (profile.unit ?? "inches").toLowerCase();
  if (unit === "cm" || unit === "centimetres" || unit === "centimeters") return n;
  return toCanonicalCm(n, "in");
}

export function snapshotToValuesCm(snapshot: MeasurementSnapshotEntry[]): Record<string, number> {
  return Object.fromEntries(snapshot.map((e) => [e.key, e.valueCm]));
}

export function mergeProfileFromSnapshot(
  existing: ProfileMeasurement | null | undefined,
  snapshot: MeasurementSnapshotEntry[],
): {
  values: Record<string, number>;
  columns: Partial<Record<(typeof PROFILE_COLUMN_BY_KEY)[string], number>>;
} {
  const values = { ...valuesMap(existing?.values), ...snapshotToValuesCm(snapshot) };
  const unit = (existing?.unit ?? "inches").toLowerCase();
  const storeInches = unit !== "cm" && unit !== "centimetres" && unit !== "centimeters";
  const columns: Partial<Record<string, number>> = {};
  for (const entry of snapshot) {
    const col = PROFILE_COLUMN_BY_KEY[entry.key];
    if (!col) continue;
    columns[col] = storeInches ? Math.round((entry.valueCm / 2.54) * 10) / 10 : entry.valueCm;
  }
  return { values, columns };
}

export function formatSnapshotLines(snapshot: MeasurementSnapshotEntry[]): string[] {
  return snapshot.map((e) => {
    const typed = `${e.typedValue} ${e.typedUnit}`;
    const cm = `${e.valueCm} cm`;
    return e.typedUnit === "cm" ? `${e.label}: ${cm}` : `${e.label}: ${typed} (${cm})`;
  });
}

export function formatSnapshotForDisplay(snapshot: MeasurementSnapshotEntry[]): string {
  return formatSnapshotLines(snapshot).join(" · ");
}

export function parseSnapshot(raw: unknown): MeasurementSnapshotEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: MeasurementSnapshotEntry[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const key = typeof r.key === "string" ? r.key : "";
    const label = typeof r.label === "string" ? r.label : key;
    const valueCm = typeof r.valueCm === "number" ? r.valueCm : Number(r.valueCm);
    const typedValue = typeof r.typedValue === "number" ? r.typedValue : Number(r.typedValue);
    const typedUnit = isTypedUnit(r.typedUnit) ? r.typedUnit : "cm";
    if (!key || !Number.isFinite(valueCm)) continue;
    out.push({
      key,
      label,
      valueCm,
      typedValue: Number.isFinite(typedValue) ? typedValue : valueCm,
      typedUnit,
    });
  }
  return out;
}
