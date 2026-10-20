import { getSetting } from "@/lib/settings";
import { ATELIER_MEASUREMENT_FIELDS_KEY, cleanAtelierFields, type AtelierMeasurementField } from "@/lib/atelier/measurement-fields-shared";

export * from "@/lib/atelier/measurement-fields-shared";

export async function readAtelierMeasurementFields(): Promise<AtelierMeasurementField[]> {
  const raw = await getSetting(ATELIER_MEASUREMENT_FIELDS_KEY);
  if (!raw?.trim()) return [];
  try {
    return cleanAtelierFields(JSON.parse(raw));
  } catch {
    return [];
  }
}
