import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCustomGlobals } from "@/lib/custom-settings";
import { profileCmForKey, resolveCustomPolicy, type MeasurementFieldDef } from "@/lib/custom-size";

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

  const previousCm: Record<string, number> = {};
  const session = await auth();
  if (session?.user?.id) {
    const profile = await prisma.clientProfile.findUnique({
      where: { userId: session.user.id },
      include: { measurements: true },
    });
    if (profile?.measurements) {
      for (const f of fields) {
        const cm = profileCmForKey(profile.measurements, f.key);
        if (cm != null) previousCm[f.key] = cm;
      }
    }
  }

  return { policy, fields, previousCm };
}
