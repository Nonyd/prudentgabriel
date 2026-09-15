import type { Prisma } from "@prisma/client";
import { skuOptionPart } from "@/lib/product-options";

export type OptionGroupInput = {
  id?: string;
  label: string;
  isRequired: boolean;
  includeInSku: boolean;
  sortOrder?: number;
  options: Array<{
    id?: string;
    label: string;
    priceAdjustmentNGN: number;
    isDefault: boolean;
    sortOrder?: number;
    skuPart?: string | null;
    measurementFieldIds?: Array<{
      fieldId: string;
      required: boolean;
      sortOrder?: number;
    }>;
  }>;
} | null | undefined;

export async function syncProductOptionGroup(
  tx: Prisma.TransactionClient,
  productId: string,
  group: OptionGroupInput,
): Promise<void> {
  const existing = await tx.productOptionGroup.findUnique({
    where: { productId },
    include: { options: { select: { id: true } } },
  });

  if (!group || group.options.length === 0) {
    if (existing) {
      await tx.productOptionGroup.delete({ where: { id: existing.id } });
    }
    return;
  }

  const label = group.label.trim() || "Choice";
  const savedGroup = existing
    ? await tx.productOptionGroup.update({
        where: { id: existing.id },
        data: {
          label,
          isRequired: group.isRequired,
          includeInSku: group.includeInSku,
          sortOrder: group.sortOrder ?? 0,
        },
      })
    : await tx.productOptionGroup.create({
        data: {
          productId,
          label,
          isRequired: group.isRequired,
          includeInSku: group.includeInSku,
          sortOrder: group.sortOrder ?? 0,
        },
      });

  const keepIds = group.options.map((o) => o.id).filter((id): id is string => Boolean(id));
  const orphans = existing?.options.filter((o) => !keepIds.includes(o.id)) ?? [];
  for (const o of orphans) {
    await tx.productOption.delete({ where: { id: o.id } });
  }

  const defaultIndex = (() => {
    const idx = group.options.findIndex((o) => o.isDefault);
    return idx >= 0 ? idx : 0;
  })();
  const existingIds = new Set(existing?.options.map((o) => o.id) ?? []);
  for (let i = 0; i < group.options.length; i++) {
    const o = group.options[i]!;
    const isDefault = i === defaultIndex;
    const skuPart = skuOptionPart(o.label, o.skuPart);
    const data = {
      label: o.label.trim(),
      priceAdjustmentNGN: o.priceAdjustmentNGN,
      isDefault,
      sortOrder: o.sortOrder ?? i,
      skuPart,
    };
    const option =
      o.id && existingIds.has(o.id)
        ? await tx.productOption.update({ where: { id: o.id }, data })
        : await tx.productOption.create({ data: { ...data, groupId: savedGroup.id } });

    await tx.productOptionMeasurement.deleteMany({ where: { optionId: option.id } });
    const ticks = o.measurementFieldIds ?? [];
    for (let j = 0; j < ticks.length; j++) {
      const mf = ticks[j]!;
      await tx.productOptionMeasurement.create({
        data: {
          optionId: option.id,
          fieldId: mf.fieldId,
          required: mf.required,
          sortOrder: mf.sortOrder ?? j,
        },
      });
    }
  }
}
