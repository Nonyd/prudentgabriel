import { SettingGroup, SettingType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { clearSettingCacheKey } from "@/lib/settings";
import {
  EMAIL_TEMPLATE_BY_KEY,
  EMAIL_TEMPLATE_CATALOG,
  EMAIL_TEMPLATE_FIELD_SUFFIXES,
  emailSettingKey,
  type EmailTemplateFieldSuffix,
  type EmailTemplateFields,
  type EmailTemplateKey,
} from "@/lib/admin-email-catalog";

export type StoredEmailTemplate = EmailTemplateFields & {
  key: EmailTemplateKey;
  label: string;
  group: "client" | "admin" | "staff";
  lastEdited: string | null;
};

async function upsertSetting(
  key: string,
  value: string,
  label: string,
  sortOrder: number,
  updatedBy: string,
): Promise<void> {
  const existing = await prisma.siteSetting.findUnique({ where: { key } });
  if (existing) {
    await prisma.siteSetting.update({
      where: { key },
      data: { value, updatedBy },
    });
  } else {
    await prisma.siteSetting.create({
      data: {
        key,
        value,
        group: SettingGroup.EMAIL,
        label,
        type: SettingType.TEXT,
        isPublic: false,
        sortOrder,
        updatedBy,
      },
    });
  }
  clearSettingCacheKey(key);
}

export async function getAllEmailTemplates(): Promise<Record<EmailTemplateKey, StoredEmailTemplate>> {
  const prefixKeys = EMAIL_TEMPLATE_CATALOG.flatMap((meta) =>
    EMAIL_TEMPLATE_FIELD_SUFFIXES.map((field) => emailSettingKey(meta.key, field)),
  );

  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: prefixKeys } },
    select: { key: true, value: true, updatedAt: true },
  });

  const byKey = new Map(rows.map((r) => [r.key, r]));
  const out = {} as Record<EmailTemplateKey, StoredEmailTemplate>;

  for (const meta of EMAIL_TEMPLATE_CATALOG) {
    const fields = {} as EmailTemplateFields;
    let lastEdited: Date | null = null;

    for (const suffix of EMAIL_TEMPLATE_FIELD_SUFFIXES) {
      const settingKey = emailSettingKey(meta.key, suffix);
      const row = byKey.get(settingKey);
      const fallback = meta.defaults[suffix];
      fields[suffix] = row?.value ?? fallback;
      if (row?.updatedAt && (!lastEdited || row.updatedAt > lastEdited)) {
        lastEdited = row.updatedAt;
      }
    }

    out[meta.key] = {
      key: meta.key,
      label: meta.label,
      group: meta.group,
      lastEdited: lastEdited?.toISOString() ?? null,
      ...fields,
    };
  }

  return out;
}

export async function getEmailTemplate(key: EmailTemplateKey): Promise<StoredEmailTemplate | null> {
  const meta = EMAIL_TEMPLATE_BY_KEY[key];
  if (!meta) return null;

  const all = await getAllEmailTemplates();
  return all[key] ?? null;
}

export async function patchEmailTemplate(
  key: EmailTemplateKey,
  patch: Partial<EmailTemplateFields>,
  updatedBy: string,
): Promise<StoredEmailTemplate> {
  const meta = EMAIL_TEMPLATE_BY_KEY[key];
  if (!meta) throw new Error("Unknown template key");

  const current = await getEmailTemplate(key);
  const merged: EmailTemplateFields = {
    subject: patch.subject ?? current?.subject ?? meta.defaults.subject,
    heading: patch.heading ?? current?.heading ?? meta.defaults.heading,
    body_1: patch.body_1 ?? current?.body_1 ?? meta.defaults.body_1,
    body_2: patch.body_2 ?? current?.body_2 ?? meta.defaults.body_2,
    cta_label: patch.cta_label ?? current?.cta_label ?? meta.defaults.cta_label,
    cta_link: patch.cta_link ?? current?.cta_link ?? meta.defaults.cta_link,
    footer_note: patch.footer_note ?? current?.footer_note ?? meta.defaults.footer_note,
  };

  for (const suffix of EMAIL_TEMPLATE_FIELD_SUFFIXES) {
    const settingKey = emailSettingKey(key, suffix);
    await upsertSetting(
      settingKey,
      merged[suffix],
      `${meta.label} — ${suffix.replace(/_/g, " ")}`,
      meta.sortOrder,
      updatedBy,
    );
  }

  const saved = await getEmailTemplate(key);
  if (!saved) throw new Error("Failed to load saved template");
  return saved;
}

export async function seedEmailTemplateDefaults(onlyMissing = true): Promise<number> {
  let created = 0;
  for (const meta of EMAIL_TEMPLATE_CATALOG) {
    for (const suffix of EMAIL_TEMPLATE_FIELD_SUFFIXES) {
      const settingKey = emailSettingKey(meta.key, suffix);
      const existing = await prisma.siteSetting.findUnique({ where: { key: settingKey } });
      if (existing && onlyMissing) continue;

      await upsertSetting(
        settingKey,
        meta.defaults[suffix],
        `${meta.label} — ${suffix.replace(/_/g, " ")}`,
        meta.sortOrder,
        "seed",
      );
      if (!existing) created += 1;
    }
  }
  return created;
}
