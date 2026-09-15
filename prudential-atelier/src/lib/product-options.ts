import type { MeasurementFieldDef } from "@/lib/custom-size";
import { skuSizePart } from "@/lib/product-sku";

export const CHOOSE_OPTION_MESSAGE = "Please choose this before adding";

export type PricedOption = {
  id: string;
  label: string;
  priceAdjustmentNGN: number;
  isDefault?: boolean;
  sortOrder?: number;
  skuPart?: string | null;
};

export type ProductOptionGroupView = {
  id: string;
  label: string;
  isRequired: boolean;
  includeInSku: boolean;
  options: PricedOption[];
};

export type OptionMeasurementOverride = {
  optionId: string;
  fields: MeasurementFieldDef[];
};

export function optionAdjustmentNGN(option?: { priceAdjustmentNGN?: number | null } | null): number {
  const n = option?.priceAdjustmentNGN;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

export function cheapestOptionAdjustmentNGN(
  options?: Array<{ priceAdjustmentNGN?: number | null }> | null,
): number {
  if (!options?.length) return 0;
  return Math.min(...options.map((o) => optionAdjustmentNGN(o)));
}

export function pickOption<T extends { id: string }>(options: T[], optionId: string | null | undefined): T | null {
  if (!optionId) return null;
  return options.find((o) => o.id === optionId) ?? null;
}

export function defaultOption<T extends { isDefault?: boolean }>(options: T[]): T | null {
  return options.find((o) => o.isDefault) ?? options[0] ?? null;
}

export function selectedOptionAdjustmentNGN(
  options: Array<{ id: string; priceAdjustmentNGN?: number | null }> | null | undefined,
  optionId: string | null | undefined,
): number {
  if (!options?.length) return 0;
  const chosen = pickOption(options, optionId);
  if (chosen) return optionAdjustmentNGN(chosen);
  return cheapestOptionAdjustmentNGN(options);
}

export function requiresOptionChoice(
  group?: { isRequired?: boolean; options?: unknown[] } | null,
): boolean {
  return Boolean(group?.isRequired && (group.options?.length ?? 0) > 0);
}

export function chooseOptionMessage(groupLabel?: string | null): string {
  const label = (groupLabel ?? "").trim();
  if (!label) return CHOOSE_OPTION_MESSAGE;
  return `Please choose ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
}

export function chooseOptionCta(groupLabel?: string | null): string {
  const label = (groupLabel ?? "an option").trim() || "an option";
  return `Choose ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
}

export function skuOptionPart(label: string, explicit?: string | null): string {
  const fromExplicit = explicit?.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase();
  if (fromExplicit) return fromExplicit;
  return skuSizePart(label).slice(0, 8);
}

/** Size SKU stays as-is. Option suffix is for the cutting ticket, not a new variant row. */
export function buildWorkroomSku(params: {
  variantSku?: string | null;
  includeInSku?: boolean | null;
  optionLabel?: string | null;
  skuPart?: string | null;
}): string | null {
  const base = params.variantSku?.trim() || null;
  if (!base) return null;
  if (!params.includeInSku || !params.optionLabel?.trim()) return base;
  return `${base}-${skuOptionPart(params.optionLabel, params.skuPart)}`;
}

/** "Allure suit — skirt, size 12" */
export function formatGarmentChoice(params: {
  name: string;
  optionLabel?: string | null;
  size?: string | null;
  custom?: boolean;
}): string {
  const bits: string[] = [];
  if (params.optionLabel?.trim()) bits.push(params.optionLabel.trim());
  if (params.custom) bits.push("Made to your measurements");
  else if (params.size?.trim()) bits.push(`size ${params.size.trim()}`);
  if (!bits.length) return params.name;
  return `${params.name} — ${bits.join(", ")}`;
}

export function formatChoiceShort(params: {
  optionLabel?: string | null;
  size?: string | null;
  custom?: boolean;
}): string {
  const bits: string[] = [];
  if (params.optionLabel?.trim()) bits.push(params.optionLabel.trim());
  if (params.custom) bits.push("Custom");
  else if (params.size?.trim()) bits.push(params.size.trim());
  return bits.join(", ") || "—";
}

export function fieldsForOption(
  productFields: MeasurementFieldDef[],
  overrides: OptionMeasurementOverride[] | undefined,
  optionId: string | null | undefined,
): MeasurementFieldDef[] {
  if (!optionId || !overrides?.length) return productFields;
  const hit = overrides.find((o) => o.optionId === optionId);
  if (hit && hit.fields.length > 0) return hit.fields;
  return productFields;
}

export type ResolvedProductOption = {
  optionId: string;
  label: string;
  priceAdjustmentNGN: number;
  skuPart: string | null;
  includeInSku: boolean;
  groupLabel: string;
};

export function assertChosenOption(params: {
  group?: {
    isRequired: boolean;
    includeInSku: boolean;
    label: string;
    options: Array<{
      id: string;
      label: string;
      priceAdjustmentNGN: number;
      isDefault: boolean;
      skuPart?: string | null;
    }>;
  } | null;
  optionId?: string | null;
}): { ok: true; chosen: ResolvedProductOption | null } | { ok: false; error: string } {
  const group = params.group;
  if (!group || group.options.length === 0) {
    if (params.optionId) return { ok: false, error: "This piece has no such choice" };
    return { ok: true, chosen: null };
  }
  const chosen = pickOption(group.options, params.optionId);
  if (chosen) {
    return {
      ok: true,
      chosen: {
        optionId: chosen.id,
        label: chosen.label,
        priceAdjustmentNGN: optionAdjustmentNGN(chosen),
        skuPart: chosen.skuPart ?? null,
        includeInSku: group.includeInSku,
        groupLabel: group.label,
      },
    };
  }
  if (group.isRequired) {
    return { ok: false, error: chooseOptionMessage(group.label) };
  }
  const fallback = defaultOption(group.options);
  if (!fallback) return { ok: true, chosen: null };
  return {
    ok: true,
    chosen: {
      optionId: fallback.id,
      label: fallback.label,
      priceAdjustmentNGN: optionAdjustmentNGN(fallback),
      skuPart: fallback.skuPart ?? null,
      includeInSku: group.includeInSku,
      groupLabel: group.label,
    },
  };
}
