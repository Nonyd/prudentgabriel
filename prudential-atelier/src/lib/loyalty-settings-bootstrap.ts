import { SettingGroup, SettingType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_EXPIRY_MONTHS, DEFAULT_MIN_REDEMPTION, LOYALTY_ACTIONS, PROGRAMME_DEFAULTS, SETTING_KEYS } from "@/lib/points-value";

const SETTING_DEFS: {
  key: string;
  value: string;
  label: string;
  type: SettingType;
  sortOrder: number;
}[] = [
  {
    key: SETTING_KEYS.rateNGN,
    value: "1",
    label: "Prudent Points — naira value of one point",
    type: SettingType.NUMBER,
    sortOrder: 0,
  },
  {
    key: SETTING_KEYS.minRedemption,
    value: String(DEFAULT_MIN_REDEMPTION),
    label: "Prudent Points — minimum redemption",
    type: SettingType.NUMBER,
    sortOrder: 1,
  },
  {
    key: SETTING_KEYS.expiryMonths,
    value: String(DEFAULT_EXPIRY_MONTHS),
    label: "Prudent Points — months until each award expires",
    type: SettingType.NUMBER,
    sortOrder: 2,
  },
];

const RULE_DEFS: { action: string; points: number; isActive: boolean }[] = [
  { action: LOYALTY_ACTIONS.SIGNUP, points: PROGRAMME_DEFAULTS[LOYALTY_ACTIONS.SIGNUP]!, isActive: true },
  { action: LOYALTY_ACTIONS.PURCHASE_PER_10, points: PROGRAMME_DEFAULTS[LOYALTY_ACTIONS.PURCHASE_PER_10]!, isActive: true },
  {
    action: LOYALTY_ACTIONS.REFERRAL_FIRST_ORDER,
    points: PROGRAMME_DEFAULTS[LOYALTY_ACTIONS.REFERRAL_FIRST_ORDER]!,
    isActive: true,
  },
  { action: LOYALTY_ACTIONS.REVIEW, points: PROGRAMME_DEFAULTS[LOYALTY_ACTIONS.REVIEW]!, isActive: true },
  { action: LOYALTY_ACTIONS.NEWSLETTER, points: PROGRAMME_DEFAULTS[LOYALTY_ACTIONS.NEWSLETTER]!, isActive: true },
  { action: LOYALTY_ACTIONS.BIRTHDAY, points: PROGRAMME_DEFAULTS[LOYALTY_ACTIONS.BIRTHDAY]!, isActive: true },
  { action: LOYALTY_ACTIONS.STYLE_PROFILE, points: PROGRAMME_DEFAULTS[LOYALTY_ACTIONS.STYLE_PROFILE]!, isActive: true },
];

export async function ensureLoyaltySettingKeys(): Promise<void> {
  for (const def of SETTING_DEFS) {
    await prisma.siteSetting.upsert({
      where: { key: def.key },
      create: {
        key: def.key,
        value: def.value,
        group: SettingGroup.LOYALTY,
        label: def.label,
        type: def.type,
        isPublic: false,
        sortOrder: def.sortOrder,
      },
      update: { label: def.label },
    });
  }

  for (const rule of RULE_DEFS) {
    await prisma.loyaltyRule.upsert({
      where: { action: rule.action },
      create: rule,
      update: {},
    });
  }

  await prisma.loyaltyRule.updateMany({
    where: { action: { in: ["SIGNUP_REFERRAL", "PURCHASE_PER_100"] } },
    data: { isActive: false },
  });
}
