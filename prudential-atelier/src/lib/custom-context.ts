import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCustomGlobals } from "@/lib/custom-settings";
import { profileCmForKey, resolveCustomPolicy, type MeasurementFieldDef } from "@/lib/custom-size";
import type { OptionMeasurementOverride } from "@/lib/product-options";

export async function getHouseSizeChart() {
  const chart = await prisma.sizeChart.findFirst({
    where: { isDefault: true },
    include: { rows: { orderBy: { sortOrder: "asc" } } },
  });
  if (chart) return chart;
  return prisma.sizeChart.findFirst({ include: { rows: { orderBy: { sortOrder: "asc" } } } });
}

export async function getProductCustomContext(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      measurementFields: { include: { field: true }, orderBy: { sortOrder: "asc" } },
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
  if (!product) return null;
  const globals = await getCustomGlobals();
  const policy = resolveCustomPolicy({ product, globals });
  const fields: MeasurementFieldDef[] = product.measurementFields.map((pm) => ({
    key: pm.field.key,
    label: pm.field.label,
    helpText: pm.field.helpText,
    minCm: pm.field.minCm,
    maxCm: pm.field.maxCm,
    required: pm.required,
    sortOrder: pm.sortOrder,
  }));

  const optionOverrides: OptionMeasurementOverride[] = (product.optionGroup?.options ?? []).map((o) => ({
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

  const previousCm: Record<string, number> = {};
  const session = await auth();
  if (session?.user?.id) {
    const profile = await prisma.clientProfile.findUnique({
      where: { userId: session.user.id },
      include: { measurements: true },
    });
    if (profile?.measurements) {
      const keys = new Set(fields.map((f) => f.key));
      for (const ov of optionOverrides) {
        for (const f of ov.fields) keys.add(f.key);
      }
      for (const key of Array.from(keys)) {
        const cm = profileCmForKey(profile.measurements, key);
        if (cm != null) previousCm[key] = cm;
      }
    }
  }

  return { policy, fields, previousCm, optionOverrides };
}
