import { SettingGroup, SettingType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_DDU_DISCLOSURE,
  DEFAULT_QUOTE_CONSENT,
  SHIPPING_DDU_KEY,
  SHIPPING_QUOTE_CONSENT_KEY,
  SHIPPING_UNCOLLECTED_DAYS_KEY,
} from "@/lib/shipping/copy";

const SHIPPING_SETTING_DEFS: {
  key: string;
  value: string;
  label: string;
  type: SettingType;
  isPublic: boolean;
  sortOrder: number;
}[] = [
  {
    key: SHIPPING_QUOTE_CONSENT_KEY,
    value: DEFAULT_QUOTE_CONSENT,
    label: "Manual quote — consent wording",
    type: SettingType.TEXTAREA,
    isPublic: true,
    sortOrder: 0,
  },
  {
    key: SHIPPING_DDU_KEY,
    value: DEFAULT_DDU_DISCLOSURE,
    label: "International duties (DDU) disclosure",
    type: SettingType.TEXTAREA,
    isPublic: true,
    sortOrder: 1,
  },
  {
    key: SHIPPING_UNCOLLECTED_DAYS_KEY,
    value: "7",
    label: "Uncollected pickup reminder (days)",
    type: SettingType.NUMBER,
    isPublic: false,
    sortOrder: 2,
  },
  { key: "gig_api_key", value: "", label: "GIG API key", type: SettingType.PASSWORD, isPublic: false, sortOrder: 10 },
  { key: "gig_wallet_id", value: "", label: "GIG wallet ID", type: SettingType.TEXT, isPublic: false, sortOrder: 11 },
  { key: "dhl_site_id", value: "", label: "DHL site ID", type: SettingType.TEXT, isPublic: false, sortOrder: 20 },
  { key: "dhl_password", value: "", label: "DHL password", type: SettingType.PASSWORD, isPublic: false, sortOrder: 21 },
  { key: "dhl_account_number", value: "", label: "DHL account number", type: SettingType.TEXT, isPublic: false, sortOrder: 22 },
];

export async function ensureShippingSettingKeys(): Promise<void> {
  for (const def of SHIPPING_SETTING_DEFS) {
    await prisma.siteSetting.upsert({
      where: { key: def.key },
      create: {
        key: def.key,
        value: def.value,
        group: SettingGroup.SHIPPING,
        label: def.label,
        type: def.type,
        isPublic: def.isPublic,
        sortOrder: def.sortOrder,
      },
      update: {},
    });
  }
}
