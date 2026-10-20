import { profileMeasurementErrors } from "@/lib/measurement-guide";
import { atelierExtrasFrom, cleanAtelierExtraInput } from "@/lib/atelier/measurement-fields-shared";

export type MeasurementData = {
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
  unit?: string;
  notes?: string | null;
  updatedAt?: string | null;
  /** The house's extra atelier fields (Atelier → Measurement fields), by key, in this set's unit. */
  extra?: Record<string, number>;
};

export function measurementFromRecord(
  record: {
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
    unit?: string;
    notes?: string | null;
    updatedAt?: Date | string | null;
    /** Measurement.values or a snapshot's values: the atelier extras are read from it. */
    values?: unknown;
  } | null,
): MeasurementData | null {
  if (!record) return null;
  return {
    bust: record.bust,
    waist: record.waist,
    hips: record.hips,
    shoulderWidth: record.shoulderWidth,
    sleeveLength: record.sleeveLength,
    dressLength: record.dressLength,
    thigh: record.thigh,
    inseam: record.inseam,
    neck: record.neck,
    armhole: record.armhole,
    unit: record.unit ?? "inches",
    notes: record.notes,
    extra: atelierExtrasFrom(record.values as Record<string, unknown> | null | undefined),
    updatedAt: record.updatedAt
      ? typeof record.updatedAt === "string"
        ? record.updatedAt
        : record.updatedAt.toISOString()
      : null,
  };
}

/**
 * Adult atelier measurements must be physically plausible.
 * Bust 24″ with waist 32″ is a child's chest on an adult hip — never pre-fill or save that.
 * Returns the field at fault so a form can mark it, not just say "failed".
 */
export function measurementPlausibilityIssue(
  data: Pick<MeasurementData, "bust" | "waist" | "hips" | "unit">,
): { field: "bust" | "waist" | "hips"; message: string } | null {
  const unit = data.unit === "cm" ? "cm" : "inches";
  const toInches = (n: number) => (unit === "cm" ? n / 2.54 : n);
  const bust = data.bust != null ? toInches(data.bust) : null;
  const waist = data.waist != null ? toInches(data.waist) : null;
  const hips = data.hips != null ? toInches(data.hips) : null;

  // A slim adult waist can be 20″; bust and hips under 28″ are a child's.
  const tooSmall = (label: string, inches: number, min: number) =>
    inches < min ? `${label} of ${inches.toFixed(1)}″ is too small for an adult commission.` : null;
  const tooLarge = (label: string, inches: number) =>
    inches > 80 ? `${label} of ${inches.toFixed(1)}″ is not a usable adult measurement.` : null;

  if (bust != null) {
    const message = tooSmall("Bust", bust, 28) ?? tooLarge("Bust", bust);
    if (message) return { field: "bust", message };
  }
  if (waist != null) {
    const message = tooSmall("Waist", waist, 19.5) ?? tooLarge("Waist", waist);
    if (message) return { field: "waist", message };
  }
  if (hips != null) {
    const message = tooSmall("Hips", hips, 28) ?? tooLarge("Hips", hips);
    if (message) return { field: "hips", message };
  }
  if (bust != null && waist != null && bust + 0.5 < waist) {
    return { field: "bust", message: "Bust cannot be smaller than waist — check the figures before saving." };
  }
  if (hips != null && waist != null && hips + 0.5 < waist) {
    return { field: "hips", message: "Hips cannot be smaller than waist — check the figures before saving." };
  }
  return null;
}

export function measurementPlausibilityError(
  data: Pick<MeasurementData, "bust" | "waist" | "hips" | "unit">,
): string | null {
  return measurementPlausibilityIssue(data)?.message ?? null;
}

/** The fixed measurement columns, in the order the house reads them. */
export const MEASUREMENT_COLUMNS = [
  "bust",
  "waist",
  "hips",
  "shoulderWidth",
  "sleeveLength",
  "dressLength",
  "thigh",
  "inseam",
  "neck",
  "armhole",
] as const;
type MeasurementColumn = (typeof MEASUREMENT_COLUMNS)[number];

function optionalFloat(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Every reason a saved set cannot be stored, per field, plus one summary line.
 * Used by her account, admin/staff and the commission's own set, and by the
 * forms before they send, so the reason she sees is the reason the server has.
 */
export function profileMeasurementProblems(
  data: Partial<Record<MeasurementColumn, number | string | null | undefined>> & { unit?: string | null },
): { error: string; fieldErrors: Partial<Record<MeasurementColumn, string>> } | null {
  const unit = data.unit === "cm" ? "cm" : "inches";
  const fieldErrors: Partial<Record<MeasurementColumn, string>> = profileMeasurementErrors(data, unit);
  const num = (v: unknown) => (v == null || v === "" ? null : Number(v));
  const nums = { bust: num(data.bust), waist: num(data.waist), hips: num(data.hips) };
  if (!Object.keys(fieldErrors).length) {
    const issue = measurementPlausibilityIssue({
      bust: Number.isFinite(nums.bust) ? nums.bust : null,
      waist: Number.isFinite(nums.waist) ? nums.waist : null,
      hips: Number.isFinite(nums.hips) ? nums.hips : null,
      unit,
    });
    if (issue) fieldErrors[issue.field] = issue.message;
  }
  const messages = Object.values(fieldErrors);
  if (!messages.length) return null;
  const error =
    messages.length === 1 ? messages[0]! : `${messages[0]} (and ${messages.length - 1} more to check)`;
  return { error, fieldErrors };
}

/**
 * A measurements PATCH body → the fields it sets (absent keys untouched), or
 * the reason it cannot be saved. Shared by the client's set and a commission's own (BD6).
 */
export function cleanMeasurementInput(
  body: unknown,
):
  | {
      ok: true;
      data: Partial<Record<MeasurementColumn, number | null>> & { unit?: string; notes?: string | null };
      /** Atelier extras to merge into `values` (null clears one). Kept apart: they are not columns. */
      extra: Record<string, number | null>;
    }
  | { ok: false; error: string; fieldErrors?: Partial<Record<string, string>> } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const data: Partial<Record<MeasurementColumn, number | null>> & { unit?: string; notes?: string | null } = {};
  for (const key of MEASUREMENT_COLUMNS) {
    const raw = b[key];
    if (typeof raw === "string" && raw.trim() && !Number.isFinite(Number(raw))) {
      return { ok: false, error: "Please enter numbers only", fieldErrors: { [key]: "Please enter a number" } };
    }
    const v = optionalFloat(raw);
    if (v !== undefined) data[key] = v;
  }
  if (typeof b.unit === "string") data.unit = b.unit;
  if (b.notes !== undefined) data.notes = typeof b.notes === "string" ? b.notes.trim() || null : null;
  const problems = profileMeasurementProblems({ ...data, unit: data.unit ?? "inches" });
  if (problems) return { ok: false, ...problems };
  const extra = cleanAtelierExtraInput(b.extra);
  if (!extra.ok) {
    return { ok: false, error: "Please check the measurements", fieldErrors: { [extra.key]: "Please enter a measurement" } };
  }
  return { ok: true, data, extra: extra.extra };
}
