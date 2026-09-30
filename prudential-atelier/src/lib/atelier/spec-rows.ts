/** Slice BC2: shaping a commission's ticked features for display. Pure; safe in client components. */

export type SpecificationRow = {
  featureId: string;
  key: string;
  label: string;
  group: string | null;
  note: string | null;
};

type FeatureRow = {
  featureId: string;
  note: string | null;
  feature: { key: string; label: string; group: string | null; sortOrder: number };
};

/** A commission's ticked features, in the house's order. */
export function specificationRows(features: FeatureRow[]): SpecificationRow[] {
  return [...features]
    .sort((a, b) => a.feature.sortOrder - b.feature.sortOrder || a.feature.label.localeCompare(b.feature.label))
    .map((f) => ({
      featureId: f.featureId,
      key: f.feature.key,
      label: f.feature.label,
      group: f.feature.group,
      note: f.note,
    }));
}
