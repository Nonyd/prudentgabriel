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
 */
export function measurementPlausibilityError(
  data: Pick<MeasurementData, "bust" | "waist" | "hips" | "unit">,
): string | null {
  const unit = data.unit === "cm" ? "cm" : "inches";
  const toInches = (n: number) => (unit === "cm" ? n / 2.54 : n);
  const bust = data.bust != null ? toInches(data.bust) : null;
  const waist = data.waist != null ? toInches(data.waist) : null;
  const hips = data.hips != null ? toInches(data.hips) : null;

  const tooSmall = (label: string, inches: number) =>
    inches < 28 ? `${label} of ${inches.toFixed(1)}″ is too small for an adult commission.` : null;
  const tooLarge = (label: string, inches: number) =>
    inches > 80 ? `${label} of ${inches.toFixed(1)}″ is not a usable adult measurement.` : null;

  if (bust != null) {
    const err = tooSmall("Bust", bust) ?? tooLarge("Bust", bust);
    if (err) return err;
  }
  if (waist != null) {
    const err = tooSmall("Waist", waist) ?? tooLarge("Waist", waist);
    if (err) return err;
  }
  if (hips != null) {
    const err = tooSmall("Hips", hips) ?? tooLarge("Hips", hips);
    if (err) return err;
  }
  if (bust != null && waist != null && bust + 0.5 < waist) {
    return "Bust cannot be smaller than waist — check the figures before saving.";
  }
  if (hips != null && waist != null && hips + 0.5 < waist) {
    return "Hips cannot be smaller than waist — check the figures before saving.";
  }
  return null;
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
 * A measurements PATCH body → the fields it sets (absent keys untouched), or
 * the plausibility error. Shared by the client's set and a commission's own (BD6).
 */
export function cleanMeasurementInput(
  body: unknown,
): { ok: true; data: Partial<Record<MeasurementColumn, number | null>> & { unit?: string; notes?: string | null } } | { ok: false; error: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const data: Partial<Record<MeasurementColumn, number | null>> & { unit?: string; notes?: string | null } = {};
  for (const key of MEASUREMENT_COLUMNS) {
    const v = optionalFloat(b[key]);
    if (v !== undefined) data[key] = v;
  }
  if (typeof b.unit === "string") data.unit = b.unit;
  if (b.notes !== undefined) data.notes = typeof b.notes === "string" ? b.notes.trim() || null : null;
  const error = measurementPlausibilityError({
    bust: typeof data.bust === "number" ? data.bust : null,
    waist: typeof data.waist === "number" ? data.waist : null,
    hips: typeof data.hips === "number" ? data.hips : null,
    unit: data.unit ?? "inches",
  });
  return error ? { ok: false, error } : { ok: true, data };
}
