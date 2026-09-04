import { prisma } from "@/lib/prisma";

export type CustomMeasurementDef = {
  key: string;
  label: string;
  helpText: string;
  minCm: number;
  maxCm: number;
  /** Older keys to rename onto this field (product ticks are moved across). */
  aliases: string[];
};

/** Fields Mrs. Prudent ticks per product for made-to-measure. */
export const CUSTOM_MEASUREMENT_FIELDS: CustomMeasurementDef[] = [
  {
    key: "shoulder",
    label: "Shoulder",
    helpText: "Measure across the back from the end of one shoulder to the other.",
    minCm: 30,
    maxCm: 60,
    aliases: ["shoulder_width"],
  },
  {
    key: "bust",
    label: "Bust",
    helpText: "Measure around the fullest part of the bust, keeping the tape level.",
    minCm: 70,
    maxCm: 150,
    aliases: [],
  },
  {
    key: "waist",
    label: "Waist",
    helpText: "Measure around the natural waist, where the body bends.",
    minCm: 60,
    maxCm: 140,
    aliases: [],
  },
  {
    key: "hip",
    label: "Hip",
    helpText: "Measure around the fullest part of the hips.",
    minCm: 80,
    maxCm: 160,
    aliases: ["hips"],
  },
  {
    key: "shoulder_to_waist",
    label: "Back neck to waist",
    helpText: "From the bone at the base of the neck down to the natural waist.",
    minCm: 30,
    maxCm: 60,
    aliases: ["nape_to_waist", "neck_to_waist"],
  },
  {
    key: "skirt_length",
    label: "Skirt length",
    helpText: "From the waist to the desired hem of the skirt.",
    minCm: 40,
    maxCm: 130,
    aliases: [],
  },
  {
    key: "pant_length",
    label: "Pant length",
    helpText: "From the waist to the desired hem of the trouser, along the outside leg.",
    minCm: 60,
    maxCm: 130,
    aliases: ["inseam"],
  },
  {
    key: "biceps",
    label: "Biceps",
    helpText: "Measure around the fullest part of the upper arm.",
    minCm: 20,
    maxCm: 60,
    aliases: ["bicep"],
  },
  {
    key: "sleeve_length",
    label: "Sleeve length",
    helpText: "From the shoulder seam to the wrist, with the arm slightly bent.",
    minCm: 20,
    maxCm: 80,
    aliases: [],
  },
  {
    key: "blouse_length",
    label: "Blouse length",
    helpText: "From the shoulder to the desired hem of the blouse.",
    minCm: 40,
    maxCm: 80,
    aliases: [],
  },
  {
    key: "dress_length",
    label: "Dress length",
    helpText: "From the shoulder to the desired hem of the dress.",
    minCm: 80,
    maxCm: 180,
    aliases: ["total_length", "length"],
  },
];

async function retargetProductMeasurements(fromFieldId: string, toFieldId: string): Promise<void> {
  if (fromFieldId === toFieldId) return;
  const links = await prisma.productMeasurement.findMany({ where: { fieldId: fromFieldId } });
  for (const link of links) {
    const already = await prisma.productMeasurement.findUnique({
      where: { productId_fieldId: { productId: link.productId, fieldId: toFieldId } },
    });
    if (already) {
      await prisma.productMeasurement.delete({ where: { id: link.id } });
    } else {
      await prisma.productMeasurement.update({
        where: { id: link.id },
        data: { fieldId: toFieldId },
      });
    }
  }
}

/** Upsert the house custom-size fields and drop anything else in the catalog. */
export async function ensureCustomMeasurementFields(): Promise<void> {
  const existing = await prisma.measurementField.findMany();
  const byKey = new Map(existing.map((f) => [f.key, f]));

  for (let i = 0; i < CUSTOM_MEASUREMENT_FIELDS.length; i++) {
    const def = CUSTOM_MEASUREMENT_FIELDS[i];
    let row = byKey.get(def.key) ?? null;

    if (!row) {
      for (const alias of def.aliases) {
        const aliased = byKey.get(alias);
        if (!aliased) continue;
        row = await prisma.measurementField.update({
          where: { id: aliased.id },
          data: {
            key: def.key,
            label: def.label,
            helpText: aliased.helpText?.trim() ? aliased.helpText : def.helpText,
            minCm: aliased.minCm ?? def.minCm,
            maxCm: aliased.maxCm ?? def.maxCm,
            sortOrder: i,
          },
        });
        byKey.delete(alias);
        byKey.set(def.key, row);
        break;
      }
    }

    if (row) {
      await prisma.measurementField.update({
        where: { id: row.id },
        data: {
          label: def.label,
          helpText: row.helpText?.trim() ? row.helpText : def.helpText,
          minCm: row.minCm ?? def.minCm,
          maxCm: row.maxCm ?? def.maxCm,
          sortOrder: i,
        },
      });
      continue;
    }

    const created = await prisma.measurementField.create({
      data: {
        key: def.key,
        label: def.label,
        helpText: def.helpText,
        minCm: def.minCm,
        maxCm: def.maxCm,
        sortOrder: i,
      },
    });
    byKey.set(def.key, created);
  }

  const keep = new Set(CUSTOM_MEASUREMENT_FIELDS.map((f) => f.key));
  const leftover = await prisma.measurementField.findMany();
  for (const extra of leftover) {
    if (keep.has(extra.key)) continue;
    const aliasOf = CUSTOM_MEASUREMENT_FIELDS.find((d) => d.aliases.includes(extra.key));
    if (aliasOf) {
      const canonical = byKey.get(aliasOf.key);
      if (canonical) await retargetProductMeasurements(extra.id, canonical.id);
    }
    await prisma.measurementField.delete({ where: { id: extra.id } });
    byKey.delete(extra.key);
  }
}
