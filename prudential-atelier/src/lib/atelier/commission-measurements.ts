import type { Prisma } from "@prisma/client";
import { MEASUREMENT_COLUMNS, measurementFromRecord, type MeasurementData } from "@/lib/measurements";

/**
 * Slice BD6 — measurements are taken per commission.
 *
 * A bride's measurements at her wedding are not her measurements at her
 * anniversary. Each commission keeps the set it is cut to (a snapshot, like
 * OrderItem.measurements for shop custom sizes); the client's Measurement row
 * stays the latest known set and the starting point for the next commission.
 *
 * Until a set is taken for this commission, the file shows her latest set and
 * says plainly when it was taken — it does not pass it off as this gown's.
 */

export type MeasurementSnapshot = Partial<Record<(typeof MEASUREMENT_COLUMNS)[number], number | null>> & {
  unit?: string;
  notes?: string | null;
  /** Centimetre extras keyed by MeasurementField.key, as on Measurement.values. */
  values?: Record<string, number>;
};

type ProfileRow = {
  unit: string;
  notes: string | null;
  values: Prisma.JsonValue | null;
  updatedAt: Date;
} & Partial<Record<(typeof MEASUREMENT_COLUMNS)[number], number | null>>;

/** A Measurement row (or a partial) → the snapshot shape stored on the commission. */
export function snapshotFrom(row: Partial<ProfileRow> | MeasurementSnapshot | null): MeasurementSnapshot {
  const out: MeasurementSnapshot = {};
  if (!row) return out;
  for (const key of MEASUREMENT_COLUMNS) {
    const v = (row as Record<string, unknown>)[key];
    if (typeof v === "number" || v === null) out[key] = v;
  }
  if (typeof row.unit === "string") out.unit = row.unit;
  if (row.notes !== undefined) out.notes = row.notes ?? null;
  const values = (row as { values?: unknown }).values;
  if (values && typeof values === "object" && !Array.isArray(values)) {
    const clean: Record<string, number> = {};
    for (const [k, v] of Object.entries(values as Record<string, unknown>)) {
      const n = typeof v === "number" ? v : Number(v);
      if (Number.isFinite(n)) clean[k] = n;
    }
    if (Object.keys(clean).length) out.values = clean;
  }
  return out;
}

export function parseSnapshot(raw: Prisma.JsonValue | null | undefined): MeasurementSnapshot | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return snapshotFrom(raw as MeasurementSnapshot);
}

export type CommissionMeasurements =
  | { source: "commission"; data: MeasurementData; takenAt: string | null }
  | { source: "client"; data: MeasurementData; takenAt: string | null }
  | { source: "none"; data: null; takenAt: null };

/** What the commission is cut to, or her latest set clearly labelled as such. */
export function commissionMeasurements(
  order: { measurementsSnapshot: Prisma.JsonValue | null; measurementsTakenAt: Date | null },
  profile: ProfileRow | null,
): CommissionMeasurements {
  const own = parseSnapshot(order.measurementsSnapshot);
  if (own) {
    return {
      source: "commission",
      data: measurementFromRecord({ ...own, updatedAt: order.measurementsTakenAt })!,
      takenAt: order.measurementsTakenAt?.toISOString() ?? null,
    };
  }
  if (profile) {
    return { source: "client", data: measurementFromRecord(profile)!, takenAt: profile.updatedAt.toISOString() };
  }
  return { source: "none", data: null, takenAt: null };
}
