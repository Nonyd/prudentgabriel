import { SettingGroup, SettingType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const APPEARANCE_LOGO_SETTING_DEFS: {
  key: string;
  value: string;
  label: string;
  type: SettingType;
  isPublic: boolean;
  sortOrder: number;
}[] = [
  { key: "logo_dark", value: "", label: "Main — Logo (Light theme)", type: SettingType.IMAGE, isPublic: true, sortOrder: 0 },
  { key: "logo_white", value: "", label: "Main — Logo (Dark theme)", type: SettingType.IMAGE, isPublic: true, sortOrder: 1 },
  { key: "logo_atelier_dark", value: "", label: "Atelier — Logo (Light theme)", type: SettingType.IMAGE, isPublic: true, sortOrder: 2 },
  { key: "logo_atelier_white", value: "", label: "Atelier — Logo (Dark theme)", type: SettingType.IMAGE, isPublic: true, sortOrder: 3 },
  { key: "logo_bridal_dark", value: "", label: "Bridal — Logo (Light theme)", type: SettingType.IMAGE, isPublic: true, sortOrder: 4 },
  { key: "logo_bridal_white", value: "", label: "Bridal — Logo (Dark theme)", type: SettingType.IMAGE, isPublic: true, sortOrder: 5 },
  { key: "logo_kids_dark", value: "", label: "Kids — Logo (Light theme)", type: SettingType.IMAGE, isPublic: true, sortOrder: 6 },
  { key: "logo_kids_white", value: "", label: "Kids — Logo (Dark theme)", type: SettingType.IMAGE, isPublic: true, sortOrder: 7 },
  { key: "img_logo_atelier", value: "", label: "Atelier Page — Sub-brand Logo", type: SettingType.IMAGE, isPublic: true, sortOrder: 20 },
  { key: "img_logo_bridal", value: "", label: "Bridal Page — Sub-brand Logo", type: SettingType.IMAGE, isPublic: true, sortOrder: 21 },
  { key: "img_logo_kids", value: "", label: "Kids Page — Sub-brand Logo", type: SettingType.IMAGE, isPublic: true, sortOrder: 22 },
];

/** Idempotent — creates missing APPEARANCE logo SiteSetting rows (safe on every admin load). */
export async function ensureAppearanceLogoSettingKeys(): Promise<void> {
  for (const def of APPEARANCE_LOGO_SETTING_DEFS) {
    await prisma.siteSetting.upsert({
      where: { key: def.key },
      create: {
        key: def.key,
        value: def.value,
        group: SettingGroup.APPEARANCE,
        label: def.label,
        type: def.type,
        isPublic: def.isPublic,
        sortOrder: def.sortOrder,
      },
      update: {},
    });
  }
}
