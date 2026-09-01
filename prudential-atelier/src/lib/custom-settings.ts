import { CustomSurchargeKind, SettingGroup, SettingType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";

export const CUSTOM_SETTING_KEYS = {
  offeredDefault: "custom_offered_default",
  surchargeKind: "custom_surcharge_kind",
  surchargeValue: "custom_surcharge_value",
  leadTimeDays: "custom_lead_time_days",
  returnable: "custom_returnable_default",
} as const;

export type CustomGlobals = {
  offeredDefault: boolean;
  surchargeKind: CustomSurchargeKind;
  surchargeValue: number;
  leadTimeDays: number;
  returnable: boolean;
};

const DEFS: {
  key: string;
  value: string;
  label: string;
  type: SettingType;
  sortOrder: number;
}[] = [
  {
    key: CUSTOM_SETTING_KEYS.offeredDefault,
    value: "false",
    label: "Custom measurements — offered by default on new products",
    type: SettingType.BOOLEAN,
    sortOrder: 20,
  },
  {
    key: CUSTOM_SETTING_KEYS.surchargeKind,
    value: "NONE",
    label: "Custom measurements — surcharge (NONE, PERCENT, or FLAT)",
    type: SettingType.TEXT,
    sortOrder: 21,
  },
  {
    key: CUSTOM_SETTING_KEYS.surchargeValue,
    value: "0",
    label: "Custom measurements — surcharge amount (% or ₦)",
    type: SettingType.NUMBER,
    sortOrder: 22,
  },
  {
    key: CUSTOM_SETTING_KEYS.leadTimeDays,
    value: "21",
    label: "Custom measurements — lead time in days",
    type: SettingType.NUMBER,
    sortOrder: 23,
  },
  {
    key: CUSTOM_SETTING_KEYS.returnable,
    value: "false",
    label: "Custom measurements — returnable (recommend off)",
    type: SettingType.BOOLEAN,
    sortOrder: 24,
  },
];

export async function ensureCustomSettingKeys(): Promise<void> {
  for (const def of DEFS) {
    await prisma.siteSetting.upsert({
      where: { key: def.key },
      create: {
        key: def.key,
        value: def.value,
        group: SettingGroup.STORE,
        label: def.label,
        type: def.type,
        isPublic: false,
        sortOrder: def.sortOrder,
      },
      update: { label: def.label },
    });
  }
  await ensureDefaultFieldsOnCustomProducts();
}

/** WooCommerce “Custom” SKUs were flagged offered; they still need a field set. */
async function ensureDefaultFieldsOnCustomProducts(): Promise<void> {
  const keys = ["bust", "waist", "hip", "total_length"] as const;
  const fields = await prisma.measurementField.findMany({
    where: { key: { in: [...keys] } },
    orderBy: { sortOrder: "asc" },
  });
  if (fields.length < keys.length) return;
  const products = await prisma.product.findMany({
    where: { customOffered: true, measurementFields: { none: {} } },
    select: { id: true },
  });
  for (const p of products) {
    await prisma.productMeasurement.createMany({
      data: fields.map((f, i) => ({
        productId: p.id,
        fieldId: f.id,
        required: true,
        sortOrder: i,
      })),
    });
  }
}

function parseKind(raw: string | null): CustomSurchargeKind {
  if (raw === "PERCENT" || raw === "FLAT" || raw === "NONE") return raw;
  return CustomSurchargeKind.NONE;
}

export async function getCustomGlobals(): Promise<CustomGlobals> {
  const [offered, kind, value, days, ret] = await Promise.all([
    getSetting(CUSTOM_SETTING_KEYS.offeredDefault),
    getSetting(CUSTOM_SETTING_KEYS.surchargeKind),
    getSetting(CUSTOM_SETTING_KEYS.surchargeValue),
    getSetting(CUSTOM_SETTING_KEYS.leadTimeDays),
    getSetting(CUSTOM_SETTING_KEYS.returnable),
  ]);
  const lead = Number(days);
  const surcharge = Number(value);
  return {
    offeredDefault: offered === "true",
    surchargeKind: parseKind(kind),
    surchargeValue: Number.isFinite(surcharge) ? surcharge : 0,
    leadTimeDays: Number.isFinite(lead) && lead > 0 ? Math.round(lead) : 21,
    returnable: ret === "true",
  };
}
