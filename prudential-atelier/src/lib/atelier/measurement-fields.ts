import { getSetting } from "@/lib/settings";
import {
  ATELIER_MEASUREMENT_FIELDS_KEY,
  cleanAtelierFields,
  DEFAULT_ATELIER_SHEET,
  type AtelierMeasurementField,
} from "@/lib/atelier/measurement-fields-shared";

export * from "@/lib/atelier/measurement-fields-shared";

/** The house sheet: as a manager saved it, else the default sheet. */
export async function readAtelierMeasurementFields(): Promise<AtelierMeasurementField[]> {
  const raw = await getSetting(ATELIER_MEASUREMENT_FIELDS_KEY);
  if (!raw?.trim()) return DEFAULT_ATELIER_SHEET;
  try {
    const saved = cleanAtelierFields(JSON.parse(raw));
    return saved.length ? saved : DEFAULT_ATELIER_SHEET;
  } catch {
    return DEFAULT_ATELIER_SHEET;
  }
}
