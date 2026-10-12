/**
 * Slice BD3 — the kinds of specification a gown carries, for server and browser.
 * Beads needed and fabric type are the two headings Mrs. Prudent named; lining
 * and anything else sit with fabric.
 */
export const MATERIAL_KINDS = ["BEADS", "FABRIC", "LINING", "OTHER"] as const;
export type MaterialKind = (typeof MATERIAL_KINDS)[number];

export const MATERIAL_KIND_LABELS: Record<MaterialKind, string> = {
  BEADS: "Beads",
  FABRIC: "Fabric",
  LINING: "Lining",
  OTHER: "Other",
};

export type MaterialRow = {
  id: string;
  kind: MaterialKind | null;
  kindLabel: string;
  name: string;
  quantity: string | null;
  notes: string | null;
  images: string[];
  issued: boolean;
  createdAt: string;
  /** Present only for a viewer who may see cost. */
  unitCost?: number | null;
  totalCost?: number | null;
};

export function splitSpecification(rows: MaterialRow[]): { beads: MaterialRow[]; fabric: MaterialRow[] } {
  return {
    beads: rows.filter((r) => r.kind === "BEADS"),
    fabric: rows.filter((r) => r.kind !== "BEADS"),
  };
}
