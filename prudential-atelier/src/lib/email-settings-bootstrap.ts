import { SettingGroup, SettingType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const RESEND_WEBHOOK_SECRET_KEY = "resend_webhook_secret";

/** Idempotent — creates missing EMAIL SiteSetting rows (safe on every admin load). */
export async function ensureEmailSettingKeys(): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { key: RESEND_WEBHOOK_SECRET_KEY },
    create: {
      key: RESEND_WEBHOOK_SECRET_KEY,
      value: "",
      group: SettingGroup.EMAIL,
      label: "Resend webhook signing secret (whsec_…)",
      type: SettingType.PASSWORD,
      isPublic: false,
      sortOrder: 8,
    },
    update: {},
  });
}
