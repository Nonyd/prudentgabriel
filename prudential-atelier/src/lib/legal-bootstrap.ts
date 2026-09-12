import { SettingGroup, SettingType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_LEGAL_UPDATED,
  LEGAL_COPY_REVISION,
  LEGAL_SEED_ENTRIES,
  legalMdToHtml,
} from "@/lib/legal-copy";

const REVISION_KEY = "legal_copy_revision";

/** Writes AR legal drafts when the revision in code is newer than the row in CMS. */
export async function ensureLegalCopy(): Promise<void> {
  if (process.env.SKIP_DB_BUILD === "1") return;

  const current = await prisma.siteSetting.findUnique({
    where: { key: REVISION_KEY },
    select: { value: true },
  });
  if (current?.value === LEGAL_COPY_REVISION) return;

  for (const entry of LEGAL_SEED_ENTRIES) {
    const html = legalMdToHtml(entry.md);
    await prisma.siteSetting.upsert({
      where: { key: entry.key },
      create: {
        key: entry.key,
        value: html,
        group: SettingGroup.CONTENT,
        label: entry.label,
        type: SettingType.TEXTAREA,
        isPublic: true,
        sortOrder: 500,
      },
      update: {
        value: html,
        isPublic: true,
        label: entry.label,
      },
    });
    await prisma.siteSetting.upsert({
      where: { key: entry.updatedKey },
      create: {
        key: entry.updatedKey,
        value: DEFAULT_LEGAL_UPDATED,
        group: SettingGroup.CONTENT,
        label: `${entry.label} last updated`,
        type: SettingType.TEXT,
        isPublic: true,
        sortOrder: 501,
      },
      update: {
        value: DEFAULT_LEGAL_UPDATED,
        isPublic: true,
      },
    });
  }

  await prisma.siteSetting.upsert({
    where: { key: REVISION_KEY },
    create: {
      key: REVISION_KEY,
      value: LEGAL_COPY_REVISION,
      group: SettingGroup.CONTENT,
      label: "Legal copy revision",
      type: SettingType.TEXT,
      isPublic: false,
      sortOrder: 499,
    },
    update: { value: LEGAL_COPY_REVISION },
  });
}
