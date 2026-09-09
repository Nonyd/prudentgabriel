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
