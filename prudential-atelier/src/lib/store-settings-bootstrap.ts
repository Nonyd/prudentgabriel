import { SettingGroup, SettingType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureCustomSettingKeys } from "@/lib/custom-settings";

const STORE_SETTING_DEFS: {
  key: string;
  value: string;
  label: string;
  type: SettingType;
  isPublic: boolean;
  sortOrder: number;
}[] = [
  {
    key: "bespoke_from_markup",
    value: "1.3",
    label: "Bespoke “from” markup (× cheapest RTW ₦)",
    type: SettingType.NUMBER,
    isPublic: false,
    sortOrder: 10,
  },
];

/** Idempotent — creates missing STORE SiteSetting rows (safe on every admin load). */
export async function ensureStoreSettingKeys(): Promise<void> {
  for (const def of STORE_SETTING_DEFS) {
    await prisma.siteSetting.upsert({
      where: { key: def.key },
      create: {
        key: def.key,
        value: def.value,
        group: SettingGroup.STORE,
        label: def.label,
        type: def.type,
        isPublic: def.isPublic,
        sortOrder: def.sortOrder,
      },
      update: {},
    });
  }
  await ensureCustomSettingKeys();
}
