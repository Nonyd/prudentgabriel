import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  CUSTOM_CART_SIZE,
  customSurchargeNGN,
  resolveCustomPolicy,
  standardVariants,
  validateCustomMeasurements,
  type MeasurementSnapshotEntry,
  type TypedMeasurement,
} from "@/lib/custom-size";
import { getCustomGlobals } from "@/lib/custom-settings";
import { effectiveUnitNGN, overrideOrConvertWithOption, resolveCurrencyOverride } from "@/lib/pricing";
import { gbpOverrideOrConvert, ratesFromLockedFx, usdOverrideOrConvert, type LockedFx } from "@/lib/fx";
import type { CartParcelLine } from "@/lib/shipping/options";
import { fieldsForOption, assertChosenOption } from "@/lib/product-options";
import { assertCustomLineAllowed } from "@/lib/custom-availability";

export type CustomResolvedLine = {
  productId: string;
  variantId: string | null;
  quantity: number;
  size: string;
  color?: string;
  colorHex?: string;
  colorId?: string;
  unitPrice: number;
  unitUsd: number;
  unitGbp: number;
  category: string;
  productName: string;
  parcel: CartParcelLine;
  sizeMode: "CUSTOM";
  measurements: MeasurementSnapshotEntry[];
  typedUnit: string;
  surchargeNGN: number;
  customLeadTimeDays: number;
  customReturnable: boolean;
  optionId: string | null;
  optionLabel: string | null;
  optionAdjustmentNGN: number;
};

export async function resolveCustomCheckoutLine(params: {
  productId: string;
  quantity: number;
  measurements: TypedMeasurement[];
  color?: string;
  colorHex?: string;
  colorId?: string;
  optionId?: string | null;
  fx: LockedFx;
}): Promise<{ ok: true; line: CustomResolvedLine } | { ok: false; error: string; status: number }> {
  const product = await prisma.product.findUnique({
    where: { id: params.productId },
    include: {
      measurementFields: { include: { field: true }, orderBy: { sortOrder: "asc" } },
      variants: { orderBy: { priceNGN: "asc" } },
      optionGroup: {
        include: {
          options: {
            orderBy: { sortOrder: "asc" },
            include: { measurementFields: { include: { field: true }, orderBy: { sortOrder: "asc" } } },
          },
        },
      },
    },
  });
  if (!product) {
    return { ok: false, status: 404, error: "Product not found" };
  }
  const allowed = await assertCustomLineAllowed(params.productId);
  if (!allowed.ok) {
    return { ok: false, status: allowed.status, error: allowed.error };
  }
  const chosen = assertChosenOption({
    group: product.optionGroup,
    optionId: params.optionId,
  });
  if (!chosen.ok) {
    return { ok: false, status: 400, error: chosen.error };
  }
  const productFields = product.measurementFields.map((pm) => ({
    key: pm.field.key,
    label: pm.field.label,
    helpText: pm.field.helpText,
    minCm: pm.field.minCm,
    maxCm: pm.field.maxCm,
    required: pm.required,
    sortOrder: pm.sortOrder,
  }));
  const overrides = (product.optionGroup?.options ?? []).map((o) => ({
    optionId: o.id,
    fields: o.measurementFields.map((pm) => ({
      key: pm.field.key,
      label: pm.field.label,
      helpText: pm.field.helpText,
      minCm: pm.field.minCm,
      maxCm: pm.field.maxCm,
      required: pm.required,
      sortOrder: pm.sortOrder,
    })),
  }));
  const fields = fieldsForOption(productFields, overrides, chosen.chosen?.optionId ?? null);
  if (!fields.length) {
    return { ok: false, status: 400, error: "No measurements are configured for this piece" };
  }
  const checked = validateCustomMeasurements(fields, params.measurements);
  if (!checked.ok) {
    return { ok: false, status: 400, error: checked.errors[0]?.message ?? "Check your measurements" };
  }
  const globals = await getCustomGlobals();
  const policy = resolveCustomPolicy({ product, globals });
  const pricedPool = standardVariants(product.variants);
  const priced = (pricedPool.length ? pricedPool : product.variants).slice().sort((a, b) => a.priceNGN - b.priceNGN)[0];
  const optionAdj = chosen.chosen?.priceAdjustmentNGN ?? 0;
  const unitBase = priced ? effectiveUnitNGN(priced, product.isOnSale, optionAdj) : product.priceNGN + optionAdj;
  const surcharge = customSurchargeNGN({
    unitNGN: unitBase,
    kind: policy.surchargeKind,
    value: policy.surchargeValue,
  });
  const unit = unitBase + surcharge;
  const overrideUsd = priced ? resolveCurrencyOverride("USD", priced, product) : product.priceUSD;
  const overrideGbp = priced ? resolveCurrencyOverride("GBP", priced, product) : product.priceGBP;
  const rates = ratesFromLockedFx(params.fx);
  return {
    ok: true,
    line: {
      productId: product.id,
      variantId: null,
      quantity: Math.max(1, params.quantity),
      size: CUSTOM_CART_SIZE,
      color: params.color,
      colorHex: params.colorHex,
      colorId: params.colorId,
      unitPrice: unit,
      unitUsd: overrideOrConvertWithOption(unit, "USD", overrideUsd, rates, optionAdj),
      unitGbp: overrideOrConvertWithOption(unit, "GBP", overrideGbp, rates, optionAdj),
      category: product.category,
      productName: product.name,
      parcel: {
        quantity: Math.max(1, params.quantity),
        variant: {},
        product: {
          weightKg: product.defaultWeightKg ?? undefined,
          lengthCm: product.defaultLengthCm ?? undefined,
          widthCm: product.defaultWidthCm ?? undefined,
          heightCm: product.defaultHeightCm ?? undefined,
        },
      },
      sizeMode: "CUSTOM",
      measurements: checked.snapshot,
      typedUnit: checked.snapshot[0]?.typedUnit ?? "cm",
      surchargeNGN: surcharge,
      customLeadTimeDays: policy.leadTimeDays,
      customReturnable: policy.returnable,
      optionId: chosen.chosen?.optionId ?? null,
      optionLabel: chosen.chosen?.label ?? null,
      optionAdjustmentNGN: optionAdj,
    },
  };
}

export async function syncProfileFromSnapshots(
  userId: string,
  snapshots: MeasurementSnapshotEntry[],
): Promise<void> {
  if (!snapshots.length) return;
  const { mergeProfileFromSnapshot } = await import("@/lib/custom-size");
  const profile = await prisma.clientProfile.findUnique({
    where: { userId },
    include: { measurements: true },
  });
  if (!profile) return;
  const merged = mergeProfileFromSnapshot(profile.measurements, snapshots);
  await prisma.measurement.upsert({
    where: { clientId: profile.id },
    create: {
      clientId: profile.id,
      unit: profile.measurements?.unit ?? "inches",
      values: merged.values as Prisma.InputJsonValue,
      ...merged.columns,
    },
    update: {
      values: merged.values as Prisma.InputJsonValue,
      ...merged.columns,
    },
  });
}
