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
